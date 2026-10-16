import re
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.adapters.storage import get_storage
from app.api.v1.billing import PRICE_SETTING, plans_with_prices
from app.core.db import db
from app.core.deps import client_ip, require_admin
from app.models.user import User
from app.services import trust
from app.services.access_policy import FIELD_MAP
from app.services.audit import audit
from app.services.notify import notify
from app.services.visibility import set_profiles_suspended

router = APIRouter(prefix="/admin", tags=["admin-ops"])
KEY_RX = re.compile(r"^[a-z0-9_]{2,40}$")
MIME = {"pdf": "application/pdf", "jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


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
        return {k: _j(x) for k, x in v.items() if k != "_id"} | ({"id": str(v["_id"])} if "_id" in v else {})
    return v


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


# ---------- Dashboard ----------
async def _funnel() -> dict:
    rows = await db.onboarding_events.aggregate([{"$group": {"_id": {"kind": "$kind", "step": "$step"}, "n": {"$sum": 1}}}]).to_list(50)
    out = {}
    for kind in ("professional", "teacher"):
        counts = {r["_id"]["step"]: r["n"] for r in rows if r["_id"]["kind"] == kind}
        steps = []
        for s in range(1, 9):
            reached = counts.get(s, 0)
            nxt = counts.get(s + 1, 0) if s < 8 else None
            steps.append({"step": s, "reached": reached, "drop_rate": round(1 - nxt / reached, 3) if reached and nxt is not None else None})
        out[kind] = steps
    return out


async def matching_stats(days: int = 30) -> dict:
    since = _now() - timedelta(days=days)
    imps = await db.match_impressions.find({"created_at": {"$gte": since}}, {"user_id": 1, "profile_id": 1, "position": 1, "created_at": 1}).to_list(20000)
    contacts = {}
    async for c in db.contact_events.find({"created_at": {"$gte": since}}, {"user_id": 1, "profile_id": 1, "created_at": 1}):
        contacts.setdefault((c["user_id"], c["profile_id"]), []).append(c["created_at"])
    seen, converted, by_pos = set(), set(), {}
    for i in imps:
        k = (i["user_id"], i["profile_id"])
        pos = by_pos.setdefault(i["position"], {"position": i["position"], "impressions": 0, "contacts": 0})
        if k in seen:
            continue
        seen.add(k)
        pos["impressions"] += 1
        if any(i["created_at"] <= t <= i["created_at"] + timedelta(days=7) for t in contacts.get(k, [])):
            converted.add(k)
            pos["contacts"] += 1
    return {"days": days, "impressions": len(seen), "contacts_after_display": len(converted),
            "contact_rate": round(len(converted) / len(seen), 3) if seen else 0, "by_position": sorted(by_pos.values(), key=lambda x: x["position"])}


@router.get("/dashboard")
async def dashboard(_: User = Depends(require_admin())):
    now = _now()
    since30 = now - timedelta(days=30)
    req_status = await db.requests.aggregate([{"$unwind": "$recipients"}, {"$group": {"_id": "$recipients.status", "n": {"$sum": 1}}}]).to_list(10)
    subs = await db.subscriptions.aggregate([{"$match": {"status": "active", "ends_at": {"$gt": now}}},
                                             {"$group": {"_id": {"audience": "$audience", "tier": "$tier"}, "n": {"$sum": 1}}}]).to_list(20)
    rev = await db.payment_orders.aggregate([{"$match": {"status": "paid"}}, {"$group": {
        "_id": {"$dateToString": {"format": "%Y-%m", "date": "$paid_at", "timezone": "Africa/Algiers"}}, "sum": {"$sum": "$amount_da"}, "n": {"$sum": 1}}},
        {"$sort": {"_id": 1}}]).to_list(24)
    rev30 = await db.payment_orders.aggregate([{"$match": {"status": "paid", "paid_at": {"$gte": since30}}},
                                               {"$group": {"_id": None, "sum": {"$sum": "$amount_da"}}}]).to_list(1)
    return {
        "funnel": await _funnel(),
        "requests": {"total": await db.requests.count_documents({}), "last_30d": await db.requests.count_documents({"created_at": {"$gte": since30}}),
                     "by_status": {r["_id"]: r["n"] for r in req_status}},
        "subscriptions": [{"audience": s["_id"]["audience"], "tier": s["_id"]["tier"], "count": s["n"]} for s in subs],
        "revenue": {"total_da": sum(r["sum"] for r in rev), "last_30d_da": rev30[0]["sum"] if rev30 else 0,
                    "by_month": [{"month": r["_id"], "amount_da": r["sum"], "orders": r["n"]} for r in rev]},
        "queues": {"profiles_pending": await db.professional_profiles.count_documents({"verification_status": "pending"})
                   + await db.teacher_profiles.count_documents({"verification_status": "pending"}),
                   "reports_open": await db.reports.count_documents({"status": "open"}),
                   "tickets_open": await db.support_tickets.count_documents({"status": "open"}),
                   "contests_open": await db.trust_contests.count_documents({"status": "open"}),
                   "category_requests": await db.category_requests.count_documents({"status": "pending"}),
                   "chatbot_unanswered_30d": await db.chatbot_logs.count_documents({"answered": False, "created_at": {"$gte": since30}})},
        "matching": await matching_stats(),
    }


# ---------- FAQ (chatbot knowledge base) ----------
class FaqIn(BaseModel):
    category: str = Field(min_length=2, max_length=40)
    question_fr: str = Field(min_length=5, max_length=200)
    question_ar: str = Field(default="", max_length=200)
    answer_fr: str = Field(min_length=5, max_length=2000)
    answer_ar: str = Field(default="", max_length=2000)
    variants: list[str] = Field(default_factory=list, max_length=30)
    lang: Literal["fr", "ar"] = "fr"
    order: int = 0
    active: bool = True


class FaqPatch(BaseModel):
    category: Optional[str] = Field(default=None, min_length=2, max_length=40)
    question_fr: Optional[str] = Field(default=None, min_length=5, max_length=200)
    question_ar: Optional[str] = Field(default=None, max_length=200)
    answer_fr: Optional[str] = Field(default=None, min_length=5, max_length=2000)
    answer_ar: Optional[str] = Field(default=None, max_length=2000)
    variants: Optional[list[str]] = Field(default=None, max_length=30)
    lang: Optional[Literal["fr", "ar"]] = None
    order: Optional[int] = None
    active: Optional[bool] = None


@router.get("/faq")
async def faq_list(_: User = Depends(require_admin("support"))):
    return [_j(d) for d in await db.faq_entries.find({}).sort([("category", 1), ("order", 1)]).to_list(1000)]


@router.post("/faq", status_code=201)
async def faq_create(body: FaqIn, request: Request, admin: User = Depends(require_admin("support"))):
    doc = body.model_dump() | {"variants": [v.strip() for v in body.variants if v.strip()], "created_at": _now()}
    res = await db.faq_entries.insert_one(doc)
    await audit("faq.create", admin, "faq", str(res.inserted_id), {"question": body.question_fr}, client_ip(request))
    return _j(await db.faq_entries.find_one({"_id": res.inserted_id}))


@router.patch("/faq/{fid}")
async def faq_patch(fid: str, body: FaqPatch, request: Request, admin: User = Depends(require_admin("support"))):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(422, "empty_patch")
    res = await db.faq_entries.update_one({"_id": _oid(fid)}, {"$set": data | {"updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    await audit("faq.update", admin, "faq", fid, {"fields": list(data)}, client_ip(request))
    return _j(await db.faq_entries.find_one({"_id": _oid(fid)}))


@router.delete("/faq/{fid}", status_code=204)
async def faq_delete(fid: str, request: Request, admin: User = Depends(require_admin("support"))):
    if not (await db.faq_entries.delete_one({"_id": _oid(fid)})).deleted_count:
        raise HTTPException(404, "not_found")
    await audit("faq.delete", admin, "faq", fid, {}, client_ip(request))


@router.get("/chatbot/unanswered")
async def unanswered(days: int = 30, _: User = Depends(require_admin("support"))):
    since = _now() - timedelta(days=max(1, min(days, 365)))
    rows = await db.chatbot_logs.aggregate([
        {"$match": {"answered": False, "created_at": {"$gte": since}}},
        {"$group": {"_id": "$normalized", "example": {"$last": "$message"}, "count": {"$sum": 1}, "last_at": {"$max": "$created_at"},
                    "best_confidence": {"$max": "$confidence"}}},
        {"$sort": {"count": -1, "last_at": -1}}, {"$limit": 100}]).to_list(100)
    total = await db.chatbot_logs.count_documents({"created_at": {"$gte": since}})
    missed = await db.chatbot_logs.count_documents({"created_at": {"$gte": since}, "answered": False})
    return {"total_questions": total, "unanswered": missed, "answer_rate": round(1 - missed / total, 3) if total else None,
            "items": [{"question": r["example"], "count": r["count"], "last_at": r["last_at"], "best_confidence": r["best_confidence"]} for r in rows]}


# ---------- Plans & unlock matrix ----------
class PlanPatch(BaseModel):
    name_fr: Optional[str] = Field(default=None, min_length=2, max_length=60)
    name_ar: Optional[str] = Field(default=None, max_length=60)
    perks_fr: Optional[list[str]] = Field(default=None, max_length=12)
    duration_days: Optional[int] = Field(default=None, ge=1, le=730)
    price_da: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    active: Optional[bool] = None


class MatrixIn(BaseModel):
    blurred: bool
    visible_fields: list[str]
    monthly_views_limit: Optional[int] = Field(default=None, ge=0, le=100000)
    direct_contact: bool = False
    can_message: bool = False
    can_request: bool = True


@router.get("/plans")
async def plans(_: User = Depends(require_admin())):
    return {"plans": await plans_with_prices(include_inactive=True),
            "matrix": await db.unlock_matrix.find({}, {"_id": 0}).to_list(20), "fields": list(FIELD_MAP)}


@router.patch("/plans/{key}")
async def patch_plan(key: str, body: PlanPatch, request: Request, admin: User = Depends(require_admin("super_admin"))):
    plan = await db.plans.find_one({"key": key})
    if not plan:
        raise HTTPException(404, "not_found")
    data = body.model_dump(exclude_none=True)
    price = data.pop("price_da", None)
    if price is not None:
        if plan["tier"] == "free" and price:
            raise HTTPException(422, "invalid_value")
        await db.settings.update_one({"key": PRICE_SETTING.format(key=key)},
                                     {"$set": {"value": price}, "$setOnInsert": {"public": True, "description": f"Prix (DA) offre {key}"}}, upsert=True)
    if data:
        await db.plans.update_one({"key": key}, {"$set": data})
    await audit("billing.plan_change", admin, "plan", key, body.model_dump(exclude_none=True), client_ip(request))
    return next(p for p in await plans_with_prices(include_inactive=True) if p["key"] == key)


@router.put("/unlock-matrix/{plan_key}")
async def put_matrix(plan_key: Literal["free", "pro", "premium"], body: MatrixIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    bad = [f for f in body.visible_fields if f not in FIELD_MAP]
    if bad:
        raise HTTPException(422, "invalid_value")
    old = await db.unlock_matrix.find_one({"audience": "client", "plan_key": plan_key}, {"_id": 0})
    row = {"audience": "client", "plan_key": plan_key, **body.model_dump()}
    await db.unlock_matrix.update_one({"audience": "client", "plan_key": plan_key}, {"$set": row}, upsert=True)
    await audit("billing.matrix_change", admin, "unlock_matrix", plan_key, {"old": old, "new": row}, client_ip(request))
    return row


# ---------- Reports (moderation) ----------
class ReportDecision(BaseModel):
    status: Literal["actioned", "dismissed"]
    note: str = Field(default="", max_length=500)
    suspend_user: bool = False


async def _report_target(r: dict) -> dict:
    tt, tid = r["target_type"], r["target_id"]
    if tt in ("professional", "teacher") and ObjectId.is_valid(tid):
        p = await _coll(tt).find_one({"_id": ObjectId(tid)}, {"display_name": 1, "user_id": 1})
        return {"label": (p or {}).get("display_name"), "user_id": str(p["user_id"]) if p else None}
    if tt == "message" and ObjectId.is_valid(tid):
        m = await db.messages.find_one({"_id": ObjectId(tid)})
        return {"label": (m or {}).get("body", "")[:200], "user_id": str(m["sender_id"]) if m else None}
    if tt == "user" and ObjectId.is_valid(tid):
        u = await db.users.find_one({"_id": ObjectId(tid)}, {"full_name": 1})
        return {"label": (u or {}).get("full_name"), "user_id": tid if u else None}
    return {"label": None, "user_id": None}


@router.get("/reports")
async def reports(status: str = "open", _: User = Depends(require_admin("moderator"))):
    docs = await db.reports.find({"status": status} if status else {}).sort("created_at", -1).to_list(200)
    out = []
    for r in docs:
        reporter = await db.users.find_one({"_id": r["reporter_id"]}, {"full_name": 1, "email": 1})
        out.append(_j({k: v for k, v in r.items() if k != "ip"}) | {"target": await _report_target(r),
                                                                    "reporter": {"name": (reporter or {}).get("full_name"), "email": (reporter or {}).get("email")}})
    return out


@router.patch("/reports/{rid}")
async def decide_report(rid: str, body: ReportDecision, request: Request, admin: User = Depends(require_admin("moderator"))):
    r = await db.reports.find_one({"_id": _oid(rid)})
    if not r:
        raise HTTPException(404, "not_found")
    await db.reports.update_one({"_id": r["_id"]}, {"$set": {"status": body.status, "note": body.note, "decided_by": ObjectId(admin.id), "decided_at": _now()}})
    target = await _report_target(r)
    if body.status == "actioned" and r["target_type"] in ("professional", "teacher"):
        await trust.recompute(r["target_type"], r["target_id"], "report_confirmed", "moderation", {"report_id": rid})
    target_doc = await db.users.find_one({"_id": ObjectId(target["user_id"])}, {"admin_role": 1}) if target["user_id"] else None
    if body.suspend_user and target_doc and target_doc.get("admin_role") and admin.admin_role != "super_admin":
        raise HTTPException(403, "insufficient_admin_role")
    if body.status == "actioned" and body.suspend_user and target["user_id"] and target["user_id"] != admin.id:
        await db.users.update_one({"_id": ObjectId(target["user_id"])}, {"$set": {"status": "suspended"}})
        await db.refresh_tokens.update_many({"user_id": ObjectId(target["user_id"])}, {"$set": {"revoked": True}})
        await set_profiles_suspended(target["user_id"], True)
        await audit("moderation.user_suspended", admin, "user", target["user_id"], {"reason": f"report {rid}: {body.note}"}, client_ip(request))
    await audit(f"moderation.report_{body.status}", admin, "report", rid, {"target": f"{r['target_type']}:{r['target_id']}", "note": body.note}, client_ip(request))
    return {"ok": True}


# ---------- Support tickets ----------
class TicketPatch(BaseModel):
    status: Literal["open", "closed"]
    note: str = Field(default="", max_length=1000)


@router.get("/tickets")
async def tickets(status: str = "open", _: User = Depends(require_admin("support", "moderator"))):
    return [_j(t) for t in await db.support_tickets.find({"status": status} if status else {}).sort("created_at", -1).to_list(200)]


@router.patch("/tickets/{tid}")
async def patch_ticket(tid: str, body: TicketPatch, request: Request, admin: User = Depends(require_admin("support", "moderator"))):
    res = await db.support_tickets.update_one({"_id": _oid(tid)}, {"$set": {"status": body.status, "note": body.note, "handled_by": admin.email, "updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    await audit("support.ticket_update", admin, "ticket", tid, {"status": body.status}, client_ip(request))
    return {"ok": True}


# ---------- Trust contests ----------
class ContestDecision(BaseModel):
    status: Literal["accepted", "rejected"]
    note: str = Field(min_length=3, max_length=1000)


@router.get("/trust/contests")
async def contests(status: str = "open", _: User = Depends(require_admin("moderator"))):
    return [_j(c) for c in await db.trust_contests.find({"status": status} if status else {}).sort("created_at", -1).to_list(200)]


@router.patch("/trust/contests/{cid}")
async def decide_contest(cid: str, body: ContestDecision, request: Request, admin: User = Depends(require_admin("moderator"))):
    c = await db.trust_contests.find_one({"_id": _oid(cid)})
    if not c:
        raise HTTPException(404, "not_found")
    await db.trust_contests.update_one({"_id": c["_id"]}, {"$set": {"status": body.status, "note": body.note, "decided_at": _now(), "decided_by": admin.email}})
    if body.status == "accepted":
        await trust.recompute(c["kind"], c["profile_id"], "contest_review", "moderation", {"contest_id": cid})
    await audit(f"trust.contest_{body.status}", admin, c["kind"], str(c["profile_id"]), {"note": body.note}, client_ip(request))
    await notify(c["user_id"], "trust_contest", "Réponse à votre contestation",
                 f"Décision : {'acceptée' if body.status == 'accepted' else 'refusée'}. {body.note}", "/dashboard")
    return {"ok": True}


# ---------- Category requests (« Autre ») ----------
class CategoryDecision(BaseModel):
    status: Literal["approved", "rejected"]
    key: Optional[str] = None
    name_fr: Optional[str] = Field(default=None, min_length=2, max_length=80)
    name_ar: str = Field(default="", max_length=80)
    family_key: Optional[str] = None
    note: str = Field(default="", max_length=300)


@router.get("/category-requests")
async def category_requests(status: str = "pending", _: User = Depends(require_admin("moderator", "support"))):
    docs = await db.category_requests.find({"status": status} if status else {}).sort("created_at", -1).to_list(200)
    users = {u["_id"]: u async for u in db.users.find({"_id": {"$in": [d["user_id"] for d in docs]}}, {"full_name": 1, "email": 1})}
    return [_j(d) | {"user": {k: users.get(d["user_id"], {}).get(k) for k in ("full_name", "email")}} for d in docs]


@router.patch("/category-requests/{cid}")
async def decide_category(cid: str, body: CategoryDecision, request: Request, admin: User = Depends(require_admin("moderator"))):
    cr = await db.category_requests.find_one({"_id": _oid(cid), "status": "pending"})
    if not cr:
        raise HTTPException(404, "not_found")
    key = None
    if body.status == "approved":
        key = body.key or ""
        if not KEY_RX.match(key):
            raise HTTPException(422, "key_invalid")
        family = body.family_key or cr["family_key"]
        if not await db.taxonomy_categories.find_one({"key": key}):
            await db.taxonomy_categories.insert_one({"key": key, "family_key": family, "name_fr": body.name_fr or cr["name"], "name_ar": body.name_ar,
                                                     "icon": "wrench", "order": 999, "active": True, "required_documents": ["id_card"], "created_at": _now()})
        await db.professional_profiles.update_many({"category_request_id": cr["_id"]}, {"$set": {"category_key": key, "family_key": family}})
    await db.category_requests.update_one({"_id": cr["_id"]}, {"$set": {"status": body.status, "category_key": key, "note": body.note, "decided_at": _now()}})
    await audit(f"taxonomy.category_request_{body.status}", admin, "category_request", cid, {"key": key}, client_ip(request))
    await notify(cr["user_id"], "category_request", "Votre demande de catégorie",
                 f"« {cr['name']} » a été {'ajoutée au catalogue' if body.status == 'approved' else 'refusée'}. {body.note}", "/dashboard")
    return {"ok": True, "category_key": key}


# ---------- Verification documents (private) ----------
class DocDecision(BaseModel):
    status: Literal["validated", "rejected"]
    reason: str = Field(default="", max_length=300)
    fake: bool = False  # rejected because forged -> negative trust event (GF2-004)


async def _doc(kind: str, pid: str, idx: int) -> tuple[dict, dict]:
    p = await _coll(kind).find_one({"_id": _oid(pid)})
    docs = (p or {}).get("documents") or []
    if not p or not (0 <= idx < len(docs)) or not isinstance(docs[idx], dict):
        raise HTTPException(404, "not_found")
    return p, docs[idx]


@router.get("/profiles/{kind}/{pid}/documents/{idx}")
async def view_document(kind: Literal["professional", "teacher"], pid: str, idx: int, request: Request, admin: User = Depends(require_admin("moderator"))):
    _, d = await _doc(kind, pid, idx)
    if not d.get("key"):
        raise HTTPException(404, "not_found")
    try:
        data = get_storage().read(d["key"], private=True)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, "not_found")
    await audit("verification.document_viewed", admin, kind, pid, {"type": d.get("type"), "index": idx}, client_ip(request))
    return Response(data, media_type=MIME.get(d["key"].rsplit(".", 1)[-1], "application/octet-stream"),
                    headers={"Cache-Control": "no-store", "Content-Disposition": "inline", "Content-Security-Policy": "sandbox"})


@router.patch("/profiles/{kind}/{pid}/documents/{idx}")
async def decide_document(kind: Literal["professional", "teacher"], pid: str, idx: int, body: DocDecision, request: Request,
                          admin: User = Depends(require_admin("moderator"))):
    p, d = await _doc(kind, pid, idx)
    await _coll(kind).update_one({"_id": p["_id"]}, {"$set": {f"documents.{idx}.status": body.status, f"documents.{idx}.reason": body.reason,
                                                              f"documents.{idx}.decided_at": _now()}})
    if body.status == "rejected" and body.fake:
        await _coll(kind).update_one({"_id": p["_id"]}, {"$push": {"trust_flags": {"type": "fake_document", "reason": body.reason, "evidence_id": d.get("type"),
                                                                              "by": admin.email, "active": True, "at": _now()}}})
    await trust.recompute(kind, p["_id"], "fake_document" if body.fake else f"document_{body.status}", "verification", {"type": d.get("type")},
                          source_type="verified" if body.status == "validated" else "moderation", evidence_id=d.get("type"))
    await audit(f"verification.document_{body.status}", admin, kind, pid, {"type": d.get("type"), "reason": body.reason}, client_ip(request))
    return {"ok": True}


@router.get("/matching/stats")
async def match_stats(days: int = 30, _: User = Depends(require_admin())):
    return await matching_stats(max(1, min(days, 365)))


@router.get("/match-results")
async def match_results(limit: int = 20, _: User = Depends(require_admin())):
    """Explainability: latest AI MATCH decisions with formula version, context, scores and reasons (ids only, no personal data)."""
    docs = await db.match_results.find({}, {"intent.text": 0}).sort("created_at", -1).to_list(max(1, min(limit, 100)))
    names = {}
    for d in docs:
        for r in d["results"][:5]:
            names.setdefault(r["profile_id"], None)
    for coll in (db.professional_profiles, db.teacher_profiles):
        async for p in coll.find({"_id": {"$in": list(names)}}, {"display_name": 1}):
            names[p["_id"]] = p["display_name"]
    return [{"id": str(d["_id"]), "source": d["source"], "kind": d["kind"], "formula_version": d["formula_version"], "context": d.get("context"),
             "candidate_count": d.get("candidate_count"), "latency_ms": d.get("latency_ms"), "fallback_used": d.get("fallback_used"),
             "created_at": d["created_at"],
             "results": [{"profile_id": str(r["profile_id"]), "name": names.get(r["profile_id"]), "rank": r["rank"], "score": r["score"],
                          "reasons": r["reasons"], "components": r["components"]} for r in d["results"][:5]]} for d in docs]
