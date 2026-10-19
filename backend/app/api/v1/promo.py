"""Public promotion blocks shown on the web and in the app: "Fixeur du mois" / best of the month / top rated, and sponsored banners."""
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.db import db
from app.core.deps import client_ip, get_optional_user
from app.core.ratelimit import hit
from app.models.user import User
from app.services.access_policy import resolve_access
from app.services.config_store import get_setting
from app.services.visibility import PUBLIC_PROFILE

router = APIRouter(tags=["promo"])

# Bayesian average: a pro with 2 reviews at 5/5 does not beat one with 20 reviews at 4.8/5.
PRIOR, WEIGHT = 4.0, 3
TOP_RATED_MIN_REVIEWS = 3
PLACEMENTS = ("home", "search")


def _bayes(total: float, n: int) -> float:
    return (total + PRIOR * WEIGHT) / (n + WEIGHT)


def _month_bounds(now: datetime, back: int = 0) -> tuple[datetime, datetime]:
    y, m = now.year, now.month - back
    while m < 1:
        y, m = y - 1, m + 12
    start = datetime(y, m, 1, tzinfo=timezone.utc)
    end = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=timezone.utc)
    return start, end


async def _month_ranking(start: datetime, end: datetime) -> list[dict]:
    rows = await db.reviews.aggregate([
        {"$match": {"kind": "professional", "created_at": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$profile_id", "n": {"$sum": 1}, "total": {"$sum": "$rating"}}},
    ]).to_list(2000)
    for r in rows:
        r["score"] = _bayes(r["total"], r["n"])
    return sorted(rows, key=lambda r: (r["score"], r["n"]), reverse=True)


async def _cards(profiles: list[dict], identity: bool, month_stats: dict | None = None) -> list[dict]:
    cats = {c["key"]: c async for c in db.taxonomy_categories.find({"key": {"$in": [p.get("category_key") for p in profiles]}})}
    wil = {w["code"]: w async for w in db.wilayas.find({}, {"_id": 0, "code": 1, "name_fr": 1, "name_ar": 1})}
    out = []
    for p in profiles:
        c = cats.get(p.get("category_key"), {})
        code = ((p.get("zones") or [{}])[0]).get("wilaya_code")
        stats = (month_stats or {}).get(p["_id"])
        out.append({
            "id": str(p["_id"]), "kind": "professional", "verification_status": p.get("verification_status"),
            "display_name": p.get("display_name") if identity else None,
            "photo_key": p.get("photo_key") if identity else None, "photo_thumb_key": p.get("photo_thumb_key") if identity else None,
            "category": {"key": c.get("key"), "name_fr": c.get("name_fr"), "name_ar": c.get("name_ar"), "icon": c.get("icon")},
            "wilaya": {"code": code, "name_fr": wil.get(code, {}).get("name_fr"), "name_ar": wil.get(code, {}).get("name_ar")} if code else None,
            "rating_avg": p.get("rating_avg") or 0, "rating_count": p.get("rating_count") or 0,
            "month": {"count": stats["n"], "avg": round(stats["total"] / stats["n"], 1)} if stats else None,
        })
    return out


async def _profiles(ids: list) -> list[dict]:
    docs = {d["_id"]: d for d in await db.professional_profiles.find({"_id": {"$in": ids}, **PUBLIC_PROFILE}).to_list(len(ids) or 1)}
    return [docs[i] for i in ids if i in docs]


@router.get("/highlights")
async def highlights(user: User | None = Depends(get_optional_user)):
    """Fixeur du mois (manual pick in the back-office, else the best Bayesian average of the month's verified reviews),
    the best pros of the month and the best rated overall. Falls back to the previous month while the current one has no review."""
    now = datetime.now(timezone.utc)
    period, ranking = None, []
    for back in (0, 1):
        start, end = _month_bounds(now, back)
        ranking = await _month_ranking(start, end)
        if ranking:
            period = start.strftime("%Y-%m")
            break
    stats = {r["_id"]: r for r in ranking}
    best = await _profiles([r["_id"] for r in ranking[:20]])
    verified = [p for p in best if p.get("verification_status") == "verified"]

    fixer, manual = (verified or best or [None])[0], False
    email = (await get_setting("fixer_of_month_email") or "").strip().lower()
    if email:
        u = await db.users.find_one({"email": email}, {"_id": 1})
        picked = u and await db.professional_profiles.find_one({"user_id": u["_id"], **PUBLIC_PROFILE})
        if picked:
            fixer, manual = picked, True

    top = await db.professional_profiles.find({**PUBLIC_PROFILE, "rating_count": {"$gte": TOP_RATED_MIN_REVIEWS}}).to_list(500)
    top.sort(key=lambda p: (_bayes((p.get("rating_avg") or 0) * p["rating_count"], p["rating_count"]), p["rating_count"]), reverse=True)

    identity = bool(await get_setting("highlights_show_identity")) or not (await resolve_access(user)).blurred
    month_best = [p for p in best if not fixer or p["_id"] != fixer["_id"]][:5]
    return {
        "period": period or now.strftime("%Y-%m"), "manual": manual,
        "fixer": (await _cards([fixer], identity, stats))[0] if fixer else None,
        "best_of_month": await _cards(month_best, identity, stats),
        "top_rated": await _cards(top[:6], identity),
    }


def _banner_view(b: dict) -> dict:
    return {"id": str(b["_id"]), "title": b.get("title"), "advertiser": b.get("advertiser"), "alt": b.get("alt") or b.get("title"),
            "image_key": b.get("image_key"), "image_thumb_key": b.get("image_thumb_key"),
            "click_url": f"/api/v1/promos/{b['_id']}/click", "sponsored": True,
            # Link inside GoFix (e.g. "/contact"): the apps navigate themselves and count the click with POST.
            "internal_path": b["link_url"] if b.get("link_url", "").startswith("/") else None}


def live_banner_query(placement: str, now: datetime) -> dict:
    return {"active": True, "placements": placement, "image_key": {"$ne": None},
            "$and": [{"$or": [{"starts_at": None}, {"starts_at": {"$lte": now}}]},
                     {"$or": [{"ends_at": None}, {"ends_at": {"$gt": now}}]}]}


@router.get("/promos")
async def promos(placement: str = Query("home")):
    """Sponsored banners in force for a placement. Each call counts one impression per banner returned."""
    if placement not in PLACEMENTS:
        return []
    docs = await db.ad_banners.find(live_banner_query(placement, datetime.now(timezone.utc))).sort([("order", 1), ("created_at", -1)]).to_list(10)
    if docs:
        await db.ad_banners.update_many({"_id": {"$in": [d["_id"] for d in docs]}}, {"$inc": {"impressions": 1}})
    return [_banner_view(d) for d in docs]


@router.get("/promos/{banner_id}/click")
async def promo_click(banner_id: str, request: Request):
    """Counts the click server-side, then sends the visitor to the advertiser (link set by the super-admin only)."""
    hit(f"promo-click:{client_ip(request)}", 60, 600)
    try:
        oid = ObjectId(banner_id)
    except InvalidId:
        return RedirectResponse(settings.frontend_url, status_code=302)
    b = await db.ad_banners.find_one_and_update({"_id": oid, "active": True}, {"$inc": {"clicks": 1}})
    url = b["link_url"] if b else settings.frontend_url
    return RedirectResponse(f"{settings.frontend_url}{url}" if url.startswith("/") else url, status_code=302)


@router.post("/promos/{banner_id}/click", status_code=204)
async def promo_click_count(banner_id: str, request: Request):
    hit(f"promo-click:{client_ip(request)}", 60, 600)
    try:
        await db.ad_banners.update_one({"_id": ObjectId(banner_id), "active": True}, {"$inc": {"clicks": 1}})
    except InvalidId:
        pass
