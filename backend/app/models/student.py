from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from ..database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    usn = Column(String(50), unique=True, index=True, nullable=False) # e.g. 1RV21CS101
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(50), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    semester = Column(Integer, default=6)
    section = Column(String(10), default="A")
    photo_url = Column(String(500), nullable=True)
    consent_status = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    department = relationship("Department", back_populates="students")
    biometric_enrollments = relationship("BiometricEnrollment", back_populates="student", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")
    recognition_events = relationship("RecognitionEvent", back_populates="student")

class BiometricEnrollment(Base):
    __tablename__ = "biometric_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    # Stored as JSON string or float list serialized
    embedding_data = Column(Text, nullable=False) 
    quality_score = Column(Float, default=0.95)
    model_version = Column(String(50), default="dlib-face-recognition-v1")
    photo_path = Column(String(500), nullable=True)
    face_bbox = Column(String(100), nullable=True) # "top,right,bottom,left"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    student = relationship("Student", back_populates="biometric_enrollments")

class BiometricConsent(Base):
    __tablename__ = "biometric_consents"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    consented = Column(Boolean, default=True)
    consented_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ip_address = Column(String(100), nullable=True)
    signed_by = Column(String(255), nullable=True)
    document_ref = Column(String(255), nullable=True)

