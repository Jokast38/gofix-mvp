"""Subscription engine. An order is settled only from a server-side status check (never from the front),
and settlement is idempotent: the pending -> processing transition is atomic, so double callbacks are no-ops."""
from datetime import datetime, timedelta, timezone

from fpdf import FPDF
from pymongo import ReturnDocument

from app.core.db import db
from app.core.logging import get_logger
from app.models.user import User
from app.services.audit import audit
from app.services.entitlements import active_subscription
from app.services.notify import notify

log = get_logger("billing")
FINAL = ("paid", "failed", "cancelled")


def _now():
    return datetime.now(timezone.utc)


async def _activate(order: dict, ip: str | None):
    now = _now()
    uid = order["user_id"]
    user = User.from_mongo(await db.users.find_one({"_id": uid}))
    current = await active_subscription(uid, [order["audience"]])
    start = current["ends_at"] if current and current.get("tier") == order["tier"] else now
    ends = start + timedelta(days=order["duration_days"])
    if current and current.get("tier") != order["tier"]:
        await db.subscriptions.update_one({"_id": current["_id"]}, {"$set": {"status": "replaced", "updated_at": now}})
    sub = {"user_id": uid, "plan_key": order["plan_key"], "tier": order["tier"], "audience": order["audience"], "status": "active",
           "starts_at": start, "ends_at": ends, "order_id": order["_id"], "reminders_sent": [], "created_at": now, "updated_at": now}
    sub_id = (await db.subscriptions.insert_one(sub)).inserted_id
    inv_number = f"INV-{now:%Y}-{await db.invoices.count_documents({}) + 1:06d}"
    await db.invoices.insert_one({"number": inv_number, "user_id": uid, "order_id": order["_id"], "order_number": order["order_number"],
                                  "plan_name": order["plan_name"], "amount_da": order["amount_da"], "currency": "DZD",
                                  "provider": order["provider"], "paid_at": now, "period": {"from": start, "to": ends},
                                  "customer": {"name": user.full_name if user else "", "email": user.email if user else None,
                                               "phone": user.phone if user else None}, "created_at": now})
    if order["audience"] == "professional":
        for coll in (db.professional_profiles, db.teacher_profiles):
            await coll.update_one({"user_id": uid}, {"$set": {"plan_key": order["plan_key"]}})
        # Requests received while the free access was exhausted become readable.
        await db.requests.update_many({"recipients": {"$elemMatch": {"provider_user_id": uid, "locked": True}}},
                                      {"$set": {"recipients.$[r].locked": False}},
                                      array_filters=[{"r.provider_user_id": uid, "r.locked": True}])
    await db.payment_orders.update_one({"_id": order["_id"]}, {"$set": {"status": "paid", "paid_at": now, "subscription_id": sub_id,
                                                                        "invoice_number": inv_number, "updated_at": now}})
    await audit("subscription.activated", user, "order", order["order_number"],
                {"invoice": inv_number, "plan": order["plan_key"], "ends_at": ends.isoformat()}, ip)
    await notify(uid, "payment", f"Paiement confirmé – {order['plan_name']}",
                 f"Votre abonnement {order['plan_name']} est actif jusqu'au {ends:%d/%m/%Y}. Facture {inv_number}.", "/account/billing")


async def settle(order: dict, status: str, ip: str | None = None, source: str = "confirm") -> dict:
    """Apply a server-verified gateway status. Safe to call any number of times."""
    if status not in FINAL:
        return order
    claimed = await db.payment_orders.find_one_and_update({"_id": order["_id"], "status": "pending"},
                                                          {"$set": {"status": "processing", "updated_at": _now()}},
                                                          return_document=ReturnDocument.AFTER)
    if not claimed:
        log.info("settle_noop", extra={"ctx": {"order": order["order_number"], "status": status, "source": source}})
        return await db.payment_orders.find_one({"_id": order["_id"]})
    try:
        if status == "paid":
            await _activate(claimed, ip)
        else:
            await db.payment_orders.update_one({"_id": claimed["_id"]}, {"$set": {"status": status, "updated_at": _now()}})
            user = User.from_mongo(await db.users.find_one({"_id": claimed["user_id"]}))
            await audit(f"payment.{status}", user, "order", claimed["order_number"], {"source": source}, ip)
    except Exception:
        await db.payment_orders.update_one({"_id": claimed["_id"]}, {"$set": {"status": "pending", "updated_at": _now()}})
        raise
    return await db.payment_orders.find_one({"_id": order["_id"]})


def _latin(s) -> str:
    return str(s if s is not None else "").replace("–", "-").replace("’", "'").encode("latin-1", "replace").decode("latin-1")


def invoice_pdf(inv: dict, company: dict | None = None) -> bytes:
    company = company or {}
    missing = "[à compléter]"
    pdf = FPDF(format="A4")
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 22)
    pdf.cell(0, 12, _latin(company.get("company_name") or "GoFix"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, _latin("Plateforme de mise en relation - Algérie"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, _latin(f"Facture {inv['number']}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    paid = inv.get("paid_at")
    period = inv.get("period") or {}
    c = inv.get("customer") or {}
    rows = [("Date de paiement", f"{paid:%d/%m/%Y}" if paid else ""), ("Commande", inv.get("order_number")),
            ("Client", c.get("name")), ("E-mail", c.get("email") or "-"), ("Téléphone", c.get("phone") or "-"),
            ("Moyen de paiement", "CIB / Edahabia (SATIM)" if inv.get("provider") == "satim" else "Démonstration (mock)")]
    for k, v in rows:
        pdf.cell(55, 8, _latin(k))
        pdf.cell(0, 8, _latin(v), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(120, 9, _latin("Désignation"), border=1)
    pdf.cell(0, 9, "Montant", border=1, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    label = f"Abonnement {inv.get('plan_name')}"
    if period.get("from") and period.get("to"):
        label += f" du {period['from']:%d/%m/%Y} au {period['to']:%d/%m/%Y}"
    amount = f"{inv.get('amount_da', 0):,}".replace(",", " ") + " DA"
    pdf.cell(120, 9, _latin(label), border=1)
    pdf.cell(0, 9, amount, border=1, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(120, 10, "Total TTC", border=1)
    pdf.cell(0, 10, amount, border=1, align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 8)
    seller = [company.get("company_name") or missing,
              f"Capital : {company['company_capital']}" if company.get("company_capital") else None,
              f"RC n° {company.get('company_rc') or missing}", f"NIF {company.get('company_nif') or missing}",
              f"NIS {company['company_nis']}" if company.get("company_nis") else None,
              f"Article d'imposition {company.get('company_tax_article') or missing}",
              company.get("company_address") or missing,
              " - ".join(x for x in (company.get("contact_email"), company.get("contact_phone")) if x) or None]
    pdf.multi_cell(0, 5, _latin(" | ".join(x for x in seller if x)))
    return bytes(pdf.output())
