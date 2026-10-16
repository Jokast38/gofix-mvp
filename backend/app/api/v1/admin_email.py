import re
import smtplib
import socket
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.adapters.email import SmtpEmailAdapter
from app.core.deps import client_ip, require_admin
from app.core.ratelimit import hit
from app.models.user import User
from app.services import email_config
from app.services.audit import audit

router = APIRouter(prefix="/admin", tags=["admin-email"])
EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
HOST_RE = re.compile(r"[A-Za-z0-9.-]+")


class SmtpIn(BaseModel):
    host: str = Field(default="", max_length=200)
    port: int = Field(default=465, ge=1, le=65535)
    security: Literal["ssl", "starttls", "none"] = "ssl"
    username: str = Field(default="", max_length=200)
    password: Optional[str] = Field(default=None, max_length=200)  # empty = keep the stored one
    from_email: str = Field(default="", max_length=200)
    from_name: str = Field(default="GoFix", max_length=80)
    reply_to: str = Field(default="", max_length=200)


class EmailConfigIn(BaseModel):
    provider: Literal["console", "smtp"]
    smtp: SmtpIn = SmtpIn()


class TestIn(BaseModel):
    to: str = Field(max_length=200)


async def _view() -> dict:
    return email_config.public_view(await email_config.effective())


@router.get("/email-config")
async def get_config(_: User = Depends(require_admin("super_admin"))):
    return await _view()


@router.put("/email-config")
async def set_config(body: EmailConfigIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    s = body.smtp
    smtp = {"host": s.host.strip(), "port": s.port, "security": s.security, "username": s.username.strip(),
            "from_email": s.from_email.strip().lower(), "from_name": s.from_name.strip().replace("\n", " "), "reply_to": s.reply_to.strip().lower()}
    if smtp["host"] and not HOST_RE.fullmatch(smtp["host"]):
        raise HTTPException(422, "invalid_host")
    for k in ("from_email", "reply_to"):
        if smtp[k] and not EMAIL_RE.fullmatch(smtp[k]):
            raise HTTPException(422, "email_invalid")
    if body.provider == "smtp":
        current = await email_config.effective()
        has_password = bool(s.password) or bool((current.get("smtp") or {}).get("password"))
        if not (smtp["host"] and smtp["from_email"]) or (smtp["username"] and not has_password):
            raise HTTPException(422, "smtp_incomplete")
    await email_config.save(body.provider, smtp, s.password or None, admin.email)
    # Audited without any secret: only whether the password changed.
    await audit("config.email_change", admin, "email_config", "default",
                {"provider": body.provider, **smtp, "password_changed": bool(s.password)}, client_ip(request))
    return await _view()


@router.post("/email-config/test")
async def test_config(body: TestIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    """Sends a real test e-mail with the saved configuration and reports the SMTP answer."""
    hit(f"mail-test:{admin.id}", 10, 600)
    to = body.to.strip().lower()
    if not EMAIL_RE.fullmatch(to):
        raise HTTPException(422, "email_invalid")
    cfg = await email_config.effective()
    if cfg["provider"] != "smtp":
        raise HTTPException(422, "smtp_not_selected")
    if not email_config.smtp_complete(cfg):
        raise HTTPException(422, "smtp_incomplete")
    result = {"ok": True, "stage": "sent", "message": ""}
    try:
        await SmtpEmailAdapter(cfg["smtp"]).send(to, "GoFix – E-mail de test",
                                                 "Ceci est un e-mail de test envoyé depuis le back-office GoFix.\n"
                                                 "Si vous le recevez, l'envoi des e-mails de la plateforme fonctionne.")
    except smtplib.SMTPAuthenticationError as exc:
        result = {"ok": False, "stage": "auth", "message": f"{exc.smtp_code}"}
    except smtplib.SMTPRecipientsRefused:
        result = {"ok": False, "stage": "recipient", "message": ""}
    except smtplib.SMTPSenderRefused as exc:
        result = {"ok": False, "stage": "sender", "message": f"{exc.smtp_code}"}
    except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected) as exc:
        result = {"ok": False, "stage": "connect", "message": type(exc).__name__}
    except smtplib.SMTPException as exc:  # before OSError: SMTPException is an OSError subclass
        result = {"ok": False, "stage": "smtp", "message": type(exc).__name__}
    except (socket.timeout, TimeoutError, OSError) as exc:  # DNS, refused, timeout, TLS
        result = {"ok": False, "stage": "connect", "message": type(exc).__name__}
    await audit("config.email_test", admin, "email_config", "default", {"ok": result["ok"], "stage": result["stage"], "to": to}, client_ip(request))
    return result
