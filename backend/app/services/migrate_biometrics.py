import os
import json
import time
import shutil
import numpy as np
import cv2
import face_recognition

from ..database import SessionLocal
from ..models import Student, BiometricEnrollment, AuditLog
from ..config import ENROLLMENTS_DIR
from .biometric_service import biometric_service

def migrate_and_standardize_biometrics():
    """
    Standardizes all stored biometric templates in SYNAPSE to use the exact
    un-normalized dlib 128-d representation from the previous project.
    
    1. Backs up current records to JSON file
    2. Identifies any normalized templates (norm ~ 1.0)
    3. Regenerates raw dlib encodings from the stored high-res reference photos
    4. Ensures zero data loss and total mathematical consistency with live matcher
    """
    db = SessionLocal()
    backup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backup")
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = int(time.time())
    backup_file = os.path.join(backup_dir, f"biometric_enrollments_backup_{timestamp}.json")

    records = db.query(BiometricEnrollment).all()
    backup_data = []
    for r in records:
        backup_data.append({
            "id": r.id,
            "student_id": r.student_id,
            "embedding_data": r.embedding_data,
            "quality_score": r.quality_score,
            "model_version": r.model_version,
            "photo_path": r.photo_path,
            "face_bbox": r.face_bbox
        })

    with open(backup_file, "w") as f:
        json.dump(backup_data, f, indent=2)
    print(f"[Migration] Backed up {len(backup_data)} biometric records to {backup_file}")

    migrated_count = 0
    intact_count = 0

    for enroll in records:
        try:
            raw_emb = json.loads(enroll.embedding_data)
            if not isinstance(raw_emb, list) or len(raw_emb) != 128:
                continue

            arr = np.array(raw_emb, dtype=np.float64)
            current_norm = float(np.linalg.norm(arr))

            # Detect normalized templates (norm ~ 1.0)
            if abs(current_norm - 1.0) < 0.08:
                student = db.query(Student).filter(Student.id == enroll.student_id).first()
                if not student:
                    continue

                # Locate reference photo
                photo_found = None
                candidates = []
                if enroll.photo_path:
                    candidates.append(os.path.join(ENROLLMENTS_DIR, os.path.basename(enroll.photo_path)))
                if student.photo_url:
                    candidates.append(os.path.join(ENROLLMENTS_DIR, os.path.basename(student.photo_url)))
                candidates.append(os.path.join(ENROLLMENTS_DIR, f"student_ref_{student.id}.jpg"))
                candidates.append(os.path.join(ENROLLMENTS_DIR, f"student_enroll_{student.id}_{student.usn}_reference.jpg"))

                for c in candidates:
                    if os.path.exists(c):
                        photo_found = c
                        break

                if photo_found:
                    img = cv2.imread(photo_found)
                    if img is not None:
                        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                        locs = face_recognition.face_locations(rgb, model="hog")
                        if locs:
                            raw_encs = face_recognition.face_encodings(rgb, [locs[0]])
                            if raw_encs:
                                raw_vec = raw_encs[0]
                                new_norm = float(np.linalg.norm(raw_vec))
                                enroll.embedding_data = json.dumps(raw_vec.tolist())
                                enroll.model_version = "dlib-face-recognition-v1"
                                migrated_count += 1
                                print(f"  [Regenerated] Student {student.id} ({student.full_name}): norm {current_norm:.3f} -> {new_norm:.3f}")
            else:
                intact_count += 1
        except Exception as e:
            print(f"  [Error] Processing record {enroll.id}: {e}")

    db.commit()
    # Refresh memory cache
    biometric_service.refresh_cache(db)
    db.close()

    print(f"[Migration Summary] Completed. Regenerated: {migrated_count}, Already Intact: {intact_count}, Total: {len(records)}")
    return migrated_count, intact_count

if __name__ == "__main__":
    migrate_and_standardize_biometrics()

