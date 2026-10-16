"""AI MATCH step 1 — RequestIntent: free text (FR / AR / darija) -> structured need, by deterministic rules.
No generative model is required (GF1-001 / GF1-005); an LLM can later enrich this behind the same schema."""
import re
import time
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from zoneinfo import ZoneInfo

from app.core.db import db
from app.data import lexicon as L
from app.services.faq_search import norm

PARSER_VERSION = "rules-v1"
TZ = ZoneInfo("Africa/Algiers")
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
_ARABIC = re.compile(r"[؀-ۿ]")
_CACHE: dict = {"at": 0.0}
CACHE_TTL_S = 300


def _has(text: str, phrase: str) -> bool:
    p = norm(phrase)
    return bool(p) and f" {p} " in f" {text} "


def _fuzzy_word(tokens: list[str], word: str) -> bool:
    w = norm(word)
    if " " in w or len(w) < 5:
        return False
    return any(len(t) >= 5 and SequenceMatcher(None, t, w).ratio() >= 0.86 for t in tokens)


async def _vocab() -> dict:
    """Taxonomy-driven vocabulary (cached): names from the DB + synonyms from the lexicon."""
    if "v" in _CACHE and time.monotonic() - _CACHE["at"] < CACHE_TTL_S:
        return _CACHE["v"]
    cats = await db.taxonomy_categories.find({"active": {"$ne": False}}, {"_id": 0, "key": 1, "name_fr": 1, "name_ar": 1, "family_key": 1}).to_list(500)
    subjects = await db.academy_subjects.find({"active": {"$ne": False}}, {"_id": 0, "key": 1, "name_fr": 1, "name_ar": 1}).to_list(100)
    wilayas = await db.wilayas.find({}, {"_id": 0}).to_list(100)
    communes = await db.communes.find({}, {"_id": 0}).to_list(5000)
    cat_terms = {}
    for c in cats:
        if c.get("family_key") == "academy":
            continue
        names = [c.get("name_fr", ""), c.get("name_ar", "")] + [x.strip() for x in (c.get("name_fr") or "").split("/")]
        cat_terms[c["key"]] = [n for n in names if n] + L.CATEGORY_SYNONYMS.get(c["key"], [])
    subj_terms = {s["key"]: [s.get("name_fr", ""), s.get("name_ar", "")] + L.SUBJECT_SYNONYMS.get(s["key"], []) for s in subjects}
    places = []  # (normalized name, wilaya_code, commune or None)
    for w in wilayas:
        for n in (w.get("name_fr"), w.get("name_ar")):
            if n:
                places.append((norm(n), w["code"], None))
    for c in communes:
        if c.get("is_capital"):
            continue
        for n in (c.get("name_fr"), c.get("name_ar")):
            if n:
                places.append((norm(n), c["wilaya_code"], c["name_fr"]))
    places.sort(key=lambda x: -len(x[0]))  # longest first: "Bab Ezzouar" before "Bab"
    v = {"cats": cat_terms, "subjects": subj_terms, "places": places}
    _CACHE.update(at=time.monotonic(), v=v)
    return v


def _best(text: str, tokens: list[str], terms: dict[str, list[str]]) -> tuple[str | None, list[str]]:
    scores: dict[str, float] = {}
    hits: dict[str, list[str]] = {}
    for key, words in terms.items():
        for w in words:
            if _has(text, w):
                scores[key] = scores.get(key, 0) + 1 + len(norm(w)) / 20  # longer phrases are stronger evidence
                hits.setdefault(key, []).append(w)
            elif _fuzzy_word(tokens, w):
                scores[key] = scores.get(key, 0) + 0.6
                hits.setdefault(key, []).append(w)
    if not scores:
        return None, []
    key = max(scores, key=scores.get)
    return key, hits[key]


def resolve_day(day: str | None, now: datetime | None = None) -> str | None:
    """'today' / 'tomorrow' -> weekday key in Algiers time."""
    if not day:
        return None
    now = now or datetime.now(TZ)
    if day == "today":
        return DAY_KEYS[now.weekday()]
    if day == "tomorrow":
        return DAY_KEYS[(now + timedelta(days=1)).weekday()]
    return day


async def parse(text: str, kind_hint: str | None = None) -> dict:
    raw = (text or "").strip()[:500]
    t = norm(raw)
    tokens = t.split()
    v = await _vocab()
    arabic = len(_ARABIC.findall(raw))
    latin = len(re.findall(r"[A-Za-z]", raw))
    language = "ar" if arabic and not latin else "mixed" if arabic and latin else "fr"

    academy = kind_hint == "teacher" or any(_has(t, m) for m in L.ACADEMY_MARKERS)
    subject, subject_hits = _best(t, tokens, v["subjects"])
    category, category_hits = (None, []) if academy and subject else _best(t, tokens, v["cats"])
    kind = kind_hint or ("teacher" if academy or (subject and not category) else "professional")

    level = grade = None
    if kind == "teacher":
        for pattern, key in L.LEVEL_PATTERNS:
            m = re.search(pattern, t)
            if m:
                level, grade = key, m.group(0).strip().upper()
                break

    wilaya = commune = None
    m = re.search(r"\bw(?:ilaya)?\s*(\d{1,2})\b", t)
    if m and 1 <= int(m.group(1)) <= 58:
        wilaya = int(m.group(1))
    for name, code, com in v["places"]:
        if name and f" {name} " in f" {t} ":
            wilaya, commune = code, com
            break

    urgency = "high" if any(_has(t, w) for w in L.URGENCY_WORDS) else "normal"
    day = next((k for k, words in L.DAY_WORDS.items() if any(_has(t, w) for w in words)), None)
    slot = next((k for k, words in L.SLOT_WORDS.items() if any(_has(t, w) for w in words)), None)
    if day == "today" and urgency == "normal" and kind == "professional":
        urgency = "high"  # "fuite ... aujourd'hui" = needed today
    mode = next((k for k, words in L.MODE_WORDS.items() if any(_has(t, w) for w in words)), None)

    intent = {"text": raw, "language": language, "kind": kind,
              "category_key": category if kind == "professional" else None,
              "subject_key": subject if kind == "teacher" else None, "level_key": level, "grade": grade,
              "wilaya_code": wilaya, "commune": commune, "urgency": urgency,
              "when": {"day": day, "weekday": resolve_day(day), "slot": slot}, "mode": mode, "parser": PARSER_VERSION,
              "evidence": {"category": category_hits[:3], "subject": subject_hits[:3]}}
    required = ["category_key", "wilaya_code"] if kind == "professional" else ["subject_key"] + ([] if mode == "online" else ["wilaya_code"])
    intent["missing"] = [f for f in required if not intent.get(f)]
    found = sum(1 for f in required if intent.get(f)) + sum(1 for x in (level, day, slot, mode, urgency == "high") if x)
    intent["confidence"] = round(min(1.0, (sum(1 for f in required if intent.get(f)) / len(required)) * 0.8 + min(found, 4) * 0.05), 2)
    return intent
