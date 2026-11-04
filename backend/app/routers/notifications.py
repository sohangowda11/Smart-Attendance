from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Notification
from ..schemas.settings import NotificationOut
from ..auth import require_faculty_or_admin

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationOut])
def get_notifications(db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    notifs = db.query(Notification).order_by(Notification.created_at.desc()).limit(20).all()
    return notifs

@router.put("/{notif_id}/read")
def mark_notification_read(notif_id: int, db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "Notification marked as read"}

@router.put("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    db.query(Notification).update({Notification.is_read: True})
    db.commit()
    return {"message": "All notifications marked as read"}

