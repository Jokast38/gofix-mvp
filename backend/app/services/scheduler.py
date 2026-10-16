"""In-process periodic jobs (single backend worker): subscription expiry, renewal reminders, stale orders."""
import asyncio
import math
from datetime import datetime, timedelta, timezone

from app.core.db import db
from app.core.logging import get_logger
from app.services.audit import audit
from app.services.config_store import get_setting
from app.services.notify import notify

log = get_logger("scheduler")
INTERVAL_S = 900


async def run_once(now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    expired = 0
    async for s in db.subscriptions.find({"status": "active", "ends_at": {"$lte": now}}):
        await db.subscriptions.update_one({"_id": s["_id"], "status": "active"}, {"$set": {"status": "expired", "updated_at": now}})
        await audit("subscription.expired", None, "subscription", str(s["_id"]), {"user_id": str(s["user_id"]), "plan": s.get("plan_key")})
        await notify(s["user_id"], "subscription_expired", "Abonnement expiré",
                     "Votre abonnement GoFix a expiré. Renouvelez-le depuis la page Offres pour garder vos avantages.", "/pricing")
        expired += 1
    days = sorted(await get_setting("subscription_reminder_days"), reverse=True)
    reminded = 0
    if days:
        async for s in db.subscriptions.find({"status": "active", "ends_at": {"$gt": now, "$lte": now + timedelta(days=days[0])}}):
            left = math.ceil((s["ends_at"] - now).total_seconds() / 86400)
            due = [d for d in days if left <= d and d not in (s.get("reminders_sent") or [])]
            if due:
                await db.subscriptions.update_one({"_id": s["_id"]}, {"$addToSet": {"reminders_sent": {"$each": due}}})
                await notify(s["user_id"], "subscription_reminder", f"Votre abonnement expire dans {left} jour(s)",
                             f"Pensez à renouveler votre abonnement avant le {s['ends_at']:%d/%m/%Y}.", "/pricing")
                reminded += 1
    timeout = await get_setting("payment_timeout_minutes")
    res = await db.payment_orders.update_many({"status": "pending", "created_at": {"$lt": now - timedelta(minutes=timeout)}},
                                              {"$set": {"status": "expired", "updated_at": now}})
    from app.api.v1.jobs import auto_complete_due, remind_upcoming
    return {"expired": expired, "reminded": reminded, "orders_expired": res.modified_count,
            "jobs_auto_completed": await auto_complete_due(now), "jobs_reminded": await remind_upcoming(now)}


async def loop():
    while True:
        try:
            out = await run_once()
            if any(out.values()):
                log.info("scheduler_run", extra={"ctx": out})
        except Exception:
            log.exception("scheduler_failed")
        await asyncio.sleep(INTERVAL_S)
