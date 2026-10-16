import re
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import db
from app.core.deps import client_ip, require_admin
from app.data.processing_register import PROCESSING_REGISTER
from app.models.user import AuditLog, User
from app.services.audit import audit
from app.services.visibility import set_profiles_suspended

router = APIRouter(prefix="/admin", tags=["admin"])


class StatusIn(BaseModel):
    status: Literal["active", "suspended"]
    reason: str = Field(min_length=3, max_length=300)


class AdminRoleIn(BaseModel):
    admin_role: Optional[Literal["super_admin", "moderator", "support"]] = None


class FlagIn(BaseModel):
    enabled: bool


class SettingIn(BaseModel):
    value: Any


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except InvalidId:
        raise HTTPException(404, "not_found")


@router.get("/stats")
async def stats(_: User = Depends(require_admin())):
    since = datetime.now(timezone.utc) - timedelta(days=13)
    by_day = await db.users.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": "Africa/Algiers"}},
                    "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}]).to_list(30)
    active = {"status": "active"}
    return {
        "users_total": await db.users.count_documents(active),
        "clients": await db.users.count_documents({**active, "roles": "client"}),
        "professionals": await db.users.count_documents({**active, "roles": "professional"}),
        "teachers": await db.users.count_documents({**active, "roles": "teacher"}),
        "students": await db.users.count_documents({**active, "roles": "student"}),
        "suspended": await db.users.count_documents({"status": "suspended"}),
        "open_tickets": await db.support_tickets.count_documents({"status": "open"}),
        "signups_by_day": [{"date": d["_id"], "count": d["count"]} for d in by_day],
    }


@router.get("/users")
async def list_users(q: str = "", role: str = "", status: str = "", page: int = 1, page_size: int = 20,
                     _: User = Depends(require_admin("moderator", "support"))):
    query: dict = {"status": status} if status else {"status": {"$ne": "deleted"}}
    if role:
        query["roles"] = role
    if q:
        import re
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"full_name": rx}, {"email": rx}, {"phone": rx}]
    page_size = max(1, min(page_size, 100))
    total = await db.users.count_documents(query)
    docs = await db.users.find(query).sort("created_at", -1).skip((max(page, 1) - 1) * page_size).to_list(page_size)
    return {"total": total, "page": page, "items": [User.from_mongo(d).to_public() for d in docs]}


@router.patch("/users/{user_id}/status")
async def set_status(user_id: str, body: StatusIn, request: Request, admin: User = Depends(require_admin("moderator"))):
    if user_id == admin.id:
        raise HTTPException(400, "cannot_target_self")
    target = await db.users.find_one({"_id": _oid(user_id)}, {"admin_role": 1})
    if target and target.get("admin_role") and admin.admin_role != "super_admin":
        raise HTTPException(403, "insufficient_admin_role")  # a moderator cannot suspend an administrator
    res = await db.users.update_one({"_id": _oid(user_id), "status": {"$ne": "deleted"}}, {"$set": {"status": body.status}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    if body.status == "suspended":
        await db.refresh_tokens.update_many({"user_id": _oid(user_id)}, {"$set": {"revoked": True}})
    await set_profiles_suspended(user_id, body.status == "suspended")
    await audit(f"moderation.user_{body.status}", admin, "user", user_id, {"reason": body.reason}, client_ip(request))
    return {"ok": True}


@router.patch("/users/{user_id}/admin-role")
async def set_admin_role(user_id: str, body: AdminRoleIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    if user_id == admin.id:
        raise HTTPException(400, "cannot_target_self")
    res = await db.users.update_one({"_id": _oid(user_id)}, {"$set": {"admin_role": body.admin_role}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    await audit("admin.role_change", admin, "user", user_id, {"admin_role": body.admin_role}, client_ip(request))
    return {"ok": True}


@router.get("/feature-flags")
async def flags(_: User = Depends(require_admin())):
    return await db.feature_flags.find({}, {"_id": 0}).sort("key", 1).to_list(200)


@router.put("/feature-flags/{key}")
async def set_flag(key: str, body: FlagIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    res = await db.feature_flags.update_one({"key": key}, {"$set": {"enabled": body.enabled}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    await audit("config.flag_change", admin, "feature_flag", key, {"enabled": body.enabled}, client_ip(request))
    return {"key": key, "enabled": body.enabled}


@router.get("/settings")
async def get_settings(_: User = Depends(require_admin())):
    return await db.settings.find({}, {"_id": 0}).sort("key", 1).to_list(200)


@router.put("/settings/{key}")
async def set_setting(key: str, body: SettingIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    current = await db.settings.find_one({"key": key})
    if not current:
        raise HTTPException(404, "not_found")
    if type(body.value) is not type(current["value"]) or (current.get("options") and body.value not in current["options"]):
        raise HTTPException(422, "invalid_value")
    if key.endswith("_url") and body.value and not body.value.startswith("https://"):
        raise HTTPException(422, "invalid_url")
    if key.endswith("_email") and body.value and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", body.value):
        raise HTTPException(422, "email_invalid")
    await db.settings.update_one({"key": key}, {"$set": {"value": body.value}})
    await audit("config.setting_change", admin, "setting", key, {"old": current["value"], "new": body.value}, client_ip(request))
    return {"key": key, "value": body.value}


@router.get("/audit-logs")
async def audit_logs(action: str = "", page: int = 1, page_size: int = 30, _: User = Depends(require_admin("super_admin"))):
    q = {"action": {"$regex": f"^{re.escape(action)}"}} if action else {}
    page_size = max(1, min(page_size, 100))
    total = await db.audit_logs.count_documents(q)
    docs = await db.audit_logs.find(q).sort("created_at", -1).skip((max(page, 1) - 1) * page_size).to_list(page_size)
    return {"total": total, "items": [AuditLog.from_mongo(d).model_dump(mode="json") for d in docs]}


@router.get("/processing-register")
async def processing_register(_: User = Depends(require_admin("super_admin"))):
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "law": "Loi n° 18-07 (ANPDP)", "treatments": PROCESSING_REGISTER}
