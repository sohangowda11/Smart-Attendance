import cv2
import face_recognition
import numpy as np
import os
import pickle

ENCODINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "encodings", "encodings.pkl")

os.makedirs(os.path.dirname(ENCODINGS_FILE), exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(os.path.dirname(__file__)), "dataset"), exist_ok=True)

class FaceRecognitionModule:
    def __init__(self):
        self.known_face_encodings = []
        self.known_face_ids = []
        self.names_map = {}
        self.load_encodings()

    def load_encodings(self):
        if os.path.exists(ENCODINGS_FILE):
            with open(ENCODINGS_FILE, "rb") as f:
                data = pickle.load(f)
                self.known_face_encodings = data.get("encodings", [])
                self.known_face_ids = data.get("ids", [])
                self.names_map = data.get("names", {})
    
    def save_encodings(self):
        with open(ENCODINGS_FILE, "wb") as f:
            pickle.dump({
                "encodings": self.known_face_encodings,
                "ids": self.known_face_ids,
                "names": self.names_map
            }, f)

    def register_user(self, student_id, student_name, frames):
        encodings = []
        for i, frame in enumerate(frames):
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            face_locations = face_recognition.face_locations(rgb_frame)
            if len(face_locations) == 1:
                enc = face_recognition.face_encodings(rgb_frame, face_locations)[0]
                encodings.append(enc)
                # optionally save raw image to dataset
                cv2.imwrite(os.path.join(os.path.dirname(os.path.dirname(__file__)), "dataset", f"{student_id}_{i}.jpg"), frame)
            elif len(face_locations) > 1:
                return False, "Multiple faces detected. Ensure only one face is visible."

        if not encodings:
            return False, "No face found in the provided frames. Try registering again."
        
        avg_encoding = np.mean(encodings, axis=0)
        
        self.known_face_encodings.append(avg_encoding)
        self.known_face_ids.append(student_id)
        self.names_map[student_id] = student_name
        self.save_encodings()
        
        return True, "User registered successfully."

    def recognize_frame(self, frame):
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        small_frame = cv2.resize(rgb_frame, (0, 0), fx=0.5, fy=0.5)
        
        face_locations = face_recognition.face_locations(small_frame)
        face_encodings = face_recognition.face_encodings(small_frame, face_locations)
        
        results = []
        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding, tolerance=0.5)
            name = "Unknown"
            student_id = None
            
            if True in matches:
                face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    student_id = self.known_face_ids[best_match_index]
                    name = self.names_map.get(student_id, "Unknown")
            
            top *= 2
            right *= 2
            bottom *= 2
            left *= 2
            
            results.append({
                "loc": (top, right, bottom, left),
                "name": name,
                "student_id": student_id
            })
            
        return results

face_rec_engine = FaceRecognitionModule()
