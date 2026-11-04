import os
import json
import time
import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Callable
from sqlalchemy.orm import Session
from ..config import settings, PROCESSED_DIR, STORAGE_DIR
from ..models import LectureSession, BiometricEnrollment, Student
from .cv_engine import cv_engine
from .tracker import CentroidIoUTracker
from .attendance_engine import attendance_engine

class VideoProcessingService:
    """
    SYNAPSE Asynchronous CCTV Video Processing Pipeline.
    Processes uploaded footage, performs frame sampling, person & face detection,
    multi-object tracking, biometric matching, and generates an annotated output video.
    """

    def _draw_hud_and_box(
        self,
        frame: np.ndarray,
        bbox: List[int],
        label: str,
        confidence_str: str,
        color: tuple, # BGR
        track_id: int
    ):
        x, y, w, h = bbox
        # Draw bounding rectangle
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
        
        # Corner accents for futuristic/cyberpunk look
        c_len = min(15, w // 4, h // 4)
        # Top-left
        cv2.line(frame, (x, y), (x + c_len, y), color, 4)
        cv2.line(frame, (x, y), (x, y + c_len), color, 4)
        # Top-right
        cv2.line(frame, (x + w, y), (x + w - c_len, y), color, 4)
        cv2.line(frame, (x + w, y), (x + w, y + c_len), color, 4)
        # Bottom-left
        cv2.line(frame, (x, y + h), (x + c_len, y + h), color, 4)
        cv2.line(frame, (x, y + h), (x, y + h - c_len), color, 4)
        # Bottom-right
        cv2.line(frame, (x + w, y + h), (x + w - c_len, y + h), color, 4)
        cv2.line(frame, (x + w, y + h), (x + w, y + h - c_len), color, 4)

        # Label badge background
        tag_text = f"#{track_id} {label} {confidence_str}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.45
        thickness = 1
        (tw, th), _ = cv2.getTextSize(tag_text, font, font_scale, thickness)
        
        tag_y = max(y - 8, th + 8)
        cv2.rectangle(frame, (x, tag_y - th - 6), (x + tw + 10, tag_y + 4), (16, 16, 16), -1)
        cv2.rectangle(frame, (x, tag_y - th - 6), (x + tw + 10, tag_y + 4), color, 1)
        cv2.putText(frame, tag_text, (x + 5, tag_y - 2), font, font_scale, color, thickness, cv2.LINE_AA)

    def process_video_file(
        self,
        db: Session,
        session_id: int,
        input_video_path: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Dict[str, Any]:
        """
        Executes end-to-end video analysis on a session video file.
        """
        session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
        if not session:
            return {"error": "Session not found"}

        session.status = "PROCESSING"
        db.commit()

        # Load enrolled biometric profiles
        enrollments = db.query(BiometricEnrollment, Student).join(
            Student, BiometricEnrollment.student_id == Student.id
        ).filter(Student.is_active == True).all()

        enrolled_cache = []
        for enroll, student in enrollments:
            try:
                emb = json.loads(enroll.embedding_data)
                enrolled_cache.append({
                    "student_id": student.id,
                    "full_name": student.full_name,
                    "usn": student.usn,
                    "embedding": emb
                })
            except Exception as e:
                print(f"Error parsing embedding for student {student.id}: {e}")

        cap = cv2.VideoCapture(input_video_path)
        if not cap.isOpened():
            session.status = "CANCELLED"
            db.commit()
            return {"error": f"Could not open video file {input_video_path}"}

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        orig_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        session.total_frames = total_frames
        db.commit()

        output_filename = f"annotated_session_{session_id}_{int(time.time())}.mp4"
        output_path = str(PROCESSED_DIR / output_filename)
        
        # Use mp4v or avc1
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, orig_fps / settings.FRAME_SAMPLE_RATE, (width, height))

        tracker = CentroidIoUTracker(max_disappeared=15, iou_threshold=0.25)
        
        # In-memory tracking of unique identities
        recognized_student_ids = set()
        total_detections_count = 0
        current_frame_idx = 0
        start_time = time.time()

        sample_rate = max(1, settings.FRAME_SAMPLE_RATE)
        
        # Color palettes in BGR:
        # Hot Pink: (139, 22, 255)
        COLOR_PINK = (139, 22, 255)
        # Electric Yellow: (0, 255, 239)
        COLOR_YELLOW = (0, 255, 239)
        # Unknown Gray: (120, 120, 120)
        COLOR_GRAY = (120, 120, 120)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            current_frame_idx += 1
            if current_frame_idx % sample_rate != 0:
                continue

            video_time_sec = current_frame_idx / orig_fps

            # Face detection & extraction
            detections = cv_engine.extract_face_embeddings(frame)
            total_detections_count += len(detections)

            rects = [d["bbox"] for d in detections]
            active_tracks = tracker.update(rects)

            # Match detections with tracks & enrolled identities
            for det in detections:
                bbox = det["bbox"]
                emb = det["embedding"]
                
                # Find matching track
                best_track_id = None
                for track in active_tracks:
                    tb = track["bbox"]
                    # If center of bbox is near track
                    if abs(bbox[0] - tb[0]) < 30 and abs(bbox[1] - tb[1]) < 30:
                        best_track_id = track["track_id"]
                        break
                
                if best_track_id is None:
                    continue

                existing_id = tracker.get_identity(best_track_id)
                if not existing_id:
                    # Match against enrolled students
                    match_res = cv_engine.match_face(emb, enrolled_cache)
                    if match_res["matched"] and match_res["status"] == "HIGH":
                        student_id = match_res["student_id"]
                        tracker.assign_identity(
                            best_track_id,
                            student_id,
                            match_res["student_name"],
                            match_res["confidence"]
                        )
                        recognized_student_ids.add(student_id)
                        
                        # Process in attendance engine
                        attendance_engine.process_detection_evidence(
                            db=db,
                            session_id=session_id,
                            student_id=student_id,
                            confidence=match_res["confidence"],
                            timestamp_sec=video_time_sec,
                            track_id=best_track_id,
                            frame_number=current_frame_idx,
                            bbox=bbox
                        )
                    elif match_res["status"] == "MEDIUM" and match_res.get("candidate_student_id"):
                        # Save snapshot for verification queue
                        snap_name = f"verify_sess{session_id}_track{best_track_id}_{current_frame_idx}.jpg"
                        snap_path = str(PROCESSED_DIR / snap_name)
                        cv2.imwrite(snap_path, frame)
                        
                        attendance_engine.queue_for_verification(
                            db=db,
                            session_id=session_id,
                            candidate_student_id=match_res["candidate_student_id"],
                            confidence=match_res["confidence"],
                            track_id=best_track_id,
                            frame_snapshot_path=f"/storage/processed/{snap_name}"
                        )

            # Draw HUD & bounding boxes on output frame
            for track in active_tracks:
                tb = track["bbox"]
                tid = track["track_id"]
                ident = track.get("identity")

                if ident:
                    label = ident["student_name"]
                    conf_str = f"({int(ident['confidence'] * 100)}%)"
                    color = COLOR_YELLOW
                else:
                    label = "STUDENT"
                    conf_str = "[TRACKING]"
                    color = COLOR_PINK

                self._draw_hud_and_box(frame, tb, label, conf_str, color, tid)

            # Top HUD banner overlay
            hud_bg_h = 42
            cv2.rectangle(frame, (0, 0), (width, hud_bg_h), (8, 8, 8), -1)
            cv2.line(frame, (0, hud_bg_h), (width, hud_bg_h), COLOR_PINK, 1)
            
            elapsed = time.time() - start_time
            fps_proc = round(current_frame_idx / max(0.1, elapsed), 1)
            hud_text = (
                f"SYNAPSE AI ENGINE | FRAME: {current_frame_idx}/{total_frames} | "
                f"FPS: {fps_proc} | DETECTED: {len(active_tracks)} | "
                f"RECOGNIZED: {len(recognized_student_ids)}"
            )
            cv2.putText(frame, hud_text, (18, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 1, cv2.LINE_AA)

            out.write(frame)

            # Emit progress update periodically
            if current_frame_idx % (sample_rate * 4) == 0 or current_frame_idx >= total_frames:
                pct = round((current_frame_idx / total_frames) * 100.0, 1)
                if progress_callback:
                    progress_callback({
                        "session_id": session_id,
                        "frame": current_frame_idx,
                        "total_frames": total_frames,
                        "progress_pct": pct,
                        "fps": fps_proc,
                        "detected_count": len(active_tracks),
                        "recognized_count": len(recognized_student_ids)
                    })

        cap.release()
        out.release()

        # Update session records
        session.annotated_video_path = f"/storage/processed/{output_filename}"
        session.total_detected = total_detections_count
        session.total_unique_tracks = tracker.next_track_id - 1
        session.total_recognized = len(recognized_student_ids)
        db.commit()

        # Finalize attendance and mark absent students automatically
        summary = attendance_engine.finalize_lecture_attendance(db, session_id)

        return {
            "session_id": session_id,
            "status": "COMPLETED",
            "annotated_video": session.annotated_video_path,
            "total_frames": total_frames,
            "total_detected": total_detections_count,
            "total_unique_tracks": session.total_unique_tracks,
            "total_recognized": len(recognized_student_ids),
            "attendance_summary": summary
        }

video_processor = VideoProcessingService()

