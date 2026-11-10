from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Department, AuditLog, Subject, LectureSession
from ..schemas.auth import UserCreate, UserUpdate, UserOut, PasswordResetIn
from ..auth import require_admin, get_password_hash

router = APIRouter(prefix="/faculty", tags=["Faculty"])

@router.get("", response_model=List[UserOut])
def list_faculty(
    department_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    query = db.query(User).filter(User.role == "FACULTY")
    if department_id:
        query = query.filter(User.department_id == department_id)
    if search:
        s = f"%{search}%"
        query = query.filter((User.full_name.ilike(s)) | (User.email.ilike(s)))

    faculty_list = query.order_by(User.id.asc()).all()
    results = []
    for f in faculty_list:
        results.append(UserOut(
            id=f.id,
            email=f.email,
            full_name=f.full_name,
            role=f.role,
            department_id=f.department_id,
            department_name=f.department.name if f.department else None,
            designation=f.designation,
            phone=f.phone,
            is_active=f.is_active,
            created_at=f.created_at
        ))
    return results

@router.get("/{faculty_id}")
def get_faculty_details(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    user = db.query(User).filter(User.id == faculty_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Faculty member not found")

    # Fetch assigned subjects
    subjects = db.query(Subject).filter(Subject.faculty_id == faculty_id).all()
    assigned_subjs = [{
        "id": s.id,
        "code": s.code,
        "name": s.name,
        "semester": s.semester,
        "credits": s.credits
    } for s in subjects]

    # Fetch total sessions conducted
    total_sessions = db.query(LectureSession).filter(LectureSession.faculty_id == faculty_id).count()

    return {
        "faculty": UserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            department_id=user.department_id,
            department_name=user.department.name if user.department else None,
            designation=user.designation,
            phone=user.phone,
            is_active=user.is_active,
            created_at=user.created_at
        ),
        "assigned_subjects": assigned_subjs,
        "total_sessions_conducted": total_sessions
    }

@router.post("", response_model=UserOut)
def create_faculty(user_in: UserCreate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    hashed_pw = get_password_hash(user_in.password)
    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hashed_pw,
        role=user_in.role or "FACULTY",
        department_id=user_in.department_id,
        designation=user_in.designation or "Assistant Professor",
        phone=user_in.phone
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(AuditLog(
        user_email=current_user.email,
        action="FACULTY_CREATED",
        entity="User",
        entity_id=str(user.id),
        details=f"Created faculty account for {user.full_name} ({user.email})",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        department_id=user.department_id,
        department_name=user.department.name if user.department else None,
        designation=user.designation,
        phone=user.phone,
        is_active=user.is_active,
        created_at=user.created_at
    )

@router.put("/{faculty_id}", response_model=UserOut)
def update_faculty(faculty_id: int, user_in: UserUpdate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    user = db.query(User).filter(User.id == faculty_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Faculty member not found")

    update_dict = user_in.model_dump(exclude_unset=True)
    if "email" in update_dict and update_dict["email"] != user.email:
        conflict = db.query(User).filter(User.email == update_dict["email"], User.id != faculty_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Another user with this email already exists")

    for k, v in update_dict.items():
        setattr(user, k, v)

    db.add(AuditLog(
        user_email=current_user.email,
        action="FACULTY_UPDATED",
        entity="User",
        entity_id=str(user.id),
        details=f"Updated faculty record {user.email}",
        ip_address="127.0.0.1"
    ))
    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        department_id=user.department_id,
        department_name=user.department.name if user.department else None,
        designation=user.designation,
        phone=user.phone,
        is_active=user.is_active,
        created_at=user.created_at
    )

@router.post("/{faculty_id}/reset-password")
def reset_faculty_password(
    faculty_id: int,
    data: PasswordResetIn,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    user = db.query(User).filter(User.id == faculty_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Faculty member not found")

    if not data.new_password or len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    user.hashed_password = get_password_hash(data.new_password)
    db.add(AuditLog(
        user_email=current_user.email,
        action="FACULTY_PASSWORD_RESET",
        entity="User",
        entity_id=str(user.id),
        details=f"Administrative password reset performed for faculty {user.email}",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return {"message": f"Password reset successfully for {user.full_name} ({user.email})"}

@router.delete("/{faculty_id}")
def delete_or_deactivate_faculty(
    faculty_id: int,
    permanent: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    if current_user.id == faculty_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate or delete your own active administrator account")

    user = db.query(User).filter(User.id == faculty_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Faculty member not found")

    session_count = db.query(LectureSession).filter(LectureSession.faculty_id == faculty_id).count()

    if permanent:
        if session_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot permanently delete faculty {user.email} because {session_count} lecture sessions exist. Please deactivate instead to preserve audit logs."
            )
        db.delete(user)
        action_desc = "PERMANENTLY_DELETED"
    else:
        user.is_active = False
        action_desc = "DEACTIVATED"

    db.add(AuditLog(
        user_email=current_user.email,
        action=f"FACULTY_{action_desc}",
        entity="User",
        entity_id=str(faculty_id),
        details=f"Faculty account {user.email} was {action_desc.lower()}. Conducted sessions: {session_count} preserved.",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return {
        "message": f"Faculty {user.full_name} successfully {action_desc.lower()}",
        "faculty_id": faculty_id,
        "action": action_desc,
        "sessions_preserved": session_count
    }

