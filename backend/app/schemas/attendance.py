from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

class AttendanceRecordOut(BaseModel):
    id: int
    session_id: int
    student_id: int
    student_name: Optional[str] = None
    student_usn: Optional[str] = None
    student_photo: Optional[str] = None
    status: str
    confidence_score: float
    first_detected_at: Optional[datetime] = None
    last_detected_at: Optional[datetime] = None
    observations_count: int
    duration_minutes: float
    is_late: bool
    is_early_departure: bool
    manual_correction: bool
    correction_reason: Optional[str] = None
    marked_at: datetime

    class Config:
        from_attributes = True

class AttendanceCorrection(BaseModel):
    new_status: str # PRESENT, ABSENT, LATE, EXCUSED
    reason: str

class VerificationQueueItem(BaseModel):
    id: int
    session_id: int
    candidate_student_id: Optional[int] = None
    candidate_name: Optional[str] = None
    candidate_usn: Optional[str] = None
    frame_snapshot_path: Optional[str] = None
    confidence: float
    track_id: int
    status: str
    detected_at: datetime

    class Config:
        from_attributes = True

class VerificationAction(BaseModel):
    action: str # APPROVE, REJECT, REASSIGN
    reassigned_student_id: Optional[int] = None
    review_notes: Optional[str] = None

