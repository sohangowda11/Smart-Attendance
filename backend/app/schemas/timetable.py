from typing import Optional
from pydantic import BaseModel
from datetime import time, date, datetime

class TimetableCreate(BaseModel):
    day_of_week: int # 0=Mon, 6=Sun
    start_time: str # "09:00:00"
    end_time: str # "10:00:00"
    subject_id: int
    faculty_id: int
    classroom_id: int
    semester: int = 6
    section: str = "A"

class TimetableOut(BaseModel):
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    subject_id: int
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    faculty_id: int
    faculty_name: Optional[str] = None
    classroom_id: int
    room_number: Optional[str] = None
    building: Optional[str] = None
    semester: int
    section: str
    created_at: datetime

    class Config:
        from_attributes = True

class LectureSessionCreate(BaseModel):
    timetable_id: Optional[int] = None
    subject_id: int
    faculty_id: int
    classroom_id: int
    session_date: Optional[str] = None # "YYYY-MM-DD"
    start_time: Optional[str] = None # "HH:MM:SS"
    end_time: Optional[str] = None
    video_source_type: str = "CCTV_UPLOAD" # CCTV_UPLOAD or LIVE_STREAM

class LectureSessionOut(BaseModel):
    id: int
    timetable_id: Optional[int] = None
    subject_id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    faculty_id: int
    faculty_name: Optional[str] = None
    classroom_id: int
    room_number: Optional[str] = None
    session_date: date
    start_time: str
    end_time: str
    status: str
    video_source_type: str
    video_filename: Optional[str] = None
    annotated_video_path: Optional[str] = None
    total_frames: int = 0
    total_detected: int = 0
    total_unique_tracks: int = 0
    total_recognized: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

