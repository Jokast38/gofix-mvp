from fastapi import APIRouter, HTTPException, Request

from app.core.db import db
from app.core.deps import client_ip
from app.core.ratelimit import hit
from app.data.wilaya_coords import WILAYA_CAPITALS
from app.services.geo import in_algeria, km as _km

router = APIRouter(tags=["catalog"])


async def _list(coll: str, q: dict | None = None, sort=("order", 1)):
    return await db[coll].find(q or {"active": {"$ne": False}}, {"_id": 0}).sort(*sort).to_list(2000)


@router.get("/geo/wilayas")
async def wilayas():
    return await db.wilayas.find({}, {"_id": 0}).sort("code", 1).to_list(100)


@router.get("/geo/locate")
async def locate(lat: float, lng: float, request: Request):
    """Suggests the wilaya of a position (nearest wilaya capital). The position is neither stored nor logged."""
    hit(f"geo-locate:{client_ip(request)}", 30, 600)
    if not in_algeria(lat, lng):
        raise HTTPException(404, "outside_algeria")
    code, km = min(((c, _km((lat, lng), p)) for c, p in WILAYA_CAPITALS.items()), key=lambda x: x[1])
    w = await db.wilayas.find_one({"code": code}, {"_id": 0})
    return (w or {"code": code}) | {"distance_km": round(km)}


@router.get("/geo/wilayas/{code}/communes")
async def communes(code: int):
    if not await db.wilayas.find_one({"code": code}):
        raise HTTPException(404, "wilaya_not_found")
    return await db.communes.find({"wilaya_code": code}, {"_id": 0}).sort("name_fr", 1).to_list(1000)


@router.get("/taxonomy/families")
async def families():
    return await _list("taxonomy_families")


@router.get("/taxonomy/categories")
async def categories(family_key: str | None = None, home_section: str | None = None):
    q = {"active": {"$ne": False}}
    if family_key:
        q["family_key"] = family_key
    if home_section:
        q["home_section"] = home_section
    return await _list("taxonomy_categories", q)


@router.get("/taxonomy/roles")
async def roles(family_key: str | None = None):
    q = {"active": {"$ne": False}}
    if family_key:
        q["family_keys"] = family_key
    return await _list("taxonomy_roles", q)


@router.get("/taxonomy/specialties")
async def specialties(category_key: str):
    return await _list("taxonomy_specialties", {"category_key": category_key, "active": {"$ne": False}})


@router.get("/academy/subjects")
async def subjects():
    return await _list("academy_subjects")


@router.get("/academy/levels")
async def levels():
    return await _list("academy_levels")
