from datetime import datetime, timezone

from bson import ObjectId

from app.core.db import db
from app.models.user import User
from app.services.config_store import get_setting

TIERS = ("free", "pro", "premium")


async def active_subscription(user_id, audiences: list[str] | None = None) -> dict | None:
    now = datetime.now(timezone.utc)
    q = {"user_id": ObjectId(str(user_id)), "status": "active", "ends_at": {"$gt": now}}
    if audiences:
        q["audience"] = {"$in": audiences}
    return await db.subscriptions.find_one(q, sort=[("ends_at", -1)])


async def user_tier(user: User | None) -> str:
    """Viewing tier: anonymous/free -> 'free'; paid subscription -> 'pro' | 'premium'; admins -> 'premium'.
    `client_unlock_mode` [à confirmer] decides whether a professional subscription also unlocks the catalogue."""
    if user is None:
        return "free"
    if user.admin_role:
        return "premium"
    mode = await get_setting("client_unlock_mode")
    audiences = None if mode == "reuse_professional_tiers" else ["client", "student"]
    sub = await active_subscription(user.id, audiences)
    if not sub:
        return "free"
    tier = sub.get("tier", "free")
    return tier if tier in TIERS else "pro" if tier == "student_pass" else "free"
