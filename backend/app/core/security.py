import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

ALGO = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def create_access_token(user_id: str, roles: list, admin_role: str | None) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "roles": roles, "adm": admin_role, "type": "access", "iat": now,
               "exp": now + timedelta(minutes=settings.access_ttl_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)


def create_refresh_token(user_id: str, jti: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "jti": jti, "type": "refresh", "iat": now,
               "exp": now + timedelta(days=settings.refresh_ttl_days)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)


def decode_token(token: str, expected_type: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong_type")
    return payload
