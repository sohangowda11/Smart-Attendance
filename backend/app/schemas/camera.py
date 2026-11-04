from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class CameraBase(BaseModel):
    camera_name: str
    camera_code: str
    classroom_id: Optional[int] = None
    location_desc: Optional[str] = "Front podium angle"
    stream_url: str
    stream_type: str = "SIMULATED" # RTSP, WEBCAM, SIMULATED
    resolution: str = "1080p"
    fps: int = 30
    is_active: bool = True

class CameraCreate(CameraBase):
    pass

class CameraUpdate(BaseModel):
    camera_name: Optional[str] = None
    classroom_id: Optional[int] = None
    location_desc: Optional[str] = None
    stream_url: Optional[str] = None
    stream_type: Optional[str] = None
    fps: Optional[int] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

class CameraOut(CameraBase):
    id: int
    status: str
    health_score: float
    last_frame_time: Optional[datetime] = None
    classroom_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CameraHealthOut(BaseModel):
    id: int
    camera_id: int
    status: str
    fps_measured: float
    latency_ms: float
    error_message: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

