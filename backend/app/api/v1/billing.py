import os
import random
from datetime import datetime, timedelta, timezone
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

from app.adapters.payment import MockPaymentAdapter, PaymentAdapter, PaymentUnavailable, get_payment_adapter
from app.core.config import settings
from app.core.db import db
from app.core.deps import client_ip, get_current_user, require_admin
from app.core.logging import get_logger
from app.core.ratelimit import hit
from app.core.safety import mock_allowed
from app.models.user import User
from app.services.audit import audit
from app.services.billing import invoice_pdf, settle
from app.services.config_store import company_info, is_enabled
from app.services.entitlements import active_subscription

router = APIRouter(tags=["billing"])
log = get_logger("billing")

PRICE_SETTING = "plan_price_{key}"
REUSE_PENDING_MINUTES = 10
MOBILE_SCHEME = os.environ.get("MOBILE_APP_SCHEME", "gofix")


def _now():
    return datetime.now(timezone.utc)


def _clean(doc: dict) -> dict:
    out = {k: (str(v) if isinstance(v, ObjectId) else v) for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc["_id"])
    return out


async def plans_with_prices(include_inactive: bool = False) -> list[dict]:
    plans = await db.plans.find({} if include_inactive else {"active": True}, {"_id": 0}).sort("order", 1).to_list(50)
    for p in plans:
        price = await db.settings.find_one({"key": PRICE_SETTING.format(key=p["key"])}, {"value": 1})
        if price is not None:
            p["price_da"] = price["value"]
            p["price_tbd"] = False
    return plans


class OrderIn(BaseModel):
    plan_key: str
    platform: Literal["web", "mobile"] = "web"


async def _adapter() -> PaymentAdapter:
    try:
        return await get_payment_adapter()
    except PaymentUnavailable as exc:
        log.warning("payment_unavailable", extra={"ctx": {"reason": str(exc)}})
        raise HTTPException(503, "payment_unavailable")


async def _mock_or_none() -> PaymentAdapter | None:
    """The mock gateway only when it is the one in force and allowed (never in production)."""
    try:
        adapter = await get_payment_adapter()
    except PaymentUnavailable:
        return None
    return adapter if isinstance(adapter, MockPaymentAdapter) and mock_allowed() else None


class SimulateIn(BaseModel):
    outcome: Literal["paid", "failed", "cancelled"]


@router.get("/billing/plans")
async def plans(audience: str | None = None):
    items = await plans_with_prices()
    return [p for p in items if not audience or p["audience"] == audience]


@router.get("/billing/me")
async def my_billing(user: User = Depends(get_current_user)):
    uid = ObjectId(user.id)
    subs = await db.subscriptions.find({"user_id": uid, "status": "active", "ends_at": {"$gt": _now()}}).sort("ends_at", -1).to_list(10)
    orders = await db.payment_orders.find({"user_id": uid}).sort("created_at", -1).to_list(50)
    invoices = await db.invoices.find({"user_id": uid}).sort("created_at", -1).to_list(50)
    try:
        provider = (await get_payment_adapter()).name
    except PaymentUnavailable:
        provider = None
    return {"subscription": _clean(subs[0]) if subs else None, "subscriptions": [_clean(s) for s in subs],
            "orders": [_clean(o) for o in orders], "invoices": [_clean(i) for i in invoices], "provider": provider}


@router.post("/billing/orders", status_code=201)
async def create_order(body: OrderIn, request: Request, user: User = Depends(get_current_user)):
    if not await is_enabled("online_payment"):
        raise HTTPException(403, "feature_disabled")
    plan = next((p for p in await plans_with_prices() if p["key"] == body.plan_key), None)
    if not plan:
        raise HTTPException(404, "plan_not_found")
    if plan["tier"] == "free" or not plan.get("price_da"):
        raise HTTPException(422, "plan_not_purchasable")
    if plan["audience"] == "professional" and not ({"professional", "teacher"} & set(user.roles)):
        raise HTTPException(403, "plan_audience_mismatch")
    if plan["audience"] == "student" and "student" not in user.roles:
        raise HTTPException(403, "plan_audience_mismatch")
    now = _now()
    # Double click / retry: reuse the recent pending order instead of creating a duplicate.
    recent = await db.payment_orders.find_one({"user_id": ObjectId(user.id), "plan_key": plan["key"], "status": "pending",
                                               "created_at": {"$gt": now - timedelta(minutes=REUSE_PENDING_MINUTES)}})
    if recent:
        return {"id": str(recent["_id"]), "order_number": recent["order_number"], "redirect_url": recent["redirect_url"],
                "amount_da": recent["amount_da"], "plan_name": recent["plan_name"], "gateway_order_id": recent["gateway_order_id"], "reused": True}
    number = f"GF-{now:%Y%m%d}-{random.randint(1000, 9999)}{await db.payment_orders.count_documents({}) + 1:04d}"
    adapter = await _adapter()
    callback = f"{settings.frontend_url}/api/v1/billing/callback/{adapter.name}"
    try:
        created = await adapter.create_order(number, plan["price_da"], f"GoFix {plan['name_fr']}", callback,
                                             f"{callback}?failed=1", user.preferred_language)
    except Exception:
        log.exception("payment_gateway_error", extra={"ctx": {"order": number}})
        raise HTTPException(502, "payment_gateway_unavailable")
    doc = {"user_id": ObjectId(user.id), "order_number": number, "plan_key": plan["key"], "plan_name": plan["name_fr"],
           "tier": plan["tier"], "audience": plan["audience"], "amount_da": plan["price_da"], "duration_days": plan["duration_days"],
           "status": "pending", "provider": adapter.name, "gateway_order_id": created.gateway_order_id,
           "redirect_url": created.redirect_url, "platform": body.platform, "created_at": now, "updated_at": now}
    res = await db.payment_orders.insert_one(doc)
    await audit("payment.order_created", user, "order", number, {"plan": plan["key"], "amount_da": plan["price_da"]}, client_ip(request))
    return {"id": str(res.inserted_id), "order_number": number, "redirect_url": created.redirect_url, "amount_da": plan["price_da"],
            "plan_name": plan["name_fr"], "gateway_order_id": created.gateway_order_id}


@router.get("/billing/orders/{number}")
async def get_order(number: str, user: User = Depends(get_current_user)):
    o = await db.payment_orders.find_one({"order_number": number, "user_id": ObjectId(user.id)})
    if not o:
        raise HTTPException(404, "not_found")
    return _clean(o)


@router.get("/billing/mock/{gid}")
async def mock_order(gid: str, user: User = Depends(get_current_user)):
    if not isinstance(await _mock_or_none(), MockPaymentAdapter):
        raise HTTPException(403, "mock_disabled")
    o = await db.payment_orders.find_one({"gateway_order_id": gid, "user_id": ObjectId(user.id)})
    if not o:
        raise HTTPException(404, "not_found")
    return {k: o[k] for k in ("order_number", "plan_name", "amount_da", "status")}


@router.post("/billing/mock/{gid}/simulate")
async def simulate(gid: str, body: SimulateIn, user: User = Depends(get_current_user)):
    """Mock hosted payment page: records the gateway-side outcome only. Activation still requires a server check."""
    adapter = await _mock_or_none()
    if not isinstance(adapter, MockPaymentAdapter):
        raise HTTPException(403, "mock_disabled")
    if not await db.payment_orders.find_one({"gateway_order_id": gid, "user_id": ObjectId(user.id)}):
        raise HTTPException(404, "not_found")
    adapter.simulate(gid, body.outcome)
    return {"gateway_order_id": gid, "status": body.outcome}


@router.api_route("/billing/callback/{provider}", methods=["GET", "POST"], include_in_schema=True)
async def callback(provider: str, request: Request):
    """Gateway return/notification URL. Parameters are never trusted: the status is re-checked with the gateway."""
    hit(f"pay-callback:{client_ip(request)}", 60, 600)
    adapter = await _adapter()
    if provider != adapter.name:
        raise HTTPException(404, "not_found")
    params = dict(request.query_params)
    if request.method == "POST":
        try:
            params |= dict(await request.form())
        except Exception:
            pass
    gid, status = await adapter.handle_callback(params)
    order = await db.payment_orders.find_one({"gateway_order_id": gid}) if gid else None
    if not order or status == "unknown":
        await audit("payment.callback_rejected", None, "order", gid or "?", {"provider": provider, "status": status}, client_ip(request))
        raise HTTPException(400, "callback_rejected")
    order = await settle(order, status, client_ip(request), source="callback")
    if order.get("platform") == "mobile":  # back to the app (deep link); the app then asks the server to confirm
        return RedirectResponse(f"{MOBILE_SCHEME}://payment/result?order={order['order_number']}", status_code=303)
    return RedirectResponse(f"{settings.frontend_url}/payment/result?order={order['order_number']}", status_code=303)


@router.post("/billing/orders/{number}/confirm")
async def confirm(number: str, request: Request, user: User = Depends(get_current_user)):
    o = await db.payment_orders.find_one({"order_number": number, "user_id": ObjectId(user.id)})
    if not o:
        raise HTTPException(404, "not_found")
    if o["status"] == "pending":
        o = await settle(o, await (await _adapter()).get_status(o["gateway_order_id"]), client_ip(request), source="confirm")
    out = _clean(o)
    sub = await active_subscription(user.id, [o["audience"]])
    out["subscription"] = _clean(sub) if sub else None
    return out


async def _invoice(number: str, user: User) -> dict:
    q = {"number": number}
    if not user.admin_role:
        q["user_id"] = ObjectId(user.id)
    inv = await db.invoices.find_one(q)
    if not inv:
        raise HTTPException(404, "not_found")
    return inv


@router.get("/billing/invoices/{number}")
async def invoice(number: str, user: User = Depends(get_current_user)):
    return _clean(await _invoice(number, user))


@router.get("/billing/invoices/{number}/pdf")
async def invoice_pdf_file(number: str, user: User = Depends(get_current_user)):
    inv = await _invoice(number, user)
    return Response(invoice_pdf(inv, await company_info()), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{inv["number"]}.pdf"'})


@router.get("/admin/payments")
async def admin_payments(status: str = "", page: int = 1, page_size: int = 30, _: User = Depends(require_admin("moderator", "support"))):
    q = {"status": status} if status else {}
    page_size = max(1, min(page_size, 100))
    total = await db.payment_orders.count_documents(q)
    docs = await db.payment_orders.find(q).sort("created_at", -1).skip((max(page, 1) - 1) * page_size).to_list(page_size)
    users = {u["_id"]: u async for u in db.users.find({"_id": {"$in": [d["user_id"] for d in docs]}}, {"email": 1, "full_name": 1})}
    revenue = await db.payment_orders.aggregate([{"$match": {"status": "paid"}}, {"$group": {"_id": None, "sum": {"$sum": "$amount_da"}}}]).to_list(1)
    return {"total": total, "revenue_da": revenue[0]["sum"] if revenue else 0,
            "items": [{**_clean(d), "user": {k: users.get(d["user_id"], {}).get(k) for k in ("email", "full_name")}} for d in docs]}
