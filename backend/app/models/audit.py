from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from ..database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False) # e.g. "USER_LOGIN", "ATTENDANCE_CORRECTED", "STUDENT_ENROLLED"
    entity = Column(String(100), nullable=False) # e.g. "Student", "AttendanceRecord", "Camera"
    entity_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    category = Column(String(50), default="GENERAL") # GENERAL, AI, ATTENDANCE, CAMERA, PRIVACY
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

