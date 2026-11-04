from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SystemSetting, AuditLog
from ..schemas.settings import SettingItem, SettingUpdate
from ..auth import require_admin

router = APIRouter(prefix="/settings", tags=["System Settings"])

@router.get("", response_model=List[SettingItem])
def get_settings(db: Session = Depends(get_db), current_user = Depends(require_admin)):
    settings_list = db.query(SystemSetting).all()
    return settings_list

@router.put("/{key}")
def update_setting(
    key: str,
    update: SettingUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    old_val = setting.value
    setting.value = update.value

    db.add(AuditLog(
        user_email=current_user.email,
        action="SETTING_UPDATED",
        entity="SystemSetting",
        entity_id=key,
        details=f"Updated setting {key} from '{old_val}' to '{update.value}'",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return {"message": "Setting updated successfully", "key": key, "value": setting.value}

