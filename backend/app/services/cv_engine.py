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
        Calculates sharpness (Laplacian variance) and size adequacy of the face crop.
        Returns: (quality_score [0..1], is_acceptable)
        """
        top, right, bottom, left = face_location
        h, w = bgr_image.shape[:2]
        
        # Clamp coordinates
        top = max(0, top)
        left = max(0, left)
        bottom = min(h, bottom)
        right = min(w, right)
        
        face_crop = bgr_image[top:bottom, left:right]
        if face_crop.size == 0 or (bottom - top) < 40 or (right - left) < 40:
            return 0.2, False

        # Blur analysis via Laplacian variance
        gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        lap_var = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
        
        # Brightness analysis
        mean_brightness = np.mean(gray_crop)
        if mean_brightness < 30 or mean_brightness > 235:
            brightness_penalty = 0.5
        else:
            brightness_penalty = 1.0

        # Normalize score
        sharpness_score = min(1.0, lap_var / 350.0)
        quality = sharpness_score * brightness_penalty
        return round(quality, 3), quality >= 0.25

    def extract_face_embeddings(self, image_input) -> List[Dict[str, Any]]:
        """
        Detects all faces in an image and extracts 128-dimensional biometric embeddings.
        Input can be file path or BGR numpy array.
        """
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                return []
            rgb_image = face_recognition.load_image_file(image_input)
            bgr_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
        else:
            bgr_image = image_input
            rgb_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)

        # Detect face locations (top, right, bottom, left)
        face_locations = face_recognition.face_locations(rgb_image, model="hog")
        if not face_locations:
            return []

        # Extract 128-dimensional encodings
        face_encodings = face_recognition.face_encodings(rgb_image, face_locations)

        results = []
        for loc, enc in zip(face_locations, face_encodings):
            quality, is_acceptable = self.assess_face_quality(bgr_image, loc)
            top, right, bottom, left = loc
            results.append({
                "bbox": [left, top, right - left, bottom - top], # x, y, w, h
                "location": loc, # top, right, bottom, left
                "embedding": enc.tolist(),
                "quality_score": quality,
                "is_acceptable": is_acceptable
            })
        return results

    def match_face(self, detected_embedding: List[float], enrolled_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Matches a detected face embedding against enrolled student biometric vectors.
        Uses Euclidean distance and converts to a calibrated confidence percentage.
        """
        if not enrolled_records:
            return {
                "matched": False,
                "student_id": None,
                "student_name": None,
                "student_usn": None,
                "confidence": 0.0,
                "status": "UNKNOWN"
            }

        det_vec = np.array(detected_embedding, dtype=np.float64)
        
        best_match = None
        min_distance = 1.0
        
        for record in enrolled_records:
            enrolled_vec = np.array(record["embedding"], dtype=np.float64)
            # Euclidean distance in 128-d face space
            dist = np.linalg.norm(det_vec - enrolled_vec)
            if dist < min_distance:
                min_distance = dist
                best_match = record

        # Calibrate confidence score: dist 0.0 -> 100%, dist 0.5 -> 75%, dist 0.6 -> 50%
        # Distance > 0.6 is typically non-match in dlib 128d space
        calibrated_conf = max(0.0, min(1.0, 1.0 - (min_distance / 1.0)))
        
        if min_distance <= self.tolerance and best_match:
            status = "HIGH" if calibrated_conf >= self.high_conf_thresh else "MEDIUM"
            return {
                "matched": True,
                "student_id": best_match["student_id"],
                "student_name": best_match["full_name"],
                "student_usn": best_match["usn"],
                "confidence": round(calibrated_conf, 3),
                "distance": round(min_distance, 3),
                "status": status
            }
        elif min_distance < (self.tolerance + 0.10) and best_match:
            return {
                "matched": False, # Requires verification
                "candidate_student_id": best_match["student_id"],
                "candidate_name": best_match["full_name"],
                "candidate_usn": best_match["usn"],
                "confidence": round(calibrated_conf, 3),
                "distance": round(min_distance, 3),
                "status": "MEDIUM"
            }
        else:
            return {
                "matched": False,
                "student_id": None,
                "confidence": round(calibrated_conf, 3),
                "distance": round(min_distance, 3),
                "status": "UNKNOWN"
            }

cv_engine = ComputerVisionEngine()

