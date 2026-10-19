"""Super-admin: sponsored banners (brands advertising on GoFix): image, link, placements, dates, statistics."""
from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from app.adapters.storage import get_storage
from app.core.db import db
from app.core.deps import client_ip, require_admin
from app.models.user import User
from app.services.audit import audit

router = APIRouter(prefix="/admin", tags=["admin-promo"])


class BannerIn(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    advertiser: str = Field(min_length=2, max_length=80)
    link_url: str = Field(min_length=1, max_length=500)
    alt: str = Field(default="", max_length=160)
    placements: list[Literal["home", "search"]] = Field(default_factory=lambda: ["home"], min_length=1)
    active: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    order: int = Field(default=0, ge=0, le=999)


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except InvalidId:
        raise HTTPException(404, "not_found")


def _check(body: BannerIn) -> dict:
    link = body.link_url.strip()
    # External sites in https only; "/..." = a page of GoFix itself (e.g. /contact). Never javascript:, http:, //host.
    if not (link.startswith("https://") or (link.startswith("/") and not link.startswith("//"))):
        raise HTTPException(422, "invalid_link")
    if body.starts_at and body.ends_at and body.ends_at <= body.starts_at:
        raise HTTPException(422, "invalid_dates")
    return body.model_dump() | {"link_url": link, "title": body.title.strip(), "advertiser": body.advertiser.strip()}


def _view(b: dict) -> dict:
    out = {k: v for k, v in b.items() if k != "_id"} | {"id": str(b["_id"])}
    out["ctr"] = round(100 * b.get("clicks", 0) / b["impressions"], 2) if b.get("impressions") else 0
    return out


@router.get("/banners")
async def list_banners(_: User = Depends(require_admin("super_admin"))):
    return [_view(b) for b in await db.ad_banners.find().sort([("order", 1), ("created_at", -1)]).to_list(200)]


@router.post("/banners", status_code=201)
async def create_banner(body: BannerIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    now = datetime.now(timezone.utc)
    doc = _check(body) | {"image_key": None, "image_thumb_key": None, "impressions": 0, "clicks": 0,
                          "created_at": now, "updated_at": now, "created_by": admin.email}
    res = await db.ad_banners.insert_one(doc)
    await audit("promo.banner_create", admin, "banner", str(res.inserted_id), {"advertiser": doc["advertiser"], "link": doc["link_url"]}, client_ip(request))
    return _view(await db.ad_banners.find_one({"_id": res.inserted_id}))


@router.put("/banners/{banner_id}")
async def update_banner(banner_id: str, body: BannerIn, request: Request, admin: User = Depends(require_admin("super_admin"))):
    upd = _check(body) | {"updated_at": datetime.now(timezone.utc)}
    b = await db.ad_banners.find_one_and_update({"_id": _oid(banner_id)}, {"$set": upd}, return_document=True)
    if not b:
        raise HTTPException(404, "not_found")
    await audit("promo.banner_update", admin, "banner", banner_id, {"active": upd["active"], "link": upd["link_url"]}, client_ip(request))
    return _view(b)


@router.post("/banners/{banner_id}/image")
async def upload_banner_image(banner_id: str, file: UploadFile = File(...), admin: User = Depends(require_admin("super_admin"))):
    """Image re-encoded to WebP, cropped to 3:1 (1200x400). Recommended upload: 1200x400 or larger, text kept centred."""
    from app.api.v1.provider import read_image
    b = await db.ad_banners.find_one({"_id": _oid(banner_id)})
    if not b:
        raise HTTPException(404, "not_found")
    keys = await read_image(file, "banner", "promo")
    keys = {"image_key": keys["banner_key"], "image_thumb_key": keys["banner_thumb_key"]}
    await db.ad_banners.update_one({"_id": b["_id"]}, {"$set": keys | {"updated_at": datetime.now(timezone.utc)}})
    for k in (b.get("image_key"), b.get("image_thumb_key")):
        if k:
            get_storage().delete(k)
    return _view(await db.ad_banners.find_one({"_id": b["_id"]}))


@router.delete("/banners/{banner_id}", status_code=204)
async def delete_banner(banner_id: str, request: Request, admin: User = Depends(require_admin("super_admin"))):
    b = await db.ad_banners.find_one_and_delete({"_id": _oid(banner_id)})
    if not b:
        raise HTTPException(404, "not_found")
    for k in (b.get("image_key"), b.get("image_thumb_key")):
        if k:
            get_storage().delete(k)
    await audit("promo.banner_delete", admin, "banner", banner_id,
                {"advertiser": b.get("advertiser"), "impressions": b.get("impressions", 0), "clicks": b.get("clicks", 0)}, client_ip(request))
