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
        job = active_processing_jobs[session_id]
        if job.get("status") == "COMPLETED" and "result" in job:
            res = job["result"]
            return {
                "session_id": session_id,
                "status": "COMPLETED",
                "progress_pct": 100.0,
                "total_frames": res.get("total_frames", 0),
                "detected_count": res.get("total_detected", 0),
                "unique_tracks": res.get("unique_tracks", 0),
                "recognized_count": res.get("total_recognized", 0),
                "max_occupancy": res.get("max_occupancy", 0),
                "avg_occupancy": res.get("avg_occupancy", 0.0),
                "min_occupancy": res.get("min_occupancy", 0),
                "frame_occupancy_timeline": res.get("frame_occupancy_timeline", []),
                "annotated_video": res.get("annotated_video"),
                "report_url": res.get("report_url"),
                "result": res
            }
        return job

    session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check for saved report file
    from ..config import REPORTS_DIR
    import json
    report_file = REPORTS_DIR / f"classroom_analysis_session_{session_id}.json"
    timeline = []
    max_occ = 0
    avg_occ = 0.0
    min_occ = 0
    if report_file.exists():
        try:
            with open(report_file, "r") as rf:
                rdata = json.load(rf)
                timeline = rdata.get("timeline", [])
                metrics = rdata.get("metrics", {})
                max_occ = metrics.get("max_occupancy", 0)
                avg_occ = metrics.get("avg_occupancy", 0.0)
                min_occ = metrics.get("min_occupancy", 0)
        except Exception as e:
            print(f"Error reading report: {e}")

    return {
        "session_id": session_id,
        "status": session.status,
        "progress_pct": 100.0 if session.status == "COMPLETED" else 0.0,
        "total_frames": session.total_frames,
        "detected_count": session.total_detected,
        "unique_tracks": session.total_unique_tracks,
        "recognized_count": session.total_recognized,
        "max_occupancy": max_occ,
        "avg_occupancy": avg_occ,
        "min_occupancy": min_occ,
        "frame_occupancy_timeline": timeline,
        "annotated_video": session.annotated_video_path,
        "report_url": f"/storage/reports/classroom_analysis_session_{session_id}.json" if report_file.exists() else None
    }

@router.get("/report/{session_id}")
def get_session_analysis_report(
    session_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    from ..config import REPORTS_DIR
    import json
    report_file = REPORTS_DIR / f"classroom_analysis_session_{session_id}.json"
    if not report_file.exists():
        raise HTTPException(status_code=404, detail="Report not found for this session")

    with open(report_file, "r") as rf:
        data = json.load(rf)
    return data


