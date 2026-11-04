from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from ..database import Base

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("lecture_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="PRESENT") # PRESENT, ABSENT, LATE, PENDING_VERIFICATION, EXCUSED
    confidence_score = Column(Float, default=0.0) # max or average confidence during session
    first_detected_at = Column(DateTime, nullable=True)
    last_detected_at = Column(DateTime, nullable=True)
    observations_count = Column(Integer, default=1)
    duration_minutes = Column(Float, default=0.0)
    is_late = Column(Boolean, default=False)
    is_early_departure = Column(Boolean, default=False)
    manual_correction = Column(Boolean, default=False)
    corrected_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    correction_reason = Column(Text, nullable=True)
    marked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("LectureSession", back_populates="attendance_records")
    student = relationship("Student", back_populates="attendance_records")
    corrected_by = relationship("User")

    __table_args__ = (
        UniqueConstraint('session_id', 'student_id', name='uq_session_student_attendance'),
    )

class RecognitionEvent(Base):
    __tablename__ = "recognition_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("lecture_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True)
    frame_number = Column(Integer, default=0)
    video_timestamp_sec = Column(Float, default=0.0)
    confidence = Column(Float, default=0.0)
    track_id = Column(Integer, default=0)
    bounding_box = Column(String(100), nullable=True) # "x,y,w,h"
    is_identified = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("LectureSession", back_populates="recognition_events")
    student = relationship("Student", back_populates="recognition_events")
    camera = relationship("Camera")

class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("lecture_sessions.id", ondelete="CASCADE"), nullable=False)
    track_id = Column(Integer, nullable=False)
    first_frame = Column(Integer, default=0)
    last_frame = Column(Integer, default=0)
    total_detections = Column(Integer, default=1)
    associated_student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)

class VerificationQueue(Base):
    __tablename__ = "verification_queue"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("lecture_sessions.id", ondelete="CASCADE"), nullable=False)
    candidate_student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    frame_snapshot_path = Column(String(500), nullable=True)
    confidence = Column(Float, default=0.0)
    track_id = Column(Integer, default=0)
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED, REASSIGNED
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    session = relationship("LectureSession", back_populates="verification_queue")
    candidate_student = relationship("Student")
    reviewed_by = relationship("User")

