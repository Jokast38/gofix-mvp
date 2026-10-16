from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.base import BaseDocument, PyObjectId

Role = Literal["client", "professional", "teacher", "student"]
AdminRole = Literal["super_admin", "moderator", "support"]


def utcnow():
    return datetime.now(timezone.utc)


class Guardian(BaseModel):
    managed_by_guardian: bool = False
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    consent_at: Optional[datetime] = None


class User(BaseDocument):
    email: Optional[str] = None
    phone: Optional[str] = None
    email_verified: bool = False
    phone_verified: bool = False
    password_hash: Optional[str] = None
    full_name: str
    roles: List[Role] = ["client"]
    active_mode: Role = "client"
    admin_role: Optional[AdminRole] = None
    status: Literal["active", "suspended", "deleted"] = "active"
    preferred_language: Literal["fr", "ar"] = "fr"
    theme: Literal["dark", "light"] = "dark"
    week_start: Literal["saturday", "sunday"] = "saturday"
    wilaya_code: Optional[int] = None
    photo_key: Optional[str] = None
    photo_thumb_key: Optional[str] = None
    birth_year: Optional[int] = None
    guardian: Guardian = Field(default_factory=Guardian)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    last_login_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    def to_public(self) -> dict:
        return self.model_dump(exclude={"password_hash"}, mode="json")


class AuditLog(BaseDocument):
    actor_id: Optional[PyObjectId] = None
    actor_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    meta: dict = Field(default_factory=dict)
    ip: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


class Consent(BaseDocument):
    user_id: Optional[PyObjectId] = None
    anonymous_id: Optional[str] = None
    type: Literal["terms", "privacy", "cookies", "parental"]
    choice: Literal["accepted", "refused"]
    version: str = "2026-01"
    ip: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
