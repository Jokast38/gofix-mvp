from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.db import db
from app.core.deps import client_ip, get_optional_user
from app.core.phone import normalize_dz_phone
from app.core.ratelimit import hit
from app.models.user import Consent, User

router = APIRouter(tags=["public"])


class CookieConsentIn(BaseModel):
    choice: Literal["accepted", "refused"]
    anonymous_id: str = Field(min_length=8, max_length=64)


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    subject: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=10, max_length=3000)

    @field_validator("phone")
    @classmethod
    def _p(cls, v):
        return normalize_dz_phone(v) if v else v


@router.get("/config")
async def public_config():
    flags = await db.feature_flags.find({}, {"_id": 0, "key": 1, "enabled": 1}).to_list(200)
    sets = await db.settings.find({"public": True}, {"_id": 0, "key": 1, "value": 1}).to_list(200)
    return {"flags": {f["key"]: f["enabled"] for f in flags}, "settings": {s["key"]: s["value"] for s in sets},
            "languages": ["fr", "ar"], "currency": "DZD", "timezone": "Africa/Algiers"}


@router.post("/consents/cookies", status_code=201)
async def cookie_consent(body: CookieConsentIn, request: Request, user: User | None = Depends(get_optional_user)):
    hit(f"cookies:{client_ip(request)}", 20, 3600)
    c = Consent(type="cookies", choice=body.choice, anonymous_id=body.anonymous_id, ip=client_ip(request)).to_mongo()
    if user:
        c["user_id"] = ObjectId(user.id)
    await db.consents.insert_one(c)
    return {"recorded": True}


@router.post("/contact", status_code=201)
async def contact(body: ContactIn, request: Request, user: User | None = Depends(get_optional_user)):
    hit(f"contact:{client_ip(request)}", 5, 3600)
    doc = {**body.model_dump(), "source": "contact_form", "status": "open",
           "user_id": ObjectId(user.id) if user else None, "created_at": datetime.now(timezone.utc)}
    res = await db.support_tickets.insert_one(doc)
    return {"ticket_id": str(res.inserted_id)}


@router.get("/faq")
async def faq(lang: Literal["fr", "ar"] = "fr"):
    docs = await db.faq_entries.find({"active": True}, {"variants": 0}).sort([("category", 1), ("order", 1)]).to_list(500)
    return [{k: v for k, v in d.items() if k != "_id"} | {"id": str(d["_id"])} for d in docs]
