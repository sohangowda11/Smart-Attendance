import os
import cv2
import json
import time
import base64
import threading
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from ..config import settings
from ..database import SessionLocal
from ..models import Camera, CameraHealthLog, BiometricEnrollment, Student, LectureSession
from .cv_engine import cv_engine
from .tracker import CentroidIoUTracker
from .attendance_engine import attendance_engine

class CameraStreamWorker(threading.Thread):
    def __init__(self, camera_id: int, stream_url: str, stream_type: str):
        super().__init__(daemon=True)
        self.camera_id = camera_id
        self.stream_url = stream_url
        self.stream_type = stream_type
        self.running = False
        self.latest_jpeg: Optional[bytes] = None
        self.latest_stats: Dict[str, Any] = {
            "camera_id": camera_id,
            "status": "CONNECTING",
            "detected_count": 0,
            "tracked_count": 0,
            "recognized_count": 0,
            "fps": 0.0,
            "timestamp": time.time()
        }
        self.tracker = CentroidIoUTracker(max_disappeared=15, iou_threshold=0.25)
        self.lock = threading.Lock()

    def run(self):
        self.running = True
        # If webcam string like "0", parse to int
        cap_target = self.stream_url
        if self.stream_type == "WEBCAM" and cap_target.isdigit():
            cap_target = int(cap_target)

        # Open video capture
        cap = cv2.VideoCapture(cap_target)
        
        # If simulated camera and stream file not found, we can generate a test pattern
        reconnect_attempts = 0
        frame_counter = 0
        start_time = time.time()
        
        # Load biometric profiles cache
        enrolled_cache = []
        try:
            db: Session = SessionLocal()
            enrollments = db.query(BiometricEnrollment, Student).join(
                Student, BiometricEnrollment.student_id == Student.id
            ).filter(Student.is_active == True).all()
            for enroll, student in enrollments:
                emb = json.loads(enroll.embedding_data)
                enrolled_cache.append({
                    "student_id": student.id,
                    "full_name": student.full_name,
                    "usn": student.usn,
                    "embedding": emb
                })
            db.close()
        except Exception as e:
            print(f"Error loading biometric cache in camera worker: {e}")

        # Active lecture session for this camera's classroom if any
        current_session_id = None

        COLOR_PINK = (139, 22, 255)
        COLOR_YELLOW = (0, 255, 239)

        while self.running:
            if not cap.isOpened():
                self.latest_stats["status"] = "RECONNECTING"
                time.sleep(2.0)
                cap = cv2.VideoCapture(cap_target)
                continue

            ret, frame = cap.read()
            if not ret:
                # If looped simulated video, rewind
                if self.stream_type in ["SIMULATED", "VIDEO"]:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    time.sleep(0.04)
                    continue
                else:
                    self.latest_stats["status"] = "OFFLINE"
                    time.sleep(1.0)
                    continue

            frame_counter += 1
            h, w = frame.shape[:2]
            
            # Process AI every 3rd frame
            if frame_counter % 3 == 0:
                detections = cv_engine.extract_face_embeddings(frame)
                rects = [d["bbox"] for d in detections]
                active_tracks = self.tracker.update(rects)

                recognized_count = 0
                for det in detections:
                    bbox = det["bbox"]
                    emb = det["embedding"]
                    # find matching track
                    best_track_id = None
                    for t in active_tracks:
                        tb = t["bbox"]
                        if abs(bbox[0] - tb[0]) < 30 and abs(bbox[1] - tb[1]) < 30:
                            best_track_id = t["track_id"]
                            break

                    if best_track_id:
                        existing_id = self.tracker.get_identity(best_track_id)
                        if not existing_id:
                            match_res = cv_engine.match_face(emb, enrolled_cache)
                            if match_res["matched"] and match_res["status"] == "HIGH":
                                self.tracker.assign_identity(
                                    best_track_id,
                                    match_res["student_id"],
                                    match_res["student_name"],
                                    match_res["confidence"]
                                )
                                recognized_count += 1
                        else:
                            recognized_count += 1

                # Draw overlays
                for track in active_tracks:
                    tb = track["bbox"]
                    tid = track["track_id"]
                    ident = track.get("identity")
                    x, y, bw, bh = tb
                    
                    if ident:
                        color = COLOR_YELLOW
                        label = f"#{tid} {ident['student_name']} ({int(ident['confidence']*100)}%)"
                    else:
                        color = COLOR_PINK
                        label = f"#{tid} TRACKING..."

                    cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2)
                    cv2.putText(frame, label, (x, max(20, y - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)

                fps_val = round(frame_counter / max(0.1, (time.time() - start_time)), 1)
                
                # Top HUD
                cv2.rectangle(frame, (0, 0), (w, 32), (8, 8, 8), -1)
                hud_msg = f"LIVE STREAM: CAM-{self.camera_id} | FPS: {fps_val} | TRACKS: {len(active_tracks)} | RECOGNIZED: {recognized_count}"
                cv2.putText(frame, hud_msg, (12, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

                with self.lock:
                    self.latest_stats = {
                        "camera_id": self.camera_id,
                        "status": "ONLINE",
                        "detected_count": len(detections),
                        "tracked_count": len(active_tracks),
                        "recognized_count": recognized_count,
                        "fps": fps_val,
                        "timestamp": time.time()
                    }

            # Encode frame to JPEG
            ret_enc, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            if ret_enc:
                with self.lock:
                    self.latest_jpeg = buffer.tobytes()

            # Slight sleep to pace live display ~ 25 FPS
            time.sleep(0.04)

        cap.release()

    def stop(self):
        self.running = False


class LiveStreamManager:
    """
    Registry & lifecycle controller for active CCTV camera ingestion pipelines.
    """
    def __init__(self):
        self.workers: Dict[int, CameraStreamWorker] = {}

    def start_camera_feed(self, camera_id: int, stream_url: str, stream_type: str = "SIMULATED") -> bool:
        if camera_id in self.workers and self.workers[camera_id].running:
            return True

        worker = CameraStreamWorker(camera_id, stream_url, stream_type)
        self.workers[camera_id] = worker
        worker.start()
        return True

    def stop_camera_feed(self, camera_id: int):
        if camera_id in self.workers:
            self.workers[camera_id].stop()
            del self.workers[camera_id]

    def get_latest_frame(self, camera_id: int) -> Optional[bytes]:
        worker = self.workers.get(camera_id)
        if worker:
            with worker.lock:
                return worker.latest_jpeg
        return None

    def get_camera_stats(self, camera_id: int) -> Dict[str, Any]:
        worker = self.workers.get(camera_id)
        if worker:
            with worker.lock:
                return worker.latest_stats.copy()
        return {"camera_id": camera_id, "status": "OFFLINE", "fps": 0.0}

live_stream_manager = LiveStreamManager()

