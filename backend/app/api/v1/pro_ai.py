"""GOFIX PRO AI: the pro's commercial workspace, built on the existing requests, conversations and jobs.

- Leads are the requests a pro received (no copy): PRO AI only adds a status, a priority and a private note.
- Quotes are priced in DZD minor units (centimes); every total is computed here, never trusted from the app.
- Nothing commercial leaves without the pro's explicit action: a quote is sent by "send", a follow-up message by
  "send", the assistant only returns a draft. Scheduled follow-ups only remind the pro himself.
- A client can mute follow-ups in a conversation; follow-ups are capped (anti-spam).
- Every resource is looked up with the authenticated pro's id: another pro's lead or quote is a 404.
"""
import re
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from statistics import median
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from pymongo import ReturnDocument

from app.api.v1 import jobs as jobs_api
from app.api.v1.passport import _passport, completeness, credentials
from app.api.v1.provider import my_profile
from app.api.v1.requests import accept_request
from app.core.db import db
from app.core.deps import client_ip, get_current_user
from app.core.ratelimit import hit
from app.data.pro_templates import DATE_PREFIX, SERVICE_QUOTE, TEMPLATES
from app.models.user import User
from app.services.audit import audit
from app.services.config_store import is_enabled
from app.services.notify import notify_key, user_lang

router = APIRouter(tags=["pro-ai"])

TZ = ZoneInfo("Africa/Algiers")
LEAD_STATUSES = ("new", "qualified", "quoted", "won", "lost")
# Manual moves a pro may make. "quoted" is set by sending a quote; "won" / "lost" also follow the client's answer.
LEAD_MOVES = {"new": {"qualified", "lost"}, "qualified": {"new", "lost"}, "quoted": {"won", "lost"}, "lost": {"qualified"}, "won": set()}
PRIORITIES = ("low", "normal", "high")
QUOTE_OPEN = ("draft", "sent")
DEFAULT_SETTINGS = {"reminders": True, "followup_after_days": 3, "quote_valid_days": 15, "default_notes": ""}
FOLLOWUP_MIN_GAP = timedelta(hours=24)
FOLLOWUP_MAX_PER_WEEK = 3
PERIODS = {"week": 7, "month": 30, "quarter": 91, "year": 365}


def _now():
    return datetime.now(timezone.utc)


def _utc(d: datetime | None) -> datetime | None:
    return d.replace(tzinfo=timezone.utc) if d is not None and d.tzinfo is None else d


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


def _first(full: str) -> str:
    return ((full or "").split() or [""])[0]


async def _enabled():
    if not await is_enabled("pro_ai"):
        raise HTTPException(404, "feature_disabled")


async def _pro(user: User) -> tuple[str, dict, ObjectId]:
    await _enabled()
    kind, p = await my_profile(user)
    return kind, p, ObjectId(user.id)


def _settings(p: dict) -> dict:
    return DEFAULT_SETTINGS | ((p.get("pro_ai") or {}).get("settings") or {})


def money(minor: int, lang: str = "fr") -> str:
    """fr: 4 500,50 DA ; en: 4,500.50 DA ; ar: 4 500 دج."""
    da, cents = divmod(int(minor), 100)
    txt = f"{da:,}" if lang == "en" else f"{da:,}".replace(",", " ")
    if cents:
        txt += ("." if lang == "en" else ",") + f"{cents:02d}"
    return f"{txt} {'دج' if lang == 'ar' else 'DA'}"


def _day(d: datetime | None) -> str:
    return _utc(d).astimezone(TZ).strftime("%d/%m/%Y") if d else ""


# ---------------------------------------------------------------- leads
async def _lead_request(rid: str, me: ObjectId) -> tuple[dict, dict]:
    r = await db.requests.find_one({"_id": _oid(rid), "recipients.provider_user_id": me})
    if not r:
        raise HTTPException(404, "not_found")
    return r, next(x for x in r["recipients"] if x["provider_user_id"] == me)


def _default_status(rec: dict) -> str:
    return "lost" if rec["status"] == "refused" else "new"


def _lead_view(r: dict, rec: dict, meta: dict | None, stats: dict | None = None) -> dict:
    meta = meta or {}
    locked = bool(rec.get("locked"))
    out = {"id": str(r["_id"]), "ref": r.get("ref"), "kind": r["kind"], "source": r.get("source") or ("ai_match" if r.get("mode") == "open" else "direct"),
           "category_key": r.get("category_key"), "subject_key": r.get("subject_key"), "level_key": r.get("level_key"),
           "wilaya_code": r.get("wilaya_code"), "commune": r.get("commune"), "format": r.get("format"),
           "created_at": r["created_at"], "request_status": r["status"], "response": rec["status"], "locked": locked,
           "conversation_id": _j(rec.get("conversation_id")), "status": meta.get("status") or _default_status(rec),
           "priority": meta.get("priority") or "normal", "note": meta.get("note") or "", "updated_at": meta.get("updated_at"),
           "client_name": None if locked else _short(r.get("client_name")), "message": None if locked else r["message"]}
    return out | (stats or {})


async def _lead_stats(me: ObjectId, rids: list) -> dict:
    stats = {rid: {"quotes": 0, "last_quote": None} for rid in rids}
    async for q in db.quotes.find({"provider_user_id": me, "request_id": {"$in": rids}}, {"request_id": 1, "status": 1, "total_minor": 1}).sort("created_at", 1):
        s = stats[q["request_id"]]
        s["quotes"] += 1
        s["last_quote"] = {"id": str(q["_id"]), "status": q["status"], "total_minor": q["total_minor"]}
    return stats


class LeadPatch(BaseModel):
    status: Optional[Literal["new", "qualified", "quoted", "won", "lost"]] = None
    priority: Optional[Literal["low", "normal", "high"]] = None
    note: Optional[str] = Field(default=None, max_length=1000)


@router.get("/pro/leads")
async def list_leads(status: str | None = None, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    docs = await db.requests.find({"recipients.provider_user_id": me}).sort("created_at", -1).to_list(300)
    rids = [d["_id"] for d in docs]
    metas = {m["request_id"]: m async for m in db.pro_leads.find({"provider_user_id": me, "request_id": {"$in": rids}})}
    stats = await _lead_stats(me, rids)
    items = [_lead_view(d, next(x for x in d["recipients"] if x["provider_user_id"] == me), metas.get(d["_id"]), stats[d["_id"]]) for d in docs]
    counts = {s: sum(1 for i in items if i["status"] == s) for s in LEAD_STATUSES}
    if status == "open":
        items = [i for i in items if i["status"] in ("new", "qualified", "quoted")]
    elif status:
        wanted = set(status.split(","))
        items = [i for i in items if i["status"] in wanted]
    return {"items": items, "counts": counts}


@router.get("/pro/leads/{rid}")
async def get_lead(rid: str, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    r, rec = await _lead_request(rid, me)
    meta = await db.pro_leads.find_one({"provider_user_id": me, "request_id": r["_id"]})
    out = _lead_view(r, rec, meta, (await _lead_stats(me, [r["_id"]]))[r["_id"]])
    out["quotes"] = [_quote_view(q) for q in await db.quotes.find({"provider_user_id": me, "request_id": r["_id"]}).sort("created_at", -1).to_list(50)]
    out["followups"] = [_followup_view(f) for f in await db.pro_followups.find({"provider_user_id": me, "request_id": r["_id"]}).sort("created_at", -1).to_list(50)]
    out["appointments"] = [{"id": str(j["_id"]), "status": j["status"], "scheduled_at": j["scheduled_at"], "duration_min": j.get("duration_min", 60)}
                           for j in await db.jobs.find({"provider_user_id": me, "request_id": r["_id"]}).sort("scheduled_at", -1).to_list(20)]
    out["followups_muted"] = bool(out["conversation_id"] and (await db.conversations.find_one({"_id": rec.get("conversation_id")}, {"followups_muted": 1}) or {}).get("followups_muted"))
    return out


async def _set_lead(me: ObjectId, request_id: ObjectId, **fields):
    await db.pro_leads.update_one({"provider_user_id": me, "request_id": request_id},
                                  {"$set": {**fields, "updated_at": _now()}, "$setOnInsert": {"created_at": _now()}}, upsert=True)


@router.patch("/pro/leads/{rid}")
async def patch_lead(rid: str, body: LeadPatch, request: Request, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    r, rec = await _lead_request(rid, me)
    if rec.get("locked"):
        raise HTTPException(402, "free_access_exhausted")
    meta = await db.pro_leads.find_one({"provider_user_id": me, "request_id": r["_id"]}) or {}
    current = meta.get("status") or _default_status(rec)
    upd = {}
    if body.status and body.status != current:
        if body.status not in LEAD_MOVES[current]:
            raise HTTPException(409, "invalid_lead_transition")
        upd["status"] = body.status
    if body.priority:
        upd["priority"] = body.priority
    if body.note is not None:
        upd["note"] = body.note.strip()
    if upd:
        await _set_lead(me, r["_id"], **upd)
        if "status" in upd:
            await audit("pro_ai.lead_status", user, "request", rid, {"from": current, "to": upd["status"]}, client_ip(request))
    return await get_lead(rid, user)


async def _conversation_for(r: dict, rec: dict, me: ObjectId) -> ObjectId:
    """The conversation with the lead's client; a request not yet answered is accepted first (opens the conversation)."""
    if rec.get("locked"):
        raise HTTPException(402, "free_access_exhausted")
    if rec.get("conversation_id"):
        return rec["conversation_id"]
    if rec["status"] == "refused" or r["status"] == "closed":
        raise HTTPException(409, "request_closed")
    return await accept_request(r, rec, me)


# ---------------------------------------------------------------- quotes
class QuoteItem(BaseModel):
    label: str = Field(min_length=2, max_length=120)
    qty: Decimal = Field(gt=0, le=10000)
    unit_price_minor: int = Field(ge=0, le=10_000_000_000)

    @field_validator("qty")
    @classmethod
    def _two_decimals(cls, v: Decimal) -> Decimal:
        if v != v.quantize(Decimal("0.01")):
            raise ValueError("qty_precision")
        return v


class QuoteBody(BaseModel):
    items: list[QuoteItem] = Field(min_length=1, max_length=30)
    notes: str = Field(default="", max_length=1000)
    valid_days: Optional[int] = Field(default=None, ge=1, le=90)


class QuoteIn(QuoteBody):
    lead_id: str
    currency: Literal["DZD"] = "DZD"


class SendIn(BaseModel):
    message: str = Field(default="", max_length=2000)


class DecisionIn(BaseModel):
    reason: str = Field(default="", max_length=500)


def _priced(items: list[QuoteItem]) -> tuple[list[dict], int]:
    """Line totals and grand total, computed server side (qty has at most 2 decimals; rounded to the centime)."""
    out, total = [], 0
    for it in items:
        line = int((it.qty * it.unit_price_minor).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        out.append({"label": it.label.strip(), "qty": float(it.qty), "unit_price_minor": it.unit_price_minor, "total_minor": line})
        total += line
    if total > 100_000_000_000:
        raise HTTPException(422, "quote_too_large")
    return out, total


def _expired(q: dict, now: datetime | None = None) -> bool:
    return q["status"] == "sent" and q.get("expires_at") is not None and _utc(q["expires_at"]) <= (now or _now())


def _quote_view(q: dict, role: str = "provider") -> dict:
    out = _j({k: v for k, v in q.items() if k not in ("_id", "idempotency_key", "provider_user_id", "client_id")})
    out["id"] = str(q["_id"])
    if _expired(q):
        out["status"] = "expired"
    out["role"] = role
    return out


async def _next_ref(now: datetime) -> str:
    c = await db.counters.find_one_and_update({"_id": f"quote-{now.year}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return f"DEV-{now.year}-{c['seq']:06d}"


async def _my_quote(qid: str, me: ObjectId) -> dict:
    q = await db.quotes.find_one({"_id": _oid(qid), "provider_user_id": me})
    if not q:
        raise HTTPException(404, "not_found")
    return q


@router.post("/pro/quotes", status_code=201)
async def create_quote(body: QuoteIn, request: Request, user: User = Depends(get_current_user)):
    kind, p, me = await _pro(user)
    idem = (request.headers.get("Idempotency-Key") or "")[:80] or None
    if idem:
        prev = await db.quotes.find_one({"provider_user_id": me, "idempotency_key": idem})
        if prev:
            return _quote_view(prev) | {"replayed": True}
    await hit(f"quotes:{user.id}", 60, 3600)
    r, rec = await _lead_request(body.lead_id, me)
    if rec.get("locked"):
        raise HTTPException(402, "free_access_exhausted")
    if await db.quotes.count_documents({"provider_user_id": me, "request_id": r["_id"], "status": "draft"}) >= 5:
        raise HTTPException(409, "too_many_drafts")
    items, total = _priced(body.items)
    now = _now()
    doc = {"provider_user_id": me, "profile_id": p["_id"], "kind": kind, "provider_display_name": p.get("display_name"),
           "request_id": r["_id"], "request_ref": r.get("ref"), "client_id": r["client_id"], "client_name": _short(r.get("client_name")),
           "category_key": r.get("category_key"), "subject_key": r.get("subject_key"), "ref": await _next_ref(now), "currency": "DZD",
           "items": items, "total_minor": total, "notes": body.notes.strip(), "valid_days": body.valid_days or _settings(p)["quote_valid_days"],
           "status": "draft", "idempotency_key": idem, "created_at": now, "updated_at": now, "sent_at": None, "expires_at": None,
           "decided_at": None, "conversation_id": rec.get("conversation_id")}
    doc["_id"] = (await db.quotes.insert_one(doc)).inserted_id
    await audit("pro_ai.quote_created", user, "quote", str(doc["_id"]), {"ref": doc["ref"], "total_minor": total}, client_ip(request))
    return _quote_view(doc)


@router.get("/pro/quotes")
async def list_quotes(lead_id: str | None = None, status: str | None = None, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    q: dict = {"provider_user_id": me}
    if lead_id:
        q["request_id"] = _oid(lead_id)
    docs = [_quote_view(d) for d in await db.quotes.find(q).sort("created_at", -1).to_list(300)]
    if status:
        docs = [d for d in docs if d["status"] in status.split(",")]
    return {"items": docs}


@router.get("/pro/quotes/{qid}")
async def get_my_quote(qid: str, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    return _quote_view(await _my_quote(qid, me))


@router.put("/pro/quotes/{qid}")
async def update_quote(qid: str, body: QuoteBody, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    items, total = _priced(body.items)
    upd = {"items": items, "total_minor": total, "notes": body.notes.strip(), "updated_at": _now()}
    if body.valid_days:
        upd["valid_days"] = body.valid_days
    q = await db.quotes.find_one_and_update({"_id": _oid(qid), "provider_user_id": me, "status": "draft"}, {"$set": upd}, return_document=ReturnDocument.AFTER)
    if not q:
        await _my_quote(qid, me)
        raise HTTPException(409, "quote_not_editable")
    return _quote_view(q)


@router.delete("/pro/quotes/{qid}", status_code=204)
async def delete_quote(qid: str, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    res = await db.quotes.delete_one({"_id": _oid(qid), "provider_user_id": me, "status": "draft"})
    if not res.deleted_count:
        await _my_quote(qid, me)
        raise HTTPException(409, "quote_not_editable")


@router.post("/pro/quotes/{qid}/send")
async def send_quote(qid: str, body: SendIn, request: Request, user: User = Depends(get_current_user)):
    """Explicit send by the pro. A second tap (or a retry) finds the quote already sent and returns it."""
    _, p, me = await _pro(user)
    q = await _my_quote(qid, me)
    if q["status"] != "draft":
        if q["status"] == "sent" and not _expired(q):
            return _quote_view(q) | {"replayed": True}
        raise HTTPException(409, "quote_not_editable")
    r, rec = await _lead_request(str(q["request_id"]), me)
    conv_id = await _conversation_for(r, rec, me)
    now = _now()
    claimed = await db.quotes.find_one_and_update(
        {"_id": q["_id"], "status": "draft"},
        {"$set": {"status": "sent", "sent_at": now, "expires_at": now + timedelta(days=q["valid_days"]), "conversation_id": conv_id, "updated_at": now}},
        return_document=ReturnDocument.AFTER)
    if not claimed:
        return _quote_view(await _my_quote(qid, me)) | {"replayed": True}
    lang = await user_lang(r["client_id"]) or "fr"
    text = body.message.strip() or _quote_line(claimed, lang)
    await _post(conv_id, me, text, quote_id=claimed["_id"])
    meta = await db.pro_leads.find_one({"provider_user_id": me, "request_id": r["_id"]}) or {}
    if (meta.get("status") or _default_status(rec)) != "won":
        await _set_lead(me, r["_id"], status="quoted")
    await notify_key(r["client_id"], "quote", "quote_received", f"/quotes/{qid}", channels=("inapp", "push"),
                     name=p.get("display_name"), total=money(claimed["total_minor"], lang))
    await audit("pro_ai.quote_sent", user, "quote", qid, {"ref": claimed["ref"], "total_minor": claimed["total_minor"]}, client_ip(request))
    return _quote_view(claimed)


def _quote_line(q: dict, lang: str) -> str:
    lines = {"fr": "Devis {ref} : {total}, valable jusqu'au {valid}.", "ar": "عرض السعر {ref}: {total}، صالح إلى غاية {valid}.",
             "en": "Quote {ref}: {total}, valid until {valid}."}
    return lines.get(lang, lines["fr"]).format(ref=q["ref"], total=money(q["total_minor"], lang), valid=_day(q["expires_at"]))


async def _post(conv_id: ObjectId, sender: ObjectId, text: str, **extra):
    now = _now()
    await db.messages.insert_one({"conversation_id": conv_id, "sender_id": sender, "body": text, "created_at": now, "read_at": None, **extra})
    await db.conversations.update_one({"_id": conv_id}, {"$set": {"updated_at": now, "last_message": {"body": text[:120], "sender_id": sender, "at": now}}})


# Client side: the quote as received, and the answer.
async def _visible_quote(qid: str, user: User) -> tuple[dict, str]:
    me = ObjectId(user.id)
    q = await db.quotes.find_one({"_id": _oid(qid), "status": {"$ne": "draft"}, "$or": [{"client_id": me}, {"provider_user_id": me}]})
    if not q:
        raise HTTPException(404, "not_found")
    return q, "client" if q["client_id"] == me else "provider"


@router.get("/quotes/{qid}")
async def view_quote(qid: str, user: User = Depends(get_current_user)):
    q, role = await _visible_quote(qid, user)
    out = _quote_view(q, role)
    if role == "client" and q.get("conversation_id"):
        conv = await db.conversations.find_one({"_id": q["conversation_id"]}, {"followups_muted": 1})
        out["followups_muted"] = bool((conv or {}).get("followups_muted"))
    return out


async def _decide(qid: str, user: User, decision: str, reason: str, request: Request) -> dict:
    q, role = await _visible_quote(qid, user)
    if role != "client":
        raise HTTPException(404, "not_found")
    if _expired(q):
        raise HTTPException(409, "quote_expired")
    now = _now()
    upd = {"status": decision, "decided_at": now, "updated_at": now, "decision_reason": reason.strip()}
    claimed = await db.quotes.find_one_and_update({"_id": q["_id"], "status": "sent"}, {"$set": upd}, return_document=ReturnDocument.AFTER)
    if not claimed:
        if q["status"] == decision:
            return _quote_view(q, role)
        raise HTTPException(409, "quote_already_decided")
    if decision == "accepted":
        await _set_lead(q["provider_user_id"], q["request_id"], status="won")
    elif not await db.quotes.count_documents({"provider_user_id": q["provider_user_id"], "request_id": q["request_id"], "status": {"$in": ["sent", "accepted"]}}):
        await _set_lead(q["provider_user_id"], q["request_id"], status="lost")
    lang = await user_lang(q["provider_user_id"]) or "fr"
    await notify_key(q["provider_user_id"], "quote", f"quote_{decision}", f"/pro-ai/leads/{q['request_id']}", channels=("inapp", "push"),
                     name=_short(user.full_name), ref=q["ref"], total=money(q["total_minor"], lang))
    await audit(f"pro_ai.quote_{decision}", user, "quote", qid, {"ref": q["ref"]}, client_ip(request))
    return _quote_view(claimed, role)


@router.post("/quotes/{qid}/accept")
async def accept_quote(qid: str, request: Request, user: User = Depends(get_current_user)):
    return await _decide(qid, user, "accepted", "", request)


@router.post("/quotes/{qid}/reject")
async def reject_quote(qid: str, body: DecisionIn, request: Request, user: User = Depends(get_current_user)):
    return await _decide(qid, user, "rejected", body.reason, request)


class MuteIn(BaseModel):
    muted: bool


@router.post("/conversations/{cid}/followups-mute")
async def mute_followups(cid: str, body: MuteIn, request: Request, user: User = Depends(get_current_user)):
    """Client opt-out: the pro can no longer send follow-up messages in this conversation (normal messages still work)."""
    res = await db.conversations.update_one({"_id": _oid(cid), "client_id": ObjectId(user.id)}, {"$set": {"followups_muted": body.muted}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    await audit("pro_ai.followups_muted" if body.muted else "pro_ai.followups_unmuted", user, "conversation", cid, None, client_ip(request))
    return {"muted": body.muted}


async def expire_quotes(now: datetime | None = None) -> int:
    """Scheduler: sent quotes past their validity become expired (the pro is told, so he can follow up)."""
    now = now or _now()
    n = 0
    async for q in db.quotes.find({"status": "sent", "expires_at": {"$lte": now}}):
        if (await db.quotes.update_one({"_id": q["_id"], "status": "sent"}, {"$set": {"status": "expired", "updated_at": now}})).modified_count:
            await notify_key(q["provider_user_id"], "quote", "quote_expired", f"/pro-ai/leads/{q['request_id']}", channels=("inapp",), ref=q["ref"])
            n += 1
    return n


# ---------------------------------------------------------------- follow-ups
class FollowupIn(BaseModel):
    lead_id: str
    quote_id: Optional[str] = None
    due_at: datetime
    note: str = Field(default="", max_length=500)


class FollowupSendIn(BaseModel):
    lead_id: str
    quote_id: Optional[str] = None
    message: str = Field(min_length=5, max_length=2000)


def _followup_view(f: dict) -> dict:
    out = _j({k: v for k, v in f.items() if k not in ("_id", "provider_user_id")})
    out["id"] = str(f["_id"])
    return out


@router.get("/pro/followups")
async def list_followups(user: User = Depends(get_current_user)):
    """to_follow: sent quotes without answer for N days (suggestions) ; scheduled: reminders the pro set ; history."""
    _, p, me = await _pro(user)
    now, days = _now(), _settings(p)["followup_after_days"]
    last = {}
    async for f in db.pro_followups.find({"provider_user_id": me, "status": "done"}).sort("done_at", 1):
        last[f["request_id"]] = f["done_at"]
    suggestions = []
    async for q in db.quotes.find({"provider_user_id": me, "status": "sent", "sent_at": {"$lte": now - timedelta(days=days)}}).sort("sent_at", 1):
        if _expired(q, now):
            continue
        since = max(_utc(q["sent_at"]), _utc(last.get(q["request_id"])) or _utc(q["sent_at"]))
        if since <= now - timedelta(days=days):
            suggestions.append({"lead_id": str(q["request_id"]), "quote": _quote_view(q), "client_name": q.get("client_name"),
                                "days": (now - _utc(q["sent_at"])).days})
    scheduled = [_followup_view(f) for f in await db.pro_followups.find({"provider_user_id": me, "status": "pending"}).sort("due_at", 1).to_list(100)]
    history = [_followup_view(f) for f in await db.pro_followups.find({"provider_user_id": me, "status": {"$in": ["done", "cancelled"]}}).sort("updated_at", -1).to_list(50)]
    names = {}
    for rid in {f["lead_id"] for f in scheduled + history}:
        r = await db.requests.find_one({"_id": ObjectId(rid)}, {"client_name": 1, "ref": 1})
        names[rid] = {"client_name": _short((r or {}).get("client_name")), "request_ref": (r or {}).get("ref")}
    for f in scheduled + history:
        f.update(names.get(f["lead_id"], {}))
    return {"to_follow": suggestions, "scheduled": scheduled, "history": history, "after_days": days}


@router.post("/pro/followups", status_code=201)
async def schedule_followup(body: FollowupIn, user: User = Depends(get_current_user)):
    """A reminder for the pro himself at due_at (nothing is sent to the client)."""
    _, _, me = await _pro(user)
    await hit(f"followups:{user.id}", 60, 3600)
    r, rec = await _lead_request(body.lead_id, me)
    if rec.get("locked"):
        raise HTTPException(402, "free_access_exhausted")
    due = _utc(body.due_at)
    if due < _now() - timedelta(minutes=5):
        raise HTTPException(422, "date_in_past")
    if await db.pro_followups.count_documents({"provider_user_id": me, "status": "pending"}) >= 100:
        raise HTTPException(409, "too_many_followups")
    now = _now()
    doc = {"provider_user_id": me, "request_id": r["_id"], "lead_id": str(r["_id"]), "quote_id": _oid(body.quote_id) if body.quote_id else None,
           "due_at": due, "note": body.note.strip(), "channel": "reminder", "status": "pending", "reminded": False, "created_at": now, "updated_at": now}
    doc["_id"] = (await db.pro_followups.insert_one(doc)).inserted_id
    return _followup_view(doc)


@router.delete("/pro/followups/{fid}", status_code=204)
async def cancel_followup(fid: str, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    res = await db.pro_followups.update_one({"_id": _oid(fid), "provider_user_id": me, "status": "pending"},
                                            {"$set": {"status": "cancelled", "updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")


@router.post("/pro/followups/send", status_code=201)
async def send_followup(body: FollowupSendIn, request: Request, user: User = Depends(get_current_user)):
    """The pro validated the (edited) text: it is posted in the conversation. Capped, and blocked if the client muted follow-ups."""
    _, _, me = await _pro(user)
    r, rec = await _lead_request(body.lead_id, me)
    if rec.get("locked"):
        raise HTTPException(402, "free_access_exhausted")
    if not rec.get("conversation_id"):
        raise HTTPException(409, "lead_not_contacted")
    conv = await db.conversations.find_one({"_id": rec["conversation_id"]})
    if (conv or {}).get("followups_muted"):
        raise HTTPException(409, "followups_muted")
    now = _now()
    recent = await db.pro_followups.find({"provider_user_id": me, "request_id": r["_id"], "status": "done", "channel": "message",
                                          "done_at": {"$gte": now - timedelta(days=7)}}).sort("done_at", -1).to_list(10)
    if recent and _utc(recent[0]["done_at"]) > now - FOLLOWUP_MIN_GAP or len(recent) >= FOLLOWUP_MAX_PER_WEEK:
        raise HTTPException(429, "followup_quota")
    await _post(conv["_id"], me, body.message.strip(), followup=True)
    await notify_key(r["client_id"], "message", "message_new", f"/messages/{conv['_id']}", channels=("inapp", "push"),
                     name=conv.get("provider_display_name"), text=body.message.strip()[:140])
    doc = {"provider_user_id": me, "request_id": r["_id"], "lead_id": str(r["_id"]), "quote_id": _oid(body.quote_id) if body.quote_id else None,
           "due_at": now, "note": "", "message": body.message.strip(), "channel": "message", "status": "done", "done_at": now,
           "created_at": now, "updated_at": now}
    doc["_id"] = (await db.pro_followups.insert_one(doc)).inserted_id
    await db.pro_followups.update_many({"provider_user_id": me, "request_id": r["_id"], "status": "pending", "due_at": {"$lte": now + timedelta(days=1)}},
                                       {"$set": {"status": "done", "done_at": now, "updated_at": now}})
    await audit("pro_ai.followup_sent", user, "request", body.lead_id, {"quote_id": body.quote_id}, client_ip(request))
    return _followup_view(doc)


async def remind_followups(now: datetime | None = None) -> int:
    """Scheduler: tell the pro that a follow-up he planned is due (only him; nothing goes to the client)."""
    now = now or _now()
    n = 0
    async for f in db.pro_followups.find({"status": "pending", "reminded": False, "due_at": {"$lte": now}}):
        await db.pro_followups.update_one({"_id": f["_id"]}, {"$set": {"reminded": True}})
        kind_p = await db.professional_profiles.find_one({"user_id": f["provider_user_id"]}, {"pro_ai": 1}) \
            or await db.teacher_profiles.find_one({"user_id": f["provider_user_id"]}, {"pro_ai": 1}) or {}
        if not _settings(kind_p)["reminders"]:
            continue
        await notify_key(f["provider_user_id"], "followup", "followup_due", f"/pro-ai/leads/{f['request_id']}", channels=("inapp", "push"),
                         note=f.get("note") or "")
        n += 1
    return n


# ---------------------------------------------------------------- agenda (on the existing jobs)
class AppointmentIn(BaseModel):
    lead_id: str
    start_at: datetime
    duration_min: int = Field(default=60, ge=15, le=600)
    mode: Literal["home", "online", "center", "workshop"] = "home"
    note: str = Field(default="", max_length=500)
    price_da: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    allow_conflict: bool = False


def _end(j: dict) -> datetime:
    return _utc(j["scheduled_at"]) + timedelta(minutes=j.get("duration_min") or 60)


def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    return a_start < b_end and b_start < a_end


@router.get("/pro/appointments")
async def list_appointments(start: datetime | None = None, days: int = 14, user: User = Depends(get_current_user)):
    _, _, me = await _pro(user)
    start = _utc(start) or _now().astimezone(TZ).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    days = max(1, min(days, 62))
    docs = await db.jobs.find({"provider_user_id": me, "status": {"$in": ["proposed", "scheduled", "completed"]},
                               "scheduled_at": {"$gte": start, "$lt": start + timedelta(days=days)}}).sort("scheduled_at", 1).to_list(500)
    clients = {u["_id"]: u.get("full_name") async for u in db.users.find({"_id": {"$in": list({d["client_id"] for d in docs})}}, {"full_name": 1})}
    active = [d for d in docs if d["status"] in jobs_api.OPEN]
    items = []
    for d in docs:
        clash = d["status"] in jobs_api.OPEN and any(o["_id"] != d["_id"] and _overlaps(_utc(d["scheduled_at"]), _end(d), _utc(o["scheduled_at"]), _end(o)) for o in active)
        items.append({"id": str(d["_id"]), "status": d["status"], "start_at": d["scheduled_at"], "end_at": _end(d), "duration_min": d.get("duration_min") or 60,
                      "mode": d.get("mode"), "note": d.get("note"), "client_name": _short(clients.get(d["client_id"])), "conflict": clash,
                      "lead_id": _j(d.get("request_id")), "category_key": d.get("category_key"), "subject_key": d.get("subject_key")})
    return {"start": start, "days": days, "items": items}


@router.post("/pro/appointments", status_code=201)
async def create_appointment(body: AppointmentIn, user: User = Depends(get_current_user)):
    """Proposes a job (the existing appointment flow: the client confirms it). Overlaps are refused unless confirmed."""
    _, _, me = await _pro(user)
    r, rec = await _lead_request(body.lead_id, me)
    start = _utc(body.start_at)
    end = start + timedelta(minutes=body.duration_min)
    if not body.allow_conflict:
        async for o in db.jobs.find({"provider_user_id": me, "status": {"$in": list(jobs_api.OPEN)},
                                     "scheduled_at": {"$gte": start - timedelta(hours=10), "$lt": end}}):
            if _overlaps(start, end, _utc(o["scheduled_at"]), _end(o)):
                raise HTTPException(409, "time_conflict")
    conv_id = await _conversation_for(r, rec, me)
    job = await jobs_api.propose(jobs_api.JobIn(conversation_id=str(conv_id), scheduled_at=start, mode=body.mode, note=body.note,
                                                price_da=body.price_da), user)
    await db.jobs.update_one({"_id": ObjectId(job["id"])}, {"$set": {"duration_min": body.duration_min, "request_id": r["_id"]}})
    return job | {"duration_min": body.duration_min}


# ---------------------------------------------------------------- dashboard and coach
@router.get("/pro/dashboard")
async def dashboard(period: Literal["week", "month", "quarter", "year"] = "month", user: User = Depends(get_current_user)):
    """Figures computed from real data only. GoFix does not collect the pro's payments: revenue is *declared*
    (the price of completed appointments), distinct from quoted and accepted amounts."""
    kind, p, me = await _pro(user)
    now = _now()
    since = now - timedelta(days=PERIODS[period])
    reqs = await db.requests.find({"recipients.provider_user_id": me, "created_at": {"$gte": since}}, {"recipients": 1, "created_at": 1}).to_list(5000)
    recs = [(r, next(x for x in r["recipients"] if x["provider_user_id"] == me)) for r in reqs]
    answered = [rec for _, rec in recs if rec.get("responded_at")]
    delays = [(_utc(rec["responded_at"]) - _utc(r["created_at"])).total_seconds() / 3600 for r, rec in recs if rec.get("responded_at")]
    quotes = await db.quotes.find({"provider_user_id": me, "sent_at": {"$gte": since}}).to_list(5000)
    status = [_quote_view(q)["status"] for q in quotes]
    accepted = [q for q, s in zip(quotes, status) if s == "accepted"]
    decided = sum(1 for s in status if s in ("accepted", "rejected", "expired"))
    done = await db.jobs.find({"provider_user_id": me, "status": "completed", "completed_at": {"$gte": since}}, {"price_da": 1}).to_list(5000)
    pending = await db.quotes.count_documents({"provider_user_id": me, "status": "sent", "expires_at": {"$gt": now}})
    stats = {
        "period": period, "since": since,
        "leads_received": len(recs), "leads_locked": sum(1 for _, rec in recs if rec.get("locked")), "leads_answered": len(answered),
        "response_hours_median": round(median(delays), 1) if delays else None,
        "quotes_sent": len(quotes), "quotes_accepted": len(accepted), "quotes_pending": pending,
        "conversion_pct": round(len(accepted) * 100 / len(quotes)) if quotes else None, "quotes_decided": decided,
        "amount_quoted_minor": sum(q["total_minor"] for q in quotes), "amount_accepted_minor": sum(q["total_minor"] for q in accepted),
        "jobs_completed": len(done), "revenue_declared_da": sum(j.get("price_da") or 0 for j in done),
        "jobs_completed_without_price": sum(1 for j in done if j.get("price_da") is None),
        "trust_score": p.get("trust_score"), "rating_avg": p.get("rating_avg"), "rating_count": p.get("rating_count") or 0,
    }
    stats["tips"] = await _coach(p, me, stats, now)
    return stats


async def _coach(p: dict, me: ObjectId, s: dict, now: datetime) -> list[dict]:
    """Explainable advice: each tip states the measured value that triggered it and the action it suggests."""
    tips = []
    days = _settings(p)["followup_after_days"]
    to_follow = await db.quotes.count_documents({"provider_user_id": me, "status": "sent", "expires_at": {"$gt": now},
                                                 "sent_at": {"$lte": now - timedelta(days=days)}})
    if to_follow:
        tips.append({"key": "follow_quotes", "level": "high", "values": {"n": to_follow, "days": days}, "action": "followups"})
    new_leads = 0
    async for r in db.requests.find({"recipients": {"$elemMatch": {"provider_user_id": me, "status": {"$in": ["sent", "seen"]}, "locked": False}},
                                     "status": "open"}, {"_id": 1}):
        new_leads += 1
    if new_leads:
        tips.append({"key": "answer_leads", "level": "high", "values": {"n": new_leads}, "action": "leads"})
    if s["response_hours_median"] is not None and s["response_hours_median"] > 4:
        tips.append({"key": "respond_faster", "level": "medium", "values": {"hours": s["response_hours_median"]}, "action": "leads"})
    if s["quotes_decided"] >= 3 and s["conversion_pct"] is not None and s["conversion_pct"] < 30:
        tips.append({"key": "low_conversion", "level": "medium", "values": {"pct": s["conversion_pct"]}, "action": "quotes"})
    if s["leads_locked"]:
        tips.append({"key": "locked_leads", "level": "medium", "values": {"n": s["leads_locked"]}, "action": "pricing"})
    pp = _passport(p)
    pct = completeness(p, pp, credentials(p))
    if pct < 80:
        tips.append({"key": "complete_passport", "level": "low", "values": {"pct": pct}, "action": "passport"})
    if s["jobs_completed"] and not s["rating_count"]:
        tips.append({"key": "ask_reviews", "level": "low", "values": {"n": s["jobs_completed"]}, "action": "assistant"})
    if s["jobs_completed_without_price"]:
        tips.append({"key": "declare_prices", "level": "low", "values": {"n": s["jobs_completed_without_price"]}, "action": "agenda"})
    return tips


# ---------------------------------------------------------------- assistant (templates)
class DraftIn(BaseModel):
    purpose: Literal["reply", "quote_intro", "followup", "reschedule", "thanks", "decline"]
    tone: Literal["formal", "friendly"] = "formal"
    lang: Optional[Literal["fr", "ar", "en"]] = None
    lead_id: Optional[str] = None
    quote_id: Optional[str] = None
    appointment_id: Optional[str] = None


async def _service_name(r: dict | None, p: dict, lang: str) -> str | None:
    key, coll = ((r or {}).get("category_key"), "taxonomy_categories") if (r or {}).get("kind", "professional") == "professional" and (r or {}).get("category_key") \
        else ((r or {}).get("subject_key"), "academy_subjects")
    if not key:
        key, coll = (p.get("category_key"), "taxonomy_categories") if p.get("category_key") else (None, None)
    if not key:
        return None
    d = await db[coll].find_one({"key": key})
    return (d or {}).get(f"name_{lang}") or (d or {}).get("name_fr")


@router.post("/pro/assistant/draft")
async def assistant_draft(body: DraftIn, request: Request, user: User = Depends(get_current_user)):
    """Returns a proposed text only. Nothing is sent, nothing is stored."""
    _, p, me = await _pro(user)
    await hit(f"assistant:{user.id}", 120, 3600)
    lang = body.lang or await user_lang(me) or "fr"
    r = q = job = None
    if body.lead_id:
        r, _ = await _lead_request(body.lead_id, me)
    if body.quote_id:
        q = await _my_quote(body.quote_id, me)
        r = r or await db.requests.find_one({"_id": q["request_id"]})
    if body.appointment_id:
        job = await db.jobs.find_one({"_id": _oid(body.appointment_id), "provider_user_id": me})
        if not job:
            raise HTTPException(404, "not_found")
        r = r or (await db.requests.find_one({"_id": job["request_id"]}) if job.get("request_id") else None)
    purpose = body.purpose
    if purpose == "quote_intro" and not q:
        raise HTTPException(422, "quote_required")
    if purpose == "followup" and q:
        purpose = "followup_quote"
    client = _first((r or {}).get("client_name"))
    if not client and job:
        client = _first((await db.users.find_one({"_id": job["client_id"]}, {"full_name": 1}) or {}).get("full_name"))
    name = await _service_name(r, p, lang)
    values = {"client": client, "service": SERVICE_QUOTE[lang].format(name) if name else "", "pro": p.get("display_name") or user.full_name,
              "ref": "", "total": "", "valid": "", "date": ""}
    if q:
        exp = q.get("expires_at") or (_now() + timedelta(days=q["valid_days"]))
        values |= {"ref": q["ref"], "total": money(q["total_minor"], lang), "valid": _day(exp)}
    if job:
        values["date"] = DATE_PREFIX[lang].format(date=_utc(job["scheduled_at"]).astimezone(TZ).strftime("%d/%m/%Y %H:%M"))
    tpl = TEMPLATES[purpose][lang][body.tone]
    if not values["client"]:
        tpl = tpl.replace(" {client}", "").replace("{client}", "")
    text = re.sub(r"[ \t]+\n", "\n", tpl.format(**values))
    return {"text": text, "purpose": purpose, "tone": body.tone, "lang": lang, "generated_by": "template"}


# ---------------------------------------------------------------- settings and data
class SettingsIn(BaseModel):
    reminders: Optional[bool] = None
    followup_after_days: Optional[int] = Field(default=None, ge=1, le=30)
    quote_valid_days: Optional[int] = Field(default=None, ge=1, le=90)
    default_notes: Optional[str] = Field(default=None, max_length=1000)


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


@router.get("/pro/settings")
async def get_settings(user: User = Depends(get_current_user)):
    _, p, _ = await _pro(user)
    return _settings(p)


@router.patch("/pro/settings")
async def patch_settings(body: SettingsIn, user: User = Depends(get_current_user)):
    kind, p, _ = await _pro(user)
    upd = {f"pro_ai.settings.{k}": (v.strip() if isinstance(v, str) else v) for k, v in body.model_dump(exclude_none=True).items()}
    if upd:
        await _coll(kind).update_one({"_id": p["_id"]}, {"$set": upd})
    return _settings(await _coll(kind).find_one({"_id": p["_id"]}))


@router.get("/pro/export")
async def export_data(request: Request, user: User = Depends(get_current_user)):
    """Everything PRO AI stores for this pro, as JSON (data portability)."""
    _, p, me = await _pro(user)
    await hit(f"pro-export:{user.id}", 10, 3600)
    await audit("pro_ai.exported", user, "user", user.id, None, client_ip(request))
    return {"exported_at": _now(), "settings": _settings(p),
            "leads": [_j({k: v for k, v in m.items() if k not in ("_id", "provider_user_id")}) async for m in db.pro_leads.find({"provider_user_id": me})],
            "quotes": [_quote_view(q) for q in await db.quotes.find({"provider_user_id": me}).to_list(5000)],
            "followups": [_followup_view(f) for f in await db.pro_followups.find({"provider_user_id": me}).to_list(5000)]}


@router.delete("/pro/data")
async def delete_data(request: Request, user: User = Depends(get_current_user)):
    """Erases the pro's private PRO AI data: statuses and notes, draft quotes, follow-ups, settings.
    Quotes already sent stay: they were received by clients, who keep them."""
    kind, p, me = await _pro(user)
    out = {"leads": (await db.pro_leads.delete_many({"provider_user_id": me})).deleted_count,
           "drafts": (await db.quotes.delete_many({"provider_user_id": me, "status": "draft"})).deleted_count,
           "followups": (await db.pro_followups.delete_many({"provider_user_id": me})).deleted_count}
    await _coll(kind).update_one({"_id": p["_id"]}, {"$unset": {"pro_ai": ""}})
    await audit("pro_ai.data_deleted", user, "user", user.id, out, client_ip(request))
    return out
