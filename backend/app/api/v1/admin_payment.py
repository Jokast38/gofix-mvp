from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.adapters.payment import SatimPaymentAdapter
from app.core.deps import client_ip, require_admin
from app.core.ratelimit import hit
from app.core.safety import mock_allowed
from app.models.user import User
from app.services import payment_config
from app.services.audit import audit

router = APIRouter(prefix="/admin", tags=["admin-payment"])


class SatimIn(BaseModel):
    environment: Literal["test", "production"] = "test"
    base_url: str = Field(default="", max_length=300)
    username: str = Field(default="", max_length=120)
    password: Optional[str] = Field(default=None, max_length=200)  # empty = keep the stored one
    terminal_id: str = Field(default="", max_length=60)


class PaymentConfigIn(BaseModel):
    provider: Literal["mock", "satim"]
    satim: SatimIn = SatimIn()


async def _view() -> dict:
    return payment_config.public_view(await payment_config.effective()) | {"mock_allowed": mock_allowed()}


@router.get("/payment-config")
async def get_config(_: User = Depends(require_admin("super_admin"))):
    return await _view()


@router.put("/payment-config")
async def set_config(body: PaymentConfigIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    s = body.satim
    satim = {"environment": s.environment, "base_url": s.base_url.strip().rstrip("/"), "username": s.username.strip(),
             "terminal_id": s.terminal_id.strip()}
    if satim["base_url"] and not satim["base_url"].startswith("https://"):
        raise HTTPException(422, "invalid_url")
    if body.provider == "mock" and not mock_allowed():
        raise HTTPException(422, "mock_not_allowed")
    if body.provider == "satim":
        current = await payment_config.effective()
        has_password = bool(s.password) or bool((current.get("satim") or {}).get("password"))
        if not (satim["base_url"] and satim["username"] and satim["terminal_id"] and has_password):
            raise HTTPException(422, "satim_incomplete")
    await payment_config.save(body.provider, satim, s.password or None, admin.email)
    # Audited without any secret: only whether the password changed.
    await audit("config.payment_change", admin, "payment_config", "default",
                {"provider": body.provider, **satim, "password_changed": bool(s.password)}, client_ip(request))
    return await _view()


@router.post("/payment-config/test")
async def test_config(request: Request, admin: User = Depends(require_admin("super_admin"))):
    hit(f"pay-test:{admin.id}", 10, 600)
    cfg = await payment_config.effective()
    if cfg["provider"] != "satim":
        raise HTTPException(422, "satim_not_selected")
    if not payment_config.satim_complete(cfg):
        raise HTTPException(422, "satim_incomplete")
    s = cfg["satim"]
    result = await SatimPaymentAdapter(s["base_url"], s["username"], s["password"], s["terminal_id"]).check()
    await audit("config.payment_test", admin, "payment_config", "default",
                {"ok": result["ok"], "error_code": result["error_code"]}, client_ip(request))
    return result
