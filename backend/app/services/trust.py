"""TRUST SCORE v2 — 0–100 built from verifiable events only, with 4 sub-indicators and a status.
It deliberately never reads subscriptions, orders or plan_key: a score cannot be bought (GF2-003). Not a legal certification.

Sub-indicators (each 0–100, None when there is no data yet):
  identity     — verified identity + validated documents (source: verified; declared documents earn nothing)
  reactivity   — share of received requests answered (behavioral)
  satisfaction — verified reviews, i.e. left after a completed job/lesson, time-decayed (behavioral)
  reliability  — completed vs provider cancellations / lost disputes, minus confirmed reports & fraud flags (behavioral/moderation)
Global = weighted mean of available sub-indicators; below the activity threshold it is capped and kept private (status 'insufficient').
"""
from datetime import datetime, timezone

from bson import ObjectId

from app.core.db import db
from app.services.config_store import get_setting

FORMULA = "trust-v2"
DEFAULT_RULES = {"weights": {"identity": 25, "reactivity": 20, "satisfaction": 30, "reliability": 25},
                 "min_activity": 3, "cap_insufficient": 60, "established_from": 50, "excellent_from": 80,
                 "half_life_days": 365, "report_penalty": 15, "fraud_penalty": 40, "review_confidence_n": 5}
STRONG_DOCS = {"trade_register", "diploma"}


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


def _decay(when: datetime | None, now: datetime, half_life: float) -> float:
    if not when:
        return 1.0
    return 0.5 ** (max(0, (now - when).days) / half_life)


async def _rules() -> dict:
    r = await get_setting("trust_rules_v2")
    return {**DEFAULT_RULES, **(r or {})}


async def _reactivity(profile: dict) -> tuple[float | None, dict]:
    pid = profile["_id"]
    agg = await db.requests.aggregate([
        {"$match": {"recipients.profile_id": pid}}, {"$unwind": "$recipients"},
        {"$match": {"recipients.profile_id": pid, "recipients.locked": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": 1},
                    "answered": {"$sum": {"$cond": [{"$in": ["$recipients.status", ["accepted", "refused"]]}, 1, 0]}}}}]).to_list(1)
    if not agg or not agg[0]["total"]:
        return None, {}
    return round(agg[0]["answered"] / agg[0]["total"] * 100), {"answered": agg[0]["answered"], "received": agg[0]["total"]}


async def compute(kind: str, profile: dict) -> dict:
    r = await _rules()
    now = datetime.now(timezone.utc)
    signals = []
    pid = profile["_id"]

    # identity (verified sources only)
    identity = 0
    if profile.get("verification_status") == "verified":
        identity += 60
        signals.append({"type": "identity_verified", "source_type": "verified", "evidence_id": str(pid), "sub": "identity", "points": 60})
    docs = [d for d in profile.get("documents") or [] if isinstance(d, dict)]
    validated = {d.get("type") for d in docs if d.get("status") == "validated"}
    if "id_card" in validated:
        identity += 20
        signals.append({"type": "document_validated", "source_type": "verified", "evidence_id": "id_card", "sub": "identity", "points": 20})
    if validated & STRONG_DOCS:
        identity += 20
        signals.append({"type": "business_registry_verified" if "trade_register" in validated else "qualification_verified",
                        "source_type": "verified", "evidence_id": next(iter(validated & STRONG_DOCS)), "sub": "identity", "points": 20})
    declared = [d.get("type") if isinstance(d, dict) else d for d in profile.get("documents") or []
                if not (isinstance(d, dict) and d.get("status") == "validated")]
    if declared:
        signals.append({"type": "documents_declared", "source_type": "declarative", "sub": "identity", "points": 0, "count": len(declared)})
    identity = min(100, identity)

    # reactivity
    reactivity, rx = await _reactivity(profile)
    if reactivity is not None:
        signals.append({"type": "response_rate", "source_type": "behavioral", "sub": "reactivity", "value": reactivity, **rx})

    # jobs / lessons (time-decayed)
    jobs = await db.jobs.find({"profile_id": pid, "status": {"$in": ["completed", "cancelled", "disputed", "failed"]}},
                              {"status": 1, "cancelled_by": 1, "late_cancel": 1, "dispute": 1, "completed_at": 1, "updated_at": 1}).to_list(5000)
    completed = cancels = disputes_lost = 0.0
    n_completed = 0
    for j in jobs:
        w = _decay(j.get("completed_at") or j.get("updated_at"), now, r["half_life_days"])
        if j["status"] == "completed" and (j.get("dispute") or {}).get("status") != "resolved_client":
            completed += w
            n_completed += 1
        if j["status"] == "cancelled" and j.get("cancelled_by") == "provider":
            cancels += w * (1.5 if j.get("late_cancel") else 1)
        if (j.get("dispute") or {}).get("status") == "resolved_client":
            disputes_lost += w
    reliability = None
    if completed + cancels + disputes_lost > 0:
        reliability = 100 * completed / (completed + cancels + 2 * disputes_lost)
        signals.append({"type": "completion", "source_type": "behavioral", "sub": "reliability", "completed": n_completed,
                        "provider_cancellations": round(cancels, 2), "disputes_lost": round(disputes_lost, 2)})
    reports = await db.reports.count_documents({"target_type": kind, "target_id": str(pid), "status": "actioned"})
    flags = [f for f in profile.get("trust_flags") or [] if f.get("active", True)]
    penalty = reports * r["report_penalty"] + len(flags) * r["fraud_penalty"]
    if penalty:
        reliability = max(0.0, (100 if reliability is None else reliability) - penalty)
        if reports:
            signals.append({"type": "reports_confirmed", "source_type": "moderation", "sub": "reliability", "count": reports, "points": -reports * r["report_penalty"]})
        for f in flags:
            signals.append({"type": f["type"], "source_type": "moderation", "sub": "reliability", "evidence_id": f.get("evidence_id"), "points": -r["fraud_penalty"]})

    # satisfaction: verified reviews only (attached to a completed job), time-decayed
    reviews = await db.reviews.find({"profile_id": pid, "verified": True}, {"rating": 1, "created_at": 1}).to_list(5000)
    satisfaction = None
    if reviews:
        ws = [(_decay(x["created_at"], now, r["half_life_days"]), x["rating"]) for x in reviews]
        avg = sum(w * v for w, v in ws) / sum(w for w, _ in ws)
        conf = min(1.0, len(reviews) / r["review_confidence_n"])
        satisfaction = 50 + ((avg - 1) / 4 * 100 - 50) * conf  # few reviews stay close to neutral
        signals.append({"type": "verified_reviews", "source_type": "behavioral", "sub": "satisfaction", "count": len(reviews), "avg": round(avg, 2)})

    subs = {"identity": round(identity), "reactivity": None if reactivity is None else round(reactivity),
            "satisfaction": None if satisfaction is None else round(satisfaction), "reliability": None if reliability is None else round(reliability)}
    weights = r["weights"]
    avail = {k: v for k, v in subs.items() if v is not None and weights.get(k)}
    raw = sum(weights[k] * v for k, v in avail.items()) / (sum(weights[k] for k in avail) or 1)
    activity = n_completed
    public = activity >= r["min_activity"]
    score = round(raw if public else min(raw, r["cap_insufficient"]))
    if flags:
        score = min(score, 30)
    status = "insufficient" if not public or score < r["established_from"] else "excellent" if score >= r["excellent_from"] else "established"
    return {"score": max(0, min(100, score)), "status": status, "public": public, "subscores": subs, "activity": activity,
            "signals": signals, "formula_version": FORMULA}


async def recompute(kind: str, profile_id, reason: str = "recompute", source: str = "system", proof: dict | None = None,
                    source_type: str = "system", evidence_id: str | None = None) -> int | None:
    coll = _coll(kind)
    profile = await coll.find_one({"_id": ObjectId(str(profile_id))})
    if not profile:
        return None
    res = await compute(kind, profile)
    old = profile.get("trust_score")
    now = datetime.now(timezone.utc)
    await coll.update_one({"_id": profile["_id"]}, {"$set": {
        "trust_score": res["score"], "trust_status": res["status"], "trust_public": res["public"], "trust_subscores": res["subscores"],
        "trust_breakdown": res["signals"], "trust_formula": FORMULA, "trust_updated_at": now,
        # behavioral signal reused by AI MATCH (share of answered requests); None until there is data
        "response_rate": None if res["subscores"]["reactivity"] is None else res["subscores"]["reactivity"] / 100}})
    if old != res["score"] or reason not in ("recompute", "seed"):
        await db.trust_events.insert_one({"profile_id": profile["_id"], "kind": kind, "user_id": profile["user_id"], "type": reason,
                                          "source": source, "source_type": source_type, "evidence_id": evidence_id,
                                          "weight": res["score"] - (old or 0), "score_before": old, "score_after": res["score"],
                                          "status_after": res["status"], "subscores": res["subscores"], "formula_version": FORMULA,
                                          "proof": proof or {}, "created_at": now})
    return res["score"]


async def flag_review_anomaly(kind: str, profile_id: ObjectId):
    """GF2-007: 3+ reviews within 24h from accounts younger than 7 days -> moderation flag (no automatic sanction)."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    recent = await db.reviews.find({"profile_id": profile_id, "created_at": {"$gte": now - timedelta(hours=24)}}, {"client_id": 1}).to_list(100)
    if len(recent) < 3:
        return False
    young = await db.users.count_documents({"_id": {"$in": [x["client_id"] for x in recent]}, "created_at": {"$gte": now - timedelta(days=7)}})
    if young < 3 or await db.reports.find_one({"target_id": str(profile_id), "reason": "review_anomaly", "status": "open"}):
        return False
    await db.reports.insert_one({"reporter_id": None, "target_type": kind, "target_id": str(profile_id), "reason": "review_anomaly",
                                 "details": f"{young} avis en 24 h depuis des comptes de moins de 7 jours", "status": "open", "created_at": now})
    return True
