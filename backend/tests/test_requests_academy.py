"""P4 free access + P5 Academy: multi-teacher requests, accept/refuse, messaging, reviews per subject."""
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from tests.conftest import login, register, run


def _teacher_ids(c, n=3):
    items = c.get("/catalog/teachers", params={"subject_key": "math"}).json()["items"]
    assert len(items) >= 2
    return [x["id"] for x in items[:n]]


def test_student_sends_to_several_teachers_who_accept_or_refuse(mdb):
    student = login("eleve@gofix.dz")
    ids = _teacher_ids(student)
    r = student.post("/requests", json={"kind": "teacher", "profile_ids": ids, "subject_key": "math", "level_key": "secondary",
                                        "format": "online", "message": "Bonjour, cours de maths pour le BAC svp."})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    profiles = {str(p["_id"]): p for p in run(mdb.teacher_profiles.find({"_id": {"$in": [ObjectId(i) for i in ids]}}).to_list(10))}
    emails = {}
    for pid, p in profiles.items():
        u = run(mdb.users.find_one({"_id": p["user_id"]}))
        emails[pid] = u["email"]
    first, second = ids[0], ids[1]
    t1, t2 = login(emails[first]), login(emails[second])
    for t in (t1, t2):
        inbox = t.get("/requests/inbox").json()["items"]
        assert any(x["id"] == rid and x["message"] for x in inbox)
    acc = t1.post(f"/requests/{rid}/respond", json={"action": "accept", "reply": "Avec plaisir !"})
    assert acc.status_code == 200 and acc.json()["conversation_id"]
    assert t1.post(f"/requests/{rid}/respond", json={"action": "refuse"}).status_code == 409
    assert t2.post(f"/requests/{rid}/respond", json={"action": "refuse"}).status_code == 200
    conv = acc.json()["conversation_id"]
    assert student.post(f"/conversations/{conv}/messages", json={"body": "Merci, mardi 18h ?"}).status_code == 201
    assert len(t1.get(f"/conversations/{conv}").json()["messages"]) == 3
    mine = student.get("/requests/mine").json()["items"]
    statuses = {x["profile_id"]: x["status"] for x in next(m for m in mine if m["id"] == rid)["recipients"]}
    assert statuses[first] == "accepted" and statuses[second] == "refused"
    # verified review: only after a completed lesson, rated per subject
    from datetime import datetime, timedelta, timezone
    soon = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    job = t1.post("/jobs", json={"conversation_id": conv, "scheduled_at": soon, "mode": "online", "subject_key": "math"}).json()
    assert job["status"] == "proposed" and "confirm" not in job["actions"]
    assert student.post(f"/jobs/{job['id']}/review", json={"rating": 5}).status_code == 403  # not completed yet
    assert student.post(f"/jobs/{job['id']}/confirm").json()["status"] == "scheduled"
    run(mdb.jobs.update_one({"_id": ObjectId(job["id"])}, {"$set": {"scheduled_at": datetime.now(timezone.utc) - timedelta(hours=2)}}))
    assert student.post(f"/jobs/{job['id']}/complete").json()["status"] == "completed"
    ok = student.post(f"/jobs/{job['id']}/review", json={"rating": 5, "comment": "Très clair"})
    assert ok.status_code == 201, ok.text
    assert student.post(f"/jobs/{job['id']}/review", json={"rating": 1}).status_code == 403
    p = run(mdb.teacher_profiles.find_one({"_id": ObjectId(first)}))
    assert p["ratings_by_subject"]["math"]["count"] >= 1
    assert run(mdb.reviews.find_one({"job_id": ObjectId(job["id"])}))["verified"] is True


def test_free_provider_blocked_after_threshold_then_unlocked_by_subscription(mdb):
    pro_user = run(mdb.users.find_one({"email": "pro02@demo.gofix.dz"}))
    prof = run(mdb.professional_profiles.find_one({"user_id": pro_user["_id"]}))
    run(mdb.subscriptions.delete_many({"user_id": pro_user["_id"]}))
    run(mdb.professional_profiles.update_one({"_id": prof["_id"]}, {"$set": {"free_access": {
        "started_at": datetime.now(timezone.utc) - timedelta(days=3), "requests_received": 5}}}))
    pro = login("pro02@demo.gofix.dz")
    assert pro.get("/provider/me").json()["access"]["blocked"] is True
    premium = login("premium.client@gofix.dz")
    r = premium.post("/requests", json={"kind": "professional", "profile_ids": [str(prof["_id"])], "message": "Besoin d'un électricien demain."})
    assert r.status_code == 201
    rid = r.json()["id"]
    item = next(x for x in pro.get("/requests/inbox").json()["items"] if x["id"] == rid)
    assert item["locked"] is True and item["message"] is None and item["client_name"] is None
    assert pro.post(f"/requests/{rid}/respond", json={"action": "accept"}).status_code == 402
    # 30-day rule alone also blocks
    run(mdb.professional_profiles.update_one({"_id": prof["_id"]}, {"$set": {"free_access": {
        "started_at": datetime.now(timezone.utc) - timedelta(days=31), "requests_received": 0}}}))
    assert pro.get("/provider/me").json()["access"]["blocked"] is True
    # paying unlocks the waiting request
    o = pro.post("/billing/orders", json={"plan_key": "professional_pro"}).json()
    pro.post(f"/billing/mock/{o['gateway_order_id']}/simulate", json={"outcome": "paid"})
    assert pro.post(f"/billing/orders/{o['order_number']}/confirm").json()["status"] == "paid"
    item = next(x for x in pro.get("/requests/inbox").json()["items"] if x["id"] == rid)
    assert item["locked"] is False and item["message"]
    assert pro.get("/provider/me").json()["access"]["blocked"] is False


def test_open_request_dispatched_by_matching():
    c, _ = register()
    r = c.post("/requests", json={"kind": "professional", "category_key": "plumber", "wilaya_code": 16,
                                  "message": "Fuite d'eau sous l'évier, urgent."})
    assert r.status_code == 201, r.text
    mine = c.get("/requests/mine").json()["items"][0]
    assert mine["mode"] == "open" and mine["recipients"]
    assert all(x["display_name"] is None for x in mine["recipients"])  # identities hidden until acceptance


def test_reports_are_queued(mdb):
    c, _ = register()
    pid = c.get("/catalog/professionals").json()["items"][0]["id"]
    assert c.post("/reports", json={"target_type": "professional", "target_id": pid, "reason": "fake_profile"}).status_code == 201
    admin = login("moderateur@gofix.dz")
    assert any(x["target_id"] == pid for x in admin.get("/admin/reports").json())
