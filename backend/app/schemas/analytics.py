from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_students: int
    present_today: int
    absent_today: int
    overall_attendance_pct: float
    active_classrooms: int
    connected_cameras: int
    ongoing_lectures: int
    completed_sessions: int

class TrendPoint(BaseModel):
    date: str
    attendance_rate: float
    present_count: int
    total_count: int

class SubjectAttendance(BaseModel):
    subject_code: str
    subject_name: str
    attendance_pct: float
    total_classes: int

class ShortageStudent(BaseModel):
    student_id: int
    name: str
    usn: str
    department: str
    semester: int
    section: str
    attendance_pct: float
    attended_lectures: int
    total_lectures: int
    critical_status: str # CRITICAL (< 65%), WARNING (65-74%), SAFE (>=75%)

class ClassroomOccupancy(BaseModel):
    room_number: str
    capacity: int
    current_occupancy: int
    tracked_unique: int
    recognized_students: int
    occupancy_pct: float
    camera_status: str

