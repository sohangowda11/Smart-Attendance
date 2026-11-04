from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

class DepartmentBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ClassroomBase(BaseModel):
    room_number: str
    building: str = "Turing Block"
    floor: int = 1
    capacity: int = 60
    has_cctv: bool = True

class ClassroomCreate(ClassroomBase):
    pass

class ClassroomOut(ClassroomBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class SubjectBase(BaseModel):
    code: str
    name: str
    department_id: int
    semester: int = 6
    credits: int = 4
    faculty_id: Optional[int] = None

class SubjectCreate(SubjectBase):
    pass

class SubjectOut(SubjectBase):
    id: int
    created_at: datetime
    faculty_name: Optional[str] = None
    department_code: Optional[str] = None

    class Config:
        from_attributes = True

