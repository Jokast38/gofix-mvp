"""TRUST SCORE public/admin API: profile score + sub-indicators, appeals, audited events, recompute (no direct score edits)."""
from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.v1.provider import ContestIn, contest
from app.core.db import db
from app.core.deps import client_ip, get_current_user, get_optional_user, require_admin
from app.models.user import User
from app.services import trust
from app.services.access_policy import resolve_access
from app.services.audit import audit
from app.services.visibility import PUBLIC_PROFILE

router = APIRouter(prefix="/trust", tags=["trust"])
Kind = Literal["professional", "teacher"]


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(404, "not_found")


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


class TrustEventIn(BaseModel):
    type: Literal["fraud_confirmed", "fake_document", "coordinated_reviews"]
    reason: str = Field(min_length=3, max_length=500)
    evidence_id: Optional[str] = Field(default=None, max_length=64)


class RecomputeIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


@router.get("/profiles/{kind}/{pid}")
async def profile_trust(kind: Kind, pid: str, user: User | None = Depends(get_optional_user)):
    p = await _coll(kind).find_one({"_id": _oid(pid), **PUBLIC_PROFILE},
                                   {"trust_score": 1, "trust_status": 1, "trust_public": 1, "trust_subscores": 1, "trust_updated_at": 1,
                                    "verified_at": 1, "user_id": 1})
    if not p:
        raise HTTPException(404, "not_found")
    acc = await resolve_access(user, kind)
    full = acc.is_admin or (user and str(p["user_id"]) == user.id)
    out = {"status": p.get("trust_status"), "updated_at": p.get("trust_updated_at"), "last_verified_at": p.get("verified_at"),
           "disclaimer": "Indice calculé à partir d'éléments vérifiables ; ce n'est pas une certification légale."}
    if full or "trust_score" in acc.fields:
        out["subscores"] = p.get("trust_subscores")
        out["score"] = p.get("trust_score") if (full or p.get("trust_public")) else None
    return out


@router.post("/appeals", status_code=201)
async def appeal(body: ContestIn, request: Request, user: User = Depends(get_current_user)):
    return await contest(body, request, user)


@router.post("/events/{kind}/{pid}", status_code=201)
async def add_event(kind: Kind, pid: str, body: TrustEventIn, request: Request, admin: User = Depends(require_admin("moderator"))):
    """Audited negative event (fraud, fake document, coordinated reviews) -> flag + recompute. Never a direct score edit."""
    flag = {"type": body.type, "reason": body.reason, "evidence_id": body.evidence_id, "by": admin.email, "active": True,
            "at": datetime.now(timezone.utc)}
    res = await _coll(kind).update_one({"_id": _oid(pid)}, {"$push": {"trust_flags": flag}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    score = await trust.recompute(kind, pid, body.type, "moderation", {"reason": body.reason}, source_type="moderation", evidence_id=body.evidence_id)
    await audit(f"trust.event_{body.type}", admin, kind, pid, {"reason": body.reason, "score_after": score}, client_ip(request))
    return {"score": score}


@router.post("/recompute/{kind}/{pid}")
async def recompute(kind: Kind, pid: str, body: RecomputeIn, request: Request, admin: User = Depends(require_admin("moderator"))):
    before = await _coll(kind).find_one({"_id": _oid(pid)}, {"trust_score": 1})
    if not before:
        raise HTTPException(404, "not_found")
    score = await trust.recompute(kind, pid, "admin_recompute", "moderation", {"reason": body.reason}, source_type="moderation")
    await audit("trust.recompute", admin, kind, pid, {"reason": body.reason, "before": before.get("trust_score"), "after": score}, client_ip(request))
    return {"before": before.get("trust_score"), "after": score}
