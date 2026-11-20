"""EDU AI level tests: question bank, scoring and recommendations.
Answers stay on the server until an attempt is finished; scores are an indicative diagnostic, never a certification."""
from datetime import datetime, timezone

from app.core.db import db
from app.data import edu_bank as BANK
from app.services.entitlements import active_subscription

ACTIVE = {"status": {"$ne": "archived"}}
STATUSES = ("draft", "published", "archived")
PASS_PCT = 60  # documents: 4/6 recommended before the next difficulty
MIN_ITEMS_PER_SUBJECT = 3  # below that, a per-subject rate is "insufficient data"
TESTS_PER_SERIES = 5
# Test subject -> Academy subject used to suggest teachers.
TEACHER_SUBJECT = {"math": "math", "reasoning": "math", "french": "french", "sciences": "sciences", "physics": "physics",
                   "english": "english", "arabic": "arabic", "philosophy": "philosophy", "computer_science": "computer_science"}


async def ensure_bank() -> int:
    """Adds the bank's missing items (an item already in the database keeps its content and validation status)."""
    now = datetime.now(timezone.utc)
    added = 0
    for item in BANK.all_items():
        res = await db.edu_items.update_one({"key": item["key"]}, {"$setOnInsert": item | {"status": "draft", "source": BANK.SOURCE, "created_at": now}},
                                            upsert=True)
        added += bool(res.upserted_id)
    return added


def band(pct: int) -> str:
    return "very_good" if pct >= 80 else "satisfactory" if pct >= PASS_PCT else "fragile" if pct >= 40 else "to_strengthen"


def next_test_key(test_key: str) -> str | None:
    """Next difficulty of the same series (class-1AP-2 -> class-1AP-3, lang-fr-4 -> lang-fr-5)."""
    head, _, num = test_key.rpartition("-")
    if test_key.startswith(("class-", "lang-")) and num.isdigit() and int(num) < TESTS_PER_SERIES:
        return f"{head}-{int(num) + 1}"
    return None


def level_key(item: dict) -> str | None:
    """Academy level of an item, for the teacher suggestion."""
    if item["kind"] == "higher":
        return "university"
    return BANK.CYCLE.get(item.get("level"))


async def has_student_pass(user) -> bool:
    return bool(user and await active_subscription(user.id, ["student"]))


async def score(items: list[dict], options: dict, answers: dict) -> dict:
    """items: bank items of the attempt; options: key -> (shuffled options, correct index); answers: key -> chosen index."""
    corrections, subjects = [], {}
    for it in items:
        opts, correct = options[it["key"]]
        chosen = answers.get(it["key"])
        chosen = chosen if isinstance(chosen, int) and 0 <= chosen < len(opts) else None
        ok = chosen == correct
        s = subjects.setdefault(it["subject"], {"subject": it["subject"], "correct": 0, "total": 0})
        s["total"] += 1
        s["correct"] += ok
        corrections.append({"key": it["key"], "subject": it["subject"], "skill": it.get("skill"), "question": it["question"], "options": opts,
                            "chosen": chosen, "correct": correct, "ok": ok, "explanation": it.get("explanation")})
    total = len(items)
    good = sum(c["ok"] for c in corrections)
    pct = round(good * 100 / total) if total else 0
    for s in subjects.values():
        s["pct"] = round(s["correct"] * 100 / s["total"]) if s["total"] >= MIN_ITEMS_PER_SUBJECT else None
    # Teachers are suggested for the weakest subject that has Academy teachers.
    teachable = [s for s in subjects.values() if s["subject"] in TEACHER_SUBJECT]
    weakest = min(teachable, key=lambda s: (s["correct"] / s["total"], -s["total"]), default=None)
    first = items[0] if items else {}
    return {"correct": good, "total": total, "score": pct, "band": band(pct), "passed": pct >= PASS_PCT,
            "subjects": list(subjects.values()), "corrections": corrections,
            "recommendation": {"subject_key": TEACHER_SUBJECT[weakest["subject"]], "level_key": level_key(first)} if weakest else None}
