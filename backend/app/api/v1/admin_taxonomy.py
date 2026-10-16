import re
from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import db
from app.core.deps import client_ip, require_admin
from app.models.user import User
from app.services import trust
from app.services.audit import audit
from app.services.notify import notify

router = APIRouter(prefix="/admin", tags=["admin-taxonomy"])

TaxKind = Literal["families", "categories", "roles", "specialties", "subjects", "levels"]
COLL = {"families": "taxonomy_families", "categories": "taxonomy_categories", "roles": "taxonomy_roles",
        "specialties": "taxonomy_specialties", "subjects": "academy_subjects", "levels": "academy_levels"}
KEY_RX = re.compile(r"^[a-z0-9_]{2,40}$")


class TaxIn(BaseModel):
    key: str = Field(min_length=2, max_length=40)
    name_fr: str = Field(min_length=2, max_length=80)
    name_ar: str = Field(default="", max_length=80)
    icon: Optional[str] = Field(default=None, max_length=40)
    family_key: Optional[str] = None
    category_key: Optional[str] = None
    family_keys: Optional[list[str]] = None
    order: int = 0
    active: bool = True


class TaxPatch(BaseModel):
    name_fr: Optional[str] = Field(default=None, min_length=2, max_length=80)
    name_ar: Optional[str] = Field(default=None, max_length=80)
    icon: Optional[str] = Field(default=None, max_length=40)
    family_key: Optional[str] = None
    category_key: Optional[str] = None
    family_keys: Optional[list[str]] = None
    order: Optional[int] = None
    active: Optional[bool] = None


class VerificationIn(BaseModel):
    status: Literal["verified", "rejected", "pending"]
    reason: str = Field(default="", max_length=300)


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except InvalidId:
        raise HTTPException(404, "not_found")


def _check_parent(kind: str, body) -> None:
    if kind == "categories" and not body.family_key:
        raise HTTPException(422, "family_key_required")
    if kind == "specialties" and not body.category_key:
        raise HTTPException(422, "category_key_required")


@router.get("/taxonomy/{kind}")
async def list_tax(kind: TaxKind, _: User = Depends(require_admin("moderator", "support"))):
    return await db[COLL[kind]].find({}, {"_id": 0}).sort("order", 1).to_list(1000)


@router.post("/taxonomy/{kind}", status_code=201)
async def create_tax(kind: TaxKind, body: TaxIn, request: Request, admin: User = Depends(require_admin("moderator"))):
    if not KEY_RX.match(body.key):
        raise HTTPException(422, "key_invalid")
    _check_parent(kind, body)
    if await db[COLL[kind]].find_one({"key": body.key}):
        raise HTTPException(409, "key_taken")
    doc = body.model_dump(exclude_none=True) | {"created_at": datetime.now(timezone.utc)}
    if kind == "categories":
        doc.setdefault("required_documents", ["id_card"])
    await db[COLL[kind]].insert_one(doc)
    await audit("taxonomy.create", admin, kind, body.key, {"name_fr": body.name_fr}, client_ip(request))
    doc.pop("_id", None)
    return doc


@router.patch("/taxonomy/{kind}/{key}")
async def patch_tax(kind: TaxKind, key: str, body: TaxPatch, request: Request, admin: User = Depends(require_admin("moderator"))):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(422, "empty_patch")
    data["updated_at"] = datetime.now(timezone.utc)
    res = await db[COLL[kind]].update_one({"key": key}, {"$set": data})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    if kind == "families" and "active" in data:
        await db.taxonomy_categories.update_many({"family_key": key}, {"$set": {"active": data["active"]}})
    await audit("taxonomy.update", admin, kind, key, data, client_ip(request))
    return await db[COLL[kind]].find_one({"key": key}, {"_id": 0})


@router.delete("/taxonomy/{kind}/{key}", status_code=204)
async def delete_tax(kind: TaxKind, key: str, request: Request, admin: User = Depends(require_admin("super_admin"))):
    used = {"categories": db.professional_profiles.count_documents({"category_key": key}),
            "families": db.taxonomy_categories.count_documents({"family_key": key}),
            "subjects": db.teacher_profiles.count_documents({"subjects.subject_key": key})}.get(kind)
    if used is not None and await used:
        raise HTTPException(409, "in_use")
    res = await db[COLL[kind]].delete_one({"key": key})
    if not res.deleted_count:
        raise HTTPException(404, "not_found")
    await audit("taxonomy.delete", admin, kind, key, {}, client_ip(request))


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


@router.get("/profiles")
async def list_profiles(kind: Literal["professional", "teacher"] = "professional", status: str = "pending",
                        page: int = 1, page_size: int = 20, _: User = Depends(require_admin("moderator", "support"))):
    q = {"verification_status": status} if status else {}
    page_size = max(1, min(page_size, 100))
    total = await _coll(kind).count_documents(q)
    docs = await _coll(kind).find(q).sort("updated_at", -1).skip((max(page, 1) - 1) * page_size).to_list(page_size)
    users = {u["_id"]: u async for u in db.users.find({"_id": {"$in": [d["user_id"] for d in docs]}}, {"email": 1, "phone": 1, "full_name": 1})}
    items = []
    for d in docs:
        u = users.get(d["user_id"], {})
        docs_view = [{k: v for k, v in x.items() if k != "key"} | {"index": i, "has_file": bool(x.get("key"))} if isinstance(x, dict)
                     else {"type": x, "status": "declared", "index": i, "has_file": False} for i, x in enumerate(d.get("documents") or [])]
        items.append({**{k: (str(v) if isinstance(v, ObjectId) else v) for k, v in d.items() if k not in ("_id", "user_id", "documents")},
                      "documents": docs_view, "id": str(d["_id"]), "user_id": str(d["user_id"]),
                      "user": {"email": u.get("email"), "phone": u.get("phone"), "full_name": u.get("full_name")}})
    return {"total": total, "items": items}


@router.patch("/profiles/{kind}/{pid}/verification")
async def set_verification(kind: Literal["professional", "teacher"], pid: str, body: VerificationIn, request: Request,
                           admin: User = Depends(require_admin("moderator"))):
    upd = {"verification_status": body.status, "verification_reason": body.reason, "verified_at": datetime.now(timezone.utc),
           "updated_at": datetime.now(timezone.utc)}
    res = await _coll(kind).update_one({"_id": _oid(pid)}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(404, "not_found")
    await trust.recompute(kind, pid, f"verification_{body.status}", "moderation", {"reason": body.reason})
    await audit(f"moderation.profile_{body.status}", admin, kind, pid, {"reason": body.reason}, client_ip(request))
    prof = await _coll(kind).find_one({"_id": _oid(pid)}, {"user_id": 1, "display_name": 1})
    if prof:
        if body.status == "verified":
            title, text = "Votre fiche est validée", f"Félicitations {prof['display_name']} ! Votre fiche GoFix est vérifiée et publiée dans le catalogue."
        elif body.status == "rejected":
            title, text = "Votre fiche n'a pas été validée", f"Votre fiche GoFix a été refusée. Motif : {body.reason or 'non précisé'}. Contactez le support."
        else:
            title, text = "Fiche remise en attente", "Votre fiche est de nouveau en cours d'examen."
        await notify(prof["user_id"], f"profile_{body.status}", title, text, "/account")
    return {"ok": True, "verification_status": body.status}
