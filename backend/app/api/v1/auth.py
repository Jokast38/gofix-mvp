import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.adapters.email import get_email_adapter
from app.adapters.sms import get_sms_adapter
from app.core.config import settings
from app.core.db import db
from app.core.deps import client_ip, get_current_user
from app.core.phone import normalize_dz_phone
from app.core.ratelimit import hit
from app.core.security import (create_access_token, create_refresh_token, decode_token, hash_password, sha256,
                               verify_password)
from app.models.user import Consent, Guardian, User
from app.services.audit import audit
from app.services.config_store import get_setting, is_enabled

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILS, LOCK_MIN = 5, 15
ACCOUNT_MAX_FAILS = 10  # same account, any IP (distributed brute force)


def _strong(v: str) -> str:
    if not (any(c.isalpha() for c in v) and any(c.isdigit() for c in v)):
        raise ValueError("password_weak")
    return v


def _phone(v):
    return normalize_dz_phone(v) if v else v


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str
    password: str = Field(min_length=8, max_length=128)
    account_type: Literal["client", "student", "professional", "teacher"] = "client"
    preferred_language: Literal["fr", "ar"] = "fr"
    accept_terms: bool
    accept_privacy: bool
    birth_year: Optional[int] = Field(default=None, ge=1920, le=2030)
    guardian_name: Optional[str] = Field(default=None, max_length=80)
    guardian_phone: Optional[str] = None
    guardian_consent: bool = False

    _v_phone = field_validator("phone", "guardian_phone")(_phone)
    _v_pw = field_validator("password")(_strong)


class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str


class OtpRequestIn(BaseModel):
    phone: str
    purpose: Literal["login", "verify_phone"] = "login"
    _v = field_validator("phone")(_phone)


class OtpVerifyIn(OtpRequestIn):
    code: str = Field(pattern=r"^\d{6}$")


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=20)
    new_password: str = Field(min_length=8, max_length=128)
    _v = field_validator("new_password")(_strong)


async def issue_tokens(user: User) -> dict:
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(24)
    await db.refresh_tokens.insert_one({"jti": jti, "user_id": ObjectId(user.id), "revoked": False, "created_at": now,
                                        "expires_at": now + timedelta(days=settings.refresh_ttl_days)})
    return {"access_token": create_access_token(user.id, user.roles, user.admin_role),
            "refresh_token": create_refresh_token(user.id, jti), "token_type": "bearer",
            "expires_in": settings.access_ttl_minutes * 60, "user": user.to_public()}


@router.post("/register", response_model=TokenPair, status_code=201)
async def register(body: RegisterIn, request: Request):
    ip = client_ip(request)
    hit(f"register:{ip}", 10, 3600)
    if not (body.accept_terms and body.accept_privacy):
        raise HTTPException(422, "consent_required")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "email_taken")
    if await db.users.find_one({"phone": body.phone}):
        raise HTTPException(409, "phone_taken")
    now = datetime.now(timezone.utc)
    guardian = Guardian()
    if body.birth_year and now.year - body.birth_year < int(await get_setting("minor_age_threshold")):
        if not (body.guardian_consent and body.guardian_name and body.guardian_phone):
            raise HTTPException(422, "guardian_consent_required")
        guardian = Guardian(managed_by_guardian=True, guardian_name=body.guardian_name,
                            guardian_phone=body.guardian_phone, consent_at=now)
    roles = ["client"] if body.account_type == "client" else ["client", body.account_type]
    user = User(email=email, phone=body.phone, password_hash=hash_password(body.password), full_name=body.full_name.strip(),
                roles=roles, active_mode=body.account_type, preferred_language=body.preferred_language,
                birth_year=body.birth_year, guardian=guardian,
                week_start=await get_setting("default_week_start"))
    res = await db.users.insert_one(user.to_mongo())
    user.id = str(res.inserted_id)
    kinds = ["terms", "privacy"] + (["parental"] if guardian.managed_by_guardian else [])
    for kind in kinds:
        c = Consent(user_id=user.id, type=kind, choice="accepted", ip=ip).to_mongo()
        c["user_id"] = ObjectId(user.id)
        await db.consents.insert_one(c)
    await audit("user.register", user, "user", user.id, {"account_type": body.account_type}, ip)
    return await issue_tokens(user)


@router.post("/login", response_model=TokenPair)
async def login(body: LoginIn, request: Request):
    ip = client_ip(request)
    hit(f"login:{ip}", 30, 600)
    ident = body.identifier.strip().lower()
    try:
        query = {"email": ident} if "@" in ident else {"phone": normalize_dz_phone(ident)}
    except ValueError:
        raise HTTPException(401, "invalid_credentials")
    key, acct_key = f"{ip}:{ident}", f"acct:{ident}"
    now = datetime.now(timezone.utc)
    attempt = await db.login_attempts.find_one({"identifier": key})
    acct = await db.login_attempts.find_one({"identifier": acct_key})
    for a in (attempt, acct):
        if a and a.get("locked_until") and a["locked_until"] > now:
            raise HTTPException(429, "too_many_attempts")
    doc = await db.users.find_one(query)
    if not doc or doc.get("status") == "deleted" or not verify_password(body.password, doc.get("password_hash") or ""):
        fails = (attempt or {}).get("count", 0) + 1
        upd = {"count": 0, "locked_until": now + timedelta(minutes=LOCK_MIN)} if fails >= MAX_FAILS else {"count": fails}
        await db.login_attempts.update_one({"identifier": key}, {"$set": upd | {"updated_at": now}}, upsert=True)
        acct_fails = (acct or {}).get("count", 0) + 1
        acct_upd = {"count": 0, "locked_until": now + timedelta(minutes=LOCK_MIN)} if acct_fails >= ACCOUNT_MAX_FAILS else {"count": acct_fails}
        await db.login_attempts.update_one({"identifier": acct_key}, {"$set": acct_upd | {"updated_at": now}}, upsert=True)
        raise HTTPException(401, "invalid_credentials")
    if doc.get("status") == "suspended":
        raise HTTPException(403, "account_suspended")
    await db.login_attempts.delete_many({"identifier": {"$in": [key, acct_key]}})
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"last_login_at": now}})
    return await issue_tokens(User.from_mongo(doc))


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshIn):
    try:
        payload = decode_token(body.refresh_token, "refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "token_invalid")
    rt = await db.refresh_tokens.find_one({"jti": payload["jti"]})
    if not rt:
        raise HTTPException(401, "token_invalid")
    if rt["revoked"]:
        await db.refresh_tokens.update_many({"user_id": rt["user_id"]}, {"$set": {"revoked": True}})
        raise HTTPException(401, "token_reused")
    await db.refresh_tokens.update_one({"_id": rt["_id"]}, {"$set": {"revoked": True}})
    doc = await db.users.find_one({"_id": rt["user_id"], "status": "active"})
    if not doc:
        raise HTTPException(401, "user_not_found")
    return await issue_tokens(User.from_mongo(doc))


@router.post("/logout", status_code=204)
async def logout(body: RefreshIn):
    try:
        payload = decode_token(body.refresh_token, "refresh")
        await db.refresh_tokens.update_one({"jti": payload["jti"]}, {"$set": {"revoked": True}})
    except jwt.InvalidTokenError:
        pass


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return user.to_public()


@router.post("/otp/request", status_code=202)
async def otp_request(body: OtpRequestIn, request: Request):
    if not await is_enabled("auth_phone_otp"):
        raise HTTPException(403, "feature_disabled")
    hit(f"otp:{body.phone}", 3, 600)
    hit(f"otp-ip:{client_ip(request)}", 10, 3600)
    code = f"{secrets.randbelow(1_000_000):06d}"
    ttl = int(await get_setting("otp_ttl_seconds"))
    now = datetime.now(timezone.utc)
    await db.otp_codes.delete_many({"phone": body.phone, "purpose": body.purpose})
    await db.otp_codes.insert_one({"phone": body.phone, "purpose": body.purpose, "code_hash": sha256(code),
                                   "attempts": 0, "created_at": now, "expires_at": now + timedelta(seconds=ttl)})
    await get_sms_adapter().send(body.phone, f"GOFIX : votre code est {code}. Valable {ttl // 60} min.")
    return {"sent": True, "expires_in": ttl}


@router.post("/otp/verify")
async def otp_verify(body: OtpVerifyIn, request: Request):
    if not await is_enabled("auth_phone_otp"):
        raise HTTPException(403, "feature_disabled")
    now = datetime.now(timezone.utc)
    otp = await db.otp_codes.find_one({"phone": body.phone, "purpose": body.purpose, "expires_at": {"$gt": now}})
    if not otp:
        raise HTTPException(400, "otp_expired")
    if otp["attempts"] >= int(await get_setting("otp_max_attempts")):
        await db.otp_codes.delete_one({"_id": otp["_id"]})
        raise HTTPException(429, "too_many_attempts")
    if not secrets.compare_digest(otp["code_hash"], sha256(body.code)):
        await db.otp_codes.update_one({"_id": otp["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "otp_invalid")
    await db.otp_codes.delete_one({"_id": otp["_id"]})
    doc = await db.users.find_one({"phone": body.phone, "status": "active"})
    if not doc:
        raise HTTPException(404, "user_not_found")
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"phone_verified": True, "last_login_at": now}})
    doc["phone_verified"] = True
    return await issue_tokens(User.from_mongo(doc))


@router.post("/password/forgot", status_code=202)
async def forgot(body: ForgotIn, request: Request):
    hit(f"forgot:{client_ip(request)}", 5, 3600)
    hit(f"forgot-mail:{body.email.lower()}", 3, 3600)  # no mail-bombing of one address from many IPs
    doc = await db.users.find_one({"email": body.email.lower(), "status": "active"})
    if doc:
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        await db.password_reset_tokens.insert_one({"token_hash": sha256(token), "user_id": doc["_id"], "used": False,
                                                   "created_at": now, "expires_at": now + timedelta(hours=1)})
        link = f"{settings.frontend_url}/reset-password?token={token}"
        await get_email_adapter().send(doc["email"], "GOFIX – Réinitialisation du mot de passe", link)
    return {"sent": True}


@router.post("/password/reset", status_code=204)
async def reset(body: ResetIn):
    now = datetime.now(timezone.utc)
    t = await db.password_reset_tokens.find_one_and_update({"token_hash": sha256(body.token), "used": False, "expires_at": {"$gt": now}},
                                                           {"$set": {"used": True, "used_at": now}})
    if not t:
        raise HTTPException(400, "token_invalid")
    await db.users.update_one({"_id": t["user_id"]}, {"$set": {"password_hash": hash_password(body.new_password), "updated_at": now}})
    await db.refresh_tokens.update_many({"user_id": t["user_id"]}, {"$set": {"revoked": True}})
