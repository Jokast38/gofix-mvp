import json
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from app.api.v1.provider import DocType, read_document, read_image
from app.core.db import db
from app.core.deps import client_ip, get_current_user
from app.core.ratelimit import hit
from app.models.user import User
from app.services import trust
from app.services.audit import audit
from app.services.notify import notify

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

Kind = Literal["professional", "teacher"]
TOTAL_STEPS = 7
OTHER_CATEGORY = "__other__"
DRAFT_MAX_BYTES = 64 * 1024


class DraftIn(BaseModel):
    kind: Kind
    step: int = Field(ge=1, le=TOTAL_STEPS)
    data: dict[str, Any] = Field(default_factory=dict)


class SubmitIn(BaseModel):
    kind: Kind


class CategoryRequestIn(BaseModel):
    family_key: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=500)


def _now():
    return datetime.now(timezone.utc)


def _clean(doc: dict) -> dict:
    return {k: (str(v) if isinstance(v, ObjectId) else v) for k, v in doc.items() if k != "_id"} | {"id": str(doc["_id"])}


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


def _validate(kind: str, d: dict) -> list[str]:
    errs = []
    if len((d.get("display_name") or "").strip()) < 2:
        errs.append("display_name")
    if len((d.get("bio") or "").strip()) < 20:
        errs.append("bio")
    zones = d.get("zones") or []
    online_only = kind == "teacher" and d.get("formats") == ["online"]
    if not zones and not online_only:
        errs.append("zones")
    if kind == "professional":
        for k in ("family_key", "category_key", "role_key"):
            if not d.get(k):
                errs.append(k)
        if d.get("category_key") == OTHER_CATEGORY and not d.get("category_request_id"):
            errs.append("category_key")
    else:
        if not d.get("subjects"):
            errs.append("subjects")
        if not d.get("formats"):
            errs.append("formats")
    if not d.get("accept_charter"):
        errs.append("accept_charter")
    return errs


@router.get("/status")
async def status(user: User = Depends(get_current_user)):
    uid = ObjectId(user.id)
    pro = await db.professional_profiles.find_one({"user_id": uid})
    teacher = await db.teacher_profiles.find_one({"user_id": uid})
    drafts = await db.onboarding_drafts.find({"user_id": uid}).to_list(2)
    return {
        "professional": _clean(pro) if pro else None,
        "teacher": _clean(teacher) if teacher else None,
        "drafts": [{"kind": d["kind"], "step": d["step"], "updated_at": d["updated_at"]} for d in drafts],
    }


@router.get("/draft")
async def get_draft(kind: Kind, user: User = Depends(get_current_user)):
    d = await db.onboarding_drafts.find_one({"user_id": ObjectId(user.id), "kind": kind})
    if not d:
        return {"kind": kind, "step": 1, "data": {}, "updated_at": None}
    return {"kind": kind, "step": d["step"], "data": d["data"], "updated_at": d["updated_at"]}


@router.put("/draft")
async def save_draft(body: DraftIn, user: User = Depends(get_current_user)):
    if len(json.dumps(body.data, default=str)) > DRAFT_MAX_BYTES:
        raise HTTPException(413, "draft_too_large")
    other = {"professional": "teacher", "teacher": "professional"}[body.kind]
    if other in user.roles:
        raise HTTPException(409, "role_conflict")
    if await _coll(body.kind).find_one({"user_id": ObjectId(user.id)}):
        raise HTTPException(409, "profile_exists")
    now = _now()
    await db.onboarding_drafts.update_one(
        {"user_id": ObjectId(user.id), "kind": body.kind},
        {"$set": {"step": body.step, "data": body.data, "updated_at": now}, "$setOnInsert": {"created_at": now}},
        upsert=True)
    await track_step(user.id, body.kind, body.step)
    return {"saved": True, "updated_at": now}


async def track_step(user_id: str, kind: str, step: int):
    """Funnel tracking: one event per (user, kind, step reached); step 8 = submitted."""
    await db.onboarding_events.update_one({"user_id": ObjectId(user_id), "kind": kind, "step": step},
                                          {"$setOnInsert": {"created_at": _now()}}, upsert=True)


@router.delete("/draft", status_code=204)
async def delete_draft(kind: Kind, user: User = Depends(get_current_user)):
    await db.onboarding_drafts.delete_one({"user_id": ObjectId(user.id), "kind": kind})


@router.post("/photo")
async def upload_photo(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    keys = await read_image(file, "photo", user.id)
    return keys | {"url": f"/api/v1/files/public/{keys['photo_key']}"}


@router.post("/cover")
async def upload_cover(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    keys = await read_image(file, "cover", user.id)
    return keys | {"url": f"/api/v1/files/public/{keys['cover_key']}"}


@router.post("/documents", status_code=201)
async def upload_document(doc_type: DocType = Form(...), file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Stored in the PRIVATE area (never served publicly); only admins can open it, and every access is audited."""
    hit(f"docs:{user.id}", 20, 3600)
    doc = await read_document(file, doc_type, user.id)
    return doc | {"uploaded_at": doc["uploaded_at"].isoformat()}


@router.post("/category-requests", status_code=201)
async def category_request(body: CategoryRequestIn, user: User = Depends(get_current_user)):
    """« Autre » : the trade is not in the taxonomy -> request sent to the admin (no free-text trade on profiles)."""
    hit(f"catreq:{user.id}", 5, 86400)
    if not await db.taxonomy_families.find_one({"key": body.family_key}):
        raise HTTPException(404, "not_found")
    res = await db.category_requests.insert_one({"user_id": ObjectId(user.id), "family_key": body.family_key, "name": body.name.strip(),
                                                 "description": body.description.strip(), "status": "pending", "created_at": _now()})
    return {"id": str(res.inserted_id), "status": "pending"}


def _documents(user_id: str, raw: list) -> list:
    out = []
    for d in raw or []:
        if isinstance(d, str):
            out.append({"type": d, "key": None, "status": "declared", "uploaded_at": None})
        elif isinstance(d, dict) and str(d.get("key") or "").startswith(f"documents/{user_id}/"):
            out.append({"type": d.get("type"), "key": d["key"], "name": d.get("name"), "status": "submitted", "uploaded_at": _now()})
    return out


def _own_key(user_id: str, key, folder: str):
    return key if isinstance(key, str) and key.startswith(f"{folder}/{user_id}/") else None


@router.post("/submit", status_code=201)
async def submit(body: SubmitIn, request: Request, user: User = Depends(get_current_user)):
    uid = ObjectId(user.id)
    draft = await db.onboarding_drafts.find_one({"user_id": uid, "kind": body.kind})
    if not draft:
        raise HTTPException(404, "draft_not_found")
    d = draft["data"]
    errs = _validate(body.kind, d)
    if errs:
        raise HTTPException(422, {"code": "draft_incomplete", "fields": errs})
    if await _coll(body.kind).find_one({"user_id": uid}):
        raise HTTPException(409, "profile_exists")
    now = _now()
    base = {
        "user_id": uid, "display_name": d["display_name"].strip(), "bio": d["bio"].strip(),
        "experience_years": int(d.get("experience_years") or 0), "zones": d.get("zones") or [],
        "photo_key": _own_key(user.id, d.get("photo_key"), "photos"), "photo_thumb_key": _own_key(user.id, d.get("photo_thumb_key"), "photos"),
        "cover_key": _own_key(user.id, d.get("cover_key"), "covers"), "cover_thumb_key": _own_key(user.id, d.get("cover_thumb_key"), "covers"),
        "documents": _documents(user.id, d.get("documents")), "chosen_plan": d.get("chosen_plan") or "free",
        "availability": {"week_start": user.week_start, "slots": d.get("slots") or []},
        "verification_status": "pending", "trust_score": 40, "plan_key": "professional_free",
        "free_access": {"started_at": now, "requests_received": 0},
        "onboarding": {"completed": True, "step": TOTAL_STEPS, "submitted_at": now},
        "ai": {}, "created_at": now, "updated_at": now,
    }
    if body.kind == "professional":
        other = d["category_key"] == OTHER_CATEGORY
        base |= {"family_key": d["family_key"], "category_key": None if other else d["category_key"], "role_key": d["role_key"],
                 "category_request_id": ObjectId(d["category_request_id"]) if other and ObjectId.is_valid(d.get("category_request_id") or "") else None,
                 "specialty_keys": d.get("specialty_keys") or [],
                 "price_hint_da": d.get("price_hint_da"), "rating_avg": 0, "rating_count": 0, "response_rate": 1.0,
                 "passport": {"enabled": False, "slug": None}}
    else:
        base |= {"role_key": d.get("role_key") or "private_teacher", "subjects": d["subjects"], "formats": d["formats"],
                 "teaching_languages": d.get("teaching_languages") or ["fr", "ar"],
                 "price_hint_da_hour": d.get("price_hint_da_hour"), "ratings_by_subject": {}}
    res = await _coll(body.kind).insert_one(base)
    await db.users.update_one({"_id": uid}, {"$addToSet": {"roles": body.kind}, "$set": {"active_mode": body.kind, "updated_at": now}})
    await db.onboarding_drafts.delete_one({"_id": draft["_id"]})
    await audit(f"onboarding.{body.kind}_submitted", user, body.kind, str(res.inserted_id), {}, client_ip(request))
    await track_step(user.id, body.kind, TOTAL_STEPS + 1)
    await trust.recompute(body.kind, res.inserted_id, "profile_created", "onboarding")
    await notify(uid, "profile_submitted", "Candidature reçue", "Votre fiche est en cours de validation (sous 48 h).", "/dashboard", channels=("inapp",))
    return {"id": str(res.inserted_id), "verification_status": "pending",
            "user": User.from_mongo(await db.users.find_one({"_id": uid})).to_public()}
