from datetime import datetime, timezone

from bson import ObjectId

from app.adapters.email import get_email_adapter
from app.adapters.sms import get_sms_adapter
from app.core.db import db
from app.core.logging import get_logger
from app.services.push import push_to_user

log = get_logger("notify")


async def notify(user_id, type_: str, title: str, body: str, link: str | None = None, channels=("inapp", "push", "email", "sms")):
    """In-app notification + mobile push + e-mail + SMS through the adapters (console mode logs them).
    Frequent events (messages, appointments) use ("inapp", "push"): instant on the phone, no e-mail/SMS flood."""
    uid = ObjectId(str(user_id))
    now = datetime.now(timezone.utc)
    if "inapp" in channels:
        await db.notifications.insert_one({"user_id": uid, "type": type_, "title": title, "body": body, "link": link,
                                           "read": False, "created_at": now})
    if "push" in channels:
        await push_to_user(uid, title, body, link)
    user = await db.users.find_one({"_id": uid}, {"email": 1, "phone": 1})
    if not user:
        return
    try:
        if "email" in channels and user.get("email"):
            await get_email_adapter().send(user["email"], f"GoFix – {title}", body)
        if "sms" in channels and user.get("phone"):
            await get_sms_adapter().send(user["phone"], f"GoFix : {title}. {body}"[:160])
    except Exception:
        log.exception("notify_failed", extra={"ctx": {"user_id": str(uid), "type": type_}})
