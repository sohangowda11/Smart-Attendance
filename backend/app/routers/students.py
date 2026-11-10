import os
import json
import shutil
import cv2
import numpy as np
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import Student, BiometricEnrollment, BiometricConsent, AttendanceRecord, Department, AuditLog, Subject
from ..schemas.student import StudentCreate, StudentUpdate, StudentOut
from ..auth import require_faculty_or_admin, require_admin, get_current_user
from ..config import ENROLLMENTS_DIR
from ..services.cv_engine import cv_engine
from ..services.biometric_enrollment_service import biometric_enrollment_service
from ..services.biometric_service import biometric_service

router = APIRouter(prefix="/students", tags=["Students"])

@router.get("", response_model=List[StudentOut])
def get_students(
    department_id: Optional[int] = None,
    semester: Optional[int] = None,
    section: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    query = db.query(Student).filter(Student.is_active == True)
    if department_id:
        query = query.filter(Student.department_id == department_id)
    if semester:
        query = query.filter(Student.semester == semester)
    if section:
        query = query.filter(Student.section == section)
    if search:
        search_filter = f"%{search}%"
        query = query.filter((Student.full_name.ilike(search_filter)) | (Student.usn.ilike(search_filter)))

    students = query.order_by(Student.usn).all()
    results = []
    for s in students:
        # Calculate attendance statistics
        total_att = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s.id).count()
        attended = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == s.id,
            AttendanceRecord.status.in_(["PRESENT", "LATE"])
        ).count()
        pct = round((attended / total_att * 100.0), 1) if total_att > 0 else 100.0

        has_bio = len(s.biometric_enrollments) > 0

        results.append(StudentOut(
            id=s.id,
            usn=s.usn,
            full_name=s.full_name,
            email=s.email,
            phone=s.phone,
            department_id=s.department_id,
            department_code=s.department.code if s.department else None,
            department_name=s.department.name if s.department else None,
            semester=s.semester,
            section=s.section,
            photo_url=s.photo_url,
            consent_status=s.consent_status,
            is_active=s.is_active,
            created_at=s.created_at,
            has_biometric=has_bio,
            attendance_percentage=pct,
            total_lectures=total_att,
            attended_lectures=attended
        ))
    return results

@router.get("/{student_id}")
def get_student_details(
    student_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Attendance history
    records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id).order_by(AttendanceRecord.marked_at.desc()).limit(50).all()
    
    total = len(records)
    attended = len([r for r in records if r.status in ["PRESENT", "LATE"]])
    overall_pct = round((attended / total * 100.0), 1) if total > 0 else 100.0

    # Subject-wise attendance breakdown
    subjects = db.query(Subject).filter(Subject.semester == student.semester).all()
    subject_stats = []
    for subj in subjects:
        subj_records = [r for r in records if r.session and r.session.subject_id == subj.id]
        subj_total = len(subj_records)
        subj_attended = len([r for r in subj_records if r.status in ["PRESENT", "LATE"]])
        subj_pct = round((subj_attended / subj_total * 100.0), 1) if subj_total > 0 else 100.0
        subject_stats.append({
            "subject_id": subj.id,
            "subject_code": subj.code,
            "subject_name": subj.name,
            "total_lectures": subj_total,
            "attended_lectures": subj_attended,
            "attendance_percentage": subj_pct,
            "is_shortage": subj_pct < 75.0
        })

    formatted_records = []
    for r in records:
        formatted_records.append({
            "id": r.id,
            "session_id": r.session_id,
            "subject_code": r.session.subject.code if r.session and r.session.subject else "N/A",
            "subject_name": r.session.subject.name if r.session and r.session.subject else "N/A",
            "date": str(r.session.session_date) if r.session else "N/A",
            "status": r.status,
            "confidence_score": r.confidence_score,
            "is_late": r.is_late,
            "manual_correction": r.manual_correction,
            "marked_at": r.marked_at
        })

    return {
        "student": {
            "id": student.id,
            "usn": student.usn,
            "full_name": student.full_name,
            "email": student.email,
            "phone": student.phone,
            "department": student.department.name if student.department else None,
            "department_code": student.department.code if student.department else None,
            "semester": student.semester,
            "section": student.section,
            "photo_url": student.photo_url,
            "consent_status": student.consent_status,
            "has_biometric": len(student.biometric_enrollments) > 0,
            "created_at": student.created_at
        },
        "stats": {
            "overall_percentage": overall_pct,
            "total_lectures": total,
            "attended_lectures": attended,
            "absent_lectures": total - attended,
            "is_shortage": overall_pct < 75.0
        },
        "subject_breakdown": subject_stats,
        "recent_history": formatted_records
    }

@router.post("", response_model=StudentOut)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    existing = db.query(Student).filter(Student.usn == student_in.usn).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student with this USN already exists")

    student = Student(**student_in.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    biometric_service.refresh_cache(db)

    # Consent
    db.add(BiometricConsent(
        student_id=student.id,
        consented=student_in.consent_status,
        signed_by=student.full_name,
        ip_address="127.0.0.1"
    ))
    db.add(AuditLog(
        user_email=current_user.email,
        action="STUDENT_CREATED",
        entity="Student",
        entity_id=str(student.id),
        details=f"Registered student {student.full_name} ({student.usn})",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return StudentOut(
        id=student.id,
        usn=student.usn,
        full_name=student.full_name,
        email=student.email,
        phone=student.phone,
        department_id=student.department_id,
        department_code=student.department.code if student.department else None,
        department_name=student.department.name if student.department else None,
        semester=student.semester,
        section=student.section,
        photo_url=student.photo_url,
        consent_status=student.consent_status,
        is_active=student.is_active,
        created_at=student.created_at,
        has_biometric=False,
        attendance_percentage=100.0,
        total_lectures=0,
        attended_lectures=0
    )

@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    student_in: StudentUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = student_in.model_dump(exclude_unset=True)
    if "usn" in update_data and update_data["usn"] != student.usn:
        conflict = db.query(Student).filter(Student.usn == update_data["usn"], Student.id != student_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Another student with this USN already exists")

    for k, v in update_data.items():
        setattr(student, k, v)

    db.add(AuditLog(
        user_email=current_user.email,
        action="STUDENT_UPDATED",
        entity="Student",
        entity_id=str(student.id),
        details=f"Updated student record for {student.usn}",
        ip_address="127.0.0.1"
    ))
    db.commit()
    db.refresh(student)
    biometric_service.refresh_cache(db)

    return StudentOut(
        id=student.id,
        usn=student.usn,
        full_name=student.full_name,
        email=student.email,
        phone=student.phone,
        department_id=student.department_id,
        department_code=student.department.code if student.department else None,
        department_name=student.department.name if student.department else None,
        semester=student.semester,
        section=student.section,
        photo_url=student.photo_url,
        consent_status=student.consent_status,
        is_active=student.is_active,
        created_at=student.created_at,
        has_biometric=len(student.biometric_enrollments) > 0
    )

@router.post("/{student_id}/enroll-face")
async def enroll_student_face(
    student_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Validate image extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png"]:
        raise HTTPException(status_code=400, detail="Only JPG and PNG images are supported")

    filename = f"student_enroll_{student.id}_{student.usn}{ext}"
    file_path = ENROLLMENTS_DIR / filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Perform CV face detection and 128-d embedding extraction
    det_results = cv_engine.extract_face_embeddings(str(file_path))
    if not det_results:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail="No face detected in reference photo. Please upload a clear frontal portrait.")

    best_face = det_results[0]
    if not best_face["is_acceptable"]:
        raise HTTPException(status_code=400, detail=f"Image quality is too low (Score: {best_face['quality_score']}). Please provide a sharper, well-lit image.")

    # Remove prior enrollments if re-enrolling
    db.query(BiometricEnrollment).filter(BiometricEnrollment.student_id == student.id).delete()

    rel_path = f"/storage/enrollments/{filename}"
    student.photo_url = rel_path

    enrollment = BiometricEnrollment(
        student_id=student.id,
        embedding_data=json.dumps(best_face["embedding"]),
        quality_score=best_face["quality_score"],
        model_version="dlib-face-recognition-v1",
        photo_path=rel_path,
        face_bbox=",".join(map(str, best_face["bbox"]))
    )
    db.add(enrollment)
    db.add(AuditLog(
        user_email=current_user.email,
        action="BIOMETRIC_ENROLLMENT",
        entity="Student",
        entity_id=str(student.id),
        details=f"Biometric face embedding generated and saved for {student.full_name} ({student.usn})",
        ip_address="127.0.0.1"
    ))
    db.commit()
    biometric_service.refresh_cache(db)

    return {
        "message": "Student face enrolled successfully",
        "student_id": student.id,
        "photo_url": rel_path,
        "quality_score": best_face["quality_score"]
    }

@router.delete("/{student_id}")
def delete_or_deactivate_student(
    student_id: int,
    permanent: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    att_count = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id).count()

    if permanent:
        if att_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot permanently delete student {student.usn} because {att_count} historical attendance records exist. Please deactivate instead to preserve audit logs."
            )
        # Safe to hard delete if no historical attendance
        db.query(BiometricEnrollment).filter(BiometricEnrollment.student_id == student_id).delete()
        db.query(BiometricConsent).filter(BiometricConsent.student_id == student_id).delete()
        db.delete(student)
        action_desc = "PERMANENTLY_DELETED"
    else:
        # Safe soft-deactivation (preserves all records, audit logs, and attendance)
        student.is_active = False
        action_desc = "DEACTIVATED"

    db.add(AuditLog(
        user_email=current_user.email,
        action=f"STUDENT_{action_desc}",
        entity="Student",
        entity_id=str(student_id),
        details=f"Student {student.full_name} ({student.usn}) was {action_desc.lower()}. Historical attendance records: {att_count} preserved.",
        ip_address="127.0.0.1"
    ))
    db.commit()
    biometric_service.refresh_cache(db)

    return {
        "message": f"Student {student.full_name} successfully {action_desc.lower()}",
        "student_id": student_id,
        "action": action_desc,
        "historical_attendance_preserved": att_count
    }

@router.post("/{student_id}/enroll-multiframe")
async def enroll_student_multiframe(
    student_id: int,
    files: List[UploadFile] = File(None),
    video_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    frames_bgr: List[np.ndarray] = []

    # 1. If image frames uploaded (sampled frames from client webcam)
    if files:
        for f in files:
            ext = os.path.splitext(f.filename)[1].lower()
            if ext in [".jpg", ".jpeg", ".png"]:
                contents = await f.read()
                np_arr = np.frombuffer(contents, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if img is not None and img.size > 0:
                    frames_bgr.append(img)

    # 2. If short video file uploaded
    if video_file and video_file.filename:
        temp_video_path = ENROLLMENTS_DIR / f"temp_{student.id}_{video_file.filename}"
        with open(temp_video_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)

        cap = cv2.VideoCapture(str(temp_video_path))
        total_vframes = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_vframes > 0:
            # Sample ~25 evenly spaced candidate frames across the recording
            step = max(1, total_vframes // 25)
            idx = 0
            while cap.isOpened() and len(frames_bgr) < 30:
                ret, frame = cap.read()
                if not ret:
                    break
                if idx % step == 0:
                    frames_bgr.append(frame)
                idx += 1
        cap.release()
        if os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except Exception:
                pass

    if len(frames_bgr) == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid video frames received. Please allow camera access and try recording again."
        )

    try:
        result = biometric_enrollment_service.enroll_student_from_frames(
            student=student,
            candidate_frames=frames_bgr,
            db=db,
            current_user_email=current_user.email
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Biometric enrollment error: {str(e)}"
        )

