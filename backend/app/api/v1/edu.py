"""EDU AI: level tests by class (1AP-3AS), language quizzes (fr/en/ar) and higher-education tracks.
A signed-in learner keeps every result to follow their progress; a visitor sees their result once (nothing is kept)."""
import hashlib
import random
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import db
from app.core.deps import client_ip, get_current_user, get_optional_user, require_admin
from app.core.ratelimit import hit
from app.data import edu_bank as BANK
from app.models.user import User
from app.services import edu
from app.services.audit import audit
from app.services.config_store import is_enabled

router = APIRouter(tags=["edu"])
ATTEMPT_TTL = timedelta(hours=24)  # an unfinished attempt is forgotten after a day
_rng = random.SystemRandom()


def _now():
    return datetime.now(timezone.utc)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def _enabled():
    if not await is_enabled("edu_ai"):
        raise HTTPException(404, "feature_disabled")


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(404, "attempt_not_found")


@router.get("/edu/catalog")
async def catalog(user: User | None = Depends(get_optional_user)):
    await _enabled()
    counts = {d["_id"]: d for d in await db.edu_items.aggregate([
        {"$match": edu.ACTIVE},
        {"$group": {"_id": "$test_key", "count": {"$sum": 1}, "draft": {"$sum": {"$cond": [{"$eq": ["$status", "draft"]}, 1, 0]}}}},
    ]).to_list(1000)}
    best = {}
    if user:
        for d in await db.edu_attempts.aggregate([
            {"$match": {"user_id": ObjectId(user.id), "status": "finished"}},
            {"$group": {"_id": "$test_key", "best": {"$max": "$result.score"}, "tries": {"$sum": 1}}},
        ]).to_list(1000):
            best[d["_id"]] = {"best": d["best"], "tries": d["tries"]}

    def test(key, **extra):
        c = counts.get(key)
        return c and {"key": key, "count": c["count"], "draft": c["draft"] > 0, **best.get(key, {}), **extra}

    def series(prefix):
        return [t for n in range(1, edu.TESTS_PER_SERIES + 1) if (t := test(f"{prefix}-{n}", number=n))]

    classes = [{"level": lvl, "cycle": BANK.CYCLE[lvl], "tests": series(f"class-{lvl}"),
                "extra": [t for k in (f"express-{lvl}", f"import-{lvl}") if (t := test(k))]} for lvl in BANK.CLASSES]
    return {"classes": [c for c in classes if c["tests"] or c["extra"]],
            "languages": [{"lang": lang, "tests": t} for lang in BANK.LANGUAGE if (t := series(f"lang-{lang}"))],
            "higher": [t for track in BANK.TRACKS if (t := test(f"higher-{track}", track=track))],
            "pass_pct": edu.PASS_PCT}


class StartIn(BaseModel):
    test_key: str = Field(min_length=3, max_length=60)


@router.post("/edu/attempts", status_code=201)
async def start(body: StartIn, request: Request, user: User | None = Depends(get_optional_user)):
    await _enabled()
    hit(f"edu-start:{user.id if user else client_ip(request)}", 60 if user else 20, 3600)
    items = await db.edu_items.find({"test_key": body.test_key, **edu.ACTIVE}).sort("position", 1).to_list(100)
    if not items:
        raise HTTPException(404, "test_not_found")
    stored, questions = [], []
    for it in items:
        opts = [it["correct"], *it["distractors"]]
        _rng.shuffle(opts)
        stored.append({"key": it["key"], "options": opts, "correct": opts.index(it["correct"])})
        questions.append({"key": it["key"], "subject": it["subject"], "skill": it.get("skill"), "question": it["question"], "options": opts,
                          "lang": it.get("lang", "fr")})
    token = None if user else secrets.token_urlsafe(24)
    doc = {"test_key": body.test_key, "user_id": ObjectId(user.id) if user else None, "token_hash": _hash(token) if token else None,
           "items": stored, "status": "open", "created_at": _now(), "expires_at": _now() + ATTEMPT_TTL}
    res = await db.edu_attempts.insert_one(doc)
    # The correct answers never leave the server before the attempt is finished.
    return {"id": str(res.inserted_id), "token": token, "test_key": body.test_key, "questions": questions,
            "draft": any(it.get("status") == "draft" for it in items)}


class FinishIn(BaseModel):
    answers: dict[str, Optional[int]] = Field(default_factory=dict)
    token: Optional[str] = Field(default=None, max_length=100)


def _result(attempt: dict) -> dict:
    return attempt["result"] | {"id": str(attempt["_id"]), "test_key": attempt["test_key"], "finished_at": attempt["finished_at"]}


@router.post("/edu/attempts/{attempt_id}/finish")
async def finish(attempt_id: str, body: FinishIn, user: User | None = Depends(get_optional_user)):
    await _enabled()
    oid = _oid(attempt_id)
    if user:
        attempt = await db.edu_attempts.find_one({"_id": oid, "user_id": ObjectId(user.id)})
        if not attempt:
            raise HTTPException(404, "attempt_not_found")
        if attempt["status"] == "finished":
            return _result(attempt) | {"saved": True}  # sent twice: same result, scored once
    else:
        # A visitor's attempt is removed as it is scored: the result is shown once and nothing is kept.
        attempt = await db.edu_attempts.find_one_and_delete({"_id": oid, "user_id": None, "status": "open",
                                                             "token_hash": _hash(body.token or "")})
        if not attempt:
            raise HTTPException(404, "attempt_not_found")
    keys = [i["key"] for i in attempt["items"]]
    by_key = {d["key"]: d for d in await db.edu_items.find({"key": {"$in": keys}}).to_list(200)}
    items = [by_key[k] for k in keys if k in by_key]
    options = {i["key"]: (i["options"], i["correct"]) for i in attempt["items"]}
    result = await edu.score(items, options, body.answers)
    result |= {"next_test_key": edu.next_test_key(attempt["test_key"]) if result["passed"] else None,
               "student_pass": await edu.has_student_pass(user)}
    now = _now()
    if not user:
        return result | {"id": attempt_id, "test_key": attempt["test_key"], "finished_at": now, "saved": False}
    res = await db.edu_attempts.update_one({"_id": oid, "status": "open"}, {"$set": {"status": "finished", "finished_at": now, "result": result,
                                                                                    "answers": body.answers}, "$unset": {"expires_at": ""}})
    if not res.modified_count:  # finished concurrently: return the stored result
        return _result(await db.edu_attempts.find_one({"_id": oid})) | {"saved": True}
    return result | {"id": attempt_id, "test_key": attempt["test_key"], "finished_at": now, "saved": True}


@router.get("/edu/history")
async def history(user: User = Depends(get_current_user)):
    docs = await db.edu_attempts.find({"user_id": ObjectId(user.id), "status": "finished"},
                                      {"test_key": 1, "finished_at": 1, "result.score": 1, "result.band": 1, "result.correct": 1, "result.total": 1}
                                      ).sort("finished_at", -1).to_list(200)
    return [{"id": str(d["_id"]), "test_key": d["test_key"], "finished_at": d["finished_at"], **d["result"]} for d in docs]


@router.get("/edu/attempts/{attempt_id}")
async def attempt_result(attempt_id: str, user: User = Depends(get_current_user)):
    attempt = await db.edu_attempts.find_one({"_id": _oid(attempt_id), "user_id": ObjectId(user.id), "status": "finished"})
    if not attempt:
        raise HTTPException(404, "attempt_not_found")
    return _result(attempt) | {"saved": True}


# --- Back office -------------------------------------------------------------------------------------------------------
@router.get("/admin/edu/items")
async def admin_items(test_key: str = "", status: str = "", kind: str = "", q: str = "", page: int = 1, page_size: int = 50,
                      _: User = Depends(require_admin("moderator", "support"))):
    query: dict = {}
    if test_key:
        query["test_key"] = test_key
    if status in edu.STATUSES:
        query["status"] = status
    if kind:
        query["kind"] = kind
    if q.strip():
        query["question"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    page, page_size = max(page, 1), max(1, min(page_size, 100))
    total = await db.edu_items.count_documents(query)
    docs = await db.edu_items.find(query, {"_id": 0}).sort([("test_key", 1), ("position", 1)]).skip((page - 1) * page_size).to_list(page_size)
    stats = {d["_id"]: d["n"] for d in await db.edu_items.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]).to_list(10)}
    return {"total": total, "page": page, "page_size": page_size, "items": docs, "stats": stats,
            "attempts": await db.edu_attempts.count_documents({"status": "finished"})}


class StatusIn(BaseModel):
    status: Literal["draft", "published", "archived"]


@router.patch("/admin/edu/items/{key}")
async def admin_item_status(key: str, body: StatusIn, request: Request, admin: User = Depends(require_admin("moderator"))):
    res = await db.edu_items.update_one({"key": key}, {"$set": {"status": body.status, "updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(404, "item_not_found")
    await audit("edu.item_status", admin, "edu_item", key, {"status": body.status}, client_ip(request))
    return {"key": key, "status": body.status}


@router.post("/admin/edu/tests/{test_key}/status")
async def admin_test_status(test_key: str, body: StatusIn, request: Request, admin: User = Depends(require_admin("moderator"))):
    res = await db.edu_items.update_many({"test_key": test_key}, {"$set": {"status": body.status, "updated_at": _now()}})
    if not res.matched_count:
        raise HTTPException(404, "test_not_found")
    await audit("edu.test_status", admin, "edu_test", test_key, {"status": body.status, "items": res.matched_count}, client_ip(request))
    return {"test_key": test_key, "status": body.status, "items": res.matched_count}


# Import format of the developer specification: {id, level, subject, skill, question, options: [{id: "A".."D", text}],
# correct_option, explanation, difficulty, language, status}; optional test_key and position.
SUBJECTS = {"mathématiques": "math", "mathematiques": "math", "français": "french", "francais": "french", "sciences": "sciences", "éveil": "sciences",
            "svt": "sciences", "physique": "physics", "anglais": "english", "arabe": "arabic", "philosophie": "philosophy",
            "informatique": "computer_science", "économie": "economics", "raisonnement": "reasoning"}
KEY_RE = re.compile(r"^[A-Za-z0-9_-]{3,40}$")
TEST_RE = re.compile(r"^(class|lang|express|higher|import)-[A-Za-z0-9_-]{1,40}$")


def _import_item(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("not_an_object")
    key = str(raw.get("id") or raw.get("key") or "")
    if not KEY_RE.match(key):
        raise ValueError("invalid_id")
    question = str(raw.get("question") or "").strip()
    if not 3 <= len(question) <= 500:
        raise ValueError("invalid_question")
    opts = raw.get("options")
    if not isinstance(opts, list) or len(opts) != 4 or {str(o.get("id")) for o in opts if isinstance(o, dict)} != {"A", "B", "C", "D"}:
        raise ValueError("options_must_be_A_to_D")
    texts = {str(o["id"]): str(o.get("text") or "").strip() for o in opts}
    if not all(texts.values()) or len(set(texts.values())) != 4:
        raise ValueError("options_empty_or_duplicate")
    correct = str(raw.get("correct_option") or "")
    if correct not in texts:
        raise ValueError("invalid_correct_option")
    level = str(raw.get("level") or "").strip()
    if not level:
        raise ValueError("missing_level")
    lang = str(raw.get("language") or "fr")[:2].lower()
    if lang not in ("fr", "ar", "en"):
        raise ValueError("invalid_language")
    test_key = str(raw.get("test_key") or f"import-{level}")
    if not TEST_RE.match(test_key):
        raise ValueError("invalid_test_key")
    status = raw.get("status") if raw.get("status") in edu.STATUSES else "draft"
    subject = str(raw.get("subject") or "").strip()
    return {"key": key, "test_key": test_key, "position": int(raw.get("position") or 0), "kind": test_key.split("-")[0], "level": level,
            "lang": lang, "subject": SUBJECTS.get(subject.lower(), subject.lower() or "other"), "skill": str(raw.get("skill") or "")[:80],
            "question": question, "correct": texts[correct], "distractors": [t for k, t in sorted(texts.items()) if k != correct],
            "explanation": str(raw.get("explanation") or "")[:500] or None, "difficulty": raw.get("difficulty"), "status": status, "source": "import"}


class ImportIn(BaseModel):
    items: list[dict] = Field(min_length=1, max_length=2000)
    replace: bool = False  # True: an existing id is updated instead of being rejected as a duplicate


@router.post("/admin/edu/import")
async def admin_import(body: ImportIn, request: Request, admin: User = Depends(require_admin("moderator"))):
    """Validates the whole file first: nothing is written if one item is invalid or duplicated."""
    parsed, errors, seen = [], [], set()
    for i, raw in enumerate(body.items):
        try:
            item = _import_item(raw)
            if item["key"] in seen:
                raise ValueError("duplicate_in_file")
            seen.add(item["key"])
            parsed.append(item)
        except ValueError as e:
            errors.append({"index": i, "id": raw.get("id") if isinstance(raw, dict) else None, "error": str(e)})
    existing = {d["key"] for d in await db.edu_items.find({"key": {"$in": list(seen)}}, {"key": 1}).to_list(len(seen) or 1)}
    if existing and not body.replace:
        errors += [{"index": None, "id": k, "error": "already_exists"} for k in sorted(existing)]
    if errors:
        await audit("edu.import_rejected", admin, "edu_import", None, {"items": len(body.items), "errors": len(errors)}, client_ip(request))
        raise HTTPException(422, {"code": "import_invalid", "errors": errors[:100]})
    now = _now()
    for item in parsed:
        await db.edu_items.update_one({"key": item["key"]}, {"$set": item | {"updated_at": now}, "$setOnInsert": {"created_at": now}}, upsert=True)
    await audit("edu.import", admin, "edu_import", None, {"created": len(parsed) - len(existing), "updated": len(existing)}, client_ip(request))
    return {"created": len(parsed) - len(existing), "updated": len(existing)}
