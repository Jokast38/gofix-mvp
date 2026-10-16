"""Super-admin creates staff (back-office) and platform accounts: role checks, one-time temporary password, invitation link."""
import re

from app.adapters import email as email_adapter
from app.core.config import settings
from tests.conftest import Api, login, run


def _super() -> Api:
    r = Api().post("/auth/login", json={"identifier": settings.admin_email, "password": settings.admin_password})
    return Api(r.json()["access_token"])


def test_only_super_admin_can_create():
    body = {"kind": "client", "full_name": "Test Client", "email": "x.only@gofix.dz"}
    assert login("moderateur@gofix.dz").post("/admin/users", json=body).status_code == 403
    assert login("support@gofix.dz").post("/admin/users", json=body).status_code == 403
    assert Api().post("/admin/users", json=body).status_code == 401


def test_create_staff_member_with_temporary_password(mdb):
    sup = _super()
    r = sup.post("/admin/users", json={"kind": "staff", "full_name": "Redha Collègue", "email": "Redha.Staff@GoFix.dz",
                                       "admin_role": "moderator", "send_invite": False})
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["user"]["email"] == "redha.staff@gofix.dz" and out["user"]["admin_role"] == "moderator"
    assert "password_hash" not in r.text and out["invite_sent"] is False
    temp = out["temporary_password"]
    assert len(temp) >= 12 and re.search(r"\d", temp) and re.search(r"[A-Za-z]", temp)
    # The temporary password works and gives back-office access with the chosen role.
    tok = Api().post("/auth/login", json={"identifier": "redha.staff@gofix.dz", "password": temp}).json()
    assert tok["user"]["admin_role"] == "moderator"
    assert Api(tok["access_token"]).get("/admin/users").status_code == 200
    doc = run(mdb.users.find_one({"email": "redha.staff@gofix.dz"}))
    assert temp not in str(doc) and doc["created_by"] == settings.admin_email
    log = run(mdb.audit_logs.find_one({"action": "admin.user_create", "target_id": str(doc["_id"])}))
    assert log and temp not in str(log)


def test_create_client_account_types():
    sup = _super()
    r = sup.post("/admin/users", json={"kind": "client", "full_name": "Prof Créé", "email": "prof.cree@gofix.dz",
                                       "phone": "0662 98 76 54", "account_type": "teacher", "admin_role": "super_admin", "send_invite": False})
    assert r.status_code == 201, r.text
    u = r.json()["user"]
    assert u["roles"] == ["client", "teacher"] and u["phone"] == "+213662987654"
    assert u["admin_role"] is None  # an admin role is never given through the "client" form


def test_validation_and_duplicates():
    sup = _super()
    assert sup.post("/admin/users", json={"kind": "staff", "full_name": "Sans Rôle", "email": "norole@gofix.dz"}).json()["detail"] == "admin_role_required"
    assert sup.post("/admin/users", json={"kind": "client", "full_name": "Mauvais", "email": "pas-un-mail"}).json()["detail"] == "email_invalid"
    assert sup.post("/admin/users", json={"kind": "client", "full_name": "Tel", "email": "tel@gofix.dz", "phone": "123"}).json()["detail"] == "phone_invalid"
    assert sup.post("/admin/users", json={"kind": "client", "full_name": "Doublon", "email": "client@gofix.dz"}).json()["detail"] == "email_taken"
    assert sup.post("/admin/users", json={"kind": "client", "full_name": "Doublon", "email": "new.dup@gofix.dz",
                                          "phone": "+213550000001"}).json()["detail"] == "phone_taken"


def test_invitation_link_lets_the_person_choose_a_password(monkeypatch):
    sent = []

    async def capture(self, to, subject, body):
        sent.append((to, subject, body))
        return True
    monkeypatch.setattr(email_adapter.ConfiguredEmailAdapter, "send", capture)
    r = _super().post("/admin/users", json={"kind": "staff", "full_name": "Agent Support", "email": "agent.invite@gofix.dz",
                                            "admin_role": "support", "preferred_language": "ar"})
    assert r.json()["invite_sent"] is True
    to, subject, body = sent[-1]
    assert to == "agent.invite@gofix.dz" and "GoFix" in subject and "عون دعم" in body
    token = re.search(r"reset-password\?token=([\w-]+)", body).group(1)
    assert Api().post("/auth/password/reset", json={"token": token, "new_password": "MonChoix2026"}).status_code == 204
    ok = Api().post("/auth/login", json={"identifier": "agent.invite@gofix.dz", "password": "MonChoix2026"})
    assert ok.status_code == 200 and ok.json()["user"]["admin_role"] == "support"
