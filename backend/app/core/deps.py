import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, Request

from app.core.db import db
from app.core.security import decode_token
from app.models.user import User


def client_ip(request: Request) -> str:
    """Real client IP. Our Nginx *overwrites* X-Real-IP with $remote_addr (the backend is only reachable through it),
    so this header cannot be forged by the client — unlike the first X-Forwarded-For entry, which the client controls."""
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else "unknown"


def _bearer(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    return auth[7:] if auth.startswith("Bearer ") else None


async def _load_user(token: str) -> User:
    try:
        payload = decode_token(token, "access")
        doc = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "token_expired")
    except (jwt.InvalidTokenError, InvalidId, KeyError):
        raise HTTPException(401, "token_invalid")
    if not doc or doc.get("status") == "deleted":
        raise HTTPException(401, "user_not_found")
    if doc.get("status") == "suspended":
        raise HTTPException(403, "account_suspended")
    return User.from_mongo(doc)


async def get_current_user(request: Request) -> User:
    token = _bearer(request)
    if not token:
        raise HTTPException(401, "not_authenticated")
    return await _load_user(token)


async def get_optional_user(request: Request) -> User | None:
    token = _bearer(request)
    if not token:
        return None
    try:
        return await _load_user(token)
    except HTTPException:
        return None


def require_admin(*admin_roles: str):
    async def dep(user: User = Depends(get_current_user)) -> User:
        if not user.admin_role:
            raise HTTPException(403, "admin_required")
        if admin_roles and user.admin_role != "super_admin" and user.admin_role not in admin_roles:
            raise HTTPException(403, "insufficient_admin_role")
        return user
    return dep
