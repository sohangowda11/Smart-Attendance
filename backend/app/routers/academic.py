from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Department, Classroom, Subject, AuditLog
from ..schemas.academic import (
    DepartmentCreate, DepartmentOut,
    ClassroomCreate, ClassroomOut,
    SubjectCreate, SubjectOut
)
from ..auth import require_faculty_or_admin, require_admin

router = APIRouter(tags=["Academic Management"])

# Departments
@router.get("/departments", response_model=List[DepartmentOut])
def get_departments(db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    return db.query(Department).all()

@router.post("/departments", response_model=DepartmentOut)
def create_department(dept_in: DepartmentCreate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    existing = db.query(Department).filter(Department.code == dept_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department with this code already exists")
    dept = Department(**dept_in.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

# Classrooms
@router.get("/classrooms", response_model=List[ClassroomOut])
def get_classrooms(db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    return db.query(Classroom).all()

@router.post("/classrooms", response_model=ClassroomOut)
def create_classroom(cr_in: ClassroomCreate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    existing = db.query(Classroom).filter(Classroom.room_number == cr_in.room_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Classroom with this room number already exists")
    cr = Classroom(**cr_in.model_dump())
    db.add(cr)
    db.commit()
    db.refresh(cr)
    return cr

# Subjects
@router.get("/subjects", response_model=List[SubjectOut])
def get_subjects(
    department_id: Optional[int] = None,
    semester: Optional[int] = None,
    faculty_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    query = db.query(Subject)
    if department_id:
        query = query.filter(Subject.department_id == department_id)
    if semester:
        query = query.filter(Subject.semester == semester)
    if faculty_id:
        query = query.filter(Subject.faculty_id == faculty_id)
    
    subjects = query.all()
    results = []
    for s in subjects:
        results.append(SubjectOut(
            id=s.id,
            code=s.code,
            name=s.name,
            department_id=s.department_id,
            semester=s.semester,
            credits=s.credits,
            faculty_id=s.faculty_id,
            created_at=s.created_at,
            faculty_name=s.assigned_faculty.full_name if s.assigned_faculty else None,
            department_code=s.department.code if s.department else None
        ))
    return results

@router.post("/subjects", response_model=SubjectOut)
def create_subject(subj_in: SubjectCreate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    existing = db.query(Subject).filter(Subject.code == subj_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject with this code already exists")
    subj = Subject(**subj_in.model_dump())
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return SubjectOut(
        id=subj.id,
        code=subj.code,
        name=subj.name,
        department_id=subj.department_id,
        semester=subj.semester,
        credits=subj.credits,
        faculty_id=subj.faculty_id,
        created_at=subj.created_at,
        faculty_name=subj.assigned_faculty.full_name if subj.assigned_faculty else None,
        department_code=subj.department.code if subj.department else None
    )

