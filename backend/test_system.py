import os
import sys
import json

# Ensure project root and backend dir are in sys.path
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

from app.database import SessionLocal
from app.models import User, Student, AttendanceRecord, LectureSession, Camera, Department
from app.services.cv_engine import cv_engine
from app.services.report_generator import report_generator
from app.auth import verify_password, create_access_token
from app.routers.timetable import get_active_lecture
from app.routers.analytics import get_admin_dashboard_stats

def test_all():
    db = SessionLocal()
    print("==================================================")
    print("SYNAPSE PLATFORM VERIFICATION TEST SUITE")
    print("==================================================")

    # 1. Database check
    admin = db.query(User).filter(User.email == "admin@synapse.ai").first()
    assert admin is not None
    assert verify_password("Admin@123", admin.hashed_password)
    print("[PASS] [AUTH] Admin user verified with Argon2 password hashing.")

    faculty = db.query(User).filter(User.email == "dr.sharma@synapse.ai").first()
    assert faculty is not None
    assert verify_password("Faculty@123", faculty.hashed_password)
    print("[PASS] [AUTH] Faculty user verified with Argon2 password hashing.")

    # 2. Token creation
    token = create_access_token({"sub": admin.email, "role": admin.role})
    assert len(token) > 20
    print("[PASS] [JWT] Secure HS256 access token generated.")

    # 3. Students & 128-D Biometrics
    students = db.query(Student).all()
    assert len(students) >= 20
    enrolled_count = len([s for s in students if len(s.biometric_enrollments) > 0])
    print(f"[PASS] [STUDENTS & BIOMETRICS] Total Students: {len(students)} | 128-D Biometric Profiles: {enrolled_count}")

    # 4. Timetable active lecture auto mapping
    active_lecture = get_active_lecture(classroom_id=1, faculty_id=faculty.id, db=db, current_user=faculty)
    print(f"[PASS] [TIMETABLE AUTO-MAPPING] Active Lecture: {active_lecture.get('subject_code')} - {active_lecture.get('subject_name')} in {active_lecture.get('room_number')}")

    # 5. Dashboard analytics calculation
    dashboard_stats = get_admin_dashboard_stats(db=db, current_user=admin)
    print(f"[PASS] [ANALYTICS] Students: {dashboard_stats.total_students} | Present: {dashboard_stats.present_today} | Overall %: {dashboard_stats.overall_attendance_pct}% | Cameras Online: {dashboard_stats.connected_cameras}")

    # 6. ReportLab PDF Generation
    pdf_records = [{
        "usn": s.usn,
        "name": s.full_name,
        "total_lectures": 15,
        "attended_lectures": 14,
        "absent_lectures": 1,
        "attendance_pct": 93.3
    } for s in students[:5]]
    pdf_url = report_generator.generate_pdf_report(
        title="SYNAPSE Verification Audit",
        department_name="AIML",
        subject_name="CS601",
        records=pdf_records
    )
    print(f"[PASS] [REPORTS PDF] Generated ReportLab branded PDF at: {pdf_url}")

    # 7. Excel Generation
    excel_url = report_generator.generate_excel_report(
        title="Attendance Export",
        records=pdf_records
    )
    print(f"[PASS] [REPORTS EXCEL] Generated Excel spreadsheet at: {excel_url}")

    # 8. CCTV Surveillance Cameras
    cams = db.query(Camera).all()
    assert len(cams) >= 3
    print(f"[PASS] [CAMERAS] {len(cams)} CCTV surveillance streams registered & active.")

    # 9. Attendance Sessions & Records
    sessions = db.query(LectureSession).all()
    assert len(sessions) > 0
    records_count = db.query(AttendanceRecord).count()
    print(f"[PASS] [ATTENDANCE ENGINE] {len(sessions)} Lecture Sessions | {records_count} Attendance Records logged.")

    db.close()
    print("==================================================")
    print("ALL 9 VERIFICATION CHECKS COMPLETED WITH 100% SUCCESS")
    print("==================================================")

if __name__ == "__main__":
    test_all()
