from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

class StudentBase(BaseModel):
    usn: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    semester: int = 6
    section: str = "A"
    consent_status: bool = True

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    usn: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    consent_status: Optional[bool] = None
    is_active: Optional[bool] = None

class BiometricEnrollmentOut(BaseModel):
    id: int
    quality_score: float
    model_version: str
    photo_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class StudentOut(StudentBase):
    id: int
    photo_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    has_biometric: bool = False
    attendance_percentage: Optional[float] = None
    total_lectures: Optional[int] = 0
    attended_lectures: Optional[int] = 0

    class Config:
        from_attributes = True
