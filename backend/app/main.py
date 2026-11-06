import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import settings, STORAGE_DIR
from .database import engine, Base
from .routers import (
    auth_router,
    students_router,
    faculty_router,
    academic_router,
    timetable_router,
    cameras_router,
    video_router,
    live_router,
    attendance_router,
    verification_router,
    analytics_router,
    reports_router,
    notifications_router,
    audit_router,
    settings_router,
    webcam_router
)

# Initialize database schema tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SYNAPSE — AI-Powered Smart Attendance & Classroom Intelligence Platform",
    description="Enterprise Computer Vision, Multi-Object Tracking & Face Recognition Attendance Architecture",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount storage directory for video previews, photos, and generated reports
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(students_router, prefix=settings.API_V1_STR)
app.include_router(faculty_router, prefix=settings.API_V1_STR)
app.include_router(academic_router, prefix=settings.API_V1_STR)
app.include_router(timetable_router, prefix=settings.API_V1_STR)
app.include_router(cameras_router, prefix=settings.API_V1_STR)
app.include_router(video_router, prefix=settings.API_V1_STR)
app.include_router(live_router, prefix=settings.API_V1_STR)
app.include_router(attendance_router, prefix=settings.API_V1_STR)
app.include_router(verification_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(reports_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)
app.include_router(webcam_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "platform": "SYNAPSE",
        "tagline": "Intelligence. Accuracy. Attendance.",
        "status": "OPERATIONAL",
        "version": settings.VERSION,
        "docs": "/docs"
    }

