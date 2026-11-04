from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, AuditLog
from ..schemas.auth import Token, UserLogin, UserOut
from ..auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    # Record login in audit log
    db.add(AuditLog(
        user_email=user.email,
        action="USER_LOGIN",
        entity="User",
        entity_id=str(user.id),
        details=f"Successful authentication for {user.role} role",
        ip_address="127.0.0.1"
    ))
    db.commit()

    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    
    dept_name = user.department.name if user.department else None
    user_out = UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        department_id=user.department_id,
        department_name=dept_name,
        designation=user.designation,
        phone=user.phone,
        is_active=user.is_active,
        created_at=user.created_at
    )
    return Token(access_token=access_token, user=user_out)

@router.get("/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)):
    dept_name = current_user.department.name if current_user.department else None
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        department_id=current_user.department_id,
        department_name=dept_name,
        designation=current_user.designation,
        phone=current_user.phone,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.add(AuditLog(
        user_email=current_user.email,
        action="USER_LOGOUT",
        entity="User",
        entity_id=str(current_user.id),
        details="User logged out cleanly",
        ip_address="127.0.0.1"
    ))
    db.commit()
    return {"message": "Logged out successfully"}

