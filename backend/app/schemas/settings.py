from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class SettingItem(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    category: str = "GENERAL"

class SettingUpdate(BaseModel):
    value: str

class AuditLogOut(BaseModel):
    id: int
    user_email: str
    action: str
    entity: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    severity: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

