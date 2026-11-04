from datetime import datetime, timezone, date, time
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Time, ForeignKey, Text
from sqlalchemy.orm import relationship
from ..database import Base

class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer, nullable=False) # 0 = Monday, 6 = Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    semester = Column(Integer, default=6)
    section = Column(String(10), default="A")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    subject = relationship("Subject", back_populates="timetable_entries")
    faculty = relationship("User")
    classroom = relationship("Classroom", back_populates="timetable_entries")
    lecture_sessions = relationship("LectureSession", back_populates="timetable_entry")

class LectureSession(Base):
    __tablename__ = "lecture_sessions"

    id = Column(Integer, primary_key=True, index=True)
    timetable_id = Column(Integer, ForeignKey("timetable_entries.id", ondelete="SET NULL"), nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    session_date = Column(Date, default=lambda: date.today(), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    status = Column(String(50), default="SCHEDULED") # SCHEDULED, ACTIVE, PROCESSING, COMPLETED, CANCELLED
    video_source_type = Column(String(50), default="CCTV_UPLOAD") # CCTV_UPLOAD, LIVE_STREAM
    video_filename = Column(String(255), nullable=True)
    annotated_video_path = Column(String(255), nullable=True)
    total_frames = Column(Integer, default=0)
    total_detected = Column(Integer, default=0)
    total_unique_tracks = Column(Integer, default=0)
    total_recognized = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    timetable_entry = relationship("TimetableEntry", back_populates="lecture_sessions")
    subject = relationship("Subject", back_populates="lecture_sessions")
    faculty = relationship("User", back_populates="lecture_sessions")
    classroom = relationship("Classroom", back_populates="lecture_sessions")
    attendance_records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    recognition_events = relationship("RecognitionEvent", back_populates="session", cascade="all, delete-orphan")
    verification_queue = relationship("VerificationQueue", back_populates="session", cascade="all, delete-orphan")

