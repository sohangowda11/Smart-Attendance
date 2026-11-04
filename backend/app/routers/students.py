import os
import json
import shutil
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
    current_user = Depends(require_admin)
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

    return {
        "message": "Student face enrolled successfully",
        "student_id": student.id,
        "photo_url": rel_path,
        "quality_score": best_face["quality_score"]
    }

