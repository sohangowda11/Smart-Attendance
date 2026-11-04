from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from ..database import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False) # e.g. CSE, AIML, ECE
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    faculty_members = relationship("User", back_populates="department")
    students = relationship("Student", back_populates="department")
    subjects = relationship("Subject", back_populates="department")

class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(50), unique=True, index=True, nullable=False) # e.g. LH-101
    building = Column(String(100), default="Turing Block")
    floor = Column(Integer, default=1)
    capacity = Column(Integer, default=60)
    has_cctv = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    cameras = relationship("Camera", back_populates="classroom")
    timetable_entries = relationship("TimetableEntry", back_populates="classroom")
    lecture_sessions = relationship("LectureSession", back_populates="classroom")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False) # e.g. CS601
    name = Column(String(255), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    semester = Column(Integer, default=6)
    credits = Column(Integer, default=4)
    faculty_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    department = relationship("Department", back_populates="subjects")
    assigned_faculty = relationship("User", back_populates="assigned_subjects")
    timetable_entries = relationship("TimetableEntry", back_populates="subject")
    lecture_sessions = relationship("LectureSession", back_populates="subject")

