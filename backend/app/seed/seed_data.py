import os
import json
import random
from datetime import datetime, timezone, date, time, timedelta
from sqlalchemy.orm import Session
from ..database import SessionLocal, Base, engine
from ..models import (
    User, Department, Classroom, Subject, Student, BiometricEnrollment,
    BiometricConsent, TimetableEntry, LectureSession, Camera,
    AttendanceRecord, Notification, AuditLog, SystemSetting
)
from ..auth import get_password_hash
from ..services.cv_engine import cv_engine
from .sample_video_generator import generate_classroom_footage_and_enrollments

def seed_database():
    print("Initializing Database schema...")
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    # Check if already seeded
    if db.query(User).filter(User.email == "admin@synapse.ai").first():
        print("Database already contains seed data.")
        db.close()
        return

    print("Seeding SYNAPSE database with realistic enterprise data...")

    # 1. System Settings
    settings_data = [
        ("MIN_ATTENDANCE_PCT", "75.0", "Minimum attendance required by institutional policy", "ATTENDANCE"),
        ("LATE_GRACE_MINUTES", "10", "Grace period in minutes before student is flagged LATE", "ATTENDANCE"),
        ("FACE_CONFIDENCE_THRESHOLD", "0.65", "Minimum confidence required for automatic attendance", "AI"),
        ("MIN_OBSERVATION_COUNT", "2", "Number of frame detections needed before marking present", "AI"),
        ("BIOMETRIC_RETENTION_DAYS", "365", "Retention period for stored biometric representations", "PRIVACY"),
        ("AUTO_MARK_ABSENT", "true", "Automatically mark absent for undetected students upon session close", "ATTENDANCE")
    ]
    for k, v, d, c in settings_data:
        db.add(SystemSetting(key=k, value=v, description=d, category=c))
    db.commit()

    # 2. Departments
    dept_aiml = Department(code="AIML", name="Artificial Intelligence & Machine Learning", description="School of Computing & AI")
    dept_cse = Department(code="CSE", name="Computer Science & Engineering", description="School of Computing")
    dept_ece = Department(code="ECE", name="Electronics & Communication Engineering", description="School of Electrical Sciences")
    db.add_all([dept_aiml, dept_cse, dept_ece])
    db.commit()

    # 3. Classrooms
    lh_101 = Classroom(room_number="LH-101", building="Turing Block", floor=1, capacity=60, has_cctv=True)
    lh_102 = Classroom(room_number="LH-102", building="Turing Block", floor=1, capacity=60, has_cctv=True)
    ai_lab = Classroom(room_number="AI-LAB-01", building="von Neumann Complex", floor=2, capacity=40, has_cctv=True)
    db.add_all([lh_101, lh_102, ai_lab])
    db.commit()

    # 4. Users (Admin + Faculty)
    admin_user = User(
        email="admin@synapse.ai",
        full_name="Dr. Alistair Vance",
        hashed_password=get_password_hash("Admin@123"),
        role="ADMIN",
        department_id=dept_aiml.id,
        designation="Dean of Academic Computing & AI",
        phone="+91 98450 11223"
    )
    faculty_sharma = User(
        email="dr.sharma@synapse.ai",
        full_name="Dr. Rajesh Sharma",
        hashed_password=get_password_hash("Faculty@123"),
        role="FACULTY",
        department_id=dept_aiml.id,
        designation="Professor & AI Lab Director",
        phone="+91 98450 44556"
    )
    faculty_menon = User(
        email="prof.menon@synapse.ai",
        full_name="Prof. Sunita Menon",
        hashed_password=get_password_hash("Faculty@123"),
        role="FACULTY",
        department_id=dept_cse.id,
        designation="Associate Professor",
        phone="+91 98450 77889"
    )
    db.add_all([admin_user, faculty_sharma, faculty_menon])
    db.commit()

    # 5. Subjects
    subj_cv = Subject(code="CS601", name="Computer Vision & Pattern Recognition", department_id=dept_aiml.id, semester=6, credits=4, faculty_id=faculty_sharma.id)
    subj_dl = Subject(code="CS602", name="Deep Learning & Neural Architectures", department_id=dept_aiml.id, semester=6, credits=4, faculty_id=faculty_sharma.id)
    subj_cloud = Subject(code="CS603", name="Scalable Cloud Systems & Microservices", department_id=dept_cse.id, semester=6, credits=3, faculty_id=faculty_menon.id)
    subj_nlp = Subject(code="CS604", name="Natural Language Processing & LLMs", department_id=dept_aiml.id, semester=6, credits=4, faculty_id=faculty_menon.id)
    db.add_all([subj_cv, subj_dl, subj_cloud, subj_nlp])
    db.commit()

    # 6. Generate biometric reference images and sample video
    student_photos, sample_video_path = generate_classroom_footage_and_enrollments()

    # 7. Cameras
    cam_101 = Camera(
        camera_name="LH-101 Front Wide CCTV",
        camera_code="CAM-LH101-01",
        classroom_id=lh_101.id,
        location_desc="Front podium wide angle covering desks 1-12",
        stream_url=sample_video_path,
        stream_type="SIMULATED",
        resolution="1080p",
        fps=30,
        status="ONLINE",
        health_score=99.4
    )
    cam_102 = Camera(
        camera_name="LH-102 Overhead Camera",
        camera_code="CAM-LH102-01",
        classroom_id=lh_102.id,
        location_desc="Ceiling mount center",
        stream_url=sample_video_path,
        stream_type="SIMULATED",
        resolution="1080p",
        fps=30,
        status="ONLINE",
        health_score=98.8
    )
    cam_lab = Camera(
        camera_name="AI-LAB Workstation Stream",
        camera_code="CAM-AILAB-01",
        classroom_id=ai_lab.id,
        location_desc="Lab entry & active workstations",
        stream_url="webcam:0",
        stream_type="WEBCAM",
        resolution="720p",
        fps=30,
        status="ONLINE",
        health_score=97.5
    )
    db.add_all([cam_101, cam_102, cam_lab])
    db.commit()

    # 8. Students (20 realistic students)
    student_names = [
        ("Aarav Sharma", "1RV21AI001", "aarav.sharma@synapse.edu"),
        ("Ananya Rao", "1RV21AI002", "ananya.rao@synapse.edu"),
        ("Rohan Verma", "1RV21AI003", "rohan.verma@synapse.edu"),
        ("Diya Patel", "1RV21AI004", "diya.patel@synapse.edu"),
        ("Vikram Aditya", "1RV21AI005", "vikram.aditya@synapse.edu"),
        ("Priya Nair", "1RV21AI006", "priya.nair@synapse.edu"),
        ("Siddharth Jain", "1RV21AI007", "siddharth.jain@synapse.edu"),
        ("Sneha Kulkarni", "1RV21AI008", "sneha.kulkarni@synapse.edu"),
        ("Arjun Gupta", "1RV21AI009", "arjun.gupta@synapse.edu"),
        ("Neha Reddy", "1RV21AI010", "neha.reddy@synapse.edu"),
        ("Kabir Mehta", "1RV21AI011", "kabir.mehta@synapse.edu"),
        ("Pooja Hegde", "1RV21AI012", "pooja.hegde@synapse.edu"),
        ("Varun Das", "1RV21AI013", "varun.das@synapse.edu"),
        ("Tanya Joseph", "1RV21AI014", "tanya.joseph@synapse.edu"),
        ("Aditya Bhat", "1RV21AI015", "aditya.bhat@synapse.edu"),
        ("Shreya Sen", "1RV21AI016", "shreya.sen@synapse.edu"),
        ("Karan Malhotra", "1RV21AI017", "karan.malhotra@synapse.edu"),
        ("Meera Joshi", "1RV21AI018", "meera.joshi@synapse.edu"),
        ("Rishabh Singh", "1RV21AI019", "rishabh.singh@synapse.edu"),
        ("Ishaan Iyer", "1RV21AI020", "ishaan.iyer@synapse.edu"),
    ]

    enrolled_students = []
    for idx, (name, usn, email) in enumerate(student_names):
        photo_rel = f"/storage/enrollments/student_ref_{idx + 1}.jpg"
        photo_abs = student_photos.get(idx + 1)
        
        student = Student(
            usn=usn,
            full_name=name,
            email=email,
            phone=f"+91 9980{idx:02d} {100+idx:03d}",
            department_id=dept_aiml.id if idx < 15 else dept_cse.id,
            semester=6,
            section="A",
            photo_url=photo_rel,
            consent_status=True,
            is_active=True
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        enrolled_students.append(student)

        # Biometric Consent
        consent = BiometricConsent(
            student_id=student.id,
            consented=True,
            signed_by=student.full_name,
            ip_address="192.168.1.10"
        )
        db.add(consent)

        # Extract real 128-d face embedding from reference photo
        if photo_abs and os.path.exists(photo_abs):
            det_results = cv_engine.extract_face_embeddings(photo_abs)
            if det_results:
                emb = det_results[0]["embedding"]
                bio = BiometricEnrollment(
                    student_id=student.id,
                    embedding_data=json.dumps(emb),
                    quality_score=0.96,
                    model_version="dlib-face-recognition-v1",
                    photo_path=photo_rel,
                    face_bbox=",".join(map(str, det_results[0]["bbox"]))
                )
                db.add(bio)
        db.commit()

    # 9. Timetable
    # Monday to Friday timetable slots
    tt_cv_mon = TimetableEntry(day_of_week=0, start_time=time(9, 0), end_time=time(10, 0), subject_id=subj_cv.id, faculty_id=faculty_sharma.id, classroom_id=lh_101.id, semester=6, section="A")
    tt_dl_mon = TimetableEntry(day_of_week=0, start_time=time(10, 15), end_time=time(11, 15), subject_id=subj_dl.id, faculty_id=faculty_sharma.id, classroom_id=lh_101.id, semester=6, section="A")
    tt_cloud_tue = TimetableEntry(day_of_week=1, start_time=time(9, 0), end_time=time(10, 0), subject_id=subj_cloud.id, faculty_id=faculty_menon.id, classroom_id=lh_102.id, semester=6, section="A")
    tt_nlp_wed = TimetableEntry(day_of_week=2, start_time=time(11, 30), end_time=time(12, 30), subject_id=subj_nlp.id, faculty_id=faculty_menon.id, classroom_id=lh_101.id, semester=6, section="A")
    tt_cv_thu = TimetableEntry(day_of_week=3, start_time=time(14, 0), end_time=time(15, 0), subject_id=subj_cv.id, faculty_id=faculty_sharma.id, classroom_id=lh_101.id, semester=6, section="A")
    tt_dl_fri = TimetableEntry(day_of_week=4, start_time=time(10, 0), end_time=time(11, 0), subject_id=subj_dl.id, faculty_id=faculty_sharma.id, classroom_id=ai_lab.id, semester=6, section="A")
    
    db.add_all([tt_cv_mon, tt_dl_mon, tt_cloud_tue, tt_nlp_wed, tt_cv_thu, tt_dl_fri])
    db.commit()

    # 10. Historical Lecture Sessions & Attendance Records (Past 14 days)
    # This seeds rich analytics, trends, shortage stats and past records
    today = date.today()
    random.seed(42)

    past_sessions = []
    for d_offset in range(12, 0, -1):
        s_date = today - timedelta(days=d_offset)
        # Skip weekends
        if s_date.weekday() >= 5:
            continue
        
        # Pick 2 subjects per day
        daily_subjs = [subj_cv, subj_dl] if s_date.weekday() % 2 == 0 else [subj_cloud, subj_nlp]
        for subj in daily_subjs:
            sess = LectureSession(
                timetable_id=tt_cv_mon.id,
                subject_id=subj.id,
                faculty_id=subj.faculty_id,
                classroom_id=lh_101.id,
                session_date=s_date,
                start_time=time(10, 0),
                end_time=time(11, 0),
                status="COMPLETED",
                video_source_type="CCTV_UPLOAD",
                total_frames=120,
                total_detected=18,
                total_unique_tracks=16,
                total_recognized=15,
                completed_at=datetime.combine(s_date, time(11, 0), tzinfo=timezone.utc)
            )
            db.add(sess)
            db.commit()
            db.refresh(sess)
            past_sessions.append(sess)

            # Generate attendance for enrolled students
            for s_idx, st in enumerate(enrolled_students):
                # Specific students configured for low attendance (<75% and <65%) to test shortage alerts!
                # Student 3 (Rohan Verma) and Student 8 (Sneha Kulkarni) have attendance shortage
                if st.usn in ["1RV21AI003", "1RV21AI008"]:
                    present_prob = 0.55 # Shortage student
                elif st.usn in ["1RV21AI013", "1RV21AI017"]:
                    present_prob = 0.62 # Warning shortage
                else:
                    present_prob = 0.90 # Normal high attendance

                is_present = random.random() < present_prob
                is_late = is_present and (random.random() < 0.15)
                
                status_val = "ABSENT"
                if is_present:
                    status_val = "LATE" if is_late else "PRESENT"

                att = AttendanceRecord(
                    session_id=sess.id,
                    student_id=st.id,
                    status=status_val,
                    confidence_score=round(random.uniform(0.78, 0.96), 2) if is_present else 0.0,
                    observations_count=random.randint(6, 18) if is_present else 0,
                    duration_minutes=random.uniform(35.0, 55.0) if is_present else 0.0,
                    is_late=is_late,
                    marked_at=datetime.combine(s_date, time(10, 15), tzinfo=timezone.utc)
                )
                db.add(att)
            db.commit()

    # 11. Today's Ready Session (Ready for demo CCTV upload and live test)
    active_session = LectureSession(
        timetable_id=tt_cv_mon.id,
        subject_id=subj_cv.id,
        faculty_id=faculty_sharma.id,
        classroom_id=lh_101.id,
        session_date=today,
        start_time=time(10, 0),
        end_time=time(11, 0),
        status="READY",
        video_source_type="CCTV_UPLOAD",
        video_filename="sample_classroom_cctv.mp4"
    )
    db.add(active_session)
    db.commit()

    # 12. Notifications & Audit Logs
    db.add(Notification(
        title="Session Completed",
        message="CS601: Computer Vision & Pattern Recognition attendance recorded for LH-101.",
        severity="SUCCESS",
        link="/attendance"
    ))
    db.add(Notification(
        title="Attendance Shortage Alert",
        message="Rohan Verma (1RV21AI003) attendance dropped below 65% in CS601.",
        severity="ALERT",
        link="/analytics"
    ))
    db.add(Notification(
        title="CCTV Stream Active",
        message="CAM-LH101-01 Front Wide CCTV stream operating at 30 FPS.",
        severity="INFO",
        link="/live"
    ))
    
    db.add(AuditLog(
        user_email="admin@synapse.ai",
        action="SYSTEM_INIT",
        entity="System",
        details="Initial seed data and biometric profiles registered successfully.",
        ip_address="127.0.0.1"
    ))
    db.commit()
    db.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()

