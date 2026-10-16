"""Security audit regressions: brute force, IP spoofing, admin privileges, reset tokens, uploads, erasure, production guards."""
from datetime import datetime, timedelta, timezone
import io

from bson import ObjectId
from PIL import Image

from app.core.config import settings
from app.core.security import sha256
from app.core.safety import production_problems
from tests.conftest import Api, login, register, run


def _login(email, password, **headers):
    return Api().post("/auth/login", json={"identifier": email, "password": password}, headers=headers)


def test_spoofed_forwarded_for_does_not_bypass_lockout(mdb):
    _, u = register()
    for i in range(5):
        assert _login(u["email"], "Wrong1234", **{"X-Forwarded-For": f"10.0.0.{i}"}).status_code == 401
    # Locked for this IP, whatever X-Forwarded-For says — even with the right password.
    assert _login(u["email"], "Secret123", **{"X-Forwarded-For": "10.9.9.9"}).status_code == 429


def test_account_locked_after_failures_from_many_ips(mdb):
    _, u = register()
    for i in range(10):
        assert _login(u["email"], "Wrong1234", **{"X-Real-IP": f"192.0.2.{i}"}).status_code == 401
    assert _login(u["email"], "Secret123", **{"X-Real-IP": "198.51.100.7"}).status_code == 429


def test_successful_login_clears_counters(mdb):
    _, u = register()
    for _ in range(3):
        _login(u["email"], "Wrong1234")
    assert _login(u["email"], "Secret123").status_code == 200
    assert not run(mdb.login_attempts.find_one({"identifier": f"acct:{u['email']}"}))


def test_moderator_cannot_suspend_an_admin(mdb):
    mod = login("moderateur@gofix.dz")
    admin = run(mdb.users.find_one({"email": settings.admin_email}))
    r = mod.patch(f"/admin/users/{admin['_id']}/status", json={"status": "suspended", "reason": "Test audit"})
    assert r.status_code == 403
    assert run(mdb.users.find_one({"_id": admin["_id"]}))["status"] == "active"
    _, client = register()
    assert mod.patch(f"/admin/users/{client['id']}/status", json={"status": "suspended", "reason": "Test audit"}).status_code == 200


def test_audit_log_filter_is_not_a_regex(mdb):
    sup = Api(Api().post("/auth/login", json={"identifier": settings.admin_email, "password": settings.admin_password}).json()["access_token"])
    assert sup.get("/admin/audit-logs", params={"action": "(a+)+$"}).status_code == 200


def test_reset_token_is_single_use(mdb):
    _, u = register()
    token = "x" * 40
    now = datetime.now(timezone.utc)
    run(mdb.password_reset_tokens.insert_one({"token_hash": sha256(token), "user_id": ObjectId(u["id"]), "used": False,
                                              "created_at": now, "expires_at": now + timedelta(hours=1)}))
    assert Api().post("/auth/password/reset", json={"token": token, "new_password": "Nouveau123"}).status_code == 204
    assert Api().post("/auth/password/reset", json={"token": token, "new_password": "Pirate123"}).status_code == 400
    assert _login(u["email"], "Nouveau123").status_code == 200


def test_document_content_must_match_its_type():
    pro = login("attente.pro@gofix.dz")
    fake = pro.post("/provider/documents", data={"doc_type": "id_card"}, files={"file": ("id.pdf", b"<html><script>alert(1)</script>", "application/pdf")})
    assert fake.status_code == 415
    disguised = pro.post("/provider/documents", data={"doc_type": "id_card"}, files={"file": ("id.png", b"%PDF-1.4 fake", "image/png")})
    assert disguised.status_code == 415
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(buf, "PNG")
    ok = pro.post("/provider/documents", data={"doc_type": "id_card"}, files={"file": ("id.png", buf.getvalue(), "image/png")})
    assert ok.status_code == 201, ok.text
    pdf = pro.post("/provider/documents", data={"doc_type": "id_card"}, files={"file": ("id.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")})
    assert pdf.status_code == 201, pdf.text


def test_account_deletion_erases_personal_data(mdb):
    c, u = register()
    uid = ObjectId(u["id"])
    now = datetime.now(timezone.utc)
    rid = run(mdb.requests.insert_one({"client_id": uid, "client_name": u["full_name"], "created_at": now})).inserted_id
    vid = run(mdb.reviews.insert_one({"client_id": uid, "author_name": "Test U.", "rating": 5, "created_at": now})).inserted_id
    run(mdb.favorites.insert_one({"user_id": uid, "profile_id": ObjectId(), "created_at": now}))
    r = c._req("DELETE", "/users/me", json={"password": "Secret123"})
    assert r.status_code == 204, r.text
    doc = run(mdb.users.find_one({"_id": uid}))
    assert doc["status"] == "deleted" and "email" not in doc and "phone" not in doc
    assert run(mdb.requests.find_one({"_id": rid}))["client_name"] == "Compte supprimé"
    assert run(mdb.reviews.find_one({"_id": vid}))["author_name"] == "Compte supprimé"
    assert run(mdb.favorites.count_documents({"user_id": uid})) == 0
    assert _login(u["email"], "Secret123").status_code == 401


def test_mock_payment_is_refused_in_production(monkeypatch):
    c, _ = register()
    o = c.post("/billing/orders", json={"plan_key": "client_pro"}).json()
    monkeypatch.setattr(settings, "app_env", "production")
    assert c.post(f"/billing/mock/{o['gateway_order_id']}/simulate", json={"outcome": "paid"}).status_code == 403
    assert c.get(f"/billing/mock/{o['gateway_order_id']}").status_code == 403


def test_production_refuses_unsafe_configuration(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "change-me")
    monkeypatch.setattr(settings, "admin_password", "admin")
    monkeypatch.setattr(settings, "frontend_url", "http://gofix.dz")
    monkeypatch.setattr(settings, "cors_origins", ["https://gofix.dz", "http://localhost:3000"])
    errors, _ = production_problems()
    assert len(errors) == 4  # the payment gateway is configured in the back-office, not a startup blocker
    monkeypatch.setattr(settings, "jwt_secret", "a" * 16 + "9f" * 16)
    monkeypatch.setattr(settings, "admin_password", "Tr3s-Solide-2026")
    monkeypatch.setattr(settings, "frontend_url", "https://gofix.dz")
    monkeypatch.setattr(settings, "cors_origins", ["https://gofix.dz"])
    monkeypatch.setattr(settings, "payment_provider", "satim")
    assert production_problems()[0] == []


def test_api_sets_no_store_and_security_headers():
    r = Api().get("/health")
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["x-content-type-options"] == "nosniff"


def test_support_reads_category_requests_but_cannot_decide():
    sup = login("support@gofix.dz")
    assert sup.get("/admin/category-requests").status_code == 200
    assert sup.patch("/admin/category-requests/000000000000000000000000", json={"status": "rejected"}).status_code == 403
