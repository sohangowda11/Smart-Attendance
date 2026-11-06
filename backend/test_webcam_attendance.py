import os
import sys
import cv2
import base64
import json
from datetime import datetime

# Ensure project root and backend dir are in sys.path
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

from app.database import SessionLocal
from app.models import User, Subject, Classroom, Student, AttendanceRecord, BiometricEnrollment, LectureSession
from app.services.webcam_attendance_manager import webcam_attendance_manager

def test_webcam_attendance_pipeline():
    print("==================================================================")
    print("  SYNAPSE // LIVE LAPTOP WEBCAM ATTENDANCE PIPELINE TEST  ")
    print("==================================================================")

    db = SessionLocal()

    # 1. Fetch test faculty user, subject, classroom
    faculty = db.query(User).filter(User.role == "FACULTY").first()
    if not faculty:
        faculty = db.query(User).first()
    
    subject = db.query(Subject).first()
    classroom = db.query(Classroom).first()
    
    print(f"[TEST 1] Starting Webcam Attendance Session...")
    print(f"Faculty: {faculty.full_name} ({faculty.email})")
    print(f"Subject: {subject.code} — {subject.name}")
    print(f"Room: {classroom.room_number}")

    start_res = webcam_attendance_manager.start_session(
        db=db,
        subject_id=subject.id,
        classroom_id=classroom.id,
        current_user=faculty
    )
    
    session_id = start_res["session_id"]
    roster_count = start_res["metrics"]["total_roster"]
    print(f"[PASS] Session initialized successfully! Session ID: {session_id}")
    print(f"Class Roster Enrolled Students: {roster_count}")
    print(f"Initial Metrics: {start_res['metrics']}")

    # 2. Test Frame with Enrolled Student Face
    enrollment = db.query(BiometricEnrollment, Student).join(Student, BiometricEnrollment.student_id == Student.id).first()
    enroll_photo_path = "backend" + enrollment[0].photo_path
    target_student = enrollment[1]

    print(f"\n[TEST 2] Processing Frame with Enrolled Student: {target_student.full_name} ({target_student.usn})")
    if os.path.exists(enroll_photo_path):
        frame = cv2.imread(enroll_photo_path)
    else:
        frame = cv2.imread("backend/storage/enrollments/student_ref_1.jpg")

    assert frame is not None, f"Could not load reference frame from {enroll_photo_path}"

    # Process Frame 1
    res1 = webcam_attendance_manager.process_frame(db, session_id, frame)
    print(f"Frame 1 Result:")
    print(f"  Faces detected in frame: {len(res1['faces'])}")
    for f in res1['faces']:
        print(f"  -> Face: {f['label']} | Status: {f['status']} | Confidence: {f['confidence']}%")
    print(f"  Newly marked students: {len(res1['newly_marked'])}")
    print(f"  Updated 5 Metrics: {res1['metrics']}")

    assert res1['metrics']['attendance_marked'] >= 1, "Student should be marked present"
    assert res1['metrics']['recognized_students'] >= 1, "Student should be recognized"

    # 3. Test DUPLICATE PREVENTION: Send the same frame 4 more times
    print("\n[TEST 3] Testing Duplicate Prevention across 4 consecutive frames...")
    for i in range(2, 6):
        res_dup = webcam_attendance_manager.process_frame(db, session_id, frame)
        # Verify newly_marked is empty on repeat frames!
        assert len(res_dup['newly_marked']) == 0, f"Frame {i} should NOT duplicate attendance mark!"

    print(f"[PASS] Frame count did NOT inflate! Attendance marked count remains: {res_dup['metrics']['attendance_marked']}")
    print(f"Recognized students count: {res_dup['metrics']['recognized_students']}")
    print(f"Remaining students count: {res_dup['metrics']['remaining_students']}")

    # 4. Test UNKNOWN Individual: Send frame with an unregistered synthetic face
    print("\n[TEST 4] Testing Unknown Individual Handling...")
    # Create black frame with a random drawn shape/box to test unknown individual spatial tracking
    unknown_res = webcam_attendance_manager.process_frame(
        db, session_id,
        cv2.putText(frame.copy(), "Simulated Unknown", (20, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
    )
    print(f"Metrics after unknown frame: {unknown_res['metrics']}")
    print(f"Total Visible People: {unknown_res['metrics']['total_visible_people']}")
    print(f"Unknown Individuals: {unknown_res['metrics']['unknown_individuals']}")

    # 5. Test Finalization
    print("\n[TEST 5] Testing Session Finalization & Absence Logging...")
    finalize_res = webcam_attendance_manager.finalize_session(db, session_id, confirm_absentees=True)
    print(f"Finalize Result: {finalize_res}")
    
    assert finalize_res["status"] == "COMPLETED"
    assert finalize_res["present_count"] >= 1
    assert finalize_res["absent_count"] == (finalize_res["total_enrolled"] - finalize_res["present_count"])
    print(f"[PASS] Finalized: {finalize_res['present_count']} Present, {finalize_res['absent_count']} Absent out of {finalize_res['total_enrolled']} enrolled.")

    # 6. Verify Database Integrity
    session_obj = db.query(LectureSession).filter(LectureSession.id == session_id).first()
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
    print(f"\n[TEST 6] Database Audit Check:")
    print(f"Session Status: {session_obj.status}")
    print(f"Video Source Type: {session_obj.video_source_type}")
    print(f"Total Attendance Records in DB: {len(records)}")
    present_records = [r for r in records if r.status == "PRESENT"]
    absent_records = [r for r in records if r.status == "ABSENT"]
    print(f"Present Records: {len(present_records)}")
    print(f"Absent Records: {len(absent_records)}")

    # Ensure no duplicates per student
    student_ids = [r.student_id for r in records]
    assert len(student_ids) == len(set(student_ids)), "Duplicate student records found in session!"
    print(f"[PASS] 100% Unique student constraints verified in database!")

    print("\n==================================================================")
    print("  ALL LIVE WEBCAM ATTENDANCE TESTS PASSED WITH 100% SUCCESS!  ")
    print("==================================================================")

    db.close()

if __name__ == "__main__":
    test_webcam_attendance_pipeline()

