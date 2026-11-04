import os
import shutil
import threading
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from ..models import LectureSession, AuditLog
from ..config import UPLOADS_DIR, settings
from ..services.video_processor import video_processor
from ..auth import require_faculty_or_admin

router = APIRouter(prefix="/video", tags=["Video Processing"])

# In-memory progress tracking for active video jobs
active_processing_jobs: Dict[int, Dict[str, Any]] = {}

def run_video_job(session_id: int, file_path: str):
    db: Session = SessionLocal()
    try:
        def on_progress(p_data: Dict[str, Any]):
            active_processing_jobs[session_id] = p_data

        active_processing_jobs[session_id] = {
            "session_id": session_id,
            "frame": 0,
            "total_frames": 100,
            "progress_pct": 5.0,
            "fps": 25.0,
            "status": "PROCESSING",
            "detected_count": 0,
            "recognized_count": 0
        }
        
        result = video_processor.process_video_file(
            db=db,
            session_id=session_id,
            input_video_path=file_path,
            progress_callback=on_progress
        )
        active_processing_jobs[session_id] = {
            "session_id": session_id,
            "progress_pct": 100.0,
            "status": "COMPLETED",
            "result": result
        }
    except Exception as e:
        print(f"Error in video processing job {session_id}: {e}")
        active_processing_jobs[session_id] = {
            "session_id": session_id,
            "status": "FAILED",
            "error": str(e)
        }
    finally:
        db.close()

@router.post("/upload")
async def upload_cctv_video(
    file: UploadFile = File(...),
    session_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    # Validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Supported formats: .mp4, .avi, .mov, .mkv"
        )

    # Save file
    clean_name = f"cctv_upload_{int(os.times().elapsed)}_{file.filename.replace(' ', '_')}"
    save_path = UPLOADS_DIR / clean_name

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size_mb = os.path.getsize(save_path) / (1024 * 1024)
    if file_size_mb > settings.MAX_UPLOAD_SIZE_MB:
        os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"File exceeds maximum size limit of {settings.MAX_UPLOAD_SIZE_MB}MB")

    # If linked to an existing session, associate it
    if session_id:
        sess = db.query(LectureSession).filter(LectureSession.id == session_id).first()
        if sess:
            sess.video_filename = clean_name
            sess.status = "READY"
            db.commit()

    db.add(AuditLog(
        user_email=current_user.email,
        action="CCTV_VIDEO_UPLOAD",
        entity="Video",
        entity_id=clean_name,
        details=f"Uploaded CCTV video footage '{file.filename}' ({file_size_mb:.2f} MB)",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return {
        "filename": clean_name,
        "original_name": file.filename,
        "size_mb": round(file_size_mb, 2),
        "file_url": f"/storage/uploads/{clean_name}",
        "session_id": session_id
    }

@router.post("/process/{session_id}")
def start_processing_session(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Lecture session not found")

    if not session.video_filename:
        # If no video attached, check if sample video exists
        sample_path = UPLOADS_DIR / "sample_classroom_cctv.mp4"
        if sample_path.exists():
            session.video_filename = "sample_classroom_cctv.mp4"
            db.commit()
        else:
            raise HTTPException(status_code=400, detail="No video file associated with this lecture session")

    video_full_path = str(UPLOADS_DIR / session.video_filename)
    if not os.path.exists(video_full_path):
        raise HTTPException(status_code=404, detail=f"Video file {session.video_filename} not found on server")

    session.status = "PROCESSING"
    db.commit()

    # Launch non-blocking background thread
    t = threading.Thread(target=run_video_job, args=(session_id, video_full_path), daemon=True)
    t.start()

    return {
        "message": "AI computer vision processing pipeline initiated",
        "session_id": session_id,
        "video_file": session.video_filename,
        "status": "PROCESSING"
    }

@router.get("/status/{session_id}")
def get_processing_status(
    session_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    if session_id in active_processing_jobs:
        return active_processing_jobs[session_id]

    session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "status": session.status,
        "progress_pct": 100.0 if session.status == "COMPLETED" else 0.0,
        "total_frames": session.total_frames,
        "detected_count": session.total_detected,
        "unique_tracks": session.total_unique_tracks,
        "recognized_count": session.total_recognized,
        "annotated_video": session.annotated_video_path
    }

