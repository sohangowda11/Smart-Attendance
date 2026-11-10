import os
import sys
import json
import argparse
import numpy as np
import cv2

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.app.database import SessionLocal
from backend.app.models import Student, BiometricEnrollment
from backend.app.services.biometric_service import biometric_service

def run_diagnostics(student_id: int = None, probe_image_path: str = None):
    print("=" * 85)
    print("  SYNAPSE // BIOMETRIC ENGINE & ENROLLMENT DEVELOPER DIAGNOSTIC TOOL")
    print("=" * 85)

    db = SessionLocal()
    cached_count = biometric_service.load_cache(db, force_reload=True)
    cached_ids = set(biometric_service.cached_student_ids)

    print(f"• RAM In-Memory Templates: {cached_count} active representations loaded.")
    print(f"• Default Matching Tolerance: {biometric_service.default_tolerance}")
    print("-" * 85)

    query = db.query(Student)
    if student_id:
        query = query.filter(Student.id == student_id)
    students = query.order_by(Student.id.asc()).all()

    print(f"{'ID':<4} | {'Full Name':<18} | {'USN':<12} | {'Active':<6} | {'Templates':<9} | {'Dim':<4} | {'Norm':<6} | {'In RAM':<6} | {'Model Version':<22}")
    print("-" * 105)

    for s in students:
        enrollments = db.query(BiometricEnrollment).filter(BiometricEnrollment.student_id == s.id).all()
        t_count = len(enrollments)
        dim = 0
        norm = 0.0
        m_ver = "None"
        if t_count > 0 and enrollments[0].embedding_data:
            try:
                data = json.loads(enrollments[0].embedding_data)
                if isinstance(data, list):
                    dim = len(data)
                    arr = np.array(data, dtype=np.float64)
                    norm = round(float(np.linalg.norm(arr)), 3)
                m_ver = enrollments[0].model_version or "v1"
            except Exception:
                m_ver = "Corrupt"

        in_ram = "YES" if s.id in cached_ids else "NO"
        act_str = "YES" if s.is_active else "NO"
        print(f"{s.id:<4} | {s.full_name:<18} | {s.usn:<12} | {act_str:<6} | {t_count:<9} | {dim:<4} | {norm:<6.3f} | {in_ram:<6} | {m_ver:<22}")

    if probe_image_path:
        print("\n" + "=" * 85)
        print(f"  TESTING PROBE IMAGE: {probe_image_path}")
        print("=" * 85)
        if not os.path.exists(probe_image_path):
            print(f"[ERROR] File not found: {probe_image_path}")
        else:
            bgr = cv2.imread(probe_image_path)
            if bgr is None:
                print(f"[ERROR] Could not decode image from: {probe_image_path}")
            else:
                results = biometric_service.recognize_faces_in_frame(bgr, db=db, tolerance=0.50)
                print(f"Detected {len(results)} face(s):")
                for idx, r in enumerate(results):
                    print(f"  Face #{idx+1}:")
                    print(f"    • Matched:      {r['matched']}")
                    print(f"    • Identity:     {r['name']} ({r.get('student_usn')})")
                    print(f"    • Student ID:   {r['student_id']}")
                    print(f"    • Distance:     {r['distance']} (Tolerance: {r['tolerance']})")
                    print(f"    • Confidence:   {r['confidence'] * 100:.1f}%")
                    print(f"    • Status:       {r['status']}")
                    print(f"    • Bounding Box: {r['bbox']}")

    db.close()
    print("\n" + "=" * 85)
    print("  DIAGNOSTIC INSPECTION COMPLETE")
    print("=" * 85)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SYNAPSE Biometric Diagnostic Tool")
    parser.add_argument("--student-id", type=int, help="Inspect specific student ID", default=None)
    parser.add_argument("--probe", type=str, help="Path to probe image to test recognition", default=None)
    args = parser.parse_args()
    run_diagnostics(student_id=args.student_id, probe_image_path=args.probe)

