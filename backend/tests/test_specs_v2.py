"""Cahier des charges « 7 innovations » — acceptance criteria for the P0 modules and the job lifecycle:
suspension (GF1-002), RequestIntent (GF1-001), recommendations (GF1-003/004/005), Trust v2 (GF2-001..005), jobs/disputes/reviews."""
import time
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.services import intent, scheduler, trust
from tests.conftest import Api, login, register, run


def _profile_of(mdb, email, coll="professional_profiles"):
    u = run(mdb.users.find_one({"email": email}))
    return run(mdb[coll].find_one({"user_id": u["_id"]}))


# ---------- 1. Suspension ----------
def test_suspended_profile_never_appears(mdb):
    target = _profile_of(mdb, "pro05@demo.gofix.dz")
    admin = login("moderateur@gofix.dz")
    assert admin.patch(f"/admin/users/{target['user_id']}/status", json={"status": "suspended", "reason": "test suspension"}).status_code == 200
    try:
        api = login("premium.client@gofix.dz")
        ids = {x["id"] for x in api.get("/catalog/professionals", params={"page_size": 50}).json()["items"]}
        assert str(target["_id"]) not in ids
        assert api.get(f"/catalog/professionals/{target['_id']}").status_code == 404
        rec = api.post("/match/recommend", json={"kind": "professional", "category_key": target["category_key"],
                                                 "wilaya_code": target["zones"][0]["wilaya_code"]}).json()
        assert str(target["_id"]) not in {x["id"] for x in rec["items"] + rec["alternatives"]}
        assert api.post("/conversations", json={"kind": "professional", "profile_id": str(target["_id"]), "body": "Bonjour"}).status_code == 404
    finally:
        admin.patch(f"/admin/users/{target['user_id']}/status", json={"status": "active", "reason": "fin du test"})
    assert str(target["_id"]) in {x["id"] for x in Api().get("/catalog/professionals", params={"page_size": 50}).json()["items"]}


# ---------- 2. AI MATCH ----------
def test_parse_urgent_service_request():
    i = run(intent.parse("fuite à Kouba aujourd'hui"))
    assert i["kind"] == "professional" and i["category_key"] == "plumber"
    assert i["wilaya_code"] == 16 and i["commune"] == "Kouba"
    assert i["urgency"] == "high" and i["when"]["day"] == "today" and not i["missing"]


def test_parse_school_request():
    i = run(intent.parse("prof de maths 3AS en visio mardi soir"))
    assert i["kind"] == "teacher" and i["subject_key"] == "math" and i["level_key"] == "secondary" and i["grade"] == "3AS"
    assert i["mode"] == "online" and i["when"]["weekday"] == "tue" and i["when"]["slot"] == "evening" and not i["missing"]


def test_parse_arabic_and_missing_fields():
    i = run(intent.parse("أحتاج سباك في وهران غدا"))
    assert i["category_key"] == "plumber" and i["wilaya_code"] == 31 and i["when"]["day"] == "tomorrow" and i["language"] == "ar"
    vague = run(intent.parse("j'ai besoin d'aide rapidement"))
    assert set(vague["missing"]) == {"category_key", "wilaya_code"} and vague["urgency"] == "high"


def test_recommend_from_free_text_is_explainable_and_traced(mdb):
    c = login("premium.client@gofix.dz")
    t0 = time.perf_counter()
    r = c.post("/match/recommend", json={"text": "fuite à Kouba aujourd'hui"}).json()
    assert time.perf_counter() - t0 < 1.0  # deterministic path, no AI dependency
    assert 1 <= len(r["items"]) <= 5 and r["intent"]["category_key"] == "plumber" and r["fallback_used"] is False
    for it in r["items"]:
        assert it["category_key"] == "plumber" and any(z["wilaya_code"] == 16 for z in it["zones"])
        assert len(it["match"]["reasons"]) >= 2 and 0 <= it["match"]["score"] <= 100
    mr = run(mdb.match_results.find_one({"_id": ObjectId(r["match_result_id"])}))
    assert mr["formula_version"].startswith("rules-v2") and mr["results"][0]["components"]
    exp = c.get(f"/match/explanations/{r['match_result_id']}", params={"profile_id": r["items"][0]["id"]}).json()
    assert exp["results"][0]["components"] and exp["formula_version"] == mr["formula_version"]
    assert c.post("/match/feedback", json={"match_result_id": r["match_result_id"], "profile_id": r["items"][0]["id"], "action": "click"}).status_code == 201
    assert Api().get(f"/match/explanations/{r['match_result_id']}").status_code == 404  # not someone else's


def test_recommend_teachers_online_tuesday_evening():
    c = login("eleve@gofix.dz")
    r = c.post("/match/recommend", json={"text": "prof de maths 3AS en visio mardi soir"}).json()
    assert r["kind"] == "teacher" and r["items"]
    for it in r["items"]:
        assert "online" in it["formats"] and any(s["key"] == "math" for s in it["subjects_full"])
        slots = (it.get("availability") or {}).get("slots") or []
        assert not slots or any(s["day"] == "tue" and s["slot"] == "evening" for s in slots)


def test_recommend_asks_for_missing_category():
    r = Api().post("/match/recommend", json={"text": "besoin de quelqu'un à Oran"}).json()
    assert r["items"] == [] and "category_key" in r["missing"]


# ---------- 3. TRUST SCORE v2 ----------
def test_new_verified_pro_without_jobs_is_not_artificially_high(mdb):
    _, user = register("professional")
    now = datetime.now(timezone.utc)
    pid = run(mdb.professional_profiles.insert_one({
        "user_id": ObjectId(user["id"]), "display_name": "Nouveau Pro", "category_key": "plumber", "family_key": "home_services",
        "zones": [{"wilaya_code": 16}], "verification_status": "verified", "created_at": now,
        "documents": [{"type": "id_card", "status": "validated"}, {"type": "trade_register", "status": "validated"}]})).inserted_id
    score = run(trust.recompute("professional", pid))
    p = run(mdb.professional_profiles.find_one({"_id": pid}))
    assert p["trust_subscores"]["identity"] == 100 and score <= 60
    assert p["trust_status"] == "insufficient" and p["trust_public"] is False
    pub = Api().get(f"/trust/profiles/professional/{pid}").json()
    assert pub["status"] == "insufficient" and pub.get("score") is None


def test_admin_trust_event_and_recompute_are_audited(mdb):
    prof = _profile_of(mdb, "pro02@demo.gofix.dz")  # verified, with history
    admin = login("moderateur@gofix.dz")
    before = run(trust.recompute("professional", prof["_id"]))
    r = admin.post(f"/trust/events/professional/{prof['_id']}", json={"type": "fake_document", "reason": "RC falsifié", "evidence_id": "trade_register"})
    assert r.status_code == 201 and r.json()["score"] < before and r.json()["score"] <= 30
    assert run(mdb.trust_events.find_one({"profile_id": prof["_id"], "type": "fake_document"}))["source_type"] == "moderation"
    run(mdb.professional_profiles.update_one({"_id": prof["_id"]}, {"$set": {"trust_flags": []}}))  # flag corrected
    rec = admin.post(f"/trust/recompute/professional/{prof['_id']}", json={"reason": "flag annulé après vérification"}).json()
    assert rec["after"] == before
    assert run(mdb.audit_logs.count_documents({"action": "trust.recompute", "target_id": str(prof["_id"])})) == 1


# ---------- Job lifecycle ----------
def _conversation_with(client: Api, mdb, email):
    prof = _profile_of(mdb, email)
    conv = client.post("/conversations", json={"kind": "professional", "profile_id": str(prof["_id"]), "body": "Bonjour"}).json()
    return prof, conv["id"]


def _scheduled_job(client, pro, conv_id, mdb, *, past=True):
    soon = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    job = pro.post("/jobs", json={"conversation_id": conv_id, "scheduled_at": soon, "mode": "home"}).json()
    assert client.post(f"/jobs/{job['id']}/confirm").json()["status"] == "scheduled"
    if past:
        run(mdb.jobs.update_one({"_id": ObjectId(job["id"])}, {"$set": {"scheduled_at": datetime.now(timezone.utc) - timedelta(hours=3)}}))
    return job["id"]


def test_job_cancel_dispute_and_auto_complete(mdb):
    client = login("premium.client@gofix.dz")
    prof, conv = _conversation_with(client, mdb, "pro04@demo.gofix.dz")
    pro = login("pro04@demo.gofix.dz")
    base = run(trust.recompute("professional", prof["_id"]))

    # late cancellation by the provider lowers reliability
    jid = _scheduled_job(client, pro, conv, mdb, past=False)
    run(mdb.jobs.update_one({"_id": ObjectId(jid)}, {"$set": {"scheduled_at": datetime.now(timezone.utc) + timedelta(hours=3)}}))
    c = pro.post(f"/jobs/{jid}/cancel", json={"reason": "Empêchement"}).json()
    assert c["status"] == "cancelled" and c["late_cancel"] is True
    after_cancel = run(mdb.professional_profiles.find_one({"_id": prof["_id"]}))["trust_subscores"]["reliability"]
    assert after_cancel < 100

    # provider marks done; the client stays silent -> auto-completed by the scheduler
    jid = _scheduled_job(client, pro, conv, mdb)
    assert pro.post(f"/jobs/{jid}/complete").json()["status"] == "scheduled"  # provider can't complete alone
    run(mdb.jobs.update_one({"_id": ObjectId(jid)}, {"$set": {"provider_done_at": datetime.now(timezone.utc) - timedelta(hours=80)}}))
    assert run(scheduler.run_once())["jobs_auto_completed"] >= 1
    assert client.get(f"/jobs/{jid}").json()["status"] == "completed"

    # dispute resolved in favour of the client -> failed job, reliability drops, audited
    jid = _scheduled_job(client, pro, conv, mdb)
    assert client.post(f"/jobs/{jid}/dispute", json={"reason": "Le professionnel n'est pas venu"}).json()["status"] == "disputed"
    admin = login("moderateur@gofix.dz")
    assert any(d["id"] == jid for d in admin.get("/admin/disputes").json())
    rel_before = run(mdb.professional_profiles.find_one({"_id": prof["_id"]}))["trust_subscores"]["reliability"]
    assert admin.patch(f"/admin/disputes/{jid}", json={"resolution": "resolved_client", "note": "Absence confirmée"}).json()["status"] == "failed"
    p = run(mdb.professional_profiles.find_one({"_id": prof["_id"]}))
    assert p["trust_subscores"]["reliability"] < rel_before
    assert client.post(f"/jobs/{jid}/review", json={"rating": 1}).status_code == 403  # no review on a failed job
    assert run(mdb.audit_logs.count_documents({"action": "jobs.dispute_resolved", "target_id": jid})) == 1
    assert base is not None


def test_only_the_other_party_confirms_and_strangers_see_nothing(mdb):
    client = login("premium.client@gofix.dz")
    _, conv = _conversation_with(client, mdb, "pro06@demo.gofix.dz")
    pro = login("pro06@demo.gofix.dz")
    soon = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    job = pro.post("/jobs", json={"conversation_id": conv, "scheduled_at": soon}).json()
    assert pro.post(f"/jobs/{job['id']}/confirm").status_code == 409
    stranger, _ = register()
    assert stranger.get(f"/jobs/{job['id']}").status_code == 404
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert pro.post("/jobs", json={"conversation_id": conv, "scheduled_at": past}).status_code == 422
