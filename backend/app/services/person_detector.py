import os
import cv2
import numpy as np
from typing import List, Dict, Any, Optional
from pathlib import Path

class ClassroomPersonDetector:
    """
    SYNAPSE Classroom Student & Person Detection Engine.
    Powered by YOLOv8 deep learning architecture with ByteTrack multi-object tracking.
    Specialized for diverse classroom CCTV environments:
    - Seated students behind desks
    - Crowded lecture halls
    - Partial occlusions and overlapping bodies
    - High-angle and wide-angle surveillance perspectives
    - Variable lighting and contrast conditions
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45
    ):
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.model = None
        self.model_name = "YOLOv8-Classroom-Person"
        
        # Determine best available weights
        candidates = [
            model_path,
            os.path.join(os.path.dirname(__file__), "..", "..", "models", "classroom_yolov8.pt"),
            os.path.join(os.path.dirname(__file__), "..", "..", "models", "yolov8n.pt"),
            "yolov8n.pt"
        ]
        
        selected_path = None
        for cand in candidates:
            if cand and os.path.exists(cand):
                selected_path = os.path.abspath(cand)
                break

        if not selected_path:
            selected_path = "yolov8n.pt"

        self.weights_path = selected_path
        self._load_model()

    def _load_model(self):
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.weights_path)
            print(f"[SYNAPSE PersonDetector] Loaded YOLOv8 engine from: {self.weights_path}")
        except Exception as e:
            print(f"[SYNAPSE PersonDetector] Warning: Could not initialize Ultralytics YOLO: {e}")
            self.model = None

    def detect_and_track(
        self,
        frame: np.ndarray,
        conf: Optional[float] = None,
        persist: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Runs person detection (class 0) and ByteTrack tracking on a single frame.
        Returns a list of dicts:
        [{
            "track_id": int,
            "bbox": [x, y, w, h],
            "confidence": float,
            "centroid": (cx, cy),
            "class_name": "person"
        }]
        """
        if self.model is None or frame is None or frame.size == 0:
            return []

        active_conf = conf if conf is not None else self.conf_threshold

        try:
            # Run inference with ByteTrack multi-object tracking strictly on class 0 (person)
            results = self.model.track(
                source=frame,
                classes=[0],            # Only detect people (eliminates desks, chairs, bags)
                conf=active_conf,       # Configurable confidence threshold
                iou=self.iou_threshold, # NMS IoU threshold
                persist=persist,        # Maintain tracks across consecutive frames
                tracker="bytetrack.yaml",
                verbose=False
            )

            detections = []
            if len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                for box in boxes:
                    # Convert xyxy [x1, y1, x2, y2] to [x, y, w, h]
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
                    x = int(round(x1))
                    y = int(round(y1))
                    w = int(round(x2 - x1))
                    h = int(round(y2 - y1))
                    
                    confidence = float(box.conf[0].cpu().numpy())
                    track_id = int(box.id[0].cpu().numpy()) if box.id is not None else -1
                    cx = int(x + w / 2)
                    cy = int(y + h / 2)

                    detections.append({
                        "track_id": track_id,
                        "bbox": [x, y, w, h],
                        "confidence": round(confidence, 3),
                        "centroid": (cx, cy),
                        "class_name": "person"
                    })

            return detections
        except Exception as e:
            # Fallback to standard detect without tracking if tracker errors
            try:
                results = self.model.predict(
                    source=frame,
                    classes=[0],
                    conf=active_conf,
                    iou=self.iou_threshold,
                    verbose=False
                )
                detections = []
                if len(results) > 0 and results[0].boxes is not None:
                    for i, box in enumerate(results[0].boxes):
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().tolist()
                        x = int(round(x1))
                        y = int(round(y1))
                        w = int(round(x2 - x1))
                        h = int(round(y2 - y1))
                        confidence = float(box.conf[0].cpu().numpy())
                        detections.append({
                            "track_id": i + 1,
                            "bbox": [x, y, w, h],
                            "confidence": round(confidence, 3),
                            "centroid": (int(x + w / 2), int(y + h / 2)),
                            "class_name": "person"
                        })
                return detections
            except Exception as e2:
                print(f"[SYNAPSE PersonDetector] Error running inference: {e2}")
                return []

# Singleton instance
classroom_person_detector = ClassroomPersonDetector()

