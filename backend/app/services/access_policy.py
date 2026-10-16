"""AccessPolicy: the single server-side place deciding which profile fields a viewer receives.
Masked fields are never present in the JSON (no CSS-only blur). Driven by the `unlock_matrix` collection (admin-editable)."""
from dataclasses import dataclass
from datetime import datetime, timezone

from bson import ObjectId

from app.core.db import db
from app.models.user import User
from app.services.config_store import get_setting
from app.services.entitlements import user_tier

# Matrix "visible_fields" -> profile document fields
FIELD_MAP = {
    "display_name": ["display_name"],
    "photo": ["photo_key", "photo_thumb_key", "cover_key", "cover_thumb_key"],
    "bio": ["bio", "specialty_keys", "experience_years", "teaching_languages", "availability"],
    "category": ["category_key", "family_key", "subjects", "formats"],
    "role": ["role_key"],
    "wilaya": ["zones"],
    "commune": [],
    "rating": ["rating_avg", "rating_count", "ratings_by_subject"],
    "rating_bucket": [],
    "price_hint_da": ["price_hint_da", "price_hint_da_hour"],
    "trust_score": ["trust_score", "trust_status", "trust_subscores"],
    "phone": [],
}
ALL_FIELDS = list(FIELD_MAP)
DEFAULT_ROW = {"blurred": True, "visible_fields": ["category", "wilaya", "rating_bucket"], "monthly_views_limit": 0,
               "direct_contact": False, "can_message": False, "can_request": True}


@dataclass
class Access:
    tier: str
    blurred: bool
    fields: list
    views_limit: int | None
    direct_contact: bool
    can_message: bool
    can_request: bool
    is_admin: bool = False
    viewer_id: str | None = None


async def _row(tier: str) -> dict:
    row = await db.unlock_matrix.find_one({"audience": "client", "plan_key": tier}, {"_id": 0})
    return {**DEFAULT_ROW, **(row or {})}


async def resolve_access(user: User | None, kind: str = "professional") -> Access:
    if user is None:
        row = await _row("free")
        return Access("visitor", True, row["visible_fields"], 0, False, False, False)
    if user.admin_role:
        return Access("premium", False, ALL_FIELDS, None, True, True, True, is_admin=True, viewer_id=user.id)
    tier = await user_tier(user)
    if kind == "teacher" and tier == "free" and await get_setting("academy_access_mode") == "free":
        return Access("free", False, [f for f in ALL_FIELDS if f != "phone"], None, False, True, True, viewer_id=user.id)
    row = await _row(tier)
    fields = ALL_FIELDS if not row["blurred"] and not row["visible_fields"] else row["visible_fields"]
    return Access(tier, bool(row["blurred"]), fields, row.get("monthly_views_limit"), bool(row.get("direct_contact")),
                  bool(row.get("can_message", not row["blurred"])), bool(row.get("can_request", True)), viewer_id=user.id)


def _rating_bucket(avg, count):
    if not count:
        return None
    return "4.5+" if avg >= 4.5 else "4+" if avg >= 4 else "3+" if avg >= 3 else "-3"


def apply_policy(doc: dict, acc: Access, kind: str = "professional", force_blur: bool = False) -> dict:
    owner = bool(acc.viewer_id) and str(doc.get("user_id")) == acc.viewer_id
    full = acc.is_admin or owner
    blurred = not full and (acc.blurred or force_blur)
    fields = ALL_FIELDS if full else (DEFAULT_ROW["visible_fields"] if force_blur else acc.fields)
    out = {"id": str(doc["_id"]), "kind": kind, "verification_status": doc.get("verification_status")}
    for f in fields:
        for k in FIELD_MAP.get(f, []):
            if k in doc:
                out[k] = doc[k]
    if "zones" in out and "commune" not in fields:
        out["zones"] = [{"wilaya_code": z.get("wilaya_code"), "radius_km": z.get("radius_km")} for z in out["zones"]]
    if "rating_bucket" in fields and "rating_avg" not in out:
        out["rating_bucket"] = _rating_bucket(doc.get("rating_avg") or 0, doc.get("rating_count") or 0)
    if not full and not doc.get("trust_public", True) and "trust_score" in out:
        out["trust_score"] = None  # GF2-001: the number is public only after the minimal activity threshold
    if full and "trust_breakdown" in doc:
        out["trust_breakdown"] = doc["trust_breakdown"]
    if blurred or "display_name" not in out:
        out["display_name"] = None
    out["blurred"] = blurred
    out["is_owner"] = owner
    out["can_contact"] = not blurred and (acc.can_message or full) and not owner
    out["can_request"] = acc.can_request and not owner and acc.viewer_id is not None
    out["can_see_phone"] = not blurred and (acc.direct_contact or acc.is_admin) and not owner
    return out


async def consume_view(acc: Access, profile_id: ObjectId) -> bool:
    """Monthly full-profile quota (e.g. Pro = N views/month). Re-opening an already viewed profile is free."""
    if acc.is_admin or acc.blurred or acc.views_limit is None or not acc.viewer_id:
        return True
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    uid = ObjectId(acc.viewer_id)
    if await db.profile_views.find_one({"user_id": uid, "month": month, "profile_id": profile_id}):
        return True
    if await db.profile_views.count_documents({"user_id": uid, "month": month}) >= acc.views_limit:
        return False
    await db.profile_views.update_one({"user_id": uid, "month": month, "profile_id": profile_id},
                                      {"$setOnInsert": {"created_at": datetime.now(timezone.utc)}}, upsert=True)
    return True


async def views_used(acc: Access) -> int | None:
    if not acc.viewer_id or acc.views_limit is None:
        return None
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    return await db.profile_views.count_documents({"user_id": ObjectId(acc.viewer_id), "month": month})
