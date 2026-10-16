"""Payment gateway configuration, editable by the super-admin in the back-office (the .env is only the fallback).
The SATIM password is stored encrypted (Fernet) and is never returned by the API."""
import base64
import hashlib
import os
from datetime import datetime, timezone

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.db import db
from app.core.logging import get_logger

log = get_logger("payment_config")
DOC_KEY = "default"
SATIM_FIELDS = ("base_url", "username", "password", "terminal_id")


def _fernet() -> Fernet:
    # Dedicated key if provided, else derived from JWT_SECRET: rotating that secret means re-entering the SATIM password.
    secret = os.environ.get("CONFIG_ENCRYPTION_KEY") or settings.jwt_secret
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(f"gofix-config:{secret}".encode()).digest()))


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        log.error("payment_config_decrypt_failed")
        return None


def _from_env() -> dict:
    e = os.environ
    return {"provider": settings.payment_provider, "source": "env",
            "satim": {"environment": e.get("SATIM_ENVIRONMENT", "test"), "base_url": e.get("SATIM_BASE_URL", ""),
                      "username": e.get("SATIM_USERNAME", ""), "password": e.get("SATIM_PASSWORD") or None,
                      "terminal_id": e.get("SATIM_TERMINAL_ID", "")}}


async def stored() -> dict | None:
    return await db.payment_config.find_one({"key": DOC_KEY})


async def effective() -> dict:
    """Configuration in force: the back-office one if it was ever saved, otherwise the .env values."""
    doc = await stored()
    if not doc:
        return _from_env()
    s = dict(doc.get("satim") or {})
    enc = s.pop("password_enc", None)
    s["password"] = decrypt(enc) if enc else None
    return {"provider": doc["provider"], "source": "database", "satim": s, "password_unreadable": bool(enc) and s["password"] is None,
            "updated_at": doc.get("updated_at"), "updated_by": doc.get("updated_by")}


def satim_complete(cfg: dict) -> bool:
    return all((cfg.get("satim") or {}).get(k) for k in SATIM_FIELDS)


def public_view(cfg: dict) -> dict:
    """Safe for the admin UI: the password is reduced to a boolean."""
    s = {k: v for k, v in (cfg.get("satim") or {}).items() if k != "password"}
    s["password_set"] = bool((cfg.get("satim") or {}).get("password"))
    out = {k: v for k, v in cfg.items() if k != "satim"}
    return out | {"satim": s, "complete": satim_complete(cfg), "callback_url": f"{settings.frontend_url}/api/v1/billing/callback/satim"}


async def save(provider: str, satim: dict, new_password: str | None, actor_email: str) -> dict:
    current = await stored()
    if new_password:
        enc = encrypt(new_password)
    elif current:
        enc = (current.get("satim") or {}).get("password_enc")
    else:  # first save from the back-office: keep the password that was in the .env, if any
        env_pw = _from_env()["satim"]["password"]
        enc = encrypt(env_pw) if env_pw else None
    doc = {"key": DOC_KEY, "provider": provider, "satim": {**satim, "password_enc": enc},
           "updated_at": datetime.now(timezone.utc), "updated_by": actor_email}
    await db.payment_config.replace_one({"key": DOC_KEY}, doc, upsert=True)
    return await effective()
