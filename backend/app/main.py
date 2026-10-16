import asyncio
import os
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import client, db, init_indexes
from app.core.logging import get_logger, setup_logging
from app.core.safety import is_production, production_problems
from app.core.security import hash_password, verify_password
from app.services import payment_config, scheduler
from app.services.config_store import ensure_defaults

setup_logging()
log = get_logger("gofix")

from app.api.v1 import (admin, admin_email, admin_ops, admin_payment, admin_taxonomy, auth, billing, catalog, chatbot, jobs, marketplace, match,  # noqa: E402
                       onboarding, provider, public, requests, social, trust_api, users)

# The interactive API docs map every endpoint: hidden in production unless EXPOSE_API_DOCS=true.
_docs = not is_production() or os.environ.get("EXPOSE_API_DOCS", "").lower() == "true"
app = FastAPI(title="GOFIX API", version=settings.app_version, docs_url="/api/docs" if _docs else None, redoc_url=None,
              openapi_url="/api/openapi.json" if _docs else None,
              description="API REST GOFIX v1 — utilisée par le web (PWA) et les futures apps mobiles.")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)", "Cross-Origin-Opener-Policy": "same-origin",
}


@app.middleware("http")
async def request_context(request: Request, call_next):
    rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled_error", extra={"ctx": {"request_id": rid, "path": request.url.path}})
        response = JSONResponse({"detail": "internal_error", "request_id": rid}, status_code=500)
    response.headers["X-Request-ID"] = rid
    for k, v in SECURITY_HEADERS.items():
        response.headers.setdefault(k, v)
    response.headers.setdefault("Cache-Control", "no-store")  # API data (tokens, personal data) is never cached
    log.info("request", extra={"ctx": {"request_id": rid, "method": request.method, "path": request.url.path,
                                       "status": response.status_code,
                                       "duration_ms": round((time.perf_counter() - start) * 1000, 1)}})
    return response


app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                   allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Accept-Language"])

v1 = APIRouter(prefix="/api/v1")
for r in (auth.router, users.router, catalog.router, marketplace.router, onboarding.router, provider.router, requests.router, jobs.router, match.router, trust_api.router, billing.router,
          social.router, chatbot.router, public.router, admin.router, admin_ops.router, admin_email.router, admin_payment.router, admin_taxonomy.router):
    v1.include_router(r)


async def _health():
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return JSONResponse({"status": "ok" if db_ok else "degraded", "db": db_ok, "version": settings.app_version,
                         "time": datetime.now(timezone.utc).isoformat()}, status_code=200 if db_ok else 503)


v1.add_api_route("/health", _health, methods=["GET"], tags=["health"])
app.include_router(v1)
app.add_api_route("/api/health", _health, methods=["GET"], tags=["health"])


async def seed_admin():
    now = datetime.now(timezone.utc)
    existing = await db.users.find_one({"email": settings.admin_email})
    if not existing:
        await db.users.insert_one({"email": settings.admin_email, "password_hash": hash_password(settings.admin_password),
                                   "full_name": "Super Admin GOFIX", "roles": ["client"], "active_mode": "client",
                                   "admin_role": "super_admin", "status": "active", "email_verified": True,
                                   "phone_verified": False, "preferred_language": "fr", "theme": "dark",
                                   "week_start": "saturday", "guardian": {}, "created_at": now, "updated_at": now})
    elif not verify_password(settings.admin_password, existing.get("password_hash") or ""):
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"password_hash": hash_password(settings.admin_password),
                                                                     "admin_role": "super_admin", "status": "active"}})


@app.on_event("startup")
async def startup():
    errors, warnings = production_problems()
    for w in warnings:
        log.warning("production_config", extra={"ctx": {"warning": w}})
    if errors:
        for e in errors:
            log.error("production_config", extra={"ctx": {"error": e}})
        raise RuntimeError("Unsafe production configuration: " + "; ".join(errors))
    await init_indexes()
    await ensure_defaults()
    if is_production():
        pay = await payment_config.effective()
        if pay["provider"] != "satim" or not payment_config.satim_complete(pay):
            log.warning("production_config", extra={"ctx": {"warning": "online payment not configured: super-admin → back-office → Moyen de paiement"}})
    await seed_admin()
    if settings.app_env != "test":
        app.state.scheduler = asyncio.create_task(scheduler.loop())
    log.info("startup_complete", extra={"ctx": {"env": settings.app_env}})


@app.on_event("shutdown")
async def shutdown():
    client.close()
