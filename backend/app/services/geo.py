"""Base point of a profile (for the "nearest" sort) and distances.
The point is the centre of the profile's first commune (or of its wilaya capital) unless the provider set it from
their device position. A client's position is only used for the current search: it is never stored."""
import math

from app.core.db import db
from app.data.wilaya_coords import ALGERIA_BOUNDS, COMMUNE_COORDS, WILAYA_CAPITALS

PROFILE_COLLECTIONS = ("professional_profiles", "teacher_profiles")


def km(a: tuple, b: tuple) -> float:
    (la1, lo1), (la2, lo2) = map(lambda p: (math.radians(p[0]), math.radians(p[1])), (a, b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def in_algeria(lat: float, lng: float) -> bool:
    return ALGERIA_BOUNDS["lat"][0] <= lat <= ALGERIA_BOUNDS["lat"][1] and ALGERIA_BOUNDS["lng"][0] <= lng <= ALGERIA_BOUNDS["lng"][1]


def point(lat: float, lng: float) -> dict:
    return {"type": "Point", "coordinates": [lng, lat]}


def distance_km(doc: dict, origin: tuple) -> int | None:
    """Rounded distance from the client to a profile's base point (at least 1 km: never more precise than that)."""
    coords = (doc.get("location") or {}).get("coordinates")
    return max(1, round(km(origin, (coords[1], coords[0])))) if coords else None


async def _commune_coords(wilaya: int, commune: str) -> tuple | None:
    if (wilaya, commune) in COMMUNE_COORDS:
        return COMMUNE_COORDS[(wilaya, commune)]
    c = await db.communes.find_one({"wilaya_code": wilaya, "name_fr": commune, "lat": {"$ne": None}, "lng": {"$ne": None}})
    if c:
        return c["lat"], c["lng"]
    w = await db.wilayas.find_one({"code": wilaya}, {"name_fr": 1})
    return WILAYA_CAPITALS.get(wilaya) if w and w.get("name_fr") == commune else None


async def zone_location(zones: list) -> tuple[dict, str] | None:
    """(GeoJSON point, source) of the first zone: its first commune with known coordinates, else the wilaya capital."""
    for z in zones or []:
        code = z.get("wilaya_code")
        for name in z.get("commune_names") or []:
            ll = await _commune_coords(code, name)
            if ll:
                return point(*ll), "commune"
        if code in WILAYA_CAPITALS:
            return point(*WILAYA_CAPITALS[code]), "wilaya"
    return None


async def refresh_location(coll: str, profile: dict, force: bool = False) -> None:
    """Recomputes the base point from the zones, unless the provider placed it themselves (force: back to the zones)."""
    if profile.get("location_source") == "gps" and not force:
        return
    found = await zone_location(profile.get("zones") or [])
    if found:
        await db[coll].update_one({"_id": profile["_id"]}, {"$set": {"location": found[0], "location_source": found[1]}})
    else:
        await db[coll].update_one({"_id": profile["_id"]}, {"$unset": {"location": "", "location_source": ""}})


async def backfill_locations() -> None:
    """Gives a base point to profiles created without one (seeds, imports, older versions)."""
    for coll in PROFILE_COLLECTIONS:
        async for p in db[coll].find({"location": {"$exists": False}, "zones.0": {"$exists": True}}, {"zones": 1}):
            await refresh_location(coll, p)
