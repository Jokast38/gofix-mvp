"""AI MATCH v1: hard filters + weighted rules + template explanations (no LLM). Replaceable behind MatchingService.
Every ranking carries a formula_version; recommendations are persisted as MatchResult for audit/explanations."""
import hashlib
import json
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from bson import ObjectId, json_util

from app.core.db import db
from app.services import geo
from app.services.config_store import get_setting

TZ = ZoneInfo("Africa/Algiers")
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
FORMULA = "rules-v2"
MIN_REASONS = 2

TEMPLATES = {
    "fr": {"same_commune": "dans votre commune", "same_wilaya": "dans votre wilaya", "online": "cours en ligne",
           "available_today": "disponible aujourd'hui", "available_tomorrow": "disponible demain", "available_week": "disponible cette semaine",
           "available_on": "disponible le jour demandé", "rating": "noté {avg}/5 ({count} avis)", "highly_rated": "très bien noté",
           "verified": "profil vérifié", "trust": "Trust {score}/100", "trusted": "profil de confiance",
           "responsive": "répond à {pct} % des demandes", "exact_category": "métier exact", "subject_level": "matière et niveau correspondants",
           "level_specialist": "spécialiste {grade}", "experience": "{years} ans d'expérience", "experienced": "expérimenté",
           "mode_match": "format souhaité disponible", "new_on_gofix": "nouveau sur GoFix", "active_profile": "profil actif sur GoFix",
           "zone_covered": "intervient dans la zone recherchée", "distance": "à {km} km"},
    "en": {"same_commune": "in your commune", "same_wilaya": "in your wilaya", "online": "online lessons",
           "available_today": "available today", "available_tomorrow": "available tomorrow", "available_week": "available this week",
           "available_on": "available on the requested day", "rating": "rated {avg}/5 ({count} reviews)", "highly_rated": "highly rated",
           "verified": "verified profile", "trust": "Trust {score}/100", "trusted": "trusted profile",
           "responsive": "answers {pct}% of requests", "exact_category": "exact trade", "subject_level": "matching subject and level",
           "level_specialist": "{grade} specialist", "experience": "{years} years of experience", "experienced": "experienced",
           "mode_match": "requested format available", "new_on_gofix": "new on GoFix", "active_profile": "active profile on GoFix",
           "zone_covered": "works in the requested area", "distance": "{km} km away"},
    "ar": {"same_commune": "في بلديتك", "same_wilaya": "في ولايتك", "online": "دروس عبر الإنترنت",
           "available_today": "متاح اليوم", "available_tomorrow": "متاح غدًا", "available_week": "متاح هذا الأسبوع",
           "available_on": "متاح في اليوم المطلوب", "rating": "تقييم {avg}/5 ({count} رأي)", "highly_rated": "تقييم ممتاز",
           "verified": "ملف موثّق", "trust": "ثقة {score}/100", "trusted": "ملف موثوق",
           "responsive": "يرد على {pct}٪ من الطلبات", "exact_category": "التخصص المطلوب", "subject_level": "المادة والمستوى المطلوبان",
           "level_specialist": "مختص في {grade}", "experience": "خبرة {years} سنوات", "experienced": "ذو خبرة", "mode_match": "الصيغة المطلوبة متاحة", "new_on_gofix": "جديد على GoFix",
           "active_profile": "ملف نشط على GoFix", "zone_covered": "يعمل في المنطقة المطلوبة", "distance": "على بعد {km} كم"},
}
# Blurred viewers never get exact figures that the unlock matrix hides.
HIDDEN = {"rating": "highly_rated", "trust": "trusted", "experience": "experienced"}


@dataclass
class MatchContext:
    kind: str = "professional"
    category_key: str | None = None
    subject_key: str | None = None
    level_key: str | None = None
    grade: str | None = None
    wilaya: int | None = None
    commune: str | None = None
    format: str | None = None
    weekday: str | None = None
    slot: str | None = None
    urgency: str = "normal"
    lang: str = "fr"
    hide_numbers: bool = False
    exposure: dict = field(default_factory=dict)  # profile_id(str) -> recent top-5 impressions
    origin: tuple | None = None  # (lat, lng) of the search: device position or centre of the chosen commune; never stored
    radius_km: int | None = None


RANK_FIELDS = {f: 1 for f in ("user_id", "suspended", "zones", "formats", "availability", "category_key", "subjects", "trust_score",
                              "trust_public", "trust_status", "verification_status", "rating_avg", "rating_count", "response_rate",
                              "experience_years", "location")}


async def hydrate(coll, ranked: list[dict]) -> list[dict]:
    """Full profiles of the ranked candidates that are actually shown, in rank order, with their `_match`.
    A profile suspended since the ranking was cached is dropped here, so it never shows."""
    ids = [p["_id"] for p in ranked]
    full = {d["_id"]: d for d in await coll.find({"_id": {"$in": ids}, "suspended": {"$ne": True}}).to_list(len(ids) or 1)}
    return [full[p["_id"]] | {"_match": dict(p["_match"])} for p in ranked if p["_id"] in full]


# Everybody runs the same few searches ("plumber, Algiers"): the ranking of a search is kept a short while, so most
# requests only load the profiles they show. Per process; a new or updated profile shows up after RANK_CACHE_S at most.
RANK_CACHE_S = 45
RANK_CACHE_MAX = 500
_rank_cache: OrderedDict = OrderedDict()


def clear_rank_cache() -> None:
    _rank_cache.clear()


async def ranked_light(coll, query: dict, ctx: "MatchContext", service, *, limit: int = 300, sort=None, exposure: bool = True) -> tuple[list[dict], int]:
    """(ranking as light rows {_id, trust_score, _match: {score}}, number of candidates), cached RANK_CACHE_S."""
    key = json_util.dumps([coll.name, query, sort, exposure, service.formula_version, ctx.kind, ctx.category_key, ctx.subject_key,
                           ctx.level_key, ctx.grade, ctx.wilaya, ctx.commune, ctx.format, ctx.weekday, ctx.slot, ctx.urgency,
                           ctx.origin, ctx.radius_km, ctx.hide_numbers], sort_keys=True)
    now = time.monotonic()
    hit = _rank_cache.get(key)
    if hit and hit[0] > now:
        _rank_cache.move_to_end(key)
        ctx.exposure = hit[3]
        return hit[1], hit[2]
    cursor = coll.find(query, RANK_FIELDS)
    if sort:
        cursor = cursor.sort(*sort)
    candidates = await cursor.to_list(limit)
    ctx.exposure = await recent_exposure([c["_id"] for c in candidates]) if exposure else {}
    ranked = await service.rank(candidates, ctx, detail_n=0)
    light = [{"_id": p["_id"], "trust_score": p.get("trust_score"), "_match": {"score": p["_match"]["score"]}} for p in ranked]
    _rank_cache[key] = (now + RANK_CACHE_S, light, len(candidates), ctx.exposure)
    while len(_rank_cache) > RANK_CACHE_MAX:
        _rank_cache.popitem(last=False)
    return light, len(candidates)


def distance_to(p: dict, ctx: "MatchContext") -> int | None:
    return geo.distance_km(p, ctx.origin) if ctx.origin else None


class MatchingService(ABC):
    formula_version: str = FORMULA

    @abstractmethod
    async def rank(self, candidates: list[dict], ctx: MatchContext) -> list[dict]:
        """Return candidates sorted best first, each with `_match` = {score, reasons, explanation, components}."""


def availability(slots: list, now: datetime | None = None) -> str | None:
    if not slots:
        return None
    now = now or datetime.now(TZ)
    days = {s.get("day") for s in slots}
    today, tomorrow = DAY_KEYS[now.weekday()], DAY_KEYS[(now + timedelta(days=1)).weekday()]
    return "available_today" if today in days else "available_tomorrow" if tomorrow in days else "available_week"


def hard_filter(p: dict, ctx: MatchContext) -> bool:
    """GF1-002: excluded profiles can never be ranked (suspension is already excluded by the query)."""
    if p.get("suspended"):
        return False
    zones = p.get("zones") or []
    formats = p.get("formats") or []
    if ctx.kind == "teacher" and ctx.format == "online":
        if "online" not in formats:
            return False
    elif ctx.wilaya and not any(z.get("wilaya_code") == ctx.wilaya for z in zones):
        if not (ctx.kind == "teacher" and "online" in formats and ctx.format in (None, "online")):
            return False
    if ctx.kind == "teacher" and ctx.format and ctx.format != "online" and ctx.format not in formats:
        return False
    if ctx.radius_km and not (ctx.kind == "teacher" and ctx.format == "online"):
        d = distance_to(p, ctx)
        if d is not None and d > ctx.radius_km:
            return False  # outside the requested radius (profiles without a base point are judged on their zones)
    slots = (p.get("availability") or {}).get("slots") or []
    if ctx.weekday and slots and not any(s.get("day") == ctx.weekday and (not ctx.slot or s.get("slot") == ctx.slot) for s in slots):
        return False  # declared availability excludes the requested day/slot
    return True


class RulesMatchingService(MatchingService):
    def __init__(self, weights: dict, exposure_penalty: float = 3.0):
        self.w = weights
        self.exposure_penalty = exposure_penalty
        self.formula_version = f"{FORMULA}-{hashlib.sha1(json.dumps(weights, sort_keys=True).encode()).hexdigest()[:8]}"

    def score(self, p: dict, ctx: MatchContext, detail: bool = True) -> dict:
        comps, reasons = {}, []
        if ctx.kind == "professional" and ctx.category_key:
            comps["category"] = 1.0 if p.get("category_key") == ctx.category_key else 0.0
            if comps["category"]:
                reasons.append((self.w.get("category", 0) * 0.5, {"code": "exact_category"}))
        if ctx.kind == "teacher" and (ctx.subject_key or ctx.level_key):
            subj = [s for s in p.get("subjects") or [] if not ctx.subject_key or s.get("subject_key") == ctx.subject_key]
            lvl = any(ctx.level_key in s.get("level_keys", []) for s in subj) if ctx.level_key else bool(subj)
            comps["category"] = (0.6 if subj else 0) + (0.4 if lvl else 0)
            if subj and lvl:
                code = {"code": "level_specialist", "params": {"grade": ctx.grade}} if ctx.grade else {"code": "subject_level"}
                reasons.append((self.w.get("category", 0) * 0.6, code))
        zones = p.get("zones") or []
        if ctx.wilaya:
            zone = next((z for z in zones if z.get("wilaya_code") == ctx.wilaya), None)
            if zone and ctx.commune and ctx.commune in (zone.get("commune_names") or []):
                comps["proximity"] = 1.0
                reasons.append((self.w.get("proximity", 0), {"code": "same_commune"}))
            elif zone:
                comps["proximity"] = 0.8
                reasons.append((self.w.get("proximity", 0) * 0.8, {"code": "same_wilaya"}))
            elif "online" in (p.get("formats") or []):
                comps["proximity"] = 0.7
                reasons.append((self.w.get("proximity", 0) * 0.7, {"code": "online"}))
            else:
                comps["proximity"] = 0.0
        d = distance_to(p, ctx)
        if d is not None and ctx.radius_km:
            # 1 at the client's door, 0 at the edge of the radius; the better of zone and distance wins.
            near = max(0.0, 1 - d / max(ctx.radius_km, 1))
            comps["proximity"] = max(comps.get("proximity", 0.0), near)
            reasons.append((self.w.get("proximity", 0) * (0.6 + 0.5 * near), {"code": "distance", "params": {"km": d}}))
        slots = (p.get("availability") or {}).get("slots") or []
        if ctx.weekday:
            on_day = any(s.get("day") == ctx.weekday for s in slots)
            comps["availability"] = 1.0 if on_day else 0.3  # no declared slots: neutral, not excluded
            if on_day:
                reasons.append((self.w.get("availability", 0) * 1.2, {"code": "available_on"}))
        else:
            avail = availability(slots)
            comps["availability"] = {"available_today": 1.0, "available_tomorrow": 0.8, "available_week": 0.4}.get(avail, 0.0)
            if ctx.urgency == "high" and avail != "available_today":
                comps["availability"] *= 0.5
            if avail:
                boost = 1.5 if ctx.urgency == "high" and avail == "available_today" else 1.0
                reasons.append((self.w.get("availability", 0) * comps["availability"] * boost, {"code": avail}))
        if ctx.kind == "teacher" and ctx.format and ctx.format in (p.get("formats") or []):
            reasons.append((self.w.get("proximity", 0) * 0.5, {"code": "mode_match"}))
        if p.get("trust_score") is not None:
            comps["trust"] = p["trust_score"] / 100
            if p.get("trust_public", True):
                reasons.append((self.w.get("trust", 0) * comps["trust"] * 0.9, {"code": "trust", "params": {"score": p["trust_score"]}}))
            if p.get("verification_status") == "verified":
                reasons.append((self.w.get("trust", 0) * comps["trust"] * 0.8, {"code": "verified"}))
        avg, count = p.get("rating_avg") or 0, p.get("rating_count") or 0
        if count:
            comps["rating"] = (avg / 5) * min(1, count / 5)
            if avg >= 4:
                reasons.append((self.w.get("rating", 0) * comps["rating"] + 1, {"code": "rating", "params": {"avg": avg, "count": count}}))
        if p.get("response_rate") is not None:
            comps["response"] = p["response_rate"]
            if p["response_rate"] >= 0.8:
                reasons.append((self.w.get("response", 0) * p["response_rate"], {"code": "responsive", "params": {"pct": round(p["response_rate"] * 100)}}))
        if p.get("experience_years"):
            reasons.append((0.5, {"code": "experience", "params": {"years": p["experience_years"]}}))
        used = {k: v for k, v in comps.items() if self.w.get(k)}
        total_w = sum(self.w[k] for k in used) or 1
        raw = sum(self.w[k] * v for k, v in used.items()) / total_w * 100
        exposure = min(self.exposure_penalty, ctx.exposure.get(str(p.get("_id")), 0) * 0.25)  # GF1-007 diversity
        score = round(max(0.0, raw - exposure), 1)
        if not detail:  # ranking pass: reasons, explanation and components are only built for the profiles shown
            return {"score": score}
        ordered, seen = [], set()
        for _, r in sorted(reasons, key=lambda x: -x[0]):
            if r["code"] not in seen:
                seen.add(r["code"])
                ordered.append(r)
        for filler in ({"code": "new_on_gofix"} if p.get("trust_status") == "insufficient" else {"code": "active_profile"}, {"code": "zone_covered"}):
            if len(ordered) >= MIN_REASONS:
                break
            ordered.append(filler)
        top = ordered[:3]
        if ctx.hide_numbers:
            top = [{"code": HIDDEN[r["code"]]} if r["code"] in HIDDEN else r for r in top]
        components = [{"criterion": k, "weight": self.w.get(k, 0), "value": round(v, 3), "contribution": round(self.w.get(k, 0) * v / total_w * 100, 1)}
                      for k, v in comps.items() if self.w.get(k)]
        if exposure:
            components.append({"criterion": "recent_exposure_penalty", "weight": None, "value": round(exposure, 2), "contribution": -round(exposure, 1)})
        return {"score": score, "reasons": top, "explanation": explain(top, ctx), "components": components}

    async def rank(self, candidates, ctx, detail_n: int = 8):
        """Best first. Only the first `detail_n` get their reasons and explanation (call `detail` for others shown)."""
        kept = [p for p in candidates if hard_filter(p, ctx)]
        for p in kept:
            p["_match"] = self.score(p, ctx, detail=False)
        kept.sort(key=lambda p: (-p["_match"]["score"], -(p.get("trust_score") or 0)))
        self.detail(kept[:detail_n], ctx)
        return kept

    def detail(self, items: list[dict], ctx: MatchContext) -> list[dict]:
        for p in items:
            if "reasons" not in p["_match"]:
                p["_match"] = self.score(p, ctx)
        return items


def explain(reasons: list[dict], ctx: MatchContext) -> str:
    tpl = TEMPLATES.get(ctx.lang, TEMPLATES["fr"])
    parts = []
    for r in reasons:
        code, params = r["code"], r.get("params") or {}
        if ctx.hide_numbers and code in HIDDEN:
            code, params = HIDDEN[code], {}
        parts.append(tpl[code].format(**params))
    return ", ".join(parts)


async def recent_exposure(profile_ids: list, days: int = 7) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = await db.match_impressions.aggregate([
        {"$match": {"created_at": {"$gte": since}, "profile_id": {"$in": profile_ids}}},
        {"$group": {"_id": "$profile_id", "n": {"$sum": 1}}}]).to_list(len(profile_ids) or 1)
    return {str(r["_id"]): r["n"] for r in rows}


async def get_matching_service() -> RulesMatchingService:
    return RulesMatchingService(await get_setting("match_weights"))


async def save_match_result(ranked: list[dict], ctx: MatchContext, *, user_id: str | None, source: str, service: RulesMatchingService,
                            started: float, candidate_count: int, intent: dict | None = None, top_n: int = 5) -> ObjectId:
    """MatchResult: what was shown, why, with which formula (GF1-003 traceability). No personal data beyond ids."""
    doc = {"user_id": ObjectId(user_id) if user_id else None, "source": source, "kind": ctx.kind, "formula_version": service.formula_version,
           "context": {k: getattr(ctx, k) for k in ("category_key", "subject_key", "level_key", "wilaya", "commune", "format", "weekday", "slot", "urgency")},
           "intent": intent, "candidate_count": candidate_count, "fallback_used": False,
           "latency_ms": round((time.perf_counter() - started) * 1000, 1),
           "results": [{"profile_id": p["_id"], "rank": i + 1, "score": p["_match"]["score"], "reasons": p["_match"]["reasons"],
                        "components": p["_match"]["components"]} for i, p in enumerate(ranked[:top_n])],
           "created_at": datetime.now(timezone.utc)}
    return (await db.match_results.insert_one(doc)).inserted_id
