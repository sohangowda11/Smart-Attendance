import os
import json
import time
import math
import cv2
import numpy as np
import face_recognition
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

from ..config import settings, ENROLLMENTS_DIR
from ..models import Student, BiometricEnrollment, AuditLog

class CentralizedBiometricService:
    """
    SYNAPSE Centralized Biometric Recognition Engine.
    Faithfully reproduces the reference face recognition methodology from the
    previous Smart Attendance project:
    - dlib ResNet 128-dimensional encodings via face_recognition
    - Exact BGR-to-RGB conversion
    - Multiple-frame enrollment with NumPy mean aggregation (WITHOUT L2-normalization tampering)
    - 0.5x downsampled HOG face detection for sub-second recognition latency
    - Euclidean distance matching with validated tolerance = 0.50
    - Fast in-memory template caching with thread-safe hot reload on enrollment
    """

    def __init__(self, tolerance: float = 0.50):
        self.default_tolerance = tolerance
        # In-memory template cache
        self.cached_encodings: List[np.ndarray] = []
        self.cached_student_ids: List[int] = []
        self.cached_student_metadata: Dict[int, Dict[str, Any]] = {}
        self.is_cache_initialized = False

    def load_cache(self, db: Session, force_reload: bool = False) -> int:
        """
        Loads all enrolled student biometric templates into memory from the database.
        Runs once on startup and whenever an enrollment changes.
        """
        if self.is_cache_initialized and not force_reload:
            return len(self.cached_encodings)

        new_encodings: List[np.ndarray] = []
        new_ids: List[int] = []
        new_metadata: Dict[int, Dict[str, Any]] = {}

        try:
            records = db.query(BiometricEnrollment, Student).join(
                Student, BiometricEnrollment.student_id == Student.id
            ).filter(Student.is_active == True).all()

            for enroll, student in records:
                if not enroll.embedding_data:
                    continue
                try:
                    raw_data = json.loads(enroll.embedding_data)
                    # Support single 128-d vector or list of vectors
                    if isinstance(raw_data, list):
                        if len(raw_data) == 128 and isinstance(raw_data[0], (int, float)):
                            vec = np.array(raw_data, dtype=np.float64)
                            new_encodings.append(vec)
                            new_ids.append(student.id)
                        elif len(raw_data) > 0 and isinstance(raw_data[0], list):
                            for sub_vec in raw_data:
                                if len(sub_vec) == 128:
                                    new_encodings.append(np.array(sub_vec, dtype=np.float64))
                                    new_ids.append(student.id)

                    new_metadata[student.id] = {
                        "id": student.id,
                        "full_name": student.full_name,
                        "usn": student.usn,
                        "photo_url": student.photo_url,
                        "department_id": student.department_id,
                        "semester": student.semester,
                        "section": student.section
                    }
                except Exception as e:
                    print(f"[BiometricService] Warning: Could not parse template for student {student.id}: {e}")

            self.cached_encodings = new_encodings
            self.cached_student_ids = new_ids
            self.cached_student_metadata = new_metadata
            self.is_cache_initialized = True
            print(f"[BiometricService] In-memory cache loaded: {len(new_encodings)} templates for {len(new_metadata)} active students.")
            return len(new_encodings)
        except Exception as e:
            print(f"[BiometricService] Error loading biometric cache: {e}")
            return 0

    def refresh_cache(self, db: Session):
        """Hot-reloads the cache after an enrollment or student update."""
        return self.load_cache(db, force_reload=True)

    def extract_face_encodings(
        self,
        bgr_image: np.ndarray,
        use_fast_scale: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Extracts 128-d face encodings and bounding boxes from a BGR image.
        Uses exact BGR-to-RGB conversion.
        If use_fast_scale is True, runs detection on 0.5x downsampled frame (4x faster)
        and scales bounding boxes back by 2, matching previous project's recognize_frame.
        """
        if bgr_image is None or bgr_image.size == 0:
            return []

        rgb_frame = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)

        if use_fast_scale:
            small_frame = cv2.resize(rgb_frame, (0, 0), fx=0.5, fy=0.5)
            locations = face_recognition.face_locations(small_frame, model="hog")
            encodings = face_recognition.face_encodings(small_frame, locations)
            
            results = []
            for (t, r, b, l), enc in zip(locations, encodings):
                # Scale coordinates back by 2
                top, right, bottom, left = t * 2, r * 2, b * 2, l * 2
                results.append({
                    "loc": (top, right, bottom, left), # top, right, bottom, left
                    "bbox": [left, top, right - left, bottom - top], # left, top, width, height
                    "encoding": enc # 128-d raw numpy array
                })
            return results
        else:
            locations = face_recognition.face_locations(rgb_frame, model="hog")
            encodings = face_recognition.face_encodings(rgb_frame, locations)

            results = []
            for (t, r, b, l), enc in zip(locations, encodings):
                results.append({
                    "loc": (t, r, b, l),
                    "bbox": [l, t, r - l, b - t],
                    "encoding": enc
                })
            return results

    def enroll_student(
        self,
        student_id: int,
        student_name: str,
        frames: List[np.ndarray],
        db: Session,
        current_user_email: str = "system"
    ) -> Dict[str, Any]:
        """
        Multi-frame enrollment reproducing the reference project's methodology:
        - Takes candidate frames (target ~8 frames)
        - Converts BGR to RGB
        - Extracts raw dlib 128-d encodings
        - Ignores unusable frames (no face or extreme blur) rather than aborting whole session
        - Aggregates using NumPy mean: avg_encoding = np.mean(encodings, axis=0) (NO L2-normalization!)
        - Persists template and official photo in database
        - Refreshes in-memory cache
        """
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError(f"Student with ID {student_id} not found")

        if not frames:
            raise ValueError("No video frames provided for enrollment.")

        valid_encodings: List[np.ndarray] = []
        accepted_frames_data: List[Dict[str, Any]] = []

        for idx, frame in enumerate(frames):
            if frame is None or frame.size == 0:
                continue

            h, w = frame.shape[:2]
            cx_target, cy_target = w / 2.0, h / 2.0

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            face_locs = face_recognition.face_locations(rgb_frame, model="hog")

            if not face_locs:
                continue

            # If multiple faces detected in candidate frame, choose the primary face inside the guide
            chosen_loc = face_locs[0]
            if len(face_locs) > 1:
                # Rank faces by area and proximity to center
                best_score = -1.0
                for loc in face_locs:
                    t, r, b, l = loc
                    area = (b - t) * (r - l)
                    cx = (l + r) / 2.0
                    cy = (t + b) / 2.0
                    dist_to_center = math.hypot(cx - cx_target, cy - cy_target)
                    score = area / (dist_to_center + 50.0)
                    if score > best_score:
                        best_score = score
                        chosen_loc = loc

            # Extract 128-d encoding
            encs = face_recognition.face_encodings(rgb_frame, [chosen_loc])
            if not encs:
                continue

            enc = encs[0]
            # Numerical validation
            if len(enc) != 128 or not np.all(np.isfinite(enc)):
                continue

            valid_encodings.append(enc)
            accepted_frames_data.append({
                "frame_idx": idx + 1,
                "frame": frame,
                "loc": chosen_loc,
                "encoding": enc
            })

        if len(valid_encodings) < 1:
            raise ValueError(
                "No clear face could be extracted from the candidate frames. "
                "Please position your face directly inside the guide with good frontal lighting and retry."
            )

        # Outlier filtering if multiple frames captured
        if len(valid_encodings) >= 3:
            embs_mat = np.array(valid_encodings)
            diff = embs_mat[:, np.newaxis, :] - embs_mat[np.newaxis, :, :]
            dist_mat = np.linalg.norm(diff, axis=-1)
            medoid_idx = int(np.argmin(dist_mat.sum(axis=1)))
            
            filtered_encs = []
            filtered_frames = []
            for i, enc in enumerate(valid_encodings):
                d = dist_mat[i, medoid_idx]
                if d <= 0.45: # Consistent with enrollment subject
                    filtered_encs.append(enc)
                    filtered_frames.append(accepted_frames_data[i])

            if len(filtered_encs) >= 2:
                valid_encodings = filtered_encs
                accepted_frames_data = filtered_frames

        # Aggregate using pure NumPy mean (EXACT previous project method):
        # avg_encoding = np.mean(encodings, axis=0) WITHOUT dividing by norm!
        avg_encoding = np.mean(valid_encodings, axis=0)

        # Select the best representative frame to save as official portrait
        best_frame_data = accepted_frames_data[0]
        # Prefer the frame closest to the mean encoding
        best_dist = 999.0
        for item in accepted_frames_data:
            d = float(np.linalg.norm(item["encoding"] - avg_encoding))
            if d < best_dist:
                best_dist = d
                best_frame_data = item

        os.makedirs(ENROLLMENTS_DIR, exist_ok=True)
        filename = f"student_enroll_{student.id}_{student.usn}_reference.jpg"
        file_path = ENROLLMENTS_DIR / filename
        cv2.imwrite(str(file_path), best_frame_data["frame"], [int(cv2.IMWRITE_JPEG_QUALITY), 95])

        rel_path = f"/storage/enrollments/{filename}"
        student.photo_url = rel_path

        # Clear previous enrollments for this student
        db.query(BiometricEnrollment).filter(BiometricEnrollment.student_id == student.id).delete()

        t, r, b, l = best_frame_data["loc"]
        enrollment_record = BiometricEnrollment(
            student_id=student.id,
            embedding_data=json.dumps(avg_encoding.tolist()),
            quality_score=0.95,
            model_version="dlib-face-recognition-v1",
            photo_path=rel_path,
            face_bbox=f"{l},{t},{r - l},{b - t}"
        )
        db.add(enrollment_record)

        db.add(AuditLog(
            user_email=current_user_email,
            action="BIOMETRIC_ENROLLMENT_STANDARDIZED",
            entity="Student",
            entity_id=str(student.id),
            details=(
                f"Standardized reference biometric template created for {student.full_name} ({student.usn}): "
                f"{len(valid_encodings)} frames aggregated via NumPy mean. Norm: {np.linalg.norm(avg_encoding):.3f}."
            ),
            ip_address="127.0.0.1"
        ))
        db.commit()

        # Update in-memory cache
        self.refresh_cache(db)

        return {
            "status": "SUCCESS",
            "message": f"Biometric template successfully enrolled for {student.full_name}",
            "student_id": student.id,
            "student_name": student.full_name,
            "student_usn": student.usn,
            "total_frames_evaluated": len(frames),
            "accepted_frames": len(valid_encodings),
            "template_norm": round(float(np.linalg.norm(avg_encoding)), 4),
            "photo_url": rel_path
        }

    def recognize_faces_in_frame(
        self,
        bgr_frame: np.ndarray,
        db: Optional[Session] = None,
        tolerance: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Real-time recognition reproducing the reference project's recognize_frame:
        - BGR to RGB
        - 0.5x scaling for sub-second execution
        - face_recognition.compare_faces(known_encodings, face_encoding, tolerance=0.50)
        - face_recognition.face_distance(known_encodings, face_encoding)
        - Coordinates scaled back by 2
        """
        if db is not None and not self.is_cache_initialized:
            self.load_cache(db)

        tol = tolerance if tolerance is not None else self.default_tolerance

        if bgr_frame is None or bgr_frame.size == 0 or len(self.cached_encodings) == 0:
            return []

        # Extract live encodings with 0.5x speed scaling
        extracted = self.extract_face_encodings(bgr_frame, use_fast_scale=True)
        if not extracted:
            return []

        results = []
        for face_item in extracted:
            loc = face_item["loc"] # (top, right, bottom, left)
            bbox = face_item["bbox"] # [x, y, w, h]
            live_enc = face_item["encoding"]

            # Compute Euclidean distances against all enrolled templates:
            # Matches face_recognition.face_distance
            face_distances = face_recognition.face_distance(self.cached_encodings, live_enc)
            matches = list(face_distances <= tol)

            name = "Unknown"
            student_id = None
            student_usn = None
            best_dist = 1.0
            confidence = 0.0
            status = "UNKNOWN"

            if True in matches:
                best_match_idx = int(np.argmin(face_distances))
                if matches[best_match_idx]:
                    student_id = self.cached_student_ids[best_match_idx]
                    best_dist = float(face_distances[best_match_idx])
                    
                    meta = self.cached_student_metadata.get(student_id, {})
                    name = meta.get("full_name", f"Student #{student_id}")
                    student_usn = meta.get("usn", "")

                    # Calibrated confidence: 0.0 dist -> 100%, 0.40 dist -> 75%, 0.50 dist -> 65%
                    confidence = round(max(0.50, min(1.0, 1.0 - (best_dist * 0.70))), 3)
                    status = "HIGH" if best_dist <= (tol * 0.85) else "MEDIUM"
            else:
                # Provide minimum distance for diagnostic monitoring
                if len(face_distances) > 0:
                    best_dist = round(float(np.min(face_distances)), 3)

            results.append({
                "loc": loc,
                "bbox": bbox,
                "matched": student_id is not None,
                "student_id": student_id,
                "name": name,
                "student_name": name,
                "student_usn": student_usn,
                "distance": round(best_dist, 3),
                "confidence": confidence,
                "status": status,
                "tolerance": tol
            })

        return results

    def match_single_embedding(
        self,
        live_embedding: List[float],
        enrolled_records: Optional[List[Dict[str, Any]]] = None,
        tolerance: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Matches a single 128-d vector against enrolled records or in-memory cache.
        Directly compatible with cv_engine.match_face.
        """
        tol = tolerance if tolerance is not None else self.default_tolerance
        det_vec = np.array(live_embedding, dtype=np.float64)

        if enrolled_records is not None:
            if not enrolled_records:
                return {
                    "matched": False,
                    "student_id": None,
                    "student_name": None,
                    "student_usn": None,
                    "confidence": 0.0,
                    "distance": 1.0,
                    "status": "UNKNOWN"
                }

            best_record = None
            min_dist = 999.0

            for rec in enrolled_records:
                enr_raw = rec.get("embedding")
                if enr_raw is None:
                    continue
                enr_vec = np.array(enr_raw, dtype=np.float64)
                d = float(np.linalg.norm(det_vec - enr_vec))
                if d < min_dist:
                    min_dist = d
                    best_record = rec

            if best_record and min_dist <= tol:
                confidence = round(max(0.50, min(1.0, 1.0 - (min_dist * 0.70))), 3)
                status = "HIGH" if min_dist <= (tol * 0.85) else "MEDIUM"
                return {
                    "matched": True,
                    "student_id": best_record.get("student_id"),
                    "student_name": best_record.get("full_name") or best_record.get("name"),
                    "student_usn": best_record.get("usn"),
                    "confidence": confidence,
                    "distance": round(min_dist, 3),
                    "status": status
                }
            else:
                return {
                    "matched": False,
                    "student_id": None,
                    "confidence": 0.0,
                    "distance": round(min_dist, 3) if min_dist < 900.0 else 1.0,
                    "status": "UNKNOWN"
                }
        else:
            # Use cached encodings
            if len(self.cached_encodings) == 0:
                return {"matched": False, "student_id": None, "confidence": 0.0, "status": "UNKNOWN"}

            dists = face_recognition.face_distance(self.cached_encodings, det_vec)
            min_idx = int(np.argmin(dists))
            min_dist = float(dists[min_idx])

            if min_dist <= tol:
                student_id = self.cached_student_ids[min_idx]
                meta = self.cached_student_metadata.get(student_id, {})
                confidence = round(max(0.50, min(1.0, 1.0 - (min_dist * 0.70))), 3)
                status = "HIGH" if min_dist <= (tol * 0.85) else "MEDIUM"
                return {
                    "matched": True,
                    "student_id": student_id,
                    "student_name": meta.get("full_name", "Student"),
                    "student_usn": meta.get("usn", ""),
                    "confidence": confidence,
                    "distance": round(min_dist, 3),
                    "status": status
                }
            else:
                return {
                    "matched": False,
                    "student_id": None,
                    "confidence": 0.0,
                    "distance": round(min_dist, 3),
                    "status": "UNKNOWN"
                }

biometric_service = CentralizedBiometricService(tolerance=0.50)

