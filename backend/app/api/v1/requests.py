from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import db
from app.core.deps import client_ip, get_current_user
from app.core.ratelimit import hit
from app.models.user import User
from app.services import trust
from app.services.access_policy import resolve_access
from app.services.config_store import get_setting
from app.services.free_access import provider_access
from app.services.matching import MatchContext, get_matching_service
from app.services.notify import notify
from app.services.visibility import PUBLIC_PROFILE as PUBLIC_STATUS

router = APIRouter(tags=["requests"])

Kind = Literal["professional", "teacher"]


def _now():
    return datetime.now(timezone.utc)


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(404, "not_found")


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


def _short_name(full: str) -> str:
    parts = (full or "").split()
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else (parts[0] if parts else "")


def _j(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, list):
        return [_j(x) for x in v]
    if isinstance(v, dict):
        return {k: _j(x) for k, x in v.items()}
    return v


class RequestIn(BaseModel):
    kind: Kind
    profile_ids: list[str] = Field(default_factory=list, max_length=20)
    category_key: Optional[str] = None
    subject_key: Optional[str] = None
    level_key: Optional[str] = None
    wilaya_code: Optional[int] = Field(default=None, ge=1, le=58)
    commune: Optional[str] = Field(default=None, max_length=80)
    format: Optional[Literal["home", "online", "center"]] = None
    message: str = Field(min_length=10, max_length=2000)


class RespondIn(BaseModel):
    action: Literal["accept", "refuse"]
    reply: str = Field(default="", max_length=1000)


class ReportIn(BaseModel):
    target_type: Literal["professional", "teacher", "message", "user"]
    target_id: str = Field(min_length=1, max_length=64)
    reason: Literal["fake_profile", "inappropriate", "fraud", "harassment", "spam", "fake_review", "other"]
    details: str = Field(default="", max_length=1000)


async def _deliver(profile: dict, kind: str) -> dict:
    """Recipient entry. A provider whose free access is exhausted still receives the request, locked (details hidden)."""
    access = await provider_access(profile)
    locked = access["blocked"]
    if not locked and not access["subscribed"]:
        await _coll(kind).update_one({"_id": profile["_id"]}, {"$inc": {"free_access.requests_received": 1}})
    return {"profile_id": profile["_id"], "provider_user_id": profile["user_id"], "display_name": profile["display_name"],
            "photo_thumb_key": profile.get("photo_thumb_key"), "status": "sent", "locked": locked,
            "conversation_id": None, "seen_at": None, "responded_at": None}


@router.post("/requests", status_code=201)
async def create_request(body: RequestIn, request: Request, user: User = Depends(get_current_user)):
    hit(f"requests:{user.id}", 20, 3600)
    acc = await resolve_access(user, body.kind)
    if not acc.can_request:
        raise HTTPException(402, "plan_required")
    coll = _coll(body.kind)
    max_n = await get_setting("request_max_recipients")
    me = ObjectId(user.id)
    if body.profile_ids:
        if acc.blurred:
            raise HTTPException(402, "plan_required")
        ids = list(dict.fromkeys(_oid(x) for x in body.profile_ids))[:max_n]
        profiles = await coll.find({"_id": {"$in": ids}, **PUBLIC_STATUS, "user_id": {"$ne": me}}).to_list(max_n)
        mode = "targeted"
    else:
        q = {**PUBLIC_STATUS, "user_id": {"$ne": me}}
        if body.kind == "professional":
            if not body.category_key:
                raise HTTPException(422, "category_required")
            q["category_key"] = body.category_key
        else:
            if not body.subject_key:
                raise HTTPException(422, "subject_required")
            q["subjects.subject_key"] = body.subject_key
            if body.format:
                q["formats"] = body.format
        if body.wilaya_code and body.format != "online":
            q["zones.wilaya_code"] = body.wilaya_code
        cands = await coll.find(q).to_list(300)
        ctx = MatchContext(body.kind, category_key=body.category_key, subject_key=body.subject_key, level_key=body.level_key,
                           wilaya=body.wilaya_code, commune=body.commune, format=body.format)
        profiles = (await (await get_matching_service()).rank(cands, ctx))[:max_n]
        mode = "open"
    if not profiles:
        raise HTTPException(404, "no_recipients")
    now = _now()
    recipients = [await _deliver(p, body.kind) for p in profiles]
    doc = {"client_id": me, "client_name": user.full_name, "kind": body.kind, "mode": mode,
           "category_key": body.category_key, "subject_key": body.subject_key, "level_key": body.level_key,
           "wilaya_code": body.wilaya_code, "commune": body.commune, "format": body.format, "message": body.message.strip(),
           "recipients": recipients, "status": "open", "created_at": now, "updated_at": now}
    rid = (await db.requests.insert_one(doc)).inserted_id
    await db.contact_events.insert_many([{"user_id": me, "profile_id": r["profile_id"], "source": "request", "created_at": now}
                                         for r in recipients])
    for r in recipients:
        if r["locked"]:
            await notify(r["provider_user_id"], "request_locked", "Nouvelle demande en attente",
                         "Vous avez reçu une demande. Votre accès gratuit est épuisé : abonnez-vous pour la consulter.", "/pricing")
        else:
            await notify(r["provider_user_id"], "request", "Nouvelle demande", f"{_short_name(user.full_name)} : {body.message[:120]}",
                         "/dashboard")
    return {"id": str(rid), "mode": mode, "recipients": len(recipients)}


def _client_view(r: dict) -> dict:
    out = _j({k: v for k, v in r.items() if k not in ("_id", "client_id")})
    out["id"] = str(r["_id"])
    for rec in out["recipients"]:
        rec.pop("provider_user_id", None)
        rec.pop("locked", None)  # the client never learns that a provider is out of free access
        if r.get("mode") == "open" and rec["status"] != "accepted":
            # Open requests are dispatched by matching: identities are revealed only once a provider accepts.
            rec["display_name"], rec["photo_thumb_key"] = None, None
    return out


@router.get("/requests/mine")
async def my_requests(user: User = Depends(get_current_user)):
    docs = await db.requests.find({"client_id": ObjectId(user.id)}).sort("created_at", -1).to_list(100)
    return {"items": [_client_view(d) for d in docs]}


@router.post("/requests/{rid}/close")
async def close_request(rid: str, user: User = Depends(get_current_user)):
    res = await db.requests.update_one({"_id": _oid(rid), "client_id": ObjectId(user.id)}, {"$set": {"status": "closed", "updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    return {"ok": True}


def _provider_view(r: dict, rec: dict) -> dict:
    base = {"id": str(r["_id"]), "kind": r["kind"], "mode": r.get("mode"), "category_key": r.get("category_key"),
            "subject_key": r.get("subject_key"), "level_key": r.get("level_key"), "wilaya_code": r.get("wilaya_code"),
            "format": r.get("format"), "status": rec["status"], "locked": rec.get("locked", False),
            "request_status": r["status"], "created_at": r["created_at"], "conversation_id": _j(rec.get("conversation_id"))}
    if rec.get("locked"):
        return base | {"client_name": None, "message": None}
    return base | {"client_name": _short_name(r.get("client_name")), "message": r["message"]}


@router.get("/requests/inbox")
async def inbox(user: User = Depends(get_current_user)):
    me = ObjectId(user.id)
    docs = await db.requests.find({"recipients.provider_user_id": me}).sort("created_at", -1).to_list(200)
    now = _now()
    await db.requests.update_many({"recipients": {"$elemMatch": {"provider_user_id": me, "status": "sent", "locked": False}}},
                                  {"$set": {"recipients.$[r].status": "seen", "recipients.$[r].seen_at": now}},
                                  array_filters=[{"r.provider_user_id": me, "r.status": "sent", "r.locked": False}])
    return {"items": [_provider_view(d, next(x for x in d["recipients"] if x["provider_user_id"] == me)) for d in docs]}


@router.post("/requests/{rid}/respond")
async def respond(rid: str, body: RespondIn, request: Request, user: User = Depends(get_current_user)):
    me = ObjectId(user.id)
    r = await db.requests.find_one({"_id": _oid(rid), "recipients.provider_user_id": me})
    if not r:
        raise HTTPException(404, "not_found")
    rec = next(x for x in r["recipients"] if x["provider_user_id"] == me)
    if rec.get("locked"):
        raise HTTPException(402, "free_access_exhausted")
    if rec["status"] in ("accepted", "refused"):
        raise HTTPException(409, "already_responded")
    if r["status"] == "closed":
        raise HTTPException(409, "request_closed")
    now = _now()
    upd = {"recipients.$[r].status": "accepted" if body.action == "accept" else "refused", "recipients.$[r].responded_at": now, "updated_at": now}
    conv_id = None
    if body.action == "accept":
        existing = await db.conversations.find_one({"client_id": r["client_id"], "profile_id": rec["profile_id"]})
        conv_id = existing["_id"] if existing else (await db.conversations.insert_one({
            "client_id": r["client_id"], "provider_user_id": me, "profile_id": rec["profile_id"], "kind": r["kind"],
            "provider_display_name": rec["display_name"], "request_id": r["_id"], "created_at": now, "updated_at": now,
            "last_message": None})).inserted_id
        for sender, text in ((r["client_id"], r["message"]), (me, body.reply.strip() or "Demande acceptée. Discutons des détails ici.")):
            await db.messages.insert_one({"conversation_id": conv_id, "sender_id": sender, "body": text, "created_at": now, "read_at": None})
        await db.conversations.update_one({"_id": conv_id}, {"$set": {"updated_at": now, "last_message": {"body": text[:120], "sender_id": me, "at": now}}})
        upd["recipients.$[r].conversation_id"] = conv_id
    await db.requests.update_one({"_id": r["_id"]}, {"$set": upd}, array_filters=[{"r.provider_user_id": me}])
    if body.action == "accept":
        await notify(r["client_id"], "request_accepted", f"{rec['display_name']} a accepté votre demande",
                     "Vous pouvez maintenant échanger dans la messagerie.", f"/messages/{conv_id}")
    else:
        await notify(r["client_id"], "request_refused", f"{rec['display_name']} n'est pas disponible",
                     "Votre demande a été déclinée. Les autres destinataires peuvent encore répondre.", "/requests", channels=("inapp", "push"))
    await trust.recompute(r["kind"], rec["profile_id"], "request_answered", "requests", {"request_id": str(r["_id"])})
    return {"status": "accepted" if body.action == "accept" else "refused", "conversation_id": str(conv_id) if conv_id else None}


@router.post("/reports", status_code=201)
async def report(body: ReportIn, request: Request, user: User = Depends(get_current_user)):
    hit(f"reports:{user.id}", 10, 3600)
    await db.reports.insert_one({"reporter_id": ObjectId(user.id), "target_type": body.target_type, "target_id": body.target_id,
                                 "reason": body.reason, "details": body.details.strip(), "status": "open", "ip": client_ip(request),
                                 "created_at": _now()})
    return {"reported": True}
