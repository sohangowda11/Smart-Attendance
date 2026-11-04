from datetime import datetime, timezone, date, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import (
    Student, AttendanceRecord, LectureSession, Classroom,
    Camera, Subject, User, SystemSetting
)
from ..schemas.analytics import DashboardStats, TrendPoint, SubjectAttendance, ShortageStudent, ClassroomOccupancy
from ..auth import require_faculty_or_admin, get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics & Intelligence"])

@router.get("/dashboard", response_model=DashboardStats)
def get_admin_dashboard_stats(db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    today = date.today()
    
    total_students = db.query(Student).filter(Student.is_active == True).count()
    
    # Today's attendances
    today_sessions = db.query(LectureSession.id).filter(LectureSession.session_date == today).all()
    today_session_ids = [s[0] for s in today_sessions]

    if today_session_ids:
        present_today = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id.in_(today_session_ids),
            AttendanceRecord.status.in_(["PRESENT", "LATE"])
        ).count()
        absent_today = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id.in_(today_session_ids),
            AttendanceRecord.status == "ABSENT"
        ).count()
    else:
        # Fallback to last recorded session day for demo visibility
        last_session = db.query(LectureSession).order_by(LectureSession.session_date.desc()).first()
        if last_session:
            ref_date = last_session.session_date
            ref_sessions = db.query(LectureSession.id).filter(LectureSession.session_date == ref_date).all()
            ref_ids = [s[0] for s in ref_sessions]
            present_today = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id.in_(ref_ids),
                AttendanceRecord.status.in_(["PRESENT", "LATE"])
            ).count()
            absent_today = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id.in_(ref_ids),
                AttendanceRecord.status == "ABSENT"
            ).count()
        else:
            present_today = 0
            absent_today = 0

    # Overall percentage
    total_records = db.query(AttendanceRecord).count()
    total_present = db.query(AttendanceRecord).filter(AttendanceRecord.status.in_(["PRESENT", "LATE"])).count()
    overall_pct = round((total_present / total_records * 100.0), 1) if total_records > 0 else 0.0

    active_classrooms = db.query(Classroom).count()
    connected_cameras = db.query(Camera).filter(Camera.status == "ONLINE").count()
    ongoing_lectures = db.query(LectureSession).filter(LectureSession.status.in_(["ACTIVE", "PROCESSING"])).count()
    completed_sessions = db.query(LectureSession).filter(LectureSession.status == "COMPLETED").count()

    return DashboardStats(
        total_students=total_students,
        present_today=present_today,
        absent_today=absent_today,
        overall_attendance_pct=overall_pct,
        active_classrooms=active_classrooms,
        connected_cameras=connected_cameras,
        ongoing_lectures=ongoing_lectures,
        completed_sessions=completed_sessions
    )

@router.get("/faculty-dashboard")
def get_faculty_dashboard_stats(db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    today = date.today()
    
    # Faculty assigned subjects
    subjects = db.query(Subject).filter(Subject.faculty_id == current_user.id).all()
    subject_ids = [s.id for s in subjects]

    # Faculty sessions
    my_sessions = db.query(LectureSession).filter(LectureSession.faculty_id == current_user.id).all()
    my_session_ids = [s.id for s in my_sessions]

    total_records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(my_session_ids)).count() if my_session_ids else 0
    total_present = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id.in_(my_session_ids),
        AttendanceRecord.status.in_(["PRESENT", "LATE"])
    ).count() if my_session_ids else 0

    pct = round((total_present / total_records * 100.0), 1) if total_records > 0 else 0.0

    return {
        "faculty_name": current_user.full_name,
        "assigned_subjects_count": len(subjects),
        "total_sessions_conducted": len(my_sessions),
        "average_attendance_pct": pct,
        "subjects": [{"code": s.code, "name": s.name} for s in subjects]
    }

@router.get("/trends", response_model=List[TrendPoint])
def get_attendance_trends(days: int = 10, db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    # Group past sessions by date
    sessions = db.query(LectureSession).filter(LectureSession.status == "COMPLETED").order_by(LectureSession.session_date).all()
    
    date_map: Dict[str, Dict[str, int]] = {}
    for s in sessions:
        d_str = str(s.session_date)
        if d_str not in date_map:
            date_map[d_str] = {"present": 0, "total": 0}
        
        recs = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).all()
        for r in recs:
            date_map[d_str]["total"] += 1
            if r.status in ["PRESENT", "LATE"]:
                date_map[d_str]["present"] += 1

    trend_points = []
    for d_str, counts in sorted(date_map.items())[-days:]:
        tot = counts["total"]
        pres = counts["present"]
        rate = round((pres / tot * 100.0), 1) if tot > 0 else 0.0
        trend_points.append(TrendPoint(
            date=d_str,
            attendance_rate=rate,
            present_count=pres,
            total_count=tot
        ))
    return trend_points

@router.get("/shortage", response_model=List[ShortageStudent])
def get_attendance_shortage(
    department_id: Optional[int] = None,
    threshold: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    # Retrieve configured threshold from system settings if not provided
    if threshold is None:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "MIN_ATTENDANCE_PCT").first()
        threshold = float(setting.value) if setting else 75.0

    students_query = db.query(Student).filter(Student.is_active == True)
    if department_id:
        students_query = students_query.filter(Student.department_id == department_id)

    students = students_query.all()
    shortage_list = []

    for s in students:
        total = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s.id).count()
        if total == 0:
            continue
        attended = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == s.id,
            AttendanceRecord.status.in_(["PRESENT", "LATE"])
        ).count()
        pct = round((attended / total * 100.0), 1)

        if pct < threshold:
            crit = "CRITICAL" if pct < 65.0 else "WARNING"
            shortage_list.append(ShortageStudent(
                student_id=s.id,
                name=s.full_name,
                usn=s.usn,
                department=s.department.name if s.department else "N/A",
                semester=s.semester,
                section=s.section,
                attendance_pct=pct,
                attended_lectures=attended,
                total_lectures=total,
                critical_status=crit
            ))

    # Sort ascending by attendance percentage (lowest attendance first)
    shortage_list.sort(key=lambda x: x.attendance_pct)
    return shortage_list

@router.get("/occupancy", response_model=List[ClassroomOccupancy])
def get_classroom_occupancy(db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    classrooms = db.query(Classroom).all()
    results = []

    for cr in classrooms:
        # Check active cameras
        cams = db.query(Camera).filter(Camera.classroom_id == cr.id).all()
        cam_status = "ONLINE" if any(c.status == "ONLINE" for c in cams) else "OFFLINE"

        # Check ongoing session
        ongoing = db.query(LectureSession).filter(
            LectureSession.classroom_id == cr.id,
            LectureSession.status.in_(["ACTIVE", "PROCESSING"])
        ).first()

        curr_occ = ongoing.total_detected if ongoing else 0
        tracked = ongoing.total_unique_tracks if ongoing else 0
        recog = ongoing.total_recognized if ongoing else 0

        occ_pct = round((curr_occ / cr.capacity * 100.0), 1) if cr.capacity > 0 else 0.0

        results.append(ClassroomOccupancy(
            room_number=cr.room_number,
            capacity=cr.capacity,
            current_occupancy=curr_occ,
            tracked_unique=tracked,
            recognized_students=recog,
            occupancy_pct=occ_pct,
            camera_status=cam_status
        ))
    return results

