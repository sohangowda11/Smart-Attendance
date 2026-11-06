import os
import json
import time
import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Callable
from sqlalchemy.orm import Session
from ..config import settings, PROCESSED_DIR, STORAGE_DIR, REPORTS_DIR
from ..models import LectureSession, BiometricEnrollment, Student
from .cv_engine import cv_engine
from .person_detector import classroom_person_detector
from .tracker import CentroidIoUTracker
from .attendance_engine import attendance_engine

class VideoProcessingService:
    """
    SYNAPSE Upgraded Asynchronous CCTV Video Processing Pipeline.
    Combines:
    1. Deep Learning Person Detection (YOLOv8) specialized for classroom surveillance
    2. Multi-Object Tracking (ByteTrack) maintaining persistent track IDs across frames
    3. Three-metric classroom counting:
       A) Frame-wise occupancy curve
       B) Unique tracked individuals (persistent MOT IDs)
       C) Peak (max), average, and minimum simultaneous occupancy
    4. Optional Biometric Facial Recognition layer for enrolled students
    5. Branded HUD visualizer overlay using SYNAPSE color palette
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
        ih, iw = frame.shape[:2]
        # Clamp to frame boundaries
        x = max(0, min(x, iw - 1))
        y = max(0, min(y, ih - 1))
        w = max(1, min(w, iw - x))
        h = max(1, min(h, ih - y))

        # Draw main bounding rectangle
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
        
        # Cyberpunk corner brackets
        c_len = max(6, min(16, w // 4, h // 4))
        # Top-left
        cv2.line(frame, (x, y), (x + c_len, y), color, 3)
        cv2.line(frame, (x, y), (x, y + c_len), color, 3)
        # Top-right
        cv2.line(frame, (x + w, y), (x + w - c_len, y), color, 3)
        cv2.line(frame, (x + w, y), (x + w, y + c_len), color, 3)
        # Bottom-left
        cv2.line(frame, (x, y + h), (x + c_len, y + h), color, 3)
        cv2.line(frame, (x, y + h), (x, y + h - c_len), color, 3)
        # Bottom-right
        cv2.line(frame, (x + w, y + h), (x + w - c_len, y + h), color, 3)
        cv2.line(frame, (x + w, y + h), (x + w, y + h - c_len), color, 3)

        # Label badge background in Surface Black (#151515)
        tag_text = f"#{track_id} {label} {confidence_str}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.42
        thickness = 1
        (tw, th), _ = cv2.getTextSize(tag_text, font, font_scale, thickness)
        
        tag_y = max(y - 6, th + 6)
        cv2.rectangle(frame, (x, tag_y - th - 5), (x + tw + 10, tag_y + 4), (16, 16, 16), -1)
        cv2.rectangle(frame, (x, tag_y - th - 5), (x + tw + 10, tag_y + 4), color, 1)
        # Text in pure white or bright accent
        cv2.putText(frame, tag_text, (x + 5, tag_y - 2), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

    def process_video_file(
        self,
        db: Session,
        session_id: int,
        input_video_path: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Dict[str, Any]:
        """
        Executes upgraded end-to-end classroom surveillance video analysis.
        Calculates occupancy metrics, tracking IDs, face recognition, and outputs branded video.
        """
        session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
        if not session:
            return {"error": "Session not found"}

        session.status = "PROCESSING"
        db.commit()

        # Load enrolled biometric profiles for facial recognition layer
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
        
        # Use mp4v codec for broad platform compatibility
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        sample_rate = max(1, settings.FRAME_SAMPLE_RATE)
        out_fps = max(5.0, orig_fps / sample_rate)
        out = cv2.VideoWriter(output_path, fourcc, out_fps, (width, height))

        # Brand colors in BGR:
        # Jet Black: #080808 -> (8, 8, 8)
        # Hot Pink: #FF168B -> (139, 22, 255)
        # Electric Yellow: #EFFF00 -> (0, 255, 239)
        COLOR_PINK = (139, 22, 255)
        COLOR_YELLOW = (0, 255, 239)

        # Counting & Analytics state
        frame_occupancy_timeline = []
        frame_counts = []
        observed_unique_track_ids = set()
        track_identity_map = {} # track_id -> {"student_id": int, "name": str, "conf": float}
        recognized_student_ids = set()
        total_detections_count = 0
        current_frame_idx = 0
        start_time = time.time()

        # Face recognition check throttle (run face recognition every N sampled frames for speed)
        face_recog_interval = 2
        sampled_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            current_frame_idx += 1
            if current_frame_idx % sample_rate != 0:
                continue

            sampled_count += 1
            video_time_sec = round(current_frame_idx / orig_fps, 2)

            # 1. PERSON DETECTION & MULTI-OBJECT TRACKING via YOLOv8 + ByteTrack
            detections = classroom_person_detector.detect_and_track(
                frame=frame,
                conf=0.25,
                persist=True
            )

            current_frame_occupancy = len(detections)
            total_detections_count += current_frame_occupancy
            frame_counts.append(current_frame_occupancy)

            active_track_ids = []
            for det in detections:
                tid = det["track_id"]
                if tid > 0:
                    observed_unique_track_ids.add(tid)
                    active_track_ids.append(tid)

            # Record timeline metric (Frame-wise occupancy)
            frame_occupancy_timeline.append({
                "frame": current_frame_idx,
                "time_sec": video_time_sec,
                "occupancy": current_frame_occupancy,
                "active_tracks": active_track_ids
            })

            # 2. FACE RECOGNITION MATCHING (if enrolled students exist and interval matches)
            if enrolled_cache and sampled_count % face_recog_interval == 0:
                face_detections = cv_engine.extract_face_embeddings(frame)
                for fdet in face_detections:
                    fb = fdet["bbox"]
                    f_emb = fdet["embedding"]

                    # Find overlapping/nearest person track
                    matched_tid = None
                    for det in detections:
                        px, py, pw, ph = det["bbox"]
                        # Check if face box center is inside person box
                        fcx = fb[0] + fb[2] // 2
                        fcy = fb[1] + fb[3] // 2
                        if px <= fcx <= px + pw and py <= fcy <= py + ph:
                            matched_tid = det["track_id"]
                            break

                    if matched_tid and matched_tid not in track_identity_map:
                        match_res = cv_engine.match_face(f_emb, enrolled_cache)
                        if match_res["matched"] and match_res["status"] == "HIGH":
                            student_id = match_res["student_id"]
                            track_identity_map[matched_tid] = {
                                "student_id": student_id,
                                "name": match_res["student_name"],
                                "confidence": match_res["confidence"]
                            }
                            recognized_student_ids.add(student_id)

                            # Record evidence in attendance engine
                            attendance_engine.process_detection_evidence(
                                db=db,
                                session_id=session_id,
                                student_id=student_id,
                                confidence=match_res["confidence"],
                                timestamp_sec=video_time_sec,
                                track_id=matched_tid,
                                frame_number=current_frame_idx,
                                bbox=fb
                            )
                        elif match_res["status"] == "MEDIUM" and match_res.get("candidate_student_id"):
                            snap_name = f"verify_sess{session_id}_track{matched_tid}_{current_frame_idx}.jpg"
                            snap_path = str(PROCESSED_DIR / snap_name)
                            cv2.imwrite(snap_path, frame)
                            attendance_engine.queue_for_verification(
                                db=db,
                                session_id=session_id,
                                candidate_student_id=match_res["candidate_student_id"],
                                confidence=match_res["confidence"],
                                track_id=matched_tid,
                                frame_snapshot_path=f"/storage/processed/{snap_name}"
                            )

            # 3. DRAW SYNAPSE BRANDED HUD & BOUNDING BOXES
            for det in detections:
                bbox = det["bbox"]
                tid = det["track_id"]
                conf = det["confidence"]

                if tid in track_identity_map:
                    ident = track_identity_map[tid]
                    label = ident["name"]
                    conf_str = f"({int(ident['confidence'] * 100)}%)"
                    color = COLOR_YELLOW
                else:
                    label = "STUDENT"
                    conf_str = f"({int(conf * 100)}%)"
                    color = COLOR_PINK

                self._draw_hud_and_box(frame, bbox, label, conf_str, color, tid)

            # Top HUD Telemetry Banner in Jet Black (#080808)
            hud_bg_h = 44
            cv2.rectangle(frame, (0, 0), (width, hud_bg_h), (8, 8, 8), -1)
            cv2.line(frame, (0, hud_bg_h), (width, hud_bg_h), COLOR_PINK, 2)
            
            elapsed = time.time() - start_time
            fps_proc = round(sampled_count / max(0.1, elapsed), 1)
            peak_so_far = max(frame_counts) if frame_counts else 0
            
            hud_text = (
                f"SYNAPSE AI ENGINE | FRAME: {current_frame_idx}/{total_frames} | "
                f"FPS: {fps_proc} | OCCUPANCY: {current_frame_occupancy} | "
                f"UNIQUE TRACKS: {len(observed_unique_track_ids)} | PEAK: {peak_so_far}"
            )
            cv2.putText(frame, hud_text, (18, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1, cv2.LINE_AA)

            out.write(frame)

            # Emit progress update periodically
            if sampled_count % 3 == 0 or current_frame_idx >= total_frames:
                pct = round((current_frame_idx / total_frames) * 100.0, 1)
                if progress_callback:
                    progress_callback({
                        "session_id": session_id,
                        "frame": current_frame_idx,
                        "total_frames": total_frames,
                        "progress_pct": pct,
                        "fps": fps_proc,
                        "detected_count": current_frame_occupancy,
                        "unique_tracks": len(observed_unique_track_ids),
                        "recognized_count": len(recognized_student_ids),
                        "max_occupancy": peak_so_far,
                        "avg_occupancy": round(float(np.mean(frame_counts)), 1) if frame_counts else 0,
                        "status": "PROCESSING"
                    })

        cap.release()
        out.release()

        # Compute comprehensive 3-metric statistics
        max_occ = max(frame_counts) if frame_counts else 0
        min_occ = min(frame_counts) if frame_counts else 0
        avg_occ = round(float(np.mean(frame_counts)), 1) if frame_counts else 0.0
        unique_tracked_count = len(observed_unique_track_ids)

        # Update database session records with true unique and peak metrics (NOT cumulative frame sums)
        session.annotated_video_path = f"/storage/processed/{output_filename}"
        session.total_detected = max_occ
        session.total_unique_tracks = unique_tracked_count
        session.total_recognized = len(recognized_student_ids)
        session.status = "COMPLETED"
        db.commit()

        # Generate automated JSON classroom occupancy report
        report_data = {
            "session_id": session_id,
            "subject_code": session.subject.code if session.subject else "N/A",
            "subject_name": session.subject.name if session.subject else "N/A",
            "classroom": session.classroom.room_number if session.classroom else "LH-101",
            "session_date": str(session.session_date),
            "video_filename": session.video_filename,
            "total_frames_analyzed": total_frames,
            "metrics": {
                "max_occupancy": max_occ,
                "avg_occupancy": avg_occ,
                "min_occupancy": min_occ,
                "unique_tracked_individuals": unique_tracked_count,
                "total_face_identifications": len(recognized_student_ids)
            },
            "timeline": frame_occupancy_timeline[::max(1, len(frame_occupancy_timeline) // 40)], # Sample ~40 points for sleek charts
            "annotated_video": session.annotated_video_path,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        report_file_name = f"classroom_analysis_session_{session_id}.json"
        report_file_path = REPORTS_DIR / report_file_name
        with open(report_file_path, "w") as rf:
            json.dump(report_data, rf, indent=2)

        # Finalize attendance and mark absent students automatically
        summary = attendance_engine.finalize_lecture_attendance(db, session_id)

        return {
            "session_id": session_id,
            "status": "COMPLETED",
            "annotated_video": session.annotated_video_path,
            "report_url": f"/storage/reports/{report_file_name}",
            "total_frames": total_frames,
            "total_detected": total_detections_count,
            "unique_tracks": unique_tracked_count,
            "max_occupancy": max_occ,
            "avg_occupancy": avg_occ,
            "min_occupancy": min_occ,
            "total_recognized": len(recognized_student_ids),
            "frame_occupancy_timeline": report_data["timeline"],
            "attendance_summary": summary
        }

video_processor = VideoProcessingService()
