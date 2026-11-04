from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from ..database import Base

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_name = Column(String(100), nullable=False) # e.g. "LH-101 Front Wide"
    camera_code = Column(String(50), unique=True, index=True, nullable=False) # e.g. "CAM-LH101-01"
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True)
    location_desc = Column(String(255), default="Front facing whiteboard/podium")
    stream_url = Column(String(500), nullable=False) # rtsp://... or webcam:0 or simulated_test.mp4
    stream_type = Column(String(50), default="SIMULATED") # RTSP, WEBCAM, SIMULATED
    resolution = Column(String(50), default="1080p")
    fps = Column(Integer, default=30)
    status = Column(String(50), default="ONLINE") # ONLINE, OFFLINE, PROCESSING, ERROR
    is_active = Column(Boolean, default=True)
    last_frame_time = Column(DateTime, nullable=True)
    health_score = Column(Float, default=99.2)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    classroom = relationship("Classroom", back_populates="cameras")
    health_logs = relationship("CameraHealthLog", back_populates="camera", cascade="all, delete-orphan")

class CameraHealthLog(Base):
    __tablename__ = "camera_health_logs"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False)
    fps_measured = Column(Float, default=30.0)
    latency_ms = Column(Float, default=45.0)
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    camera = relationship("Camera", back_populates="health_logs")

