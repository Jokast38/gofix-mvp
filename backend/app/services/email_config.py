"""Outgoing e-mail (SMTP) configuration, editable by the super-admin in the back-office (the .env is only the fallback).
The SMTP password is stored encrypted (same key as the SATIM password) and is never returned by the API."""
import os
from datetime import datetime, timezone

from app.core.config import settings
from app.core.db import db
from app.services.payment_config import decrypt, encrypt

DOC_KEY = "default"
SECURITY = ("ssl", "starttls", "none")


def _from_env() -> dict:
    e = os.environ
    port = int(e.get("SMTP_PORT") or 587)
    security = "ssl" if port == 465 else "starttls" if e.get("SMTP_TLS", "true") == "true" else "none"
    return {"provider": "smtp" if settings.email_provider == "smtp" else "console", "source": "env",
            "smtp": {"host": e.get("SMTP_HOST", ""), "port": port, "security": security, "username": e.get("SMTP_USER", ""),
                     "password": e.get("SMTP_PASSWORD") or None, "from_email": e.get("SMTP_FROM", ""),
                     "from_name": e.get("SMTP_FROM_NAME", "GoFix"), "reply_to": e.get("SMTP_REPLY_TO", "")}}


async def stored() -> dict | None:
    return await db.email_config.find_one({"key": DOC_KEY})


async def effective() -> dict:
    """Configuration in force: the back-office one if it was ever saved, otherwise the .env values."""
    doc = await stored()
    if not doc:
        return _from_env()
    s = dict(doc.get("smtp") or {})
    enc = s.pop("password_enc", None)
    s["password"] = decrypt(enc) if enc else None
    return {"provider": doc["provider"], "source": "database", "smtp": s, "password_unreadable": bool(enc) and s["password"] is None,
            "updated_at": doc.get("updated_at"), "updated_by": doc.get("updated_by")}


def smtp_complete(cfg: dict) -> bool:
    s = cfg.get("smtp") or {}
    return bool(s.get("host") and s.get("port") and s.get("from_email")) and (not s.get("username") or bool(s.get("password")))


def public_view(cfg: dict) -> dict:
    """Safe for the admin UI: the password is reduced to a boolean."""
    s = {k: v for k, v in (cfg.get("smtp") or {}).items() if k != "password"}
    s["password_set"] = bool((cfg.get("smtp") or {}).get("password"))
    out = {k: v for k, v in cfg.items() if k != "smtp"}
    return out | {"smtp": s, "complete": smtp_complete(cfg)}


async def save(provider: str, smtp: dict, new_password: str | None, actor_email: str) -> dict:
    current = await stored()
    if new_password:
        enc = encrypt(new_password)
    elif current:
        enc = (current.get("smtp") or {}).get("password_enc")
    else:  # first save from the back-office: keep the password that was in the .env, if any
        env_pw = _from_env()["smtp"]["password"]
        enc = encrypt(env_pw) if env_pw else None
    doc = {"key": DOC_KEY, "provider": provider, "smtp": {**smtp, "password_enc": enc},
           "updated_at": datetime.now(timezone.utc), "updated_by": actor_email}
    await db.email_config.replace_one({"key": DOC_KEY}, doc, upsert=True)
    return await effective()
