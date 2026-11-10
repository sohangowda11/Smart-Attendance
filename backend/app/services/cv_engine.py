import os
import json
import numpy as np
import cv2
import face_recognition
from typing import List, Tuple, Dict, Any, Optional
from ..config import settings

class ComputerVisionEngine:
    """
    SYNAPSE Computer Vision & Face Biometrics Engine.
    Handles face detection, quality validation, 128-d biometric feature extraction,
    and calibrated cosine/Euclidean distance matching against enrolled students.
    """

    def __init__(self):
        self.tolerance = settings.FACE_RECOGNITION_TOLERANCE
        self.high_conf_thresh = settings.HIGH_CONFIDENCE_THRESHOLD
        self.med_conf_thresh = settings.MEDIUM_CONFIDENCE_THRESHOLD

    def assess_face_quality(self, bgr_image: np.ndarray, face_location: Tuple[int, int, int, int]) -> Tuple[float, bool]:
        """
        Calculates sharpness (Laplacian variance), face resolution, and exposure adequacy of the face crop.
        Returns: (quality_score [0..1], is_acceptable)
        """
        top, right, bottom, left = face_location
        h, w = bgr_image.shape[:2]
        
        # Clamp coordinates
        top = max(0, top)
        left = max(0, left)
        bottom = min(h, bottom)
        right = min(w, right)
        
        face_h = bottom - top
        face_w = right - left
        if face_h < 40 or face_w < 40:
            return 0.15, False

        face_crop = bgr_image[top:bottom, left:right]
        if face_crop.size == 0:
            return 0.1, False

        # Blur analysis via Laplacian variance
        gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        lap_var = float(cv2.Laplacian(gray_crop, cv2.CV_64F).var())
        
        # Brightness / exposure analysis
        mean_brightness = float(np.mean(gray_crop))
        if mean_brightness < 25 or mean_brightness > 240:
            brightness_score = 0.4
        else:
            brightness_score = max(0.5, 1.0 - abs(mean_brightness - 128.0) / 160.0)

        # Realistic normalized scores for indoor webcams
        sharpness_score = min(1.0, lap_var / 110.0)
        size_score = min(1.0, face_h / 130.0)

        quality = 0.45 * sharpness_score + 0.35 * size_score + 0.20 * brightness_score
        quality = round(float(quality), 3)

        is_acceptable = (lap_var >= 13.0) and (quality >= 0.22)
        return quality, is_acceptable

    def extract_face_embeddings(self, image_input, use_fast_scale: bool = True) -> List[Dict[str, Any]]:
        """
        Detects all faces in an image and extracts 128-dimensional biometric embeddings.
        Input can be file path or BGR numpy array.
        Uses 0.5x fast scale (matching reference implementation) for sub-second live recognition.
        """
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                return []
            rgb_image = face_recognition.load_image_file(image_input)
            bgr_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
        else:
            bgr_image = image_input
            rgb_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)

        if use_fast_scale and (bgr_image.shape[0] >= 320 and bgr_image.shape[1] >= 320):
            small_rgb = cv2.resize(rgb_image, (0, 0), fx=0.5, fy=0.5)
            small_locs = face_recognition.face_locations(small_rgb, model="hog")
            if not small_locs:
                return []
            small_encs = face_recognition.face_encodings(small_rgb, small_locs)
            results = []
            for (t, r, b, l), enc in zip(small_locs, small_encs):
                loc = (t * 2, r * 2, b * 2, l * 2)
                quality, is_acceptable = self.assess_face_quality(bgr_image, loc)
                top, right, bottom, left = loc
                results.append({
                    "bbox": [left, top, right - left, bottom - top], # x, y, w, h
                    "location": loc,
                    "embedding": enc.tolist(),
                    "quality_score": quality,
                    "is_acceptable": is_acceptable
                })
            return results
        else:
            # Full scale fallback
            face_locations = face_recognition.face_locations(rgb_image, model="hog")
            if not face_locations:
                return []
            face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
            results = []
            for loc, enc in zip(face_locations, face_encodings):
                quality, is_acceptable = self.assess_face_quality(bgr_image, loc)
                top, right, bottom, left = loc
                results.append({
                    "bbox": [left, top, right - left, bottom - top], # x, y, w, h
                    "location": loc,
                    "embedding": enc.tolist(),
                    "quality_score": quality,
                    "is_acceptable": is_acceptable
                })
            return results

    def match_face(self, detected_embedding: List[float], enrolled_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Matches a detected face embedding against enrolled student biometric vectors.
        Uses Euclidean distance and converts to a calibrated confidence percentage.
        Includes ambiguity protection when top candidates have near-identical distances.
        """
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

        det_vec = np.array(detected_embedding, dtype=np.float64)
        
        # Calculate distances against all enrolled candidates
        scored = []
        for record in enrolled_records:
            enr_raw = record.get("embedding")
            if enr_raw is None:
                continue
            enrolled_vec = np.array(enr_raw, dtype=np.float64)
            dist = float(np.linalg.norm(det_vec - enrolled_vec))
            scored.append((dist, record))

        if not scored:
            return {
                "matched": False,
                "student_id": None,
                "confidence": 0.0,
                "distance": 1.0,
                "status": "UNKNOWN"
            }

        scored.sort(key=lambda x: x[0])
        best_dist, best_match = scored[0]

        # Ambiguity check: if top 2 candidates are from different students and within 0.035 distance
        if len(scored) > 1 and best_dist <= self.tolerance:
            second_dist, second_match = scored[1]
            if second_match.get("student_id") != best_match.get("student_id"):
                if (second_dist - best_dist) < 0.035 and second_dist <= (self.tolerance + 0.05):
                    return {
                        "matched": False,
                        "student_id": None,
                        "candidate_student_id": best_match["student_id"],
                        "student_name": f"Ambiguous ({best_match['full_name']} / {second_match['full_name']})",
                        "student_usn": None,
                        "confidence": 0.50,
                        "distance": round(best_dist, 3),
                        "status": "AMBIGUOUS"
                    }

        # Calibrate confidence score: dist 0.0 -> 100%, dist 0.5 -> 75%
        # Matches reference implementation tolerance logic
        calibrated_conf = max(0.50, min(1.0, 1.0 - (best_dist / (2.0 * self.tolerance))))
        
        if best_dist <= self.tolerance and best_match:
            return {
                "matched": True,
                "student_id": best_match["student_id"],
                "student_name": best_match["full_name"],
                "student_usn": best_match["usn"],
                "confidence": round(calibrated_conf, 3),
                "distance": round(best_dist, 3),
                "status": "HIGH"
            }
        elif best_dist < (self.tolerance + 0.10) and best_match:
            return {
                "matched": False, # Requires verification
                "candidate_student_id": best_match["student_id"],
                "candidate_name": best_match["full_name"],
                "candidate_usn": best_match["usn"],
                "confidence": round(calibrated_conf, 3),
                "distance": round(best_dist, 3),
                "status": "MEDIUM"
            }
        else:
            return {
                "matched": False,
                "student_id": None,
                "confidence": round(calibrated_conf, 3),
                "distance": round(best_dist, 3),
                "status": "UNKNOWN"
            }

cv_engine = ComputerVisionEngine()

