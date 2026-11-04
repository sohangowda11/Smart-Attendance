from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Department, AuditLog, Subject
from ..schemas.auth import UserCreate, UserUpdate, UserOut
from ..auth import require_admin, get_password_hash

router = APIRouter(prefix="/faculty", tags=["Faculty"])

@router.get("", response_model=List[UserOut])
def list_faculty(db: Session = Depends(get_db), current_user = Depends(require_admin)):
    faculty_list = db.query(User).filter(User.role == "FACULTY").all()
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

    for k, v in user_in.model_dump(exclude_unset=True).items():
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

