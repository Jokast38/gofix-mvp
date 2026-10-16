import time
from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import db
from app.core.deps import client_ip, get_optional_user
from app.core.logging import get_logger
from app.core.ratelimit import hit
from app.models.user import User
from app.services import intent as intent_svc
from app.services.access_policy import apply_policy, resolve_access
from app.services.config_store import get_setting
from app.services.matching import MatchContext, get_matching_service, recent_exposure, save_match_result
from app.services.visibility import PUBLIC_PROFILE

router = APIRouter(prefix="/match", tags=["ai-match"])
log = get_logger("match")


def _lang(request: Request) -> str:
    return "ar" if (request.headers.get("Accept-Language") or "").lower().startswith("ar") else "fr"


class ParseIn(BaseModel):
    text: str = Field(min_length=2, max_length=500)
    kind: Optional[Literal["professional", "teacher"]] = None


class RecommendIn(BaseModel):
    text: Optional[str] = Field(default=None, max_length=500)
    kind: Optional[Literal["professional", "teacher"]] = None
    category_key: Optional[str] = None
    subject_key: Optional[str] = None
    level_key: Optional[str] = None
    wilaya_code: Optional[int] = Field(default=None, ge=1, le=58)
    commune: Optional[str] = Field(default=None, max_length=80)
    format: Optional[Literal["home", "online", "center"]] = None
    weekday: Optional[Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]] = None
    slot: Optional[Literal["morning", "afternoon", "evening"]] = None
    urgency: Literal["normal", "high"] = "normal"
    limit: int = Field(default=5, ge=3, le=5)


class FeedbackIn(BaseModel):
    match_result_id: str
    profile_id: str
    action: Literal["click", "message", "request", "refuse", "favorite"]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(404, "not_found")


@router.post("/parse")
async def parse(body: ParseIn, request: Request):
    hit(f"match-parse:{client_ip(request)}", 60, 60)
    return await intent_svc.parse(body.text, body.kind)


@router.post("/recommend")
async def recommend(body: RecommendIn, request: Request, user: User | None = Depends(get_optional_user)):
    """Top 3–5 profiles + ≥2 readable reasons each, alternatives, and the MatchResult id for feedback/explanations."""
    hit(f"match-rec:{client_ip(request)}", 60, 60)
    started = time.perf_counter()
    intent, fallback = None, False
    if body.text:
        try:
            intent = await intent_svc.parse(body.text, body.kind)
        except Exception:  # never block the user: fall back to the explicit filters only
            log.exception("intent_parse_failed")
            fallback = True
    i = intent or {}
    kind = body.kind or i.get("kind") or "professional"
    ctx = MatchContext(kind, category_key=body.category_key or i.get("category_key"), subject_key=body.subject_key or i.get("subject_key"),
                       level_key=body.level_key or i.get("level_key"), grade=i.get("grade"), wilaya=body.wilaya_code or i.get("wilaya_code"),
                       commune=body.commune or i.get("commune"), format=body.format or i.get("mode"),
                       weekday=body.weekday or (i.get("when") or {}).get("weekday"), slot=body.slot or (i.get("when") or {}).get("slot"),
                       urgency="high" if body.urgency == "high" or i.get("urgency") == "high" else "normal", lang=_lang(request))
    missing = list(i.get("missing") or [])
    q: dict = dict(PUBLIC_PROFILE)
    if kind == "professional":
        if not ctx.category_key:
            return {"intent": intent, "missing": sorted(set(missing + ["category_key"])), "items": [], "alternatives": [], "match_result_id": None}
        q["category_key"] = ctx.category_key
        coll = db.professional_profiles
    else:
        if not ctx.subject_key:
            return {"intent": intent, "missing": sorted(set(missing + ["subject_key"])), "items": [], "alternatives": [], "match_result_id": None}
        q["subjects.subject_key"] = ctx.subject_key
        coll = db.teacher_profiles
    if user:
        q["user_id"] = {"$ne": ObjectId(user.id)}
    candidates = await coll.find(q).to_list(300)
    acc = await resolve_access(user, kind)
    ctx.hide_numbers = acc.blurred
    ctx.exposure = await recent_exposure([c["_id"] for c in candidates])
    service = await get_matching_service()
    ranked = await service.rank(candidates, ctx)
    mr_id = await save_match_result(ranked, ctx, user_id=user.id if user else None, source="recommend", service=service,
                                    started=started, candidate_count=len(candidates), intent=intent, top_n=body.limit + 3)
    if ranked and user:
        now = datetime.now(timezone.utc)
        await db.match_impressions.insert_many([{"user_id": ObjectId(user.id), "profile_id": p["_id"], "kind": kind, "position": n + 1,
                                                 "match_result_id": mr_id, "created_at": now} for n, p in enumerate(ranked[:body.limit])])

    def card(p, n):
        out = apply_policy(p, acc, kind)
        out["match"] = {**{k: p["_match"][k] for k in ("score", "reasons", "explanation")}, "top": n < body.limit, "rank": n + 1,
                        "match_result_id": str(mr_id)}
        return out

    from app.api.v1.marketplace import _enrich_pros, _enrich_teachers  # shared enrichment
    enrich = _enrich_pros if kind == "professional" else _enrich_teachers
    items = await enrich([card(p, n) for n, p in enumerate(ranked[:body.limit])])
    alternatives = await enrich([card(p, n) for n, p in enumerate(ranked[body.limit:body.limit + 3], start=body.limit)])
    log.info("match_returned", extra={"ctx": {"match_result_id": str(mr_id), "formula": service.formula_version, "candidates": len(candidates),
                                              "returned": len(items), "fallback_used": fallback,
                                              "latency_ms": round((time.perf_counter() - started) * 1000, 1)}})
    resolved = {"category_key": ctx.category_key, "subject_key": ctx.subject_key, "wilaya_code": ctx.wilaya}
    return {"intent": intent, "missing": [m for m in missing if not resolved.get(m)],
            "kind": kind, "formula_version": service.formula_version, "fallback_used": fallback, "match_result_id": str(mr_id),
            "blurred": acc.blurred, "items": items, "alternatives": alternatives}


@router.post("/feedback", status_code=201)
async def feedback(body: FeedbackIn, request: Request, user: User | None = Depends(get_optional_user)):
    hit(f"match-fb:{client_ip(request)}", 120, 60)
    mr = await db.match_results.find_one({"_id": _oid(body.match_result_id)}, {"results.profile_id": 1, "results.rank": 1})
    if not mr:
        raise HTTPException(404, "not_found")
    pid = _oid(body.profile_id)
    rank = next((r["rank"] for r in mr["results"] if r["profile_id"] == pid), None)
    await db.match_feedback.insert_one({"match_result_id": mr["_id"], "profile_id": pid, "rank": rank, "action": body.action,
                                        "user_id": ObjectId(user.id) if user else None, "created_at": datetime.now(timezone.utc)})
    return {"recorded": True}


@router.get("/explanations/{mr_id}")
async def explanation(mr_id: str, profile_id: str | None = None, user: User | None = Depends(get_optional_user)):
    """Detailed, explainable score: criteria, weights, contributions, formula version (owner or admin only)."""
    mr = await db.match_results.find_one({"_id": _oid(mr_id)})
    if not mr:
        raise HTTPException(404, "not_found")
    owner = mr.get("user_id")
    if owner and not (user and (str(owner) == user.id or user.admin_role)):
        raise HTTPException(404, "not_found")
    results = mr["results"]
    if profile_id:
        results = [r for r in results if str(r["profile_id"]) == profile_id]
    return {"id": mr_id, "formula_version": mr["formula_version"], "created_at": mr["created_at"], "context": mr.get("context"),
            "candidate_count": mr.get("candidate_count"), "weights": await get_setting("match_weights"),
            "results": [{"profile_id": str(r["profile_id"]), "rank": r["rank"], "score": r["score"], "reasons": r["reasons"],
                         "components": r["components"]} for r in results]}
