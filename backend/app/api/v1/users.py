from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.adapters.storage import get_storage
from app.core.db import db
from app.core.deps import client_ip, get_current_user
from app.core.phone import normalize_dz_phone
from app.core.ratelimit import hit
from app.core.security import verify_password
from app.models.user import User
from app.services.audit import audit
from app.services.push import TOKEN_RE

router = APIRouter(prefix="/users", tags=["users"])


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    preferred_language: Optional[Literal["fr", "ar"]] = None
    theme: Optional[Literal["dark", "light"]] = None
    week_start: Optional[Literal["saturday", "sunday"]] = None
    wilaya_code: Optional[int] = Field(default=None, ge=1, le=58)
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return normalize_dz_phone(v) if v else v


class PushTokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    platform: Literal["ios", "android", "web"] = "android"


class RoleIn(BaseModel):
    role: Literal["professional", "teacher", "student"]


class ModeIn(BaseModel):
    mode: Literal["client", "professional", "teacher", "student"]


class DeleteIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)


def _oid(user: User):
    return {"_id": ObjectId(user.id)}


@router.patch("/me")
async def update_me(body: ProfileUpdate, user: User = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if "email" in data:
        data["email"] = data["email"].lower()
        if await db.users.find_one({"email": data["email"], "_id": {"$ne": ObjectId(user.id)}}):
            raise HTTPException(409, "email_taken")
    if "phone" in data:
        if await db.users.find_one({"phone": data["phone"], "_id": {"$ne": ObjectId(user.id)}}):
            raise HTTPException(409, "phone_taken")
        if data["phone"] != user.phone:
            data["phone_verified"] = False  # a new number must be verified again
    data["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one(_oid(user), {"$set": data})
    return User.from_mongo(await db.users.find_one(_oid(user))).to_public()


@router.post("/me/photo")
async def upload_photo(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Optional profile photo for every account (clients included), re-encoded to WebP without metadata."""
    from app.api.v1.provider import read_image
    hit(f"user-photo:{user.id}", 20, 3600)
    keys = await read_image(file, "photo", user.id)
    old = [k for k in (user.photo_key, user.photo_thumb_key) if k]
    await db.users.update_one(_oid(user), {"$set": keys | {"updated_at": datetime.now(timezone.utc)}})
    for k in old:
        get_storage().delete(k)
    return User.from_mongo(await db.users.find_one(_oid(user))).to_public()


@router.delete("/me/photo")
async def delete_photo(user: User = Depends(get_current_user)):
    for k in (user.photo_key, user.photo_thumb_key):
        if k:
            get_storage().delete(k)
    await db.users.update_one(_oid(user), {"$set": {"photo_key": None, "photo_thumb_key": None, "updated_at": datetime.now(timezone.utc)}})
    return User.from_mongo(await db.users.find_one(_oid(user))).to_public()


@router.post("/me/push-tokens", status_code=204)
async def add_push_token(body: PushTokenIn, user: User = Depends(get_current_user)):
    """Device registered for push notifications (after the user accepted them in the app)."""
    if not TOKEN_RE.match(body.token):
        raise HTTPException(422, "push_token_invalid")
    await db.push_tokens.update_one({"token": body.token}, {"$set": {"user_id": ObjectId(user.id), "platform": body.platform,
                                                                     "updated_at": datetime.now(timezone.utc)}}, upsert=True)


@router.post("/me/push-tokens/remove", status_code=204)
async def remove_push_token(body: PushTokenIn, user: User = Depends(get_current_user)):
    """Called on logout or when the user turns notifications off on this device."""
    await db.push_tokens.delete_one({"token": body.token, "user_id": ObjectId(user.id)})


@router.post("/me/roles")
async def add_role(body: RoleIn, user: User = Depends(get_current_user)):
    other = {"professional": "teacher", "teacher": "professional"}.get(body.role)
    if other and other in user.roles:
        raise HTTPException(409, "role_conflict")
    await db.users.update_one(_oid(user), {"$addToSet": {"roles": body.role}, "$set": {"active_mode": body.role}})
    return User.from_mongo(await db.users.find_one(_oid(user))).to_public()


@router.put("/me/mode")
async def set_mode(body: ModeIn, user: User = Depends(get_current_user)):
    if body.mode not in user.roles:
        raise HTTPException(403, "role_missing")
    await db.users.update_one(_oid(user), {"$set": {"active_mode": body.mode}})
    return User.from_mongo(await db.users.find_one(_oid(user))).to_public()


@router.get("/me/export")
async def export_me(user: User = Depends(get_current_user)):
    uid = ObjectId(user.id)

    def js(v):
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, list):
            return [js(x) for x in v]
        if isinstance(v, dict):
            return {k: js(x) for k, x in v.items()}
        return v

    async def coll(name, q):
        return [js(d) for d in await db[name].find(q, {"_id": 0}).to_list(1000)]

    return {"exported_at": datetime.now(timezone.utc).isoformat(), "user": user.to_public(),
            "consents": await coll("consents", {"user_id": uid}),
            "professional_profile": await coll("professional_profiles", {"user_id": uid}),
            "teacher_profile": await coll("teacher_profiles", {"user_id": uid}),
            "support_tickets": await coll("support_tickets", {"user_id": uid}),
            "requests_sent": await coll("requests", {"client_id": uid}),
            "reviews_written": await coll("reviews", {"client_id": uid}),
            "messages_sent": await coll("messages", {"sender_id": uid}),
            "subscriptions": await coll("subscriptions", {"user_id": uid}),
            "invoices": await coll("invoices", {"user_id": uid}),
            "reports_filed": await coll("reports", {"reporter_id": uid})}


async def _erase_personal_data(uid: ObjectId) -> None:
    """Right to erasure: profiles and their files (photos, private ID documents) are deleted; the name copied into
    requests, reviews, conversations and jobs is anonymized (those records are kept for the other party)."""
    storage = get_storage()
    me = await db.users.find_one({"_id": uid}, {"photo_key": 1, "photo_thumb_key": 1})
    for k in ("photo_key", "photo_thumb_key"):
        if (me or {}).get(k):
            storage.delete(me[k])
    await db.users.update_one({"_id": uid}, {"$set": {"photo_key": None, "photo_thumb_key": None}})
    for coll in (db.professional_profiles, db.teacher_profiles):
        async for p in coll.find({"user_id": uid}):
            for k, v in p.items():
                if k.endswith("_key") and isinstance(v, str):
                    storage.delete(v)
            for d in p.get("documents") or []:
                if isinstance(d, dict) and d.get("key"):
                    storage.delete(d["key"], private=True)
        await coll.delete_many({"user_id": uid})
    anon = "Compte supprimé"
    await db.requests.update_many({"client_id": uid}, {"$set": {"client_name": anon}})
    await db.reviews.update_many({"client_id": uid}, {"$set": {"author_name": anon}})
    await db.conversations.update_many({"provider_user_id": uid}, {"$set": {"provider_display_name": anon}})
    await db.jobs.update_many({"provider_user_id": uid}, {"$set": {"provider_display_name": anon}})
    for coll in (db.onboarding_drafts, db.favorites, db.notifications, db.password_reset_tokens, db.push_tokens):
        await coll.delete_many({"user_id": uid})


@router.delete("/me", status_code=204)
async def delete_me(body: DeleteIn, request: Request, user: User = Depends(get_current_user)):
    doc = await db.users.find_one(_oid(user))
    if not verify_password(body.password, doc.get("password_hash") or ""):
        raise HTTPException(401, "invalid_credentials")
    now = datetime.now(timezone.utc)
    uid = ObjectId(user.id)
    await db.users.update_one({"_id": uid}, {"$set": {
        "status": "deleted", "deleted_at": now, "full_name": "Compte supprimé", "password_hash": None,
        "guardian": {}, "birth_year": None, "roles": ["client"], "admin_role": None},
        "$unset": {"email": "", "phone": ""}})
    await db.refresh_tokens.update_many({"user_id": uid}, {"$set": {"revoked": True}})
    await _erase_personal_data(uid)
    if doc.get("phone"):
        await db.otp_codes.delete_many({"phone": doc["phone"]})
    await audit("user.delete_account", user, "user", user.id, {}, client_ip(request))
