import math
from datetime import datetime, timedelta, timezone

from app.services.config_store import get_setting
from app.services.entitlements import active_subscription


async def provider_access(profile: dict) -> dict:
    """Free provider access: new requests are received during N days OR up to M requests (first threshold wins),
    unless the provider holds an active Pro/Premium professional subscription. Thresholds are admin settings."""
    now = datetime.now(timezone.utc)
    sub = await active_subscription(profile["user_id"], ["professional"])
    subscribed = bool(sub and sub.get("tier") in ("pro", "premium"))
    days = await get_setting("free_access_days")
    max_requests = await get_setting("free_access_max_requests")
    fa = profile.get("free_access") or {}
    started = fa.get("started_at") or profile.get("created_at") or now
    ends = started + timedelta(days=days)
    used = int(fa.get("requests_received") or 0)
    return {
        "subscribed": subscribed, "tier": sub.get("tier") if subscribed else "free",
        "subscription_ends_at": sub.get("ends_at") if subscribed else None,
        "blocked": not subscribed and (now >= ends or used >= max_requests),
        "free_days": days, "free_max_requests": max_requests, "free_ends_at": ends,
        "days_left": max(0, math.ceil((ends - now).total_seconds() / 86400)),
        "requests_used": used, "requests_left": max(0, max_requests - used),
    }
