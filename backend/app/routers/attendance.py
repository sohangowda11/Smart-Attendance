from datetime import datetime, timezone, date, time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import LectureSession, AttendanceRecord, Student, Subject, Classroom, User, AuditLog
from ..schemas.timetable import LectureSessionCreate, LectureSessionOut
from ..schemas.attendance import AttendanceRecordOut, AttendanceCorrection
from ..services.attendance_engine import attendance_engine
from ..auth import require_faculty_or_admin, get_current_user

router = APIRouter(prefix="/attendance", tags=["Attendance Engine"])

@router.get("/sessions", response_model=List[LectureSessionOut])
def get_lecture_sessions(
    subject_id: Optional[int] = None,
    faculty_id: Optional[int] = None,
    classroom_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    date_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    query = db.query(LectureSession)
    
    # If logged in as faculty (not admin), show their sessions
    if current_user.role == "FACULTY":
        query = query.filter(LectureSession.faculty_id == current_user.id)
    elif faculty_id:
        query = query.filter(LectureSession.faculty_id == faculty_id)

    if subject_id:
        query = query.filter(LectureSession.subject_id == subject_id)
    if classroom_id:
        query = query.filter(LectureSession.classroom_id == classroom_id)
    if status_filter:
        query = query.filter(LectureSession.status == status_filter)
    if date_filter:
        d = datetime.strptime(date_filter, "%Y-%m-%d").date()
        query = query.filter(LectureSession.session_date == d)

    sessions = query.order_by(LectureSession.session_date.desc(), LectureSession.start_time.desc()).all()
    results = []
    for s in sessions:
        results.append(LectureSessionOut(
            id=s.id,
            timetable_id=s.timetable_id,
            subject_id=s.subject_id,
            subject_name=s.subject.name if s.subject else None,
            subject_code=s.subject.code if s.subject else None,
            faculty_id=s.faculty_id,
            faculty_name=s.faculty.full_name if s.faculty else None,
            classroom_id=s.classroom_id,
            room_number=s.classroom.room_number if s.classroom else None,
            session_date=s.session_date,
            start_time=s.start_time.strftime("%H:%M:%S") if isinstance(s.start_time, time) else str(s.start_time),
            end_time=s.end_time.strftime("%H:%M:%S") if isinstance(s.end_time, time) else str(s.end_time),
            status=s.status,
            video_source_type=s.video_source_type,
            video_filename=s.video_filename,
            annotated_video_path=s.annotated_video_path,
            total_frames=s.total_frames,
            total_detected=s.total_detected,
            total_unique_tracks=s.total_unique_tracks,
            total_recognized=s.total_recognized,
            created_at=s.created_at,
            completed_at=s.completed_at
        ))
    return results

@router.post("/sessions", response_model=LectureSessionOut)
def create_lecture_session(
    session_in: LectureSessionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    s_date = datetime.strptime(session_in.session_date, "%Y-%m-%d").date() if session_in.session_date else date.today()
    st = datetime.strptime(session_in.start_time, "%H:%M:%S").time() if session_in.start_time else time(9, 0)
    et = datetime.strptime(session_in.end_time, "%H:%M:%S").time() if session_in.end_time else time(10, 0)

    # Prevent duplicate active sessions for same classroom & time
    conflict = db.query(LectureSession).filter(
        LectureSession.classroom_id == session_in.classroom_id,
        LectureSession.session_date == s_date,
        LectureSession.status.in_(["ACTIVE", "PROCESSING"])
    ).first()
    if conflict:
        raise HTTPException(
            status_code=400,
            detail=f"An active session is already ongoing in this classroom (Session #{conflict.id})"
        )

    session = LectureSession(
        timetable_id=session_in.timetable_id,
        subject_id=session_in.subject_id,
        faculty_id=session_in.faculty_id if current_user.role == "ADMIN" else current_user.id,
        classroom_id=session_in.classroom_id,
        session_date=s_date,
        start_time=st,
        end_time=et,
        status="READY",
        video_source_type=session_in.video_source_type
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    db.add(AuditLog(
        user_email=current_user.email,
        action="SESSION_CREATED",
        entity="LectureSession",
        entity_id=str(session.id),
        details=f"Created lecture session for subject #{session.subject_id}",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return LectureSessionOut(
        id=session.id,
        timetable_id=session.timetable_id,
        subject_id=session.subject_id,
        subject_name=session.subject.name if session.subject else None,
        subject_code=session.subject.code if session.subject else None,
        faculty_id=session.faculty_id,
        faculty_name=session.faculty.full_name if session.faculty else None,
        classroom_id=session.classroom_id,
        room_number=session.classroom.room_number if session.classroom else None,
        session_date=session.session_date,
        start_time=str(session.start_time),
        end_time=str(session.end_time),
        status=session.status,
        video_source_type=session.video_source_type,
        video_filename=session.video_filename,
        created_at=session.created_at
    )

@router.get("/sessions/{session_id}")
def get_session_details(
    session_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
    
    formatted_records = []
    for r in records:
        formatted_records.append(AttendanceRecordOut(
            id=r.id,
            session_id=r.session_id,
            student_id=r.student_id,
            student_name=r.student.full_name if r.student else None,
            student_usn=r.student.usn if r.student else None,
            student_photo=r.student.photo_url if r.student else None,
            status=r.status,
            confidence_score=r.confidence_score,
            first_detected_at=r.first_detected_at,
            last_detected_at=r.last_detected_at,
            observations_count=r.observations_count,
            duration_minutes=r.duration_minutes,
            is_late=r.is_late,
            is_early_departure=r.is_early_departure,
            manual_correction=r.manual_correction,
            correction_reason=r.correction_reason,
            marked_at=r.marked_at
        ))

    present_count = len([r for r in records if r.status in ["PRESENT", "LATE"]])
    absent_count = len([r for r in records if r.status == "ABSENT"])
    late_count = len([r for r in records if r.status == "LATE" or r.is_late])

    return {
        "session": {
            "id": session.id,
            "subject_code": session.subject.code if session.subject else None,
            "subject_name": session.subject.name if session.subject else None,
            "faculty_name": session.faculty.full_name if session.faculty else None,
            "room_number": session.classroom.room_number if session.classroom else None,
            "date": str(session.session_date),
            "start_time": str(session.start_time),
            "end_time": str(session.end_time),
            "status": session.status,
            "video_filename": session.video_filename,
            "annotated_video_path": session.annotated_video_path,
            "total_frames": session.total_frames,
            "total_detected": session.total_detected,
            "total_unique_tracks": session.total_unique_tracks,
            "total_recognized": session.total_recognized
        },
        "stats": {
            "total_enrolled": len(records),
            "present_count": present_count,
            "absent_count": absent_count,
            "late_count": late_count,
            "attendance_pct": round(present_count / len(records) * 100.0, 1) if records else 0.0
        },
        "records": formatted_records
    }

@router.put("/records/{record_id}/correct")
def correct_attendance_record(
    record_id: int,
    correction: AttendanceCorrection,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    old_status = record.status
    record.status = correction.new_status
    record.manual_correction = True
    record.corrected_by_user_id = current_user.id
    record.correction_reason = correction.reason

    db.add(AuditLog(
        user_email=current_user.email,
        action="ATTENDANCE_CORRECTED",
        entity="AttendanceRecord",
        entity_id=str(record.id),
        details=f"Status changed from {old_status} to {correction.new_status}. Reason: {correction.reason}",
        ip_address="127.0.0.1"
    ))
    db.commit()
    db.refresh(record)

    return {
        "message": "Attendance record corrected successfully",
        "record_id": record.id,
        "old_status": old_status,
        "new_status": record.status,
        "reason": record.correction_reason
    }

@router.post("/sessions/{session_id}/finalize")
def finalize_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    result = attendance_engine.finalize_lecture_attendance(db, session_id)
    return result

