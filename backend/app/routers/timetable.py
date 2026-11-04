from datetime import datetime, time, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import TimetableEntry, Subject, Classroom, User, Camera, LectureSession
from ..schemas.timetable import TimetableCreate, TimetableOut
from ..auth import require_faculty_or_admin, require_admin

router = APIRouter(prefix="/timetable", tags=["Timetable"])

@router.get("", response_model=List[TimetableOut])
def get_timetable(
    day_of_week: Optional[int] = None,
    faculty_id: Optional[int] = None,
    classroom_id: Optional[int] = None,
    semester: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    query = db.query(TimetableEntry)
    if day_of_week is not None:
        query = query.filter(TimetableEntry.day_of_week == day_of_week)
    if faculty_id:
        query = query.filter(TimetableEntry.faculty_id == faculty_id)
    if classroom_id:
        query = query.filter(TimetableEntry.classroom_id == classroom_id)
    if semester:
        query = query.filter(TimetableEntry.semester == semester)

    entries = query.order_by(TimetableEntry.day_of_week, TimetableEntry.start_time).all()
    results = []
    for e in entries:
        results.append(TimetableOut(
            id=e.id,
            day_of_week=e.day_of_week,
            start_time=e.start_time.strftime("%H:%M:%S") if isinstance(e.start_time, time) else str(e.start_time),
            end_time=e.end_time.strftime("%H:%M:%S") if isinstance(e.end_time, time) else str(e.end_time),
            subject_id=e.subject_id,
            subject_code=e.subject.code if e.subject else None,
            subject_name=e.subject.name if e.subject else None,
            faculty_id=e.faculty_id,
            faculty_name=e.faculty.full_name if e.faculty else None,
            classroom_id=e.classroom_id,
            room_number=e.classroom.room_number if e.classroom else None,
            building=e.classroom.building if e.classroom else None,
            semester=e.semester,
            section=e.section,
            created_at=e.created_at
        ))
    return results

@router.post("", response_model=TimetableOut)
def create_timetable_entry(entry_in: TimetableCreate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    st = datetime.strptime(entry_in.start_time, "%H:%M:%S").time() if len(entry_in.start_time) == 8 else datetime.strptime(entry_in.start_time, "%H:%M").time()
    et = datetime.strptime(entry_in.end_time, "%H:%M:%S").time() if len(entry_in.end_time) == 8 else datetime.strptime(entry_in.end_time, "%H:%M").time()

    entry = TimetableEntry(
        day_of_week=entry_in.day_of_week,
        start_time=st,
        end_time=et,
        subject_id=entry_in.subject_id,
        faculty_id=entry_in.faculty_id,
        classroom_id=entry_in.classroom_id,
        semester=entry_in.semester,
        section=entry_in.section
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return TimetableOut(
        id=entry.id,
        day_of_week=entry.day_of_week,
        start_time=str(entry.start_time),
        end_time=str(entry.end_time),
        subject_id=entry.subject_id,
        subject_code=entry.subject.code if entry.subject else None,
        subject_name=entry.subject.name if entry.subject else None,
        faculty_id=entry.faculty_id,
        faculty_name=entry.faculty.full_name if entry.faculty else None,
        classroom_id=entry.classroom_id,
        room_number=entry.classroom.room_number if entry.classroom else None,
        building=entry.classroom.building if entry.classroom else None,
        semester=entry.semester,
        section=entry.section,
        created_at=entry.created_at
    )

@router.delete("/{entry_id}")
def delete_timetable_entry(entry_id: int, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"message": "Timetable entry deleted"}

@router.get("/active-lecture")
def get_active_lecture(
    classroom_id: Optional[int] = None,
    faculty_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    """
    Automatic Subject Mapping:
    Matches current weekday and wall-clock time with timetable entries to auto-suggest
    the active lecture, subject, faculty, classroom, and CCTV camera.
    """
    now = datetime.now()
    current_weekday = now.weekday() # 0 = Monday
    current_time = now.time()

    query = db.query(TimetableEntry).filter(TimetableEntry.day_of_week == current_weekday)
    if classroom_id:
        query = query.filter(TimetableEntry.classroom_id == classroom_id)
    if faculty_id:
        query = query.filter(TimetableEntry.faculty_id == faculty_id)

    entries = query.all()

    # Find matching time slot
    active_entry = None
    for e in entries:
        if e.start_time <= current_time <= e.end_time:
            active_entry = e
            break

    # If no strict time slot matches right now, pick the nearest upcoming or first slot of the day as suggestion
    if not active_entry and entries:
        active_entry = entries[0]
    elif not active_entry:
        # Fallback to any active subject entry
        active_entry = db.query(TimetableEntry).first()

    if not active_entry:
        return {"has_active_lecture": False, "message": "No scheduled lectures found."}

    # Fetch assigned cameras for this classroom
    cameras = db.query(Camera).filter(Camera.classroom_id == active_entry.classroom_id, Camera.is_active == True).all()
    camera_list = [{"id": c.id, "name": c.camera_name, "code": c.camera_code, "status": c.status} for c in cameras]

    return {
        "has_active_lecture": True,
        "timetable_id": active_entry.id,
        "subject_id": active_entry.subject_id,
        "subject_code": active_entry.subject.code,
        "subject_name": active_entry.subject.name,
        "faculty_id": active_entry.faculty_id,
        "faculty_name": active_entry.faculty.full_name,
        "classroom_id": active_entry.classroom_id,
        "room_number": active_entry.classroom.room_number,
        "start_time": str(active_entry.start_time),
        "end_time": str(active_entry.end_time),
        "assigned_cameras": camera_list
    }

