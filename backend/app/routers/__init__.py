from .auth import router as auth_router
from .students import router as students_router
from .faculty import router as faculty_router
from .academic import router as academic_router
from .timetable import router as timetable_router
from .cameras import router as cameras_router
from .video import router as video_router
from .live import router as live_router
from .attendance import router as attendance_router
from .verification import router as verification_router
from .analytics import router as analytics_router
from .reports import router as reports_router
from .notifications import router as notifications_router
from .audit import router as audit_router
from .settings import router as settings_router
from .webcam import router as webcam_router

__all__ = [
    "auth_router",
    "students_router",
    "faculty_router",
    "academic_router",
    "timetable_router",
    "cameras_router",
    "video_router",
    "live_router",
    "attendance_router",
    "verification_router",
    "analytics_router",
    "reports_router",
    "notifications_router",
    "audit_router",
    "settings_router",
    "webcam_router"
]

