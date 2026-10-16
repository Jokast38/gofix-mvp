"""P6 chatbot + P8 Trust Score / AI Match v1 rules."""
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.services import trust
from app.services.matching import MatchContext, RulesMatchingService, availability
from tests.conftest import Api, login, run

W = {"category": 30, "proximity": 20, "availability": 10, "trust": 20, "rating": 15, "response": 5}


def _p(**kw):
    base = {"category_key": "plumber", "zones": [{"wilaya_code": 16, "commune_names": ["Kouba"]}], "trust_score": 60,
            "rating_avg": 4.5, "rating_count": 10, "response_rate": 0.9, "verification_status": "verified", "availability": {"slots": []}}
    return base | kw


# ---------- AI Match ----------
def test_proximity_ranking_and_explanation():
    m = RulesMatchingService(W)
    ctx = MatchContext("professional", category_key="plumber", wilaya=16, commune="Kouba")
    same_commune, same_wilaya = _p(), _p(zones=[{"wilaya_code": 16, "commune_names": []}])
    other = _p(zones=[{"wilaya_code": 31, "commune_names": []}])
    ranked = run(m.rank([other, same_wilaya, same_commune], ctx))
    assert ranked[0] is same_commune and other not in ranked  # out-of-zone profiles are excluded before ranking
    assert "dans votre commune" in same_commune["_match"]["explanation"]
    assert "4.5/5" in same_commune["_match"]["explanation"] or "noté" in same_commune["_match"]["explanation"]


def test_explanation_in_arabic_and_hidden_numbers_for_blurred():
    m = RulesMatchingService(W)
    ar = m.score(_p(), MatchContext("professional", category_key="plumber", wilaya=16, lang="ar"))
    assert "ولايتك" in ar["explanation"]
    hidden = m.score(_p(), MatchContext("professional", category_key="plumber", hide_numbers=True))
    assert "4.5" not in hidden["explanation"]


def test_missing_data_falls_back_without_error():
    m = RulesMatchingService(W)
    bare = {"category_key": "plumber"}
    s = m.score(bare, MatchContext("professional", category_key="plumber"))
    assert 0 <= s["score"] <= 100
    ranked = run(m.rank([{"trust_score": 10}, {"trust_score": 90}], MatchContext()))
    assert ranked[0]["trust_score"] == 90


def test_availability_today_tomorrow():
    from zoneinfo import ZoneInfo
    sat = datetime(2026, 10, 3, 10, tzinfo=ZoneInfo("Africa/Algiers"))  # a Saturday
    assert availability([{"day": "sat"}], sat) == "available_today"
    assert availability([{"day": "sun"}], sat) == "available_tomorrow"
    assert availability([{"day": "wed"}], sat) == "available_week"
    assert availability([], sat) is None


def test_teacher_subject_level_match():
    m = RulesMatchingService(W)
    ctx = MatchContext("teacher", subject_key="math", level_key="secondary")
    good = {"subjects": [{"subject_key": "math", "level_keys": ["secondary"]}], "trust_score": 50}
    half = {"subjects": [{"subject_key": "math", "level_keys": ["primary"]}], "trust_score": 50}
    assert m.score(good, ctx)["score"] > m.score(half, ctx)["score"]


def test_catalog_returns_top_matches_with_explanations():
    body = Api().get("/catalog/professionals", params={"category_key": "plumber", "wilaya": 16}).json()
    assert body["ai_match"] is True
    tops = [x for x in body["items"] if x["match"]["top"]]
    assert 0 < len(tops) <= 5 and all(x["match"]["explanation"] for x in tops)


# ---------- Trust Score ----------
def test_trust_score_cannot_be_bought(mdb):
    prof = run(mdb.professional_profiles.find_one({"verification_status": "verified"}))
    before = run(trust.recompute("professional", prof["_id"]))
    now = datetime.now(timezone.utc)
    run(mdb.subscriptions.insert_one({"user_id": prof["user_id"], "plan_key": "professional_premium", "tier": "premium",
                                      "audience": "professional", "status": "active", "starts_at": now, "ends_at": now + timedelta(days=30)}))
    run(mdb.professional_profiles.update_one({"_id": prof["_id"]}, {"$set": {"plan_key": "professional_premium"}}))
    assert run(trust.recompute("professional", prof["_id"])) == before


def test_trust_events_are_traced(mdb):
    prof = run(mdb.professional_profiles.find_one({"verification_status": "verified", "trust_public": True}))
    base = run(trust.recompute("professional", prof["_id"]))
    run(mdb.professional_profiles.update_one({"_id": prof["_id"]}, {"$set": {"verification_status": "unverified"}}))
    lower = run(trust.recompute("professional", prof["_id"], "verification_unverified", "test", source_type="moderation"))
    assert lower < base
    ev = run(mdb.trust_events.find_one({"profile_id": prof["_id"], "type": "verification_unverified"}))
    assert ev and ev["weight"] == lower - base and ev["source_type"] == "moderation" and ev["formula_version"] == "trust-v2"
    run(mdb.professional_profiles.update_one({"_id": prof["_id"]}, {"$set": {"verification_status": "verified"}}))
    run(trust.recompute("professional", prof["_id"]))


def test_provider_sees_breakdown_and_can_contest():
    pro = login("pro@gofix.dz")
    me = pro.get("/provider/me").json()
    assert me["trust"]["breakdown"] and 0 <= me["trust"]["score"] <= 100
    assert set(me["trust"]["subscores"]) == {"identity", "reactivity", "satisfaction", "reliability"}
    assert me["trust"]["status"] in ("insufficient", "established", "excellent")
    assert pro.post("/provider/trust/contest", json={"message": "Mon ancienneté réelle est de 10 ans."}).status_code == 201
    assert login("moderateur@gofix.dz").get("/admin/trust/contests").json()


# ---------- Chatbot ----------
def test_chatbot_answers_faq_with_typos():
    api = Api()
    for q, expected in [("comment payer avec edahabia", "CIB"), ("pourquoi la liste est floue", "Pro ou Premium"),
                        ("je veux suprimer mon conte", "Supprimer mon compte"), ("quels sont les tarifs", "Offres")]:
        r = api.post("/chatbot/ask", json={"message": q}).json()
        assert r["answered"], q
        assert expected in r["answer"], (q, r["answer"])


def test_chatbot_admits_ignorance_and_hands_off(mdb):
    api = Api()
    r = api.post("/chatbot/ask", json={"message": "quel temps fera-t-il à Oran demain ?"}).json()
    assert r["answered"] is False and r["handoff"] is True and r["answer"] is None
    t = api.post("/chatbot/handoff", json={"message": "Je veux parler à quelqu'un", "name": "Test", "phone": "0550123456"})
    assert t.status_code == 201
    assert run(mdb.support_tickets.find_one({"_id": ObjectId(t.json()["ticket_id"])}))["source"] == "chatbot"
    report = login("support@gofix.dz").get("/admin/chatbot/unanswered").json()
    assert any("oran" in x["question"].lower() for x in report["items"])
