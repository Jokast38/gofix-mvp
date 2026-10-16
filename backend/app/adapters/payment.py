import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("payment")

PaymentStatus = str  # "pending" | "paid" | "failed" | "cancelled" | "unknown"


@dataclass
class CreatedOrder:
    gateway_order_id: str
    redirect_url: str


class PaymentAdapter(ABC):
    name = "base"

    @abstractmethod
    async def create_order(self, order_number: str, amount_da: int, description: str,
                           return_url: str, fail_url: str, lang: str = "fr") -> CreatedOrder: ...

    @abstractmethod
    async def get_status(self, gateway_order_id: str) -> PaymentStatus: ...

    async def handle_callback(self, params: dict) -> tuple[str, PaymentStatus]:
        """Never trust callback params: always re-check status server-side."""
        gid = params.get("orderId") or params.get("gateway_order_id")
        if not gid:
            return "", "unknown"
        return gid, await self.get_status(gid)


class MockPaymentAdapter(PaymentAdapter):
    """Dev/demo: the mock 'hosted page' lets the tester pick success/failure; status is stored server-side."""
    name = "mock"
    _store: dict[str, PaymentStatus] = {}

    async def create_order(self, order_number, amount_da, description, return_url, fail_url, lang="fr"):
        gid = f"MOCK-{uuid.uuid4().hex[:16]}"
        self._store[gid] = "pending"
        return CreatedOrder(gid, f"{settings.frontend_url}/payment/mock?orderId={gid}")

    def simulate(self, gid: str, outcome: PaymentStatus):
        if gid in self._store:
            self._store[gid] = outcome

    async def get_status(self, gid):
        return self._store.get(gid, "unknown")


class PaymentUnavailable(Exception):
    """No usable gateway: SATIM selected but incomplete, or the mock gateway in production."""


class SatimPaymentAdapter(PaymentAdapter):
    """CIB / Edahabia via SATIM hosted payment page (register.do → redirect → confirmOrder.do)."""
    name = "satim"

    def __init__(self, base_url: str, username: str, password: str, terminal_id: str):
        self.base = base_url.rstrip("/")
        self.username, self.password, self.terminal_id = username, password, terminal_id

    async def _call(self, endpoint: str, params: dict) -> dict:
        params = {"userName": self.username, "password": self.password, **params}
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(f"{self.base}/{endpoint}", params=params)
        data = r.json()
        log.info("satim_call", extra={"ctx": {"endpoint": endpoint, "http": r.status_code,
                                              "error_code": data.get("ErrorCode") or data.get("errorCode")}})
        return data

    async def create_order(self, order_number, amount_da, description, return_url, fail_url, lang="fr"):
        data = await self._call("register.do", {
            "orderNumber": order_number, "amount": amount_da * 100, "currency": "012",
            "returnUrl": return_url, "failUrl": fail_url, "language": lang.upper(), "description": description,
            "jsonParams": json.dumps({"force_terminal_id": self.terminal_id, "udf1": order_number}),
        })
        if str(data.get("errorCode", "0")) != "0" or "formUrl" not in data:
            raise RuntimeError(f"satim_register_failed:{data.get('errorCode')}")
        return CreatedOrder(data["orderId"], data["formUrl"])

    async def get_status(self, gid):
        data = await self._call("confirmOrder.do", {"mdOrder": gid, "language": "FR"})
        status, err = data.get("OrderStatus"), str(data.get("ErrorCode", ""))
        if status == 2 and err == "0":
            return "paid"
        if status in (3, 6):
            return "failed"
        if status == 0:
            return "pending"
        return "failed" if err not in ("", "0") else "unknown"

    async def check(self) -> dict:
        """Connection test without any charge: status of an order that cannot exist.
        SATIM answers error 5 when the credentials are refused; any other answer proves they were accepted."""
        try:
            data = await self._call("confirmOrder.do", {"mdOrder": "00000000-0000-0000-0000-000000000000", "language": "FR"})
        except (httpx.HTTPError, ValueError) as exc:
            return {"ok": False, "reachable": False, "error_code": None, "message": type(exc).__name__}
        code = str(data.get("ErrorCode", data.get("errorCode", "")))
        message = str(data.get("ErrorMessage") or data.get("errorMessage") or "")[:200]
        return {"ok": code != "5", "reachable": True, "error_code": code, "message": message}


_mock = MockPaymentAdapter()


async def get_payment_adapter() -> PaymentAdapter:
    """Gateway in force, from the back-office configuration (or the .env). Raises PaymentUnavailable."""
    from app.core.safety import mock_allowed
    from app.services import payment_config

    cfg = await payment_config.effective()
    if cfg["provider"] == "satim":
        if not payment_config.satim_complete(cfg):
            raise PaymentUnavailable("satim_incomplete")
        s = cfg["satim"]
        return SatimPaymentAdapter(s["base_url"], s["username"], s["password"], s["terminal_id"])
    if not mock_allowed():
        raise PaymentUnavailable("mock_in_production")
    return _mock
