"""GOFIX PASSPORT: a professional's public, read-only identity page, shared by QR code.

- Nothing is shown as "verified" without the matching validation (identity document, skill, credential not expired).
- Documents never leave the private storage: the public page only carries badges.
- The QR code points to an opaque URL (128-bit token). The token is derived from a server key and a version number,
  so it is never stored (only its hash, for the lookup) yet the owner can display it again; revoking bumps the
  version, which kills every printed QR at once.
- Suspension, rejection, an expired document or a removed badge show on the public page immediately (nothing is
  frozen in the QR)."""
import base64
import hashlib
import hmac
import re
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

import segno
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.v1.provider import my_profile
from app.core.config import settings
from app.core.db import db
from app.core.deps import client_ip, get_current_user, require_admin
from app.core.ratelimit import hit
from app.models.user import User
from app.services.audit import audit
from app.services.config_store import is_enabled
from app.services.visibility import PUBLIC_PROFILE

router = APIRouter(tags=["passport"])

MAX_SKILLS = 15
VISIBILITY_FIELDS = ("full_name", "city", "photo", "rating", "trust")
DEFAULT_VISIBILITY = {"full_name": False, "city": True, "photo": True, "rating": True, "trust": True}
CREDENTIALS = ("id_card", "diploma", "trade_register")
_KEY = hashlib.sha256(f"{settings.jwt_secret}:passport-share".encode()).digest()


def _now():
    return datetime.now(timezone.utc)


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(404, "not_found")


async def _enabled():
    if not await is_enabled("passport"):
        raise HTTPException(404, "feature_disabled")


def share_token(profile_id: ObjectId, version: int) -> str:
    """128-bit opaque token, reproducible by the server only (HMAC of the profile id and the link version)."""
    mac = hmac.new(_KEY, f"{profile_id}:{version}".encode(), hashlib.sha256).digest()[:16]
    return base64.urlsafe_b64encode(mac).decode().rstrip("=")


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _passport(p: dict) -> dict:
    """The profile's passport sub-document with its defaults (older profiles only have {enabled, slug})."""
    pp = dict(p.get("passport") or {})
    pp.setdefault("status", "published" if pp.get("enabled") else "draft")
    pp["visibility"] = DEFAULT_VISIBILITY | (pp.get("visibility") or {})
    pp.setdefault("skills", [])
    pp.setdefault("share", {})
    return pp


def _doc_status(d: dict, now: datetime) -> str:
    """submitted | validated | rejected | expired (a validated document past its expiry date is no longer proof)."""
    status = d.get("status") or "submitted"
    exp = d.get("expires_at")
    if status == "validated" and exp:
        exp = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if exp <= now:
            return "expired"
    return status


def credentials(p: dict) -> dict:
    """Best status per credential type: validated > submitted > expired > rejected > missing."""
    now, rank = _now(), {"validated": 4, "submitted": 3, "expired": 2, "rejected": 1}
    best = {}
    for d in p.get("documents") or []:
        if not isinstance(d, dict) or d.get("type") not in CREDENTIALS:
            continue
        st = _doc_status(d, now)
        if rank.get(st, 0) > rank.get(best.get(d["type"], {}).get("status"), 0):
            best[d["type"]] = {"status": st, "expires_at": d.get("expires_at")}
    return {t: best.get(t, {"status": "missing", "expires_at": None}) for t in CREDENTIALS}


def completeness(p: dict, pp: dict, creds: dict) -> int:
    checks = [bool(p.get("photo_key") or p.get("photo_thumb_key")), len((p.get("bio") or "").strip()) >= 40, bool(p.get("zones") or p.get("formats")),
              bool(pp["skills"]), creds["id_card"]["status"] in ("submitted", "validated"),
              any(creds[t]["status"] in ("submitted", "validated") for t in ("diploma", "trade_register")), pp["status"] == "published"]
    return round(sum(checks) * 100 / len(checks))


def _short(name: str) -> str:
    parts = (name or "").split()
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else (parts[0] if parts else "")


async def _names(coll: str, keys: set) -> dict:
    if not keys:
        return {}
    return {d["key"]: {f"name_{lg}": d.get(f"name_{lg}") for lg in ("fr", "ar", "en")}
            async for d in db[coll].find({"key": {"$in": list(keys)}})}


async def public_view(p: dict, kind: str) -> dict:
    """Allow-list of what anybody holding the link may see. No phone, address, e-mail or document, ever."""
    pp, creds = _passport(p), credentials(p)
    vis = pp["visibility"]
    out = {"kind": kind, "profile_id": str(p["_id"]), "name": p["display_name"] if vis["full_name"] else _short(p["display_name"]),
           "identity_verified": creds["id_card"]["status"] == "validated",
           "profile_verified": p.get("verification_status") == "verified",
           "credentials": [{"type": t, "verified": c["status"] == "validated"} for t, c in creds.items() if t != "id_card" and c["status"] in ("validated", "submitted")],
           "skills": [{"label": s["label"], "verified": bool(s.get("verified"))} for s in pp["skills"]],
           "updated_at": pp.get("updated_at") or p.get("updated_at"), "member_since": p.get("created_at")}
    if kind == "professional":
        out["trade"] = (await _names("taxonomy_categories", {p.get("category_key")})).get(p.get("category_key"))
    else:
        keys = {s.get("subject_key") for s in p.get("subjects") or []}
        out["subjects"] = list((await _names("academy_subjects", keys)).values())
    if vis["city"]:
        codes = [z.get("wilaya_code") for z in p.get("zones") or [] if z.get("wilaya_code")]
        out["wilayas"] = [{"code": w["code"], "name_fr": w.get("name_fr"), "name_ar": w.get("name_ar")}
                          async for w in db.wilayas.find({"code": {"$in": codes}})]
    if vis["photo"]:
        out["photo_thumb_key"] = p.get("photo_thumb_key")
    if vis["rating"] and p.get("rating_count"):
        out["rating"] = {"avg": p.get("rating_avg"), "count": p.get("rating_count")}
    if vis["trust"] and p.get("trust_public", True) and p.get("trust_score") is not None and p.get("trust_status") != "insufficient":
        out["trust_score"] = p["trust_score"]  # read from the TRUST service: never computed here
    return out


def _share_out(p: dict, pp: dict) -> dict | None:
    sh = pp["share"]
    if not sh.get("token_hash"):
        return None
    url = f"{settings.frontend_url}/p/{share_token(p['_id'], sh['version'])}"
    return {"url": url, "created_at": sh.get("created_at"), "qr": segno.make(url, error="m").png_data_uri(scale=8, border=2)}


async def _me(user: User) -> tuple[str, dict, dict]:
    kind, p = await my_profile(user)
    return kind, p, _passport(p)


async def _out(kind: str, p: dict, pp: dict) -> dict:
    creds = credentials(p)
    return {"kind": kind, "profile_id": str(p["_id"]), "status": pp["status"], "visibility": pp["visibility"],
            "skills": [{"id": s["id"], "label": s["label"], "verified": bool(s.get("verified"))} for s in pp["skills"]],
            "credentials": {t: {"status": c["status"], "expires_at": c["expires_at"]} for t, c in creds.items()},
            "profile_status": "suspended" if p.get("suspended") else p.get("verification_status"),
            "completeness": completeness(p, pp, creds), "share": _share_out(p, pp), "preview": await public_view(p, kind)}


async def _save(kind: str, p: dict, pp: dict, fields: dict):
    await _coll(kind).update_one({"_id": p["_id"]}, {"$set": {f"passport.{k}": v for k, v in fields.items()} | {"passport.updated_at": _now()}})
    pp.update(fields)


@router.get("/me/passport")
async def my_passport(user: User = Depends(get_current_user)):
    await _enabled()
    return await _out(*await _me(user))


class PassportIn(BaseModel):
    visibility: Optional[dict[Literal["full_name", "city", "photo", "rating", "trust"], bool]] = None


@router.patch("/me/passport")
async def update_passport(body: PassportIn, request: Request, user: User = Depends(get_current_user)):
    await _enabled()
    kind, p, pp = await _me(user)
    if body.visibility is not None:
        await _save(kind, p, pp, {"visibility": pp["visibility"] | body.visibility})
        await audit("passport.visibility_changed", user, "passport", str(p["_id"]), body.visibility, client_ip(request))
    return await _out(kind, p, pp)


class SkillIn(BaseModel):
    label: str = Field(min_length=2, max_length=60)


@router.post("/me/passport/skills", status_code=201)
async def add_skill(body: SkillIn, request: Request, user: User = Depends(get_current_user)):
    await _enabled()
    await hit(f"passport:{user.id}", 60, 3600)
    kind, p, pp = await _me(user)
    label = re.sub(r"\s+", " ", body.label).strip()
    if len(pp["skills"]) >= MAX_SKILLS:
        raise HTTPException(422, "too_many_skills")
    if any(s["label"].lower() == label.lower() for s in pp["skills"]):
        raise HTTPException(409, "skill_exists")
    await _save(kind, p, pp, {"skills": pp["skills"] + [{"id": uuid.uuid4().hex[:12], "label": label, "verified": False, "created_at": _now()}]})
    await audit("passport.skill_added", user, "passport", str(p["_id"]), {"label": label}, client_ip(request))
    return await _out(kind, p, pp)


@router.delete("/me/passport/skills/{sid}")
async def delete_skill(sid: str, request: Request, user: User = Depends(get_current_user)):
    await _enabled()
    kind, p, pp = await _me(user)
    skill = next((s for s in pp["skills"] if s["id"] == sid), None)
    if not skill:
        raise HTTPException(404, "not_found")
    await _save(kind, p, pp, {"skills": [s for s in pp["skills"] if s["id"] != sid]})
    await audit("passport.skill_removed", user, "passport", str(p["_id"]), {"label": skill["label"]}, client_ip(request))
    return await _out(kind, p, pp)


class PublishIn(BaseModel):
    published: bool


@router.post("/me/passport/publish")
async def publish(body: PublishIn, request: Request, user: User = Depends(get_current_user)):
    await _enabled()
    kind, p, pp = await _me(user)
    if body.published and (p.get("suspended") or p.get("verification_status") not in PUBLIC_PROFILE["verification_status"]["$in"]):
        raise HTTPException(409, "profile_not_public")
    status = "published" if body.published else "draft"
    await _save(kind, p, pp, {"status": status, "enabled": body.published})
    await audit(f"passport.{status}", user, "passport", str(p["_id"]), None, client_ip(request))
    return await _out(kind, p, pp)


@router.post("/me/passport/share")
async def create_share(request: Request, user: User = Depends(get_current_user)):
    """Creates the shareable link + QR if there is none (the active one is returned as is)."""
    await _enabled()
    await hit(f"passport:{user.id}", 60, 3600)
    kind, p, pp = await _me(user)
    if not pp["share"].get("token_hash"):
        version = int(pp["share"].get("version") or 0) + 1
        await _save(kind, p, pp, {"share": {"version": version, "token_hash": _hash(share_token(p["_id"], version)), "created_at": _now()}})
        await audit("passport.link_created", user, "passport", str(p["_id"]), None, client_ip(request))
    return await _out(kind, p, pp)


@router.post("/me/passport/share/revoke")
async def revoke_share(request: Request, user: User = Depends(get_current_user)):
    """Every QR code and link printed or sent so far stops working at once."""
    await _enabled()
    kind, p, pp = await _me(user)
    if pp["share"].get("token_hash"):
        await _save(kind, p, pp, {"share": {"version": int(pp["share"].get("version") or 0), "token_hash": None, "revoked_at": _now()}})
        await audit("passport.link_revoked", user, "passport", str(p["_id"]), None, client_ip(request))
    return await _out(kind, p, pp)


ACTIONS = {"passport.visibility_changed", "passport.skill_added", "passport.skill_removed", "passport.published", "passport.draft",
           "passport.link_created", "passport.link_revoked", "passport.skill_verified", "passport.skill_unverified",
           "verification.document_uploaded", "verification.document_validated", "verification.document_rejected"}


@router.get("/me/passport/history")
async def history(user: User = Depends(get_current_user)):
    """Change log (time, action, who: the pro or GoFix). Moderators' identities stay internal."""
    await _enabled()
    kind, p, _ = await _me(user)
    docs = await db.audit_logs.find({"target_id": str(p["_id"]), "action": {"$in": list(ACTIONS)}}).sort("created_at", -1).to_list(50)
    return [{"action": d["action"], "at": d.get("created_at"), "by": "you" if str(d.get("actor_id")) == user.id else "gofix",
             "meta": {k: v for k, v in (d.get("meta") or {}).items() if k in ("label", "type")}} for d in docs]


@router.get("/passports/{token}")
async def public_passport(token: str, request: Request):
    await _enabled()
    await hit(f"passport-view:{client_ip(request)}", 120, 60)
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,24}", token):
        raise HTTPException(404, "passport_not_found")
    q = {"passport.share.token_hash": _hash(token), "passport.status": "published", **PUBLIC_PROFILE}
    for kind in ("professional", "teacher"):
        p = await _coll(kind).find_one(q)
        if p:
            return await public_view(p, kind)
    raise HTTPException(404, "passport_not_found")  # unknown, revoked, unpublished, suspended: same answer


class SkillDecision(BaseModel):
    verified: bool


@router.patch("/admin/passports/{kind}/{pid}/skills/{sid}")
async def verify_skill(kind: Literal["professional", "teacher"], pid: str, sid: str, body: SkillDecision, request: Request,
                       admin: User = Depends(require_admin("moderator"))):
    res = await _coll(kind).update_one({"_id": _oid(pid), "passport.skills.id": sid},
                                       {"$set": {"passport.skills.$.verified": body.verified, "passport.skills.$.verified_at": _now(),
                                                 "passport.updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    await audit(f"passport.skill_{'verified' if body.verified else 'unverified'}", admin, "passport", pid, {"skill": sid}, client_ip(request))
    return {"ok": True}
