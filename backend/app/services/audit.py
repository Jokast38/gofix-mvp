from bson import ObjectId

from app.core.db import db
from app.core.logging import get_logger
from app.models.user import AuditLog, User

log = get_logger("audit")


async def audit(action: str, actor: User | None = None, target_type: str | None = None,
                target_id: str | None = None, meta: dict | None = None, ip: str | None = None):
    entry = AuditLog(actor_id=actor.id if actor else None, actor_email=actor.email if actor else None,
                     action=action, target_type=target_type, target_id=target_id, meta=meta or {}, ip=ip)
    doc = entry.to_mongo()
    if doc.get("actor_id"):
        doc["actor_id"] = ObjectId(doc["actor_id"])
    await db.audit_logs.insert_one(doc)
    log.info("audit", extra={"ctx": {"action": action, "target": f"{target_type}:{target_id}"}})
