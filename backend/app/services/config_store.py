from app.core.db import db
from app.data.defaults import DEFAULT_FLAGS, DEFAULT_SETTINGS, OBSOLETE_SETTINGS


async def is_enabled(key: str) -> bool:
    doc = await db.feature_flags.find_one({"key": key}, {"enabled": 1})
    return bool(doc and doc.get("enabled"))


async def get_setting(key: str):
    doc = await db.settings.find_one({"key": key}, {"value": 1})
    if doc is not None:
        return doc["value"]
    return next(s["value"] for s in DEFAULT_SETTINGS if s["key"] == key)


COMPANY_KEYS = ("company_name", "company_capital", "company_rc", "company_nif", "company_nis", "company_tax_article",
                "company_address", "contact_email", "contact_phone")


async def company_info() -> dict:
    """Seller identity (back-office "Société & mentions légales"), used on invoices."""
    return {k: await get_setting(k) for k in COMPANY_KEYS}


async def ensure_defaults():
    for f in DEFAULT_FLAGS:
        await db.feature_flags.update_one({"key": f["key"]}, {"$setOnInsert": f}, upsert=True)
    for s in DEFAULT_SETTINGS:
        await db.settings.update_one({"key": s["key"]}, {"$setOnInsert": s}, upsert=True)
    await db.settings.delete_many({"key": {"$in": OBSOLETE_SETTINGS}})
