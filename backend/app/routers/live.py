import time
import base64
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Camera
from ..services.live_stream_manager import live_stream_manager
from ..auth import require_faculty_or_admin

router = APIRouter(prefix="/live", tags=["Live CCTV Streaming"])

def generate_mjpeg_stream(camera_id: int):
    while True:
        frame_bytes = live_stream_manager.get_latest_frame(camera_id)
        if frame_bytes:
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
            )
        time.sleep(0.04) # ~25 FPS

@router.get("/stream/{camera_id}")
def stream_camera_mjpeg(camera_id: int, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Ensure worker is started
    live_stream_manager.start_camera_feed(cam.id, cam.stream_url, cam.stream_type)

    return StreamingResponse(
        generate_mjpeg_stream(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/stats/{camera_id}")
def get_live_camera_stats(camera_id: int, db: Session = Depends(get_db)):
    stats = live_stream_manager.get_camera_stats(camera_id)
    return stats

@router.websocket("/ws/{camera_id}")
async def websocket_camera_feed(websocket: WebSocket, camera_id: int):
    await websocket.accept()
    
    # Try start camera feed if not running
    # We can read camera from DB
    from ..database import SessionLocal
    db = SessionLocal()
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if cam:
        live_stream_manager.start_camera_feed(cam.id, cam.stream_url, cam.stream_type)
    db.close()

    try:
        while True:
            stats = live_stream_manager.get_camera_stats(camera_id)
            frame_bytes = live_stream_manager.get_latest_frame(camera_id)
            
            payload = {
                "type": "LIVE_TELEMETRY",
                "stats": stats,
                "timestamp": time.time()
            }
            if frame_bytes:
                payload["frame_b64"] = base64.b64encode(frame_bytes).decode("utf-8")

            await websocket.send_json(payload)
            await asyncio.sleep(0.1) # 10 updates per second over WebSocket
    except WebSocketDisconnect:
        print(f"WebSocket client disconnected for camera {camera_id}")
    except Exception as e:
        print(f"WebSocket error on camera {camera_id}: {e}")

