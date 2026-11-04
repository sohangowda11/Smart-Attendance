import numpy as np
from typing import List, Dict, Any, Tuple

class CentroidIoUTracker:
    """
    Multi-Object Tracker for Classroom CCTV monitoring.
    Combines Intersection over Union (IoU) with Centroid euclidean distance
    to maintain consistent track identifiers across frames.
    """

    def __init__(self, max_disappeared: int = 15, iou_threshold: float = 0.25):
        self.next_track_id = 1
        self.objects: Dict[int, List[int]] = {}  # track_id -> [x, y, w, h]
        self.centroids: Dict[int, Tuple[int, int]] = {} # track_id -> (cx, cy)
        self.disappeared: Dict[int, int] = {} # track_id -> count of lost frames
        self.identities: Dict[int, Dict[str, Any]] = {} # track_id -> recognition info
        self.history_lengths: Dict[int, int] = {} # track_id -> total frames seen
        self.max_disappeared = max_disappeared
        self.iou_threshold = iou_threshold

    def _compute_iou(self, boxA: List[int], boxB: List[int]) -> float:
        # box: [x, y, w, h]
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
        yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])

        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = boxA[2] * boxA[3]
        boxBArea = boxB[2] * boxB[3]
        unionArea = float(boxAArea + boxBArea - interArea)

        if unionArea <= 0:
            return 0.0
        return interArea / unionArea

    def update(self, rects: List[List[int]]) -> List[Dict[str, Any]]:
        """
        Takes current frame bounding boxes [[x, y, w, h], ...]
        Returns active tracked items: [{'track_id': int, 'bbox': [x,y,w,h], 'centroid': (cx, cy)}]
        """
        if len(rects) == 0:
            for track_id in list(self.disappeared.keys()):
                self.disappeared[track_id] += 1
                if self.disappeared[track_id] > self.max_disappeared:
                    self.deregister(track_id)
            return self.get_active_tracks()

        input_centroids = []
        for r in rects:
            cx = int(r[0] + r[2] / 2.0)
            cy = int(r[1] + r[3] / 2.0)
            input_centroids.append((cx, cy))

        if len(self.objects) == 0:
            for i, r in enumerate(rects):
                self.register(r, input_centroids[i])
            return self.get_active_tracks()

        object_ids = list(self.objects.keys())
        prev_boxes = [self.objects[oid] for oid in object_ids]

        # Calculate IoU matrix between previous boxes and new rects
        iou_matrix = np.zeros((len(object_ids), len(rects)), dtype=np.float32)
        for i, prev_box in enumerate(prev_boxes):
            for j, new_box in enumerate(rects):
                iou_matrix[i, j] = self._compute_iou(prev_box, new_box)

        # Match using greedy maximum IoU
        matched_prev = set()
        matched_new = set()

        if iou_matrix.size > 0:
            # Flatten indices sorted by descending IoU
            indices = np.argsort(iou_matrix.ravel())[::-1]
            for idx in indices:
                row = idx // len(rects)
                col = idx % len(rects)
                if row in matched_prev or col in matched_new:
                    continue
                if iou_matrix[row, col] >= self.iou_threshold:
                    oid = object_ids[row]
                    self.objects[oid] = rects[col]
                    self.centroids[oid] = input_centroids[col]
                    self.disappeared[oid] = 0
                    self.history_lengths[oid] += 1
                    matched_prev.add(row)
                    matched_new.add(col)

        # For remaining unmatched previous objects, mark disappeared
        for i, oid in enumerate(object_ids):
            if i not in matched_prev:
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    self.deregister(oid)

        # For unmatched new rects, register them
        for j, rect in enumerate(rects):
            if j not in matched_new:
                self.register(rect, input_centroids[j])

        return self.get_active_tracks()

    def register(self, rect: List[int], centroid: Tuple[int, int]):
        track_id = self.next_track_id
        self.next_track_id += 1
        self.objects[track_id] = rect
        self.centroids[track_id] = centroid
        self.disappeared[track_id] = 0
        self.history_lengths[track_id] = 1

    def deregister(self, track_id: int):
        self.objects.pop(track_id, None)
        self.centroids.pop(track_id, None)
        self.disappeared.pop(track_id, None)

    def assign_identity(self, track_id: int, student_id: int, student_name: str, confidence: float):
        self.identities[track_id] = {
            "student_id": student_id,
            "student_name": student_name,
            "confidence": confidence
        }

    def get_identity(self, track_id: int) -> Optional[Dict[str, Any]]:
        return self.identities.get(track_id)

    def get_active_tracks(self) -> List[Dict[str, Any]]:
        results = []
        for track_id, bbox in self.objects.items():
            results.append({
                "track_id": track_id,
                "bbox": bbox,
                "centroid": self.centroids.get(track_id, (0, 0)),
                "frames_seen": self.history_lengths.get(track_id, 1),
                "identity": self.identities.get(track_id)
            })
        return results

