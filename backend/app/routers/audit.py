from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AuditLog
from ..schemas.settings import AuditLogOut
from ..auth import require_admin

router = APIRouter(prefix="/audit", tags=["Audit Logs"])

@router.get("/logs", response_model=List[AuditLogOut])
def get_audit_logs(
    limit: int = 50,
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return logs

