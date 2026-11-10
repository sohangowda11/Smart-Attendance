import os
import json
import time
import math
import shutil
import numpy as np
import cv2
import face_recognition
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

from ..config import ENROLLMENTS_DIR
from ..models import Student, BiometricEnrollment, AuditLog
from .cv_engine import cv_engine
from .biometric_service import biometric_service

class BiometricEnrollmentService:
    """
    SYNAPSE Intelligent Multi-Frame Biometric Enrollment Pipeline.
    
    Provides:
    - Continuous primary face tracking across candidate frames
    - Foreground / Guide proximity weighting to ignore background bystanders
    - Adaptive quality assessment (sharpness, size, illumination, pose)
    - Rejection of low-quality frames without failing entire recording
    - Pairwise identity consistency & outlier rejection via embedding medoid
    - Consolidated consensus 128-d embedding generation (backward-compatible)
    - Representative pose template generation for enhanced angle tolerance
    - User-friendly, non-technical diagnostics and feedback
    """

    def __init__(self):
        self.min_face_size = 45  # minimum bounding box width/height in px
        self.min_laplacian_sharpness = 14.0  # sensible webcam blur cutoff
        self.min_acceptable_frames = 3  # reasonable minimum usable frames
        self.target_frame_count = 8     # ideal selected frames count
        self.max_candidate_frames = 30  # cap on candidate frames to evaluate

    def _assess_frame_quality(
        self,
        bgr_image: np.ndarray,
        face_loc: Tuple[int, int, int, int]
    ) -> Dict[str, Any]:
        """
        Computes sharpness, face size adequacy, and exposure metrics for a face crop.
        face_loc is (top, right, bottom, left)
        """
        top, right, bottom, left = face_loc
        h, w = bgr_image.shape[:2]

        top = max(0, top)
        left = max(0, left)
        bottom = min(h, bottom)
        right = min(w, right)

        face_h = bottom - top
        face_w = right - left

        if face_h < self.min_face_size or face_w < self.min_face_size:
            return {
                "quality_score": 0.1,
                "is_usable": False,
                "reason": "Face too small / far from camera",
                "sharpness": 0.0,
                "face_h": face_h,
                "face_w": face_w,
                "brightness": 128.0
            }

        face_crop = bgr_image[top:bottom, left:right]
        if face_crop.size == 0:
            return {
                "quality_score": 0.0,
                "is_usable": False,
                "reason": "Empty crop",
                "sharpness": 0.0,
                "face_h": 0,
                "face_w": 0,
                "brightness": 128.0
            }

        gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)

        # 1. Sharpness via Laplacian variance
        lap_var = float(cv2.Laplacian(gray_crop, cv2.CV_64F).var())
        is_sharp_enough = lap_var >= self.min_laplacian_sharpness

        # 2. Exposure / Illumination
        mean_brightness = float(np.mean(gray_crop))
        if mean_brightness < 25.0:
            brightness_score = 0.3
            is_lit_enough = False
            light_reason = "Lighting too dark"
        elif mean_brightness > 240.0:
            brightness_score = 0.4
            is_lit_enough = False
            light_reason = "Overexposed / direct glare"
        else:
            # Good exposure range [35..220]
            brightness_score = 1.0 - abs(mean_brightness - 128.0) / 160.0
            brightness_score = max(0.4, min(1.0, brightness_score))
            is_lit_enough = True
            light_reason = "Normal illumination"

        # 3. Size adequacy score (120px+ gets full points)
        size_score = min(1.0, face_h / 140.0)

        # 4. Normalized sharpness score (scaled for webcams where 80+ is crystal clear)
        sharpness_score = min(1.0, lap_var / 100.0)

        composite_quality = (
            0.45 * sharpness_score +
            0.35 * size_score +
            0.20 * brightness_score
        )
        composite_quality = round(float(composite_quality), 4)

        is_usable = is_sharp_enough and is_lit_enough and (face_h >= self.min_face_size)

        return {
            "quality_score": composite_quality,
            "is_usable": is_usable,
            "reason": light_reason if not is_lit_enough else ("Motion blur" if not is_sharp_enough else "Good"),
            "sharpness": round(lap_var, 1),
            "face_h": face_h,
            "face_w": face_w,
            "brightness": round(mean_brightness, 1)
        }

    def _track_primary_face(
        self,
        candidate_frames: List[np.ndarray]
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Processes candidate frames, tracks the primary enrollment subject across time,
        and cleanly filters out background bystanders.
        """
        tracked_records: List[Dict[str, Any]] = []
        stats = {
            "total_frames": len(candidate_frames),
            "frames_with_faces": 0,
            "multiple_face_frames": 0,
            "bystanders_ignored": 0,
            "ambiguous_frames": 0,
        }

        # Track state for primary subject
        last_primary_box: Optional[Tuple[int, int, int, int]] = None  # (top, right, bottom, left)

        for idx, frame in enumerate(candidate_frames):
            h, w = frame.shape[:2]
            frame_center_x = w / 2.0
            frame_center_y = h / 2.0
            max_center_dist = math.hypot(frame_center_x, frame_center_y)

            # Fast downsampled face detection (2x speedup)
            small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            small_rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
            raw_locs_small = face_recognition.face_locations(small_rgb, model="hog")

            if not raw_locs_small:
                # Fallback to full resolution if downsampling missed a smaller face
                full_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                raw_locs = face_recognition.face_locations(full_rgb, model="hog")
            else:
                raw_locs = [(t * 2, r * 2, b * 2, l * 2) for (t, r, b, l) in raw_locs_small]

            if not raw_locs:
                continue

            stats["frames_with_faces"] += 1
            if len(raw_locs) > 1:
                stats["multiple_face_frames"] += 1

            # Score each candidate face in this frame
            candidates = []
            for loc in raw_locs:
                top, right, bottom, left = loc
                face_h = bottom - top
                face_w = right - left
                area = face_h * face_w
                cx = (left + right) / 2.0
                cy = (top + bottom) / 2.0

                # Centrality score (1.0 at center of frame, drops towards edges)
                c_dist = math.hypot(cx - frame_center_x, cy - frame_center_y)
                centrality = max(0.0, 1.0 - (c_dist / max_center_dist))

                # Foreground area score (relative to frame size)
                area_ratio = min(1.0, area / (w * h * 0.15))

                # Track continuity score if we previously established a primary face
                continuity = 0.5
                if last_primary_box is not None:
                    lt, lr, lb, ll = last_primary_box
                    lcx = (ll + lr) / 2.0
                    lcy = (lt + lb) / 2.0
                    track_dist = math.hypot(cx - lcx, cy - lcy)
                    continuity = max(0.0, 1.0 - (track_dist / (w * 0.4)))

                # Composite score: prefer large, central, continuous face
                selection_score = (
                    0.40 * area_ratio +
                    0.35 * centrality +
                    0.25 * continuity
                )

                candidates.append({
                    "loc": loc,
                    "score": selection_score,
                    "area": area,
                    "centrality": centrality,
                    "quality_info": self._assess_frame_quality(frame, loc)
                })

            # Sort descending by selection score
            candidates.sort(key=lambda c: c["score"], reverse=True)
            primary_candidate = candidates[0]

            # If there was a secondary face, note bystander ignored
            if len(candidates) > 1:
                secondary = candidates[1]
                # If secondary face is vastly smaller or farther off-center, ignore cleanly
                if primary_candidate["score"] >= (secondary["score"] + 0.15):
                    stats["bystanders_ignored"] += (len(candidates) - 1)
                else:
                    stats["ambiguous_frames"] += 1

            # Update primary track box
            last_primary_box = primary_candidate["loc"]

            tracked_records.append({
                "frame_idx": idx + 1,
                "frame": frame,
                "loc": primary_candidate["loc"],
                "quality_info": primary_candidate["quality_info"],
                "selection_score": primary_candidate["score"]
            })

        return tracked_records, stats

    def _extract_and_filter_embeddings(
        self,
        tracked_records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Extracts 128-d embeddings for usable primary face crops, computes pairwise
        distances, rejects outliers via medoid clustering, and returns consistent candidates.
        """
        valid_items: List[Dict[str, Any]] = []

        for item in tracked_records:
            quality_info = item["quality_info"]
            if not quality_info["is_usable"]:
                continue

            frame = item["frame"]
            loc = item["loc"]
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Extract 128-d dlib face embedding with landmark alignment
            encs = face_recognition.face_encodings(rgb_frame, known_face_locations=[loc], num_jitters=1)
            if not encs:
                continue

            emb = np.array(encs[0], dtype=np.float64)
            norm = np.linalg.norm(emb)
            if norm == 0 or np.isnan(norm):
                continue
            # Keep raw dlib 128-d vector without L2-normalization, matching reference engine scale

            top, right, bottom, left = loc
            bbox = [left, top, right - left, bottom - top]

            valid_items.append({
                "frame_idx": item["frame_idx"],
                "frame": frame,
                "loc": loc,
                "bbox": bbox,
                "embedding": emb,
                "quality_score": quality_info["quality_score"],
                "sharpness": quality_info["sharpness"],
                "brightness": quality_info["brightness"],
                "selection_score": item["selection_score"]
            })

        if len(valid_items) < 2:
            return valid_items

        # Pairwise distance matrix to find identity medoid
        n = len(valid_items)
        embs = np.array([it["embedding"] for it in valid_items])  # (n, 128)
        
        # Euclidean distance matrix: dist_mat[i, j] = norm(e_i - e_j)
        diff = embs[:, np.newaxis, :] - embs[np.newaxis, :, :]
        dist_mat = np.linalg.norm(diff, axis=-1)

        # Medoid is the index with minimum sum of distances to other candidate frames
        sum_dists = dist_mat.sum(axis=1)
        medoid_idx = int(np.argmin(sum_dists))
        medoid_emb = embs[medoid_idx]

        # Filter out any frame whose distance to medoid > 0.42 (identity outlier)
        consistent_items = []
        for i, it in enumerate(valid_items):
            dist_to_medoid = float(dist_mat[i, medoid_idx])
            it["dist_to_medoid"] = round(dist_to_medoid, 3)
            if dist_to_medoid <= 0.42:
                consistent_items.append(it)

        return consistent_items

    def enroll_student_from_frames(
        self,
        student: Student,
        candidate_frames: List[np.ndarray],
        db: Session,
        current_user_email: str
    ) -> Dict[str, Any]:
        """
        Main entry point for multi-frame biometric enrollment from a set of frames.
        """
        if not candidate_frames:
            raise ValueError("No video frames received from camera. Please ensure camera access is allowed.")

        # Limit to max candidate frames
        if len(candidate_frames) > self.max_candidate_frames:
            step = len(candidate_frames) / float(self.max_candidate_frames)
            sampled_indices = [int(i * step) for i in range(self.max_candidate_frames)]
            candidate_frames = [candidate_frames[i] for i in sampled_indices]

        # 1. Continuous primary face tracking across frames
        tracked_records, track_stats = self._track_primary_face(candidate_frames)

        if not tracked_records:
            raise ValueError(
                "No face detected in the video stream. Please ensure your camera is positioned correctly "
                "and your face is clearly visible inside the guide."
            )

        # 2. Extract embeddings & filter outliers via identity medoid
        consistent_items = self._extract_and_filter_embeddings(tracked_records)

        if len(consistent_items) < self.min_acceptable_frames:
            usable_count = len(consistent_items)
            total_cand = len(candidate_frames)
            if usable_count == 0:
                raise ValueError(
                    "Could not extract clear biometric frames. The camera feed may be too dark or blurry. "
                    "Please face the camera directly in good lighting and try again."
                )
            else:
                raise ValueError(
                    f"Only {usable_count} usable biometric frame(s) captured. "
                    f"Please hold steady inside the guide for the full 5 seconds."
                )

        # 3. Rank consistent items by composite quality (sharpness + size + central illumination)
        # Select the best 5 to 10 frames
        consistent_items.sort(
            key=lambda x: (x["quality_score"] * 0.6 + min(x["sharpness"] / 80.0, 1.0) * 0.4),
            reverse=True
        )
        selected_items = consistent_items[:self.target_frame_count]

        # 4. Generate consolidated consensus 128-d embedding using pure NumPy mean (reference project approach)
        selected_embs = [item["embedding"] for item in selected_items]
        consensus_emb = np.mean(selected_embs, axis=0)

        # 5. Select the best photograph to save as official portrait
        best_item = selected_items[0]
        best_frame = best_item["frame"]

        os.makedirs(ENROLLMENTS_DIR, exist_ok=True)
        filename = f"student_enroll_{student.id}_{student.usn}_multiframe.jpg"
        file_path = ENROLLMENTS_DIR / filename
        cv2.imwrite(str(file_path), best_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])

        rel_path = f"/storage/enrollments/{filename}"
        student.photo_url = rel_path

        # Average quality score of selected frames
        avg_quality = float(np.mean([it["quality_score"] for it in selected_items]))

        # 6. Check for distinct representative pose templates (slight yaw/tilt)
        # Select up to 2 distinct templates whose distance to consensus is in [0.18..0.38]
        representative_templates = []
        for it in selected_items[1:]:
            d = float(np.linalg.norm(it["embedding"] - consensus_emb))
            if 0.16 <= d <= 0.38:
                # Ensure it's not too close to an already selected template
                if not any(np.linalg.norm(it["embedding"] - t["emb"]) < 0.15 for t in representative_templates):
                    representative_templates.append({
                        "emb": it["embedding"],
                        "quality": it["quality_score"],
                        "bbox": it["bbox"]
                    })
                    if len(representative_templates) >= 2:
                        break

        # 7. Persist biometric profile in database
        # Remove any existing enrollment rows for this student
        db.query(BiometricEnrollment).filter(BiometricEnrollment.student_id == student.id).delete()

        # Save Primary Consensus Enrollment
        primary_enrollment = BiometricEnrollment(
            student_id=student.id,
            embedding_data=json.dumps(consensus_emb.tolist()),
            quality_score=round(avg_quality, 4),
            model_version="dlib-face-recognition-multiframe-v3",
            photo_path=rel_path,
            face_bbox=",".join(map(str, best_item["bbox"]))
        )
        db.add(primary_enrollment)

        # Save Representative Pose Templates as supplementary rows
        for idx, tmpl in enumerate(representative_templates):
            t_row = BiometricEnrollment(
                student_id=student.id,
                embedding_data=json.dumps(tmpl["emb"].tolist()),
                quality_score=round(tmpl["quality"], 4),
                model_version=f"dlib-face-recognition-template-v3-{idx+1}",
                photo_path=rel_path,
                face_bbox=",".join(map(str, tmpl["bbox"]))
            )
            db.add(t_row)

        # Audit Log
        db.add(AuditLog(
            user_email=current_user_email,
            action="ADVANCED_BIOMETRIC_ENROLLMENT",
            entity="Student",
            entity_id=str(student.id),
            details=(
                f"Consolidated biometric profile generated for {student.full_name} ({student.usn}): "
                f"{len(selected_items)} frames accepted out of {len(candidate_frames)} candidate frames. "
                f"Average Quality: {avg_quality * 100:.1f}%, Templates: {len(representative_templates) + 1}."
            ),
            ip_address="127.0.0.1"
        ))
        db.commit()
        biometric_service.refresh_cache(db)

        return {
            "status": "SUCCESS",
            "message": "Biometric profile generated and saved successfully.",
            "student_id": student.id,
            "student_name": student.full_name,
            "student_usn": student.usn,
            "total_frames_extracted": len(candidate_frames),
            "tracked_frames": len(tracked_records),
            "accepted_frames": len(selected_items),
            "rejected_frames": max(0, len(candidate_frames) - len(selected_items)),
            "quality_score": round(avg_quality, 4),
            "photo_url": rel_path,
            "templates_generated": len(representative_templates) + 1,
            "stats": {
                "bystanders_ignored": track_stats.get("bystanders_ignored", 0),
                "usable_candidates": len(consistent_items),
                "selected_best_frames": len(selected_items)
            }
        }

biometric_enrollment_service = BiometricEnrollmentService()

