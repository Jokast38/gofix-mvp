"""Outgoing e-mail configured from the back-office: super-admin only, encrypted password, never returned, audited, used at send time."""
import smtplib

import pytest

from app.adapters import email as email_adapter
from app.core.config import settings
from app.services import email_config
from tests.conftest import Api, login, run

SMTP = {"host": "smtp.gofix.invalid", "port": 465, "security": "ssl", "username": "no-reply@gofix-digital.dz",
        "from_email": "no-reply@gofix-digital.dz", "from_name": "GoFix", "reply_to": "contact@gofix-digital.dz"}


def _super() -> Api:
    r = Api().post("/auth/login", json={"identifier": settings.admin_email, "password": settings.admin_password})
    return Api(r.json()["access_token"])


@pytest.fixture(autouse=True)
def _clean(mdb):
    run(mdb.email_config.delete_many({}))
    yield
    run(mdb.email_config.delete_many({}))


class FakeSMTP:
    sent = []
    fail = None

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def starttls(self):
        pass

    def login(self, user, password):
        if FakeSMTP.fail == "auth":
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")
        self.creds = (user, password)

    def send_message(self, msg):
        FakeSMTP.sent.append({"host": self.host, "port": self.port, "creds": self.creds, "from": msg["From"], "to": msg["To"],
                              "reply_to": msg["Reply-To"], "subject": msg["Subject"]})


@pytest.fixture
def fake_smtp(monkeypatch):
    FakeSMTP.sent, FakeSMTP.fail = [], None
    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    return FakeSMTP


def test_only_super_admin_and_env_default():
    mod = login("moderateur@gofix.dz")
    assert mod.get("/admin/email-config").status_code == 403
    assert mod.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"password": "x"}}).status_code == 403
    view = _super().get("/admin/email-config").json()
    assert view["source"] == "env" and view["provider"] == "console"


def test_validation():
    sup = _super()
    assert sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP}).json()["detail"] == "smtp_incomplete"
    assert sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"from_email": "", "password": "x"}}).json()["detail"] == "smtp_incomplete"
    assert sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"reply_to": "pas-un-mail", "password": "x"}}).json()["detail"] == "email_invalid"
    assert sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"host": "https://smtp.x.dz", "password": "x"}}).json()["detail"] == "invalid_host"
    assert sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"port": 70000, "password": "x"}}).status_code == 422


def test_password_encrypted_never_returned_and_kept(mdb):
    sup = _super()
    r = sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"password": "Mb0x-Secret!"}})
    assert r.status_code == 200, r.text
    assert "Mb0x-Secret!" not in r.text and r.json()["smtp"]["password_set"] is True and r.json()["complete"] is True
    doc = run(mdb.email_config.find_one({"key": "default"}))
    assert "Mb0x-Secret!" not in str(doc)
    r = sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"from_name": "GoFix DZ"}})
    assert r.json()["smtp"]["password_set"] is True and run(email_config.effective())["smtp"]["password"] == "Mb0x-Secret!"
    log = run(mdb.audit_logs.find_one({"action": "config.email_change"}, sort=[("created_at", -1)]))
    assert "Mb0x-Secret!" not in str(log) and log["meta"]["password_changed"] is False


def test_platform_mails_use_the_saved_configuration(fake_smtp):
    sup = _super()
    sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"password": "Mb0x-Secret!"}})
    # Forgotten password: sent through the configured server, sender and reply-to — no restart needed.
    assert Api().post("/auth/password/forgot", json={"email": "client@gofix.dz"}).status_code == 202
    mail = fake_smtp.sent[-1]
    assert (mail["host"], mail["port"], mail["to"]) == ("smtp.gofix.invalid", 465, "client@gofix.dz")
    assert mail["creds"] == ("no-reply@gofix-digital.dz", "Mb0x-Secret!")
    assert "no-reply@gofix-digital.dz" in mail["from"] and mail["reply_to"] == "contact@gofix-digital.dz"
    # Back to console mode: nothing leaves the server.
    sup.put("/admin/email-config", json={"provider": "console", "smtp": SMTP})
    n = len(fake_smtp.sent)
    run(email_adapter.get_email_adapter().send("x@gofix.dz", "s", "b"))
    assert len(fake_smtp.sent) == n


def test_send_test_mail(fake_smtp, mdb):
    sup = _super()
    assert sup.post("/admin/email-config/test", json={"to": "admin@gofix.dz"}).json()["detail"] == "smtp_not_selected"
    sup.put("/admin/email-config", json={"provider": "smtp", "smtp": SMTP | {"password": "x"}})
    assert sup.post("/admin/email-config/test", json={"to": "nope"}).json()["detail"] == "email_invalid"
    r = sup.post("/admin/email-config/test", json={"to": "admin@gofix.dz"}).json()
    assert r["ok"] is True and fake_smtp.sent[-1]["to"] == "admin@gofix.dz"
    fake_smtp.fail = "auth"
    r = sup.post("/admin/email-config/test", json={"to": "admin@gofix.dz"}).json()
    assert r == {"ok": False, "stage": "auth", "message": "535"}
    assert run(mdb.audit_logs.count_documents({"action": "config.email_test"})) >= 2
