"""English language: reference data, server texts and rule-based search."""
import string
from datetime import datetime, timezone

import pytest

from tests.conftest import run

from app.core.db import db
from app.data import seed_data as S
from app.data import seed_en as EN
from app.data.messages import MESSAGES, lang_of, message
from app.seed import seed_english
from app.services import intent
from app.services.faq_search import search
from app.services.matching import TEMPLATES
from app.services.notify import notify_key


def test_every_reference_item_has_an_english_name():
    assert {k for k, *_ in S.FAMILIES + S.EXTRA_FAMILIES} == set(EN.FAMILIES)
    assert {k for k, *_ in S.CATEGORIES} == set(EN.CATEGORIES)
    assert {k for k, *_ in S.ROLES} == set(EN.ROLES)
    assert {k for k, *_ in S.SPECIALTIES} == set(EN.SPECIALTIES)
    assert {k for k, *_ in S.SUBJECTS} == set(EN.SUBJECTS)
    assert {k for k, *_ in S.LEVELS} == set(EN.LEVELS)
    assert {f"{aud}_{k}" for aud, k, *_ in S.PLANS} == set(EN.PLANS)
    assert {q for _, q, *_ in S.FAQ} == set(EN.FAQ)


def test_plan_perks_match_the_french_ones():
    for aud, key, _, _, _, _, perks in S.PLANS:
        assert len(EN.PLANS[f"{aud}_{key}"][1]) == len(perks)


def test_english_templates_cover_french_ones():
    assert set(TEMPLATES["en"]) == set(TEMPLATES["fr"])


@pytest.mark.parametrize("key", list(MESSAGES))
def test_messages_exist_in_french_and_english_with_the_same_values(key):
    fields = {lang: {f for part in MESSAGES[key][lang] for _, f, _, _ in string.Formatter().parse(part) if f} for lang in ("fr", "en")}
    assert fields["fr"] == fields["en"]


def test_message_language_and_fallback():
    assert message("job_completed", "en")[0] == "Job completed"
    assert message("job_completed", "fr")[0] == "Prestation terminée"
    assert message("job_completed", "ar")[0] == "Prestation terminée"  # no Arabic text yet
    assert message("job_completed", None)[0] == "Prestation terminée"


class _Req:
    def __init__(self, value):
        self.headers = {"Accept-Language": value} if value else {}


@pytest.mark.parametrize("header,expected", [("en", "en"), ("en-GB,en;q=0.9", "en"), ("ar", "ar"), ("fr", "fr"), (None, "fr"), ("de", "fr")])
def test_lang_of(header, expected):
    assert lang_of(_Req(header)) == expected


@pytest.mark.parametrize("question,expected", [
    ("how do I create an account", "Comment créer un compte ?"),
    ("I forgot my password", "J'ai oublié mon mot de passe"),
    ("how much does it cost", "Quelles sont les offres et leurs prix ?"),
    ("where is my invoice", "Où trouver ma facture ?"),
])
def test_chatbot_search_understands_english(question, expected):
    entries = [{"question_fr": q, "question_en": EN.FAQ[q][0], "variants_en": EN.FAQ[q][2]} for _, q, *_ in S.FAQ]
    score, best = search(question, entries)[0]
    assert best["question_fr"] == expected
    assert score >= 0.45  # default chatbot_min_confidence


def test_seed_english_keeps_back_office_edits():
    run(db.taxonomy_categories.update_one({"key": "plumber"}, {"$set": {"name_en": "Edited in the back office"}}))
    run(seed_english())
    assert run(db.taxonomy_categories.find_one({"key": "plumber"}))["name_en"] == "Edited in the back office"
    run(db.taxonomy_categories.update_one({"key": "plumber"}, {"$set": {"name_en": ""}}))
    run(seed_english())
    assert run(db.taxonomy_categories.find_one({"key": "plumber"}))["name_en"] == "Plumber"


def test_reference_data_is_seeded_in_english():
    assert run(db.wilayas.find_one({"code": 16}))["name_en"] == "Algiers"
    plan = run(db.plans.find_one({"key": "student_student_pass"}))
    assert plan["name_en"] == "Student Pass" and plan["perks_en"]
    assert run(db.faq_entries.find_one({"question_fr": "Comment créer un compte ?"}))["answer_en"].startswith("Click")


@pytest.mark.parametrize("text,field,value", [
    ("leak in Kouba today", "category_key", "plumber"),
    ("I need an electrician in Oran tomorrow morning", "category_key", "electrician"),
    ("online maths teacher for high school", "subject_key", "math"),
    ("plumber in Algiers", "wilaya_code", 16),
    ("urgent locksmith in Oran", "urgency", "high"),
])
def test_ai_match_understands_english(text, field, value):
    assert run(intent.parse(text))[field] == value


def test_french_parsing_is_unchanged():
    out = run(intent.parse("fuite à Kouba aujourd'hui"))
    assert out["category_key"] == "plumber" and out["wilaya_code"] == 16 and out["commune"] == "Kouba"


def test_notification_is_written_in_the_recipient_language():
    user = run(db.users.find_one({"email": "client@gofix.dz"}))
    run(db.users.update_one({"_id": user["_id"]}, {"$set": {"preferred_language": "en"}}))
    try:
        run(notify_key(user["_id"], "job", "job_confirmed", "/jobs/1", channels=("inapp",), at=datetime(2026, 11, 2, 9, 30, tzinfo=timezone.utc)))
        run(notify_key(user["_id"], "review", "review_new", "/dashboard", channels=("inapp",), rating=5))
    finally:
        run(db.users.update_one({"_id": user["_id"]}, {"$set": {"preferred_language": "fr"}}))
    rows = run(db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(2))
    assert {r["title"] for r in rows} == {"Appointment confirmed", "New verified review"}
    assert any(r["body"] == "On 02/11/2026 at 10:30." for r in rows)  # Algiers time
