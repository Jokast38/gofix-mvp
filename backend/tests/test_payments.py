"""P4 — subscriptions only activate after server-side confirmation; failures, cancels, doubles and forgeries break nothing."""
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.services import scheduler
from app.services.entitlements import user_tier
from app.models.user import User
from tests.conftest import Api, register, run


def _order(c: Api, plan="client_pro") -> dict:
    r = c.post("/billing/orders", json={"plan_key": plan})
    assert r.status_code == 201, r.text
    return r.json()


def _subs(mdb, uid):
    return run(mdb.subscriptions.count_documents({"user_id": ObjectId(uid), "status": "active"}))


def test_paid_order_activates_once_even_with_double_callback(mdb):
    c, user = register()
    o = _order(c)
    assert c.post(f"/billing/mock/{o['gateway_order_id']}/simulate", json={"outcome": "paid"}).status_code == 200
    assert _subs(mdb, user["id"]) == 0  # the mock page alone activates nothing
    for _ in range(3):
        r = Api().get(f"/billing/callback/mock?orderId={o['gateway_order_id']}", follow_redirects=False)
        assert r.status_code == 303 and o["order_number"] in r.headers["location"]
    assert c.post(f"/billing/orders/{o['order_number']}/confirm").json()["status"] == "paid"
    assert _subs(mdb, user["id"]) == 1
    assert run(mdb.invoices.count_documents({"user_id": ObjectId(user["id"])})) == 1
    me = c.get("/billing/me").json()
    pdf = c.get(f"/billing/invoices/{me['invoices'][0]['number']}/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_failed_and_cancelled_payments(mdb):
    for outcome in ("failed", "cancelled"):
        c, user = register()
        o = _order(c)
        c.post(f"/billing/mock/{o['gateway_order_id']}/simulate", json={"outcome": outcome})
        r = c.post(f"/billing/orders/{o['order_number']}/confirm").json()
        assert r["status"] == outcome and r["subscription"] is None
        assert _subs(mdb, user["id"]) == 0
        # a late "paid" callback after a final state changes nothing
        c.post(f"/billing/mock/{o['gateway_order_id']}/simulate", json={"outcome": "paid"})
        Api().get(f"/billing/callback/mock?orderId={o['gateway_order_id']}", follow_redirects=False)
        assert _subs(mdb, user["id"]) == 0


def test_forged_callbacks_are_refused(mdb):
    c, user = register()
    r = Api().get("/billing/callback/mock?orderId=MOCK-forged&status=paid", follow_redirects=False)
    assert r.status_code == 400
    o = _order(c)
    # real order id, but the gateway says it is still pending: "status=paid" in the URL is ignored
    Api().get(f"/billing/callback/mock?orderId={o['gateway_order_id']}&status=paid&OrderStatus=2", follow_redirects=False)
    assert run(mdb.payment_orders.find_one({"order_number": o["order_number"]}))["status"] == "pending"
    assert _subs(mdb, user["id"]) == 0
    assert Api().get("/billing/callback/satim?orderId=x", follow_redirects=False).status_code == 404
    assert run(mdb.audit_logs.count_documents({"action": "payment.callback_rejected"})) >= 1


def test_double_click_reuses_pending_order():
    c, _ = register()
    a, b = _order(c), _order(c)
    assert a["order_number"] == b["order_number"] and b.get("reused")


def test_subscription_expiry_and_stale_orders(mdb):
    c, user = register()
    o = _order(c)
    c.post(f"/billing/mock/{o['gateway_order_id']}/simulate", json={"outcome": "paid"})
    c.post(f"/billing/orders/{o['order_number']}/confirm")
    u = User.from_mongo(run(mdb.users.find_one({"_id": ObjectId(user["id"])})))
    assert run(user_tier(u)) == "pro"
    stale = _order(c, "client_premium")
    past = datetime.now(timezone.utc) - timedelta(hours=2)
    run(mdb.payment_orders.update_one({"order_number": stale["order_number"]}, {"$set": {"created_at": past}}))
    run(mdb.subscriptions.update_one({"user_id": ObjectId(user["id"]), "status": "active"}, {"$set": {"ends_at": past}}))
    out = run(scheduler.run_once())
    assert out["expired"] >= 1 and out["orders_expired"] >= 1
    assert run(user_tier(u)) == "free"
    assert run(mdb.payment_orders.find_one({"order_number": stale["order_number"]}))["status"] == "expired"


def test_renewal_reminder_sent_once(mdb):
    c, user = register()
    uid = ObjectId(user["id"])
    now = datetime.now(timezone.utc)
    run(mdb.subscriptions.insert_one({"user_id": uid, "plan_key": "client_pro", "tier": "pro", "audience": "client", "status": "active",
                                      "starts_at": now, "ends_at": now + timedelta(days=2, hours=12), "reminders_sent": []}))
    run(scheduler.run_once())
    run(scheduler.run_once())
    assert run(mdb.notifications.count_documents({"user_id": uid, "type": "subscription_reminder"})) == 1
