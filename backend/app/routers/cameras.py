from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Camera, CameraHealthLog, AuditLog, Classroom
from ..schemas.camera import CameraCreate, CameraUpdate, CameraOut, CameraHealthOut
from ..auth import require_faculty_or_admin, require_admin

router = APIRouter(prefix="/cameras", tags=["Cameras"])

@router.get("", response_model=List[CameraOut])
def get_cameras(
    classroom_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    query = db.query(Camera)
    if classroom_id:
        query = query.filter(Camera.classroom_id == classroom_id)

    cameras = query.all()
    results = []
    for c in cameras:
        results.append(CameraOut(
            id=c.id,
            camera_name=c.camera_name,
            camera_code=c.camera_code,
            classroom_id=c.classroom_id,
            classroom_name=c.classroom.room_number if c.classroom else None,
            location_desc=c.location_desc,
            stream_url=c.stream_url,
            stream_type=c.stream_type,
            resolution=c.resolution,
            fps=c.fps,
            status=c.status,
            is_active=c.is_active,
            health_score=c.health_score,
            last_frame_time=c.last_frame_time,
            created_at=c.created_at
        ))
    return results

@router.post("", response_model=CameraOut)
def register_camera(cam_in: CameraCreate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    existing = db.query(Camera).filter(Camera.camera_code == cam_in.camera_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Camera with this code already registered")

    cam = Camera(**cam_in.model_dump())
    db.add(cam)
    db.commit()
    db.refresh(cam)

    db.add(AuditLog(
        user_email=current_user.email,
        action="CAMERA_REGISTERED",
        entity="Camera",
        entity_id=str(cam.id),
        details=f"Registered CCTV camera {cam.camera_name} ({cam.camera_code})",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return CameraOut(
        id=cam.id,
        camera_name=cam.camera_name,
        camera_code=cam.camera_code,
        classroom_id=cam.classroom_id,
        classroom_name=cam.classroom.room_number if cam.classroom else None,
        location_desc=cam.location_desc,
        stream_url=cam.stream_url,
        stream_type=cam.stream_type,
        resolution=cam.resolution,
        fps=cam.fps,
        status=cam.status,
        is_active=cam.is_active,
        health_score=cam.health_score,
        last_frame_time=cam.last_frame_time,
        created_at=cam.created_at
    )

@router.put("/{camera_id}", response_model=CameraOut)
def update_camera(camera_id: int, cam_in: CameraUpdate, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    for k, v in cam_in.model_dump(exclude_unset=True).items():
        setattr(cam, k, v)

    db.add(AuditLog(
        user_email=current_user.email,
        action="CAMERA_UPDATED",
        entity="Camera",
        entity_id=str(cam.id),
        details=f"Updated settings for camera {cam.camera_code}",
        ip_address="127.0.0.1"
    ))
    db.commit()
    db.refresh(cam)

    return CameraOut(
        id=cam.id,
        camera_name=cam.camera_name,
        camera_code=cam.camera_code,
        classroom_id=cam.classroom_id,
        classroom_name=cam.classroom.room_number if cam.classroom else None,
        location_desc=cam.location_desc,
        stream_url=cam.stream_url,
        stream_type=cam.stream_type,
        resolution=cam.resolution,
        fps=cam.fps,
        status=cam.status,
        is_active=cam.is_active,
        health_score=cam.health_score,
        last_frame_time=cam.last_frame_time,
        created_at=cam.created_at
    )

@router.delete("/{camera_id}")
def delete_camera(camera_id: int, db: Session = Depends(get_db), current_user = Depends(require_admin)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    db.delete(cam)
    db.commit()
    return {"message": "Camera unregistered"}

@router.get("/{camera_id}/health", response_model=List[CameraHealthOut])
def get_camera_health(camera_id: int, db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    logs = db.query(CameraHealthLog).filter(CameraHealthLog.camera_id == camera_id).order_by(CameraHealthLog.timestamp.desc()).limit(30).all()
    return logs

