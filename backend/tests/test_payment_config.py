"""Payment gateway configured from the back-office: super-admin only, encrypted password, never returned, audited."""
import pytest

from app.adapters.payment import SatimPaymentAdapter
from app.core.config import settings
from app.services import payment_config
from tests.conftest import Api, login, register, run

SATIM = {"environment": "test", "base_url": "https://satim.invalid/payment/rest", "username": "marchand", "terminal_id": "E010900001"}


def _super() -> Api:
    r = Api().post("/auth/login", json={"identifier": settings.admin_email, "password": settings.admin_password})
    return Api(r.json()["access_token"])


@pytest.fixture(autouse=True)
def _clean(mdb):
    run(mdb.payment_config.delete_many({}))
    yield
    run(mdb.payment_config.delete_many({}))


def test_only_super_admin_can_read_or_change():
    mod = login("moderateur@gofix.dz")
    assert mod.get("/admin/payment-config").status_code == 403
    assert mod.put("/admin/payment-config", json={"provider": "satim", "satim": SATIM | {"password": "x"}}).status_code == 403
    view = _super().get("/admin/payment-config").json()
    assert view["source"] == "env" and view["provider"] == "mock"
    assert view["callback_url"].endswith("/api/v1/billing/callback/satim")


def test_validation():
    sup = _super()
    assert sup.put("/admin/payment-config", json={"provider": "satim", "satim": SATIM}).json()["detail"] == "satim_incomplete"
    bad = SATIM | {"base_url": "http://satim.dz", "password": "x"}
    assert sup.put("/admin/payment-config", json={"provider": "satim", "satim": bad}).json()["detail"] == "invalid_url"


def test_password_encrypted_never_returned_and_kept(mdb):
    sup = _super()
    r = sup.put("/admin/payment-config", json={"provider": "satim", "satim": SATIM | {"password": "S3cret-Satim!"}})
    assert r.status_code == 200, r.text
    assert "S3cret-Satim!" not in r.text and r.json()["satim"]["password_set"] is True and r.json()["source"] == "database"
    doc = run(mdb.payment_config.find_one({"key": "default"}))
    assert "S3cret-Satim!" not in str(doc) and payment_config.decrypt(doc["satim"]["password_enc"]) == "S3cret-Satim!"
    # Saving again without a password keeps the stored one.
    r = sup.put("/admin/payment-config", json={"provider": "satim", "satim": SATIM | {"username": "marchand2"}})
    assert r.json()["satim"]["password_set"] is True
    assert run(payment_config.effective())["satim"]["password"] == "S3cret-Satim!"
    log = run(mdb.audit_logs.find_one({"action": "config.payment_change"}, sort=[("created_at", -1)]))
    assert "S3cret-Satim!" not in str(log) and log["meta"]["password_changed"] is False


def test_orders_follow_the_configured_gateway():
    sup = _super()
    sup.put("/admin/payment-config", json={"provider": "satim", "satim": SATIM | {"password": "x"}})
    c, _ = register()
    # SATIM is now in force: the (unreachable) test gateway is called instead of the mock page.
    assert c.post("/billing/orders", json={"plan_key": "client_pro"}).json()["detail"] == "payment_gateway_unavailable"
    sup.put("/admin/payment-config", json={"provider": "mock", "satim": SATIM})
    assert c.post("/billing/orders", json={"plan_key": "client_pro"}).status_code == 201


def test_mock_gateway_refused_in_production(monkeypatch):
    sup = _super()
    c, _ = register()
    monkeypatch.setattr(settings, "app_env", "production")
    assert sup.put("/admin/payment-config", json={"provider": "mock", "satim": SATIM}).json()["detail"] == "mock_not_allowed"
    assert sup.get("/admin/payment-config").json()["mock_allowed"] is False
    assert c.post("/billing/orders", json={"plan_key": "client_pro"}).json()["detail"] == "payment_unavailable"


def test_connection_test(monkeypatch):
    sup = _super()
    assert sup.post("/admin/payment-config/test").json()["detail"] == "satim_not_selected"
    sup.put("/admin/payment-config", json={"provider": "satim", "satim": SATIM | {"password": "x"}})

    async def refused(self, endpoint, params):
        return {"ErrorCode": "5", "ErrorMessage": "Access denied"}

    async def accepted(self, endpoint, params):
        return {"ErrorCode": "6", "ErrorMessage": "Order not found"}

    monkeypatch.setattr(SatimPaymentAdapter, "_call", refused)
    assert sup.post("/admin/payment-config/test").json() == {"ok": False, "reachable": True, "error_code": "5", "message": "Access denied"}
    monkeypatch.setattr(SatimPaymentAdapter, "_call", accepted)
    assert sup.post("/admin/payment-config/test").json()["ok"] is True
