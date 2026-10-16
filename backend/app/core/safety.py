"""Production safety checks: the API refuses to start with development settings (weak secrets, mock payments...)."""
import os

from app.core.config import settings

WEAK_MARKERS = ("change-me", "changeme", "secret", "password", "admin")


def is_production() -> bool:
    return settings.app_env == "production"


def mock_allowed() -> bool:
    """The mock payment gateway marks orders paid without money: never in production unless explicitly allowed (staging)."""
    return not is_production() or os.environ.get("ALLOW_MOCK_PAYMENTS", "").lower() == "true"


def _strong_password(p: str) -> bool:
    return (len(p) >= 12 and any(c.isdigit() for c in p) and any(c.isalpha() for c in p)
            and not any(m in p.lower() for m in ("change-me", "changeme", "password", "123456")))


def production_problems() -> tuple[list[str], list[str]]:
    """(blocking errors, warnings) for the current configuration in production."""
    if not is_production():
        return [], []
    errors, warnings = [], []
    s = settings.jwt_secret
    if len(s) < 32 or any(m in s.lower() for m in WEAK_MARKERS):
        errors.append("JWT_SECRET must be a random value of 32+ characters (openssl rand -hex 32)")
    if not _strong_password(settings.admin_password):
        errors.append("ADMIN_PASSWORD must be 12+ characters with letters and digits")
    if not settings.frontend_url.startswith("https://"):
        errors.append("FRONTEND_URL must be https:// in production")
    dev = [o for o in settings.cors_origins if "localhost" in o or "127.0.0.1" in o or o == "*"]
    if dev:
        errors.append(f"CORS_ORIGINS contains development origins: {', '.join(dev)}")
    if settings.sms_provider == "console":
        warnings.append("SMS_PROVIDER=console: OTP codes are only written to the logs")
    if settings.email_provider == "console":
        warnings.append("EMAIL_PROVIDER=console: unless SMTP is set in the back-office (Admin > E-mails), e-mails are only written to the logs")
    if "@" not in settings.mongo_url.split("//", 1)[-1]:
        warnings.append("MONGO_URL has no credentials: enable MongoDB authentication")
    return errors, warnings
