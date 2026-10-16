"""Service / lesson lifecycle (Session/Lesson entity):
proposed -> scheduled -> completed | cancelled ; disputed -> completed | failed (admin decision).
Only a completed job unlocks a *verified* review; every transition feeds the Trust Score."""
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import db
from app.core.deps import client_ip, get_current_user, require_admin
from app.core.ratelimit import hit
from app.models.user import User
from app.services import trust
from app.services.audit import audit
from app.services.config_store import get_setting
from app.services.notify import notify

router = APIRouter(tags=["jobs"])
TZ = ZoneInfo("Africa/Algiers")


def _fmt(dt: datetime) -> str:
    return dt.astimezone(TZ).strftime("%d/%m/%Y à %H:%M")
OPEN = ("proposed", "scheduled")


def _now():
    return datetime.now(timezone.utc)


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(404, "not_found")


def _j(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, list):
        return [_j(x) for x in v]
    if isinstance(v, dict):
        return {k: _j(x) for k, x in v.items()}
    return v


def _short(full: str) -> str:
    parts = (full or "").split()
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else (parts[0] if parts else "")


class JobIn(BaseModel):
    conversation_id: str
    scheduled_at: datetime
    mode: Literal["home", "online", "center", "workshop"] = "home"
    note: str = Field(default="", max_length=500)
    price_da: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    subject_key: Optional[str] = None


class ReasonIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)
    subject_key: Optional[str] = None


class DisputeDecision(BaseModel):
    resolution: Literal["resolved_client", "resolved_provider"]
    note: str = Field(min_length=3, max_length=1000)


def _role(job: dict, uid: ObjectId) -> str:
    if job["client_id"] == uid:
        return "client"
    if job["provider_user_id"] == uid:
        return "provider"
    raise HTTPException(404, "not_found")


async def _get(jid: str, user: User) -> tuple[dict, str]:
    job = await db.jobs.find_one({"_id": _oid(jid)})
    if not job:
        raise HTTPException(404, "not_found")
    return job, _role(job, ObjectId(user.id))


def _actions(job: dict, role: str, now: datetime, dispute_days: int) -> list[str]:
    s = job["status"]
    acts = []
    if s == "proposed":
        acts += ["cancel"] + (["confirm"] if job["proposed_by"] != role else [])
    if s == "scheduled":
        acts.append("cancel")
        if job["scheduled_at"] - timedelta(hours=1) <= now:
            acts += ["complete", "dispute"] if role == "client" else (["mark_done", "dispute"] if not job.get("provider_done_at") else ["dispute"])
    if s == "completed":
        done = job.get("completed_at") or now
        if now - done <= timedelta(days=dispute_days) and not job.get("dispute"):
            acts.append("dispute")
        if role == "client" and not job.get("reviewed"):
            acts.append("review")
    return acts


async def _view(job: dict, role: str) -> dict:
    now = _now()
    out = _j({k: v for k, v in job.items() if k not in ("_id", "history")})
    out["id"] = str(job["_id"])
    out["role"] = role
    other_id = job["provider_user_id"] if role == "client" else job["client_id"]
    other = await db.users.find_one({"_id": other_id}, {"full_name": 1})
    out["other_name"] = job.get("provider_display_name") if role == "client" else _short((other or {}).get("full_name"))
    out["actions"] = _actions(job, role, now, await get_setting("job_dispute_window_days"))
    out["history"] = _j(job.get("history") or [])
    return out


async def _transition(job: dict, status: str, by: str, extra: dict | None = None, reason: str = ""):
    now = _now()
    await db.jobs.update_one({"_id": job["_id"]}, {"$set": {"status": status, "updated_at": now, **(extra or {})},
                                                   "$push": {"history": {"status": status, "by": by, "reason": reason, "at": now}}})
    return await db.jobs.find_one({"_id": job["_id"]})


async def _notify_other(job: dict, role: str, title: str, body: str):
    target = job["provider_user_id"] if role == "client" else job["client_id"]
    await notify(target, "job", title, body, f"/jobs/{job['_id']}", channels=("inapp", "push"))


@router.post("/jobs", status_code=201)
async def propose(body: JobIn, user: User = Depends(get_current_user)):
    hit(f"jobs:{user.id}", 30, 3600)
    me = ObjectId(user.id)
    conv = await db.conversations.find_one({"_id": _oid(body.conversation_id), "$or": [{"client_id": me}, {"provider_user_id": me}]})
    if not conv:
        raise HTTPException(404, "not_found")
    if body.scheduled_at.tzinfo is None:
        body.scheduled_at = body.scheduled_at.replace(tzinfo=timezone.utc)
    if body.scheduled_at < _now() - timedelta(minutes=5):
        raise HTTPException(422, "date_in_past")
    if await db.jobs.count_documents({"conversation_id": conv["_id"], "status": {"$in": list(OPEN)}}) >= 3:
        raise HTTPException(409, "too_many_open_jobs")
    role = "client" if conv["client_id"] == me else "provider"
    request = await db.requests.find_one({"_id": conv.get("request_id")}) if conv.get("request_id") else None
    profile = await (db.professional_profiles if conv["kind"] == "professional" else db.teacher_profiles).find_one({"_id": conv["profile_id"]})
    now = _now()
    doc = {"conversation_id": conv["_id"], "request_id": conv.get("request_id"), "kind": conv["kind"], "client_id": conv["client_id"],
           "provider_user_id": conv["provider_user_id"], "profile_id": conv["profile_id"], "provider_display_name": conv.get("provider_display_name"),
           "category_key": (profile or {}).get("category_key"), "subject_key": body.subject_key or (request or {}).get("subject_key"),
           "level_key": (request or {}).get("level_key"), "scheduled_at": body.scheduled_at, "mode": body.mode, "note": body.note.strip(),
           "price_da": body.price_da, "status": "proposed", "proposed_by": role, "reviewed": False,
           "history": [{"status": "proposed", "by": role, "reason": "", "at": now}], "created_at": now, "updated_at": now}
    doc["_id"] = (await db.jobs.insert_one(doc)).inserted_id
    await _notify_other(doc, role, "Rendez-vous proposé", f"Le {_fmt(body.scheduled_at)}. Confirmez-le dans GoFix.")
    return await _view(doc, role)


@router.get("/jobs")
async def list_jobs(conversation_id: str | None = None, status: str | None = None, user: User = Depends(get_current_user)):
    me = ObjectId(user.id)
    q: dict = {"$or": [{"client_id": me}, {"provider_user_id": me}]}
    if conversation_id:
        q["conversation_id"] = _oid(conversation_id)
    if status:
        q["status"] = {"$in": status.split(",")}
    docs = await db.jobs.find(q).sort("scheduled_at", -1).to_list(200)
    return {"items": [await _view(d, _role(d, me)) for d in docs]}


@router.get("/jobs/{jid}")
async def get_job(jid: str, user: User = Depends(get_current_user)):
    job, role = await _get(jid, user)
    return await _view(job, role)


@router.post("/jobs/{jid}/confirm")
async def confirm(jid: str, user: User = Depends(get_current_user)):
    job, role = await _get(jid, user)
    if job["status"] != "proposed" or job["proposed_by"] == role:
        raise HTTPException(409, "invalid_transition")
    job = await _transition(job, "scheduled", role, {"confirmed_at": _now()})
    await _notify_other(job, role, "Rendez-vous confirmé", f"Le {_fmt(job['scheduled_at'])}.")
    return await _view(job, role)


@router.post("/jobs/{jid}/cancel")
async def cancel(jid: str, body: ReasonIn, user: User = Depends(get_current_user)):
    job, role = await _get(jid, user)
    if job["status"] not in OPEN:
        raise HTTPException(409, "invalid_transition")
    late = job["status"] == "scheduled" and job["scheduled_at"] - _now() < timedelta(hours=await get_setting("job_late_cancel_hours"))
    job = await _transition(job, "cancelled", role, {"cancelled_by": role, "cancel_reason": body.reason, "late_cancel": late}, body.reason)
    await _notify_other(job, role, "Rendez-vous annulé", body.reason[:140])
    if role == "provider" and job.get("confirmed_at"):
        await trust.recompute(job["kind"], job["profile_id"], "job_cancelled_by_provider", "jobs", {"job_id": jid, "late": late},
                              source_type="behavioral", evidence_id=jid)
    return await _view(job, role)


@router.post("/jobs/{jid}/complete")
async def complete(jid: str, user: User = Depends(get_current_user)):
    """Client confirms the job/lesson took place. A provider can only *mark it done* (client confirms, or auto after N hours)."""
    job, role = await _get(jid, user)
    acts = _actions(job, role, _now(), await get_setting("job_dispute_window_days"))
    if role == "provider":
        if "mark_done" not in acts:
            raise HTTPException(409, "invalid_transition")
        await db.jobs.update_one({"_id": job["_id"]}, {"$set": {"provider_done_at": _now(), "updated_at": _now()},
                                                       "$push": {"history": {"status": "provider_done", "by": role, "reason": "", "at": _now()}}})
        job = await db.jobs.find_one({"_id": job["_id"]})
        await _notify_other(job, role, "Prestation terminée ?", "Confirmez que la prestation a bien eu lieu, puis laissez un avis.")
        return await _view(job, role)
    if "complete" not in acts:
        raise HTTPException(409, "invalid_transition")
    job = await complete_job(job, "client")
    return await _view(job, role)


async def complete_job(job: dict, by: str) -> dict:
    job = await _transition(job, "completed", by, {"completed_at": _now()})
    await trust.recompute(job["kind"], job["profile_id"], "job_completed", "jobs", {"job_id": str(job["_id"])},
                          source_type="behavioral", evidence_id=str(job["_id"]))
    await notify(job["client_id"], "job_completed", "Prestation terminée", "Donnez votre avis : il aide toute la communauté.",
                 f"/jobs/{job['_id']}", channels=("inapp", "push"))
    return job


@router.post("/jobs/{jid}/dispute")
async def dispute(jid: str, body: ReasonIn, request: Request, user: User = Depends(get_current_user)):
    job, role = await _get(jid, user)
    if "dispute" not in _actions(job, role, _now(), await get_setting("job_dispute_window_days")):
        raise HTTPException(409, "invalid_transition")
    job = await _transition(job, "disputed", role, {"dispute": {"opened_by": role, "reason": body.reason, "status": "open", "opened_at": _now()}},
                            body.reason)
    await audit("jobs.dispute_opened", user, "job", jid, {"role": role}, client_ip(request))
    await _notify_other(job, role, "Litige ouvert", "L'équipe GoFix examine la situation et revient vers vous.")
    return await _view(job, role)


@router.post("/jobs/{jid}/review", status_code=201)
async def review(jid: str, body: ReviewIn, user: User = Depends(get_current_user)):
    """Verified review: only the client, only once, only after a completed job/lesson (rated per subject for lessons)."""
    job, role = await _get(jid, user)
    if role != "client" or job["status"] != "completed" or job.get("reviewed"):
        raise HTTPException(403, "review_requires_completed_job")
    subject = body.subject_key or job.get("subject_key") if job["kind"] == "teacher" else None
    if job["kind"] == "teacher" and not subject:
        raise HTTPException(422, "subject_required")
    now = _now()
    claimed = await db.jobs.update_one({"_id": job["_id"], "reviewed": {"$ne": True}}, {"$set": {"reviewed": True}})
    if not claimed.modified_count:
        raise HTTPException(409, "already_reviewed")
    await db.reviews.insert_one({"job_id": job["_id"], "request_id": job.get("request_id"), "profile_id": job["profile_id"], "kind": job["kind"],
                                 "client_id": ObjectId(user.id), "author_name": _short(user.full_name), "rating": body.rating,
                                 "subject_key": subject, "comment": body.comment.strip(), "verified": True, "created_at": now})
    coll = db.professional_profiles if job["kind"] == "professional" else db.teacher_profiles
    p = await coll.find_one({"_id": job["profile_id"]})
    count = (p.get("rating_count") or 0) + 1
    avg = round(((p.get("rating_avg") or 0) * (count - 1) + body.rating) / count, 2)
    upd = {"rating_avg": avg, "rating_count": count}
    if subject:
        cur = (p.get("ratings_by_subject") or {}).get(subject) or {"avg": 0, "count": 0}
        n = cur["count"] + 1
        upd[f"ratings_by_subject.{subject}"] = {"avg": round((cur["avg"] * cur["count"] + body.rating) / n, 2), "count": n}
    await coll.update_one({"_id": p["_id"]}, {"$set": upd})
    await trust.recompute(job["kind"], p["_id"], "review_received", "reviews", {"job_id": jid, "rating": body.rating},
                          source_type="behavioral", evidence_id=jid)
    await trust.flag_review_anomaly(job["kind"], p["_id"])
    await notify(job["provider_user_id"], "review", "Nouvel avis vérifié", f"Note : {body.rating}/5", "/dashboard", channels=("inapp", "push"))
    return {"ok": True, "rating_avg": avg, "rating_count": count}


# ---------- Admin: disputes ----------
@router.get("/admin/disputes")
async def disputes(status: str = "open", _: User = Depends(require_admin("moderator", "support"))):
    q = {"dispute.status": status} if status else {"dispute": {"$exists": True}}
    docs = await db.jobs.find(q).sort("updated_at", -1).to_list(200)
    users = {u["_id"]: u async for u in db.users.find({"_id": {"$in": [d["client_id"] for d in docs]}}, {"full_name": 1, "email": 1})}
    return [_j({k: v for k, v in d.items() if k != "_id"}) | {"id": str(d["_id"]), "client": {"name": users.get(d["client_id"], {}).get("full_name"),
                                                                                          "email": users.get(d["client_id"], {}).get("email")}} for d in docs]


@router.patch("/admin/disputes/{jid}")
async def resolve_dispute(jid: str, body: DisputeDecision, request: Request, admin: User = Depends(require_admin("moderator"))):
    job = await db.jobs.find_one({"_id": _oid(jid), "dispute.status": "open"})
    if not job:
        raise HTTPException(404, "not_found")
    status = "failed" if body.resolution == "resolved_client" else "completed"
    extra = {"dispute.status": body.resolution, "dispute.note": body.note, "dispute.resolved_at": _now(), "dispute.resolved_by": admin.email}
    if status == "completed" and not job.get("completed_at"):
        extra["completed_at"] = _now()
    job = await _transition(job, status, "admin", extra, body.note)
    await trust.recompute(job["kind"], job["profile_id"], "dispute_resolved", "moderation", {"job_id": jid, "resolution": body.resolution},
                          source_type="moderation", evidence_id=jid)
    await audit("jobs.dispute_resolved", admin, "job", jid, {"resolution": body.resolution, "note": body.note}, client_ip(request))
    for uid in (job["client_id"], job["provider_user_id"]):
        await notify(uid, "dispute", "Décision sur le litige", body.note[:140], f"/jobs/{jid}")
    return {"ok": True, "status": status}


async def auto_complete_due(now: datetime | None = None) -> int:
    """Scheduler: provider marked done N hours ago, client silent and no dispute -> completed."""
    now = now or _now()
    hours = await get_setting("job_auto_complete_hours")
    n = 0
    async for job in db.jobs.find({"status": "scheduled", "provider_done_at": {"$lte": now - timedelta(hours=hours)}}):
        await complete_job(job, "system")
        n += 1
    return n


async def remind_upcoming(now: datetime | None = None) -> int:
    now = now or _now()
    n = 0
    async for job in db.jobs.find({"status": "scheduled", "reminded": {"$ne": True}, "scheduled_at": {"$gt": now, "$lte": now + timedelta(hours=24)}}):
        await db.jobs.update_one({"_id": job["_id"]}, {"$set": {"reminded": True}})
        for uid in (job["client_id"], job["provider_user_id"]):
            await notify(uid, "job_reminder", "Rendez-vous demain", f"Le {_fmt(job['scheduled_at'])}.", f"/jobs/{job['_id']}", channels=("inapp", "push"))
        n += 1
    return n
