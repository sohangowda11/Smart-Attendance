import base64
import cv2
import numpy as np
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import LectureSession, Student, AttendanceRecord, AuditLog
from ..auth import require_faculty_or_admin
from ..services.webcam_attendance_manager import webcam_attendance_manager

router = APIRouter(prefix="/webcam", tags=["Live Laptop Webcam Attendance"])

class StartSessionIn(BaseModel):
    subject_id: int
    classroom_id: int
    timetable_id: Optional[int] = None

class ProcessFrameIn(BaseModel):
    session_id: int
    image_base64: str
    client_timestamp: Optional[float] = None

class FinalizeSessionIn(BaseModel):
    session_id: int
    confirm_absentees: bool = True

class ManualMarkIn(BaseModel):
    session_id: int
    student_id: int
    status: str = "PRESENT"
    reason: Optional[str] = "Faculty manual confirmation during live session"

@router.post("/start")
def start_webcam_session(
    data: StartSessionIn,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    try:
        res = webcam_attendance_manager.start_session(
            db=db,
            subject_id=data.subject_id,
            classroom_id=data.classroom_id,
            current_user=current_user,
            timetable_id=data.timetable_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/process-frame")
def process_webcam_frame(
    data: ProcessFrameIn,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    # Decode base64 frame string
    try:
        raw_b64 = data.image_base64
        # Strip header if present e.g. "data:image/jpeg;base64,"
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]

        image_bytes = base64.b64decode(raw_b64)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None or frame.size == 0:
            raise HTTPException(status_code=400, detail="Invalid frame buffer received")

        result = webcam_attendance_manager.process_frame(
            db=db,
            session_id=data.session_id,
            bgr_frame=frame,
            client_timestamp=data.client_timestamp
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame processing error: {e}")

@router.get("/session/{session_id}")
def get_session_live_status(
    session_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    state = webcam_attendance_manager.get_session_state(session_id)
    if state:
        roster_list = list(state["roster"].values())
        return {
            "session_id": session_id,
            "status": "ACTIVE",
            "subject_code": state["subject_code"],
            "subject_name": state["subject_name"],
            "room_number": state["room_number"],
            "faculty_name": state["faculty_name"],
            "roster": roster_list,
            "metrics": {
                "total_roster": len(roster_list),
                "total_visible_people": len(state["recognized_student_ids"]) + len(state["unknown_tracks"]),
                "recognized_students": len(state["recognized_student_ids"]),
                "attendance_marked": len(state["attendance_marked_ids"]),
                "unknown_individuals": len(state["unknown_tracks"]),
                "remaining_students": max(0, len(roster_list) - len(state["recognized_student_ids"]))
            }
        }

    # If not in active memory, query DB
    session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
    present_count = len([r for r in records if r.status in ["PRESENT", "LATE"]])

    return {
        "session_id": session_id,
        "status": session.status,
        "subject_code": session.subject.code if session.subject else "N/A",
        "subject_name": session.subject.name if session.subject else "N/A",
        "room_number": session.classroom.room_number if session.classroom else "N/A",
        "faculty_name": session.faculty.full_name if session.faculty else "N/A",
        "metrics": {
            "total_roster": len(records),
            "total_visible_people": session.total_unique_tracks or present_count,
            "recognized_students": session.total_recognized or present_count,
            "attendance_marked": present_count,
            "unknown_individuals": 0,
            "remaining_students": max(0, len(records) - present_count)
        }
    }

@router.post("/finalize")
def finalize_webcam_session(
    data: FinalizeSessionIn,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    try:
        res = webcam_attendance_manager.finalize_session(
            db=db,
            session_id=data.session_id,
            confirm_absentees=data.confirm_absentees
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/manual-mark")
def manual_mark_student(
    data: ManualMarkIn,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    """
    Allows faculty to manually verify and mark a student present if their face was temporarily obscured.
    """
    state = webcam_attendance_manager.get_session_state(data.session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Active session not found")

    student_id = data.student_id
    if student_id not in state["roster"]:
        raise HTTPException(status_code=400, detail="Student is not in the active class roster")

    now = datetime.now()
    state["recognized_student_ids"].add(student_id)
    state["attendance_marked_ids"].add(student_id)
    state["roster"][student_id]["status"] = data.status
    state["roster"][student_id]["confidence"] = 1.0
    state["roster"][student_id]["marked_at"] = now.strftime("%H:%M:%S")

    # Record in database
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == data.session_id,
        AttendanceRecord.student_id == student_id
    ).first()

    if not record:
        record = AttendanceRecord(
            session_id=data.session_id,
            student_id=student_id,
            status=data.status,
            confidence_score=1.0,
            observations_count=1,
            manual_correction=True,
            corrected_by_user_id=current_user.id,
            correction_reason=data.reason,
            first_detected_at=now,
            last_detected_at=now,
            marked_at=now
        )
        db.add(record)
    else:
        record.status = data.status
        record.manual_correction = True
        record.corrected_by_user_id = current_user.id
        record.correction_reason = data.reason
        record.last_detected_at = now

    db.add(AuditLog(
        user_email=current_user.email,
        action="MANUAL_ATTENDANCE_OVERRIDE",
        entity="AttendanceRecord",
        entity_id=str(student_id),
        details=f"Faculty {current_user.full_name} manually verified student #{student_id} as {data.status}. Reason: {data.reason}",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return {
        "message": f"Student #{student_id} marked as {data.status}",
        "student_id": student_id,
        "status": data.status
    }

@router.get("/diagnostic/overview")
def get_biometric_diagnostics_overview(
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    """
    Developer & Faculty Diagnostic API:
    Inspects biometric enrollment status, template count, vector dimensions,
    norm consistency, and in-memory RAM cache status across all students.
    Raw floating-point vectors are never exposed.
    """
    from ..services.biometric_service import biometric_service
    from ..models import BiometricEnrollment
    import json

    cached_ids = set(biometric_service.cached_student_ids)
    students = db.query(Student).order_by(Student.id.asc()).all()
    records = []

    for s in students:
        enrollments = db.query(BiometricEnrollment).filter(BiometricEnrollment.student_id == s.id).all()
        has_enrollment = len(enrollments) > 0
        emb_dim = 0
        emb_norm = 0.0
        model_version = None

        if has_enrollment and enrollments[0].embedding_data:
            try:
                data = json.loads(enrollments[0].embedding_data)
                if isinstance(data, list):
                    emb_dim = len(data)
                    arr = np.array(data, dtype=np.float64)
                    emb_norm = round(float(np.linalg.norm(arr)), 4)
                model_version = enrollments[0].model_version
            except Exception:
                pass

        records.append({
            "student_id": s.id,
            "full_name": s.full_name,
            "usn": s.usn,
            "department_id": s.department_id,
            "semester": s.semester,
            "section": s.section,
            "is_active": s.is_active,
            "has_enrollment": has_enrollment,
            "enrollment_templates_count": len(enrollments),
            "embedding_dimension": emb_dim,
            "embedding_norm": emb_norm,
            "model_version": model_version,
            "in_memory_cache": s.id in cached_ids,
            "photo_url": s.photo_url
        })

    return {
        "total_students": len(students),
        "total_active": len([s for s in students if s.is_active]),
        "cached_active_templates_in_ram": len(biometric_service.cached_encodings),
        "tolerance": biometric_service.default_tolerance,
        "students": records
    }

