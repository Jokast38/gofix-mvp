"""Leases in MongoDB: with several backend workers, a periodic job (the scheduler) runs in one of them only.
The holder renews its lease on each run; if it dies, another worker takes over once the lease has expired."""
import os
import socket
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.db import db

OWNER = f"{socket.gethostname()}:{os.getpid()}"


async def acquire(name: str, ttl_s: int) -> bool:
    """True if this process holds (or just took, or renewed) the lease `name` for the next `ttl_s` seconds."""
    now = datetime.now(timezone.utc)
    try:
        doc = await db.leases.find_one_and_update(
            {"_id": name, "$or": [{"until": {"$lt": now}}, {"owner": OWNER}]},
            {"$set": {"owner": OWNER, "until": now + timedelta(seconds=ttl_s)}},
            upsert=True, return_document=ReturnDocument.AFTER)
    except DuplicateKeyError:  # another worker holds it (the upsert raced with its document)
        return False
    return bool(doc and doc.get("owner") == OWNER)
