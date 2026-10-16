import os
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("sms")


class SmsAdapter(ABC):
    @abstractmethod
    async def send(self, phone: str, message: str) -> bool: ...


class ConsoleSmsAdapter(SmsAdapter):
    async def send(self, phone, message):
        log.info("sms_console", extra={"ctx": {"to": phone, "message": message}})
        return True


class HttpSmsAdapter(SmsAdapter):
    """Generic HTTP gateway for an Algerian SMS provider (URL/token from env)."""

    def __init__(self):
        self.url = os.environ["SMS_HTTP_URL"]
        self.token = os.environ["SMS_HTTP_TOKEN"]
        self.sender = os.environ.get("SMS_SENDER_ID", "GOFIX")

    async def send(self, phone, message):
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(self.url, headers={"Authorization": f"Bearer {self.token}"},
                             json={"to": phone, "from": self.sender, "text": message})
        ok = r.status_code < 300
        log.info("sms_http", extra={"ctx": {"to": phone, "status": r.status_code}})
        return ok


def get_sms_adapter() -> SmsAdapter:
    return HttpSmsAdapter() if settings.sms_provider == "http" else ConsoleSmsAdapter()
