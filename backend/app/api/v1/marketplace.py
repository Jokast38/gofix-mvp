import re
import time
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from app.adapters.storage import get_storage
from app.core.db import db
from app.core.deps import get_optional_user
from app.models.user import User
from app.services.access_policy import Access, apply_policy, consume_view, resolve_access, views_used
from app.services.config_store import get_setting, is_enabled
from app.services.matching import MatchContext, get_matching_service, recent_exposure, save_match_result
from app.services.visibility import PUBLIC_PROFILE as PUBLIC_STATUS

router = APIRouter(tags=["marketplace"])

MIME = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
CANDIDATES_MAX = 300


def _rx(q: str):
    return {"$regex": re.escape(q.strip()), "$options": "i"}


def _page(page: int, page_size: int):
    page_size = max(1, min(page_size, 50))
    return max(page, 1), page_size


def _lang(request: Request) -> str:
    return "ar" if (request.headers.get("Accept-Language") or "").lower().startswith("ar") else "fr"


async def _names(coll: str, keys: set) -> dict:
    docs = await db[coll].find({"key": {"$in": [k for k in keys if k]}}, {"_id": 0}).to_list(500)
    return {d["key"]: d for d in docs}


async def _wilayas() -> dict:
    return {w["code"]: w async for w in db.wilayas.find({}, {"_id": 0})}


def _zones_view(item: dict, wil: dict):
    item["wilayas"] = [{"code": z["wilaya_code"], "communes": z.get("commune_names"),
                        **{k: wil.get(z["wilaya_code"], {}).get(k) for k in ("name_fr", "name_ar")}} for z in item.get("zones", [])]


async def _enrich_pros(items: list) -> list:
    cats = await _names("taxonomy_categories", {p.get("category_key") for p in items})
    wil = await _wilayas()
    for p in items:
        c = cats.get(p.get("category_key"), {})
        p["category"] = {"key": c.get("key"), "name_fr": c.get("name_fr"), "name_ar": c.get("name_ar"), "icon": c.get("icon")}
        _zones_view(p, wil)
    return items


async def _enrich_teachers(items: list) -> list:
    subj = await _names("academy_subjects", {s["subject_key"] for t in items for s in t.get("subjects", [])})
    lvl = {d["key"]: d for d in await db.academy_levels.find({}, {"_id": 0}).to_list(50)}
    wil = await _wilayas()
    for t in items:
        t["subjects_full"] = [{"key": s["subject_key"], "name_fr": subj.get(s["subject_key"], {}).get("name_fr"),
                               "name_ar": subj.get(s["subject_key"], {}).get("name_ar"),
                               "rating": (t.get("ratings_by_subject") or {}).get(s["subject_key"]),
                               "levels": [{"key": l, "name_fr": lvl.get(l, {}).get("name_fr"), "name_ar": lvl.get(l, {}).get("name_ar")} for l in s.get("level_keys", [])]}
                              for s in t.get("subjects", [])]
        _zones_view(t, wil)
    return items


async def _search(kind: str, query: dict, ctx: MatchContext, acc: Access, page: int, page_size: int, user: User | None) -> dict:
    coll = db.professional_profiles if kind == "professional" else db.teacher_profiles
    page, page_size = _page(page, page_size)
    total = await coll.count_documents(query)
    use_match = await is_enabled("ai_match")
    mr_id = None
    if use_match:
        started = time.perf_counter()
        candidates = await coll.find(query).sort("trust_score", -1).to_list(CANDIDATES_MAX)
        ctx.hide_numbers = acc.blurred
        ctx.exposure = await recent_exposure([d["_id"] for d in candidates]) if page == 1 else {}
        service = await get_matching_service()
        ranked = await service.rank(candidates, ctx)
        total = len(ranked) if len(candidates) < CANDIDATES_MAX else total
        if page == 1 and ranked:
            mr_id = await save_match_result(ranked, ctx, user_id=user.id if user else None, source="search", service=service,
                                            started=started, candidate_count=len(candidates))
        docs = ranked[(page - 1) * page_size: page * page_size]
    else:
        docs = await coll.find(query).sort([("verification_status", -1), ("trust_score", -1)]).skip((page - 1) * page_size).to_list(page_size)
    top_n = await get_setting("match_top_n") if use_match and page == 1 else 0
    items = []
    for i, d in enumerate(docs):
        it = apply_policy(d, acc, kind)
        if use_match:
            it["match"] = {**{k: d["_match"][k] for k in ("score", "reasons", "explanation")}, "top": i < top_n,
                           "rank": (page - 1) * page_size + i + 1, "match_result_id": str(mr_id) if mr_id else None}
        items.append(it)
    if top_n and user:
        now = datetime.now(timezone.utc)
        rows = [{"user_id": ObjectId(user.id), "profile_id": d["_id"], "kind": kind, "position": i + 1, "match_result_id": mr_id, "created_at": now}
                for i, d in enumerate(docs[:top_n])]
        if rows:
            await db.match_impressions.insert_many(rows)
    items = await (_enrich_pros(items) if kind == "professional" else _enrich_teachers(items))
    return {"total": total, "page": page, "page_size": page_size, "blurred": acc.blurred, "viewer_tier": acc.tier,
            "ai_match": use_match, "match_result_id": str(mr_id) if mr_id else None, "views_limit": acc.views_limit, "views_used": await views_used(acc), "items": items}


def _wilaya_filter(raw: str) -> int | None:
    """Wilaya filter: empty or invalid values mean no filter (older app versions send "wilaya=")."""
    return int(raw) if raw.strip().isdigit() and 1 <= int(raw) <= 58 else None


@router.get("/catalog/professionals")
async def list_pros(request: Request, q: str = "", family_key: str = "", category_key: str = "", wilaya: str = "",
                    commune: str = "", page: int = 1, page_size: int = 12, user: User | None = Depends(get_optional_user)):
    wilaya = _wilaya_filter(wilaya)
    query: dict = dict(PUBLIC_STATUS)
    if family_key:
        query["family_key"] = family_key
    if category_key:
        query["category_key"] = category_key
    if wilaya:
        query["zones.wilaya_code"] = wilaya
    if q:
        cat_keys = [c["key"] for c in await db.taxonomy_categories.find({"$or": [{"name_fr": _rx(q)}, {"name_ar": _rx(q)}]}, {"key": 1}).to_list(100)]
        query["$or"] = [{"display_name": _rx(q)}, {"bio": _rx(q)}, {"category_key": {"$in": cat_keys}}]
    acc = await resolve_access(user, "professional")
    ctx = MatchContext("professional", category_key=category_key or None, wilaya=wilaya, commune=commune or None, lang=_lang(request))
    return await _search("professional", query, ctx, acc, page, page_size, user)


@router.get("/catalog/teachers")
async def list_teachers(request: Request, q: str = "", subject_key: str = "", level_key: str = "", format: str = "",
                        wilaya: str = "", page: int = 1, page_size: int = 12, user: User | None = Depends(get_optional_user)):
    wilaya = _wilaya_filter(wilaya)
    query: dict = dict(PUBLIC_STATUS)
    if subject_key and level_key:
        query["subjects"] = {"$elemMatch": {"subject_key": subject_key, "level_keys": level_key}}
    elif subject_key:
        query["subjects.subject_key"] = subject_key
    elif level_key:
        query["subjects.level_keys"] = level_key
    if format:
        query["formats"] = format
    if wilaya:
        query["$and"] = [{"$or": [{"zones.wilaya_code": wilaya}, {"formats": "online"}]}] if format != "home" else [{"zones.wilaya_code": wilaya}]
    if q:
        keys = [s["key"] for s in await db.academy_subjects.find({"$or": [{"name_fr": _rx(q)}, {"name_ar": _rx(q)}]}, {"key": 1}).to_list(50)]
        query["$or"] = [{"display_name": _rx(q)}, {"bio": _rx(q)}, {"subjects.subject_key": {"$in": keys}}]
    acc = await resolve_access(user, "teacher")
    ctx = MatchContext("teacher", subject_key=subject_key or None, level_key=level_key or None, wilaya=wilaya,
                       format=format or None, lang=_lang(request))
    return await _search("teacher", query, ctx, acc, page, page_size, user)


async def _reviews(pid: ObjectId) -> list:
    docs = await db.reviews.find({"profile_id": pid}, {"client_id": 0}).sort("created_at", -1).to_list(10)
    return [{"id": str(r["_id"]), "rating": r["rating"], "comment": r.get("comment"), "subject_key": r.get("subject_key"),
             "author": r.get("author_name"), "created_at": r["created_at"]} for r in docs]


async def _detail(kind: str, pid: str, user: User | None) -> tuple[dict, dict]:
    coll = db.professional_profiles if kind == "professional" else db.teacher_profiles
    try:
        doc = await coll.find_one({"_id": ObjectId(pid), **PUBLIC_STATUS})
    except InvalidId:
        doc = None
    if not doc:
        raise HTTPException(404, "not_found")
    acc = await resolve_access(user, kind)
    allowed = await consume_view(acc, doc["_id"])
    item = apply_policy(doc, acc, kind, force_blur=not allowed)
    item["quota_exceeded"] = not allowed
    item["viewer_tier"] = acc.tier
    item["views_limit"] = acc.views_limit
    item["views_used"] = await views_used(acc)
    if item.get("can_see_phone"):
        owner = await db.users.find_one({"_id": doc["user_id"]}, {"phone": 1})
        item["phone"] = (owner or {}).get("phone")
    item["reviews"] = await _reviews(doc["_id"])
    return doc, item


@router.get("/catalog/professionals/{pid}")
async def get_pro(pid: str, user: User | None = Depends(get_optional_user)):
    doc, item = await _detail("professional", pid, user)
    item = (await _enrich_pros([item]))[0]
    if not item["blurred"]:
        specs = await _names("taxonomy_specialties", set(doc.get("specialty_keys") or []))
        item["specialties"] = [{"key": k, "name_fr": v["name_fr"], "name_ar": v["name_ar"]} for k, v in specs.items()]
        item["role"] = await db.taxonomy_roles.find_one({"key": doc.get("role_key")}, {"_id": 0})
    return item


@router.get("/catalog/teachers/{tid}")
async def get_teacher(tid: str, user: User | None = Depends(get_optional_user)):
    _, item = await _detail("teacher", tid, user)
    return (await _enrich_teachers([item]))[0]


@router.get("/files/public/{key:path}")
async def public_file(key: str):
    try:
        data = get_storage().read(key, private=False)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, "not_found")
    return Response(data, media_type=MIME.get(key.rsplit(".", 1)[-1].lower(), "application/octet-stream"),
                    headers={"Cache-Control": "public, max-age=604800, immutable"})
