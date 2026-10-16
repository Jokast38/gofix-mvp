"""Mobile push notifications through the Expo push service (which relays to Apple APNs / Google FCM).
Tokens are registered by the app after the user accepted notifications; dead tokens are removed automatically."""
import asyncio
import os
import re

import httpx

from app.core.db import db
from app.core.logging import get_logger
from app.services.config_store import is_enabled

log = get_logger("push")
EXPO_URL = "https://exp.host/--/api/v2/push/send"
TOKEN_RE = re.compile(r"^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_\-]{10,}\]$")
_tasks: set[asyncio.Task] = set()


def provider() -> str:
    return os.environ.get("PUSH_PROVIDER", "expo")


async def _send(messages: list[dict]) -> None:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(EXPO_URL, json=messages, headers={"Accept": "application/json"})
    tickets = (r.json() or {}).get("data") or []
    for msg, ticket in zip(messages, tickets):
        if ticket.get("status") == "error":
            log.warning("push_error", extra={"ctx": {"error": (ticket.get("details") or {}).get("error"), "message": ticket.get("message")}})
            if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                await db.push_tokens.delete_one({"token": msg["to"]})


async def _run(messages: list[dict]) -> None:
    try:
        await _send(messages)
    except Exception:  # noqa: BLE001 - a push failure must never break the request that triggered it
        log.exception("push_failed")


async def push_to_user(user_id, title: str, body: str, link: str | None = None) -> int:
    """Queue a push to every device of the user (non-blocking). Returns the number of devices targeted."""
    if provider() != "expo" or not await is_enabled("push_notifications"):
        return 0
    tokens = [t["token"] async for t in db.push_tokens.find({"user_id": user_id}, {"token": 1})]
    if not tokens:
        return 0
    messages = [{"to": t, "title": title[:120], "body": body[:240], "sound": "default", "channelId": "default",
                 "data": {"link": link} if link else {}} for t in tokens]
    task = asyncio.create_task(_run(messages))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return len(tokens)
