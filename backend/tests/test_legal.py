"""Company identity & legal notices, editable by the super-admin, public for the legal pages, printed on invoices."""
import re
import zlib
from datetime import datetime, timezone

from app.core.config import settings
from app.services.billing import invoice_pdf
from tests.conftest import Api, login, run


def _super() -> Api:
    r = Api().post("/auth/login", json={"identifier": settings.admin_email, "password": settings.admin_password})
    return Api(r.json()["access_token"])


def _pdf_text(data: bytes) -> str:
    out = []
    for m in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", data, re.S):
        try:
            out.append(zlib.decompress(m.group(1)).decode("latin-1"))
        except zlib.error:
            out.append(m.group(1).decode("latin-1", "ignore"))
    return "".join(out)


def test_company_fields_are_public_and_super_admin_only(mdb):
    cfg = Api().get("/config").json()["settings"]
    for k in ("company_name", "company_rc", "company_nif", "company_address", "contact_email", "abuse_email", "legal_version", "legal_reviewed"):
        assert k in cfg, k
    assert cfg["company_name"] == "GoFix DIGITAL S.A.R.L" and cfg["legal_reviewed"] is False
    assert login("moderateur@gofix.dz").put("/admin/settings/company_rc", json={"value": "16/00-1234567B26"}).status_code == 403
    sup = _super()
    assert sup.put("/admin/settings/contact_email", json={"value": "pas-un-email"}).json()["detail"] == "email_invalid"
    assert sup.put("/admin/settings/contact_email", json={"value": "contact@gofix-digital.dz"}).status_code == 200
    assert sup.put("/admin/settings/company_rc", json={"value": "16/00-1234567B26"}).status_code == 200
    assert Api().get("/config").json()["settings"]["company_rc"] == "16/00-1234567B26"
    for k, v in (("contact_email", ""), ("company_rc", "")):
        sup.put(f"/admin/settings/{k}", json={"value": v})


def test_invoice_shows_the_seller_identity():
    inv = {"number": "GF-F-0001", "paid_at": datetime.now(timezone.utc), "order_number": "GF-1", "plan_name": "Pro", "amount_da": 1500,
           "customer": {"name": "Client Test"}, "provider": "satim"}
    company = {"company_name": "GoFix DIGITAL S.A.R.L", "company_rc": "16/00-1234567B26", "company_nif": "000216123456789",
               "company_tax_article": "16012345678", "company_address": "Alger", "contact_email": "contact@gofix-digital.dz"}
    text = _pdf_text(invoice_pdf(inv, company))
    for needle in ("16/00-1234567B26", "000216123456789", "16012345678", "contact@gofix-digital.dz"):
        assert needle in text, needle
    assert "[à compléter]".encode("latin-1").decode("latin-1") in _pdf_text(invoice_pdf(inv, {}))
