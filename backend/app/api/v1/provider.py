from datetime import datetime, timezone
from io import BytesIO
from typing import Literal, Optional

from bson import ObjectId
from PIL import Image
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from app.adapters.storage import get_storage
from app.core.db import db
from app.core.deps import client_ip, get_current_user
from app.core.ratelimit import hit
from app.models.user import User
from app.services.audit import audit
from app.services.free_access import provider_access
from app.services.images import store_image
from app.services.notify import notify

router = APIRouter(tags=["provider"])

IMAGE_MAX = 5 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
DOC_MAX = 8 * 1024 * 1024
DOC_TYPES = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
DocType = Literal["id_card", "trade_register", "diploma", "other"]


def _now():
    return datetime.now(timezone.utc)


def _j(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, list):
        return [_j(x) for x in v]
    if isinstance(v, dict):
        return {k: _j(x) for k, x in v.items()}
    return v


async def read_image(file: UploadFile, kind: str, user_id: str) -> dict:
    if (file.content_type or "") not in IMAGE_TYPES:
        raise HTTPException(415, "unsupported_media_type")
    data = await file.read()
    if len(data) > IMAGE_MAX:
        raise HTTPException(413, "file_too_large")
    try:
        return store_image(data, kind, f"{kind}s/{user_id}")
    except ValueError:
        raise HTTPException(415, "unsupported_media_type")


def _content_matches(data: bytes, ext: str) -> bool:
    if ext == "pdf":
        return data[:1024].lstrip().startswith(b"%PDF-")
    try:
        with Image.open(BytesIO(data)) as img:
            fmt = img.format
            img.verify()
    except Exception:
        return False
    return fmt == {"jpg": "JPEG", "png": "PNG", "webp": "WEBP"}[ext]


async def read_document(file: UploadFile, doc_type: str, user_id: str) -> dict:
    ext = DOC_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(415, "unsupported_media_type")
    data = await file.read()
    if len(data) > DOC_MAX:
        raise HTTPException(413, "file_too_large")
    if not _content_matches(data, ext):  # the declared Content-Type is client-controlled: check the actual bytes
        raise HTTPException(415, "unsupported_media_type")
    key = get_storage().save(data, ext, private=True, folder=f"documents/{user_id}")
    return {"type": doc_type, "key": key, "name": (file.filename or "")[:120], "status": "submitted", "uploaded_at": _now()}


async def my_profile(user: User) -> tuple[str, dict]:
    uid = ObjectId(user.id)
    for kind, coll in (("professional", db.professional_profiles), ("teacher", db.teacher_profiles)):
        p = await coll.find_one({"user_id": uid})
        if p:
            return kind, p
    raise HTTPException(404, "profile_not_found")


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


def _profile_out(p: dict) -> dict:
    out = _j({k: v for k, v in p.items() if k not in ("_id", "user_id", "ai")})
    out["id"] = str(p["_id"])
    out["documents"] = [{k: v for k, v in d.items() if k != "key"} | {"has_file": bool(d.get("key"))} if isinstance(d, dict)
                        else {"type": d, "status": "declared", "has_file": False} for d in p.get("documents") or []]
    return out


@router.get("/provider/me")
async def provider_me(user: User = Depends(get_current_user)):
    kind, p = await my_profile(user)
    stats = await db.requests.aggregate([
        {"$match": {"recipients.profile_id": p["_id"]}}, {"$unwind": "$recipients"}, {"$match": {"recipients.profile_id": p["_id"]}},
        {"$group": {"_id": "$recipients.status", "n": {"$sum": 1}, "locked": {"$sum": {"$cond": ["$recipients.locked", 1, 0]}}}}]).to_list(10)
    by = {s["_id"]: s["n"] for s in stats}
    events = await db.trust_events.find({"profile_id": p["_id"]}).sort("created_at", -1).to_list(20)
    contests = await db.trust_contests.find({"profile_id": p["_id"]}).sort("created_at", -1).to_list(10)
    return {"kind": kind, "profile": _profile_out(p), "access": await provider_access(p),
            "requests": {"total": sum(by.values()), "pending": by.get("sent", 0) + by.get("seen", 0), "accepted": by.get("accepted", 0),
                         "refused": by.get("refused", 0), "locked": sum(s["locked"] for s in stats)},
            "trust": {"score": p.get("trust_score"), "status": p.get("trust_status"), "public": p.get("trust_public"),
                      "subscores": p.get("trust_subscores") or {}, "breakdown": p.get("trust_breakdown") or [],
                      "events": [_j({k: v for k, v in e.items() if k not in ("user_id",)}) | {"id": str(e["_id"])} for e in events],
                      "contests": [_j(c) | {"id": str(c["_id"])} for c in contests]}}


class ProfilePatch(BaseModel):
    bio: Optional[str] = Field(default=None, min_length=20, max_length=1500)
    experience_years: Optional[int] = Field(default=None, ge=0, le=60)
    price_hint_da: Optional[int] = Field(default=None, ge=0)
    price_hint_da_hour: Optional[int] = Field(default=None, ge=0)
    zones: Optional[list[dict]] = None
    slots: Optional[list[dict]] = None


@router.patch("/provider/profile")
async def patch_profile(body: ProfilePatch, user: User = Depends(get_current_user)):
    kind, p = await my_profile(user)
    data = body.model_dump(exclude_none=True)
    if "slots" in data:
        data["availability"] = {"week_start": user.week_start, "slots": [{"day": s.get("day"), "slot": s.get("slot")} for s in data.pop("slots")][:21]}
    if "zones" in data:
        data["zones"] = [{"wilaya_code": int(z["wilaya_code"]), "commune_names": list(z.get("commune_names") or [])[:30],
                          "radius_km": int(z.get("radius_km") or 10)} for z in data["zones"] if 1 <= int(z.get("wilaya_code") or 0) <= 58][:10]
    data["updated_at"] = _now()
    await _coll(kind).update_one({"_id": p["_id"]}, {"$set": data})
    return _profile_out(await _coll(kind).find_one({"_id": p["_id"]}))


@router.post("/provider/media/{media}")
async def upload_media(media: Literal["photo", "cover"], file: UploadFile = File(...), user: User = Depends(get_current_user)):
    kind, p = await my_profile(user)
    keys = await read_image(file, media, user.id)
    old = [p.get(k) for k in keys if p.get(k)]
    await _coll(kind).update_one({"_id": p["_id"]}, {"$set": keys | {"updated_at": _now()}})
    for k in old:
        get_storage().delete(k)
    return keys


@router.delete("/provider/media/{media}", status_code=204)
async def delete_media(media: Literal["photo", "cover"], user: User = Depends(get_current_user)):
    kind, p = await my_profile(user)
    keys = [f"{media}_key", f"{media}_thumb_key"]
    for k in keys:
        if p.get(k):
            get_storage().delete(p[k])
    await _coll(kind).update_one({"_id": p["_id"]}, {"$set": {k: None for k in keys}})


@router.post("/provider/documents", status_code=201)
async def upload_document(request: Request, doc_type: DocType = Form(...), file: UploadFile = File(...), user: User = Depends(get_current_user)):
    hit(f"docs:{user.id}", 20, 3600)
    kind, p = await my_profile(user)
    doc = await read_document(file, doc_type, user.id)
    docs = [d for d in p.get("documents") or [] if not (isinstance(d, str) and d == doc_type)]
    await _coll(kind).update_one({"_id": p["_id"]}, {"$set": {"documents": docs + [doc], "updated_at": _now()}})
    await audit("verification.document_uploaded", user, kind, str(p["_id"]), {"type": doc_type}, client_ip(request))
    return {k: v for k, v in doc.items() if k != "key"}


class ContestIn(BaseModel):
    event_id: Optional[str] = None
    message: str = Field(min_length=10, max_length=1500)


@router.post("/provider/trust/contest", status_code=201)
async def contest(body: ContestIn, request: Request, user: User = Depends(get_current_user)):
    hit(f"contest:{user.id}", 5, 86400)
    kind, p = await my_profile(user)
    doc = {"profile_id": p["_id"], "kind": kind, "user_id": ObjectId(user.id), "display_name": p["display_name"],
           "event_id": ObjectId(body.event_id) if body.event_id and ObjectId.is_valid(body.event_id) else None,
           "score_at_contest": p.get("trust_score"), "message": body.message.strip(), "status": "open", "created_at": _now()}
    res = await db.trust_contests.insert_one(doc)
    await audit("trust.contest_opened", user, kind, str(p["_id"]), {"contest_id": str(res.inserted_id)}, client_ip(request))
    await notify(user.id, "trust_contest", "Contestation reçue", "Notre équipe examine votre demande sous 72 h.", "/dashboard", channels=("inapp",))
    return {"id": str(res.inserted_id)}
