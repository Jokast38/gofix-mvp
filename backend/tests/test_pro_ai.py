"""GOFIX PRO AI: leads, DZD quotes (server totals, explicit send, double tap), client answer, follow-ups (quota,
client opt-out, reminders), agenda conflicts, dashboard, template assistant, settings and data rights."""
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from bson import ObjectId

from app.services import scheduler
from tests.conftest import login, run

PRO, OTHER = "pro08@demo.gofix.dz", "pro09@demo.gofix.dz"


def _uid(mdb, email):
    return run(mdb.users.find_one({"email": email}))["_id"]


@pytest.fixture()
def lead(mdb):
    """A request from premium.client to PRO (unlocked), and a clean PRO AI state afterwards."""
    me = _uid(mdb, PRO)
    prof = run(mdb.professional_profiles.find_one({"user_id": me}))
    client = login("premium.client@gofix.dz")
    body = {"kind": "professional", "profile_ids": [str(prof["_id"])], "category_key": prof["category_key"], "wilaya_code": 16,
            "message": "Fuite sous l'évier de la cuisine, besoin d'un devis"}
    r = client.post("/requests", json=body, headers={"Idempotency-Key": uuid.uuid4().hex})
    assert r.status_code == 201, r.text
    rid = ObjectId(r.json()["id"])
    run(mdb.requests.update_one({"_id": rid}, {"$set": {"recipients.$[r].locked": False}}, array_filters=[{"r.provider_user_id": me}]))
    yield client, login(PRO), str(rid)
    for coll in ("quotes", "pro_leads", "pro_followups"):
        run(mdb[coll].delete_many({"provider_user_id": me}))
    run(mdb.jobs.delete_many({"request_id": rid}))
    run(mdb.requests.delete_one({"_id": rid}))
    run(mdb.conversations.update_many({"provider_user_id": me}, {"$unset": {"followups_muted": ""}}))
    run(mdb.professional_profiles.update_one({"_id": prof["_id"]}, {"$unset": {"pro_ai": ""}}))


ITEMS = [{"label": "Réparation fuite", "qty": 1, "unit_price_minor": 450000}, {"label": "Joint", "qty": 2.5, "unit_price_minor": 12050}]


def _quote(pro, rid, items=ITEMS, key=None):
    r = pro.post("/pro/quotes", json={"lead_id": rid, "currency": "DZD", "items": items, "notes": "Sous réserve de diagnostic"},
                 headers={"Idempotency-Key": key or uuid.uuid4().hex})
    assert r.status_code == 201, r.text
    return r.json()


def test_lead_to_quote_to_acceptance(lead, mdb):
    client, pro, rid = lead
    leads = pro.get("/pro/leads").json()
    mine = next(x for x in leads["items"] if x["id"] == rid)
    assert mine["status"] == "new" and mine["source"] == "direct" and mine["client_name"] and mine["message"]
    assert pro.patch(f"/pro/leads/{rid}", json={"status": "won"}).json()["detail"] == "invalid_lead_transition"
    d = pro.patch(f"/pro/leads/{rid}", json={"status": "qualified", "priority": "high", "note": "Client pressé"}).json()
    assert (d["status"], d["priority"], d["note"]) == ("qualified", "high", "Client pressé")

    # totals are computed by the server, in centimes: 4 500 DA + 2.5 x 120.50 DA = 4 801.25 DA
    key = uuid.uuid4().hex
    q = _quote(pro, rid, key=key)
    assert q["status"] == "draft" and q["total_minor"] == 480125 and q["items"][1]["total_minor"] == 30125
    assert re.fullmatch(r"DEV-\d{4}-\d{6}", q["ref"])
    again = _quote(pro, rid, key=key)  # double tap on "save draft"
    assert again["id"] == q["id"] and again["replayed"] is True
    bad = pro.post("/pro/quotes", json={"lead_id": rid, "items": [{"label": "X tuyau", "qty": 1.234, "unit_price_minor": 100}]})
    assert bad.status_code == 422
    assert client.get(f"/quotes/{q['id']}").status_code == 404  # a draft is invisible to the client

    upd = pro.put(f"/pro/quotes/{q['id']}", json={"items": [ITEMS[0]], "notes": "Déplacement inclus"}).json()
    assert upd["total_minor"] == 450000

    # strangers: another pro sees nothing of this lead or quote
    other = login(OTHER)
    assert other.get(f"/pro/quotes/{q['id']}").status_code == 404
    assert other.patch(f"/pro/leads/{rid}", json={"status": "lost"}).status_code == 404
    assert other.post(f"/pro/quotes/{q['id']}/send", json={}).status_code == 404

    sent = pro.post(f"/pro/quotes/{q['id']}/send", json={}).json()
    assert sent["status"] == "sent" and sent["expires_at"] and sent["conversation_id"]
    assert pro.post(f"/pro/quotes/{q['id']}/send", json={}).json()["replayed"] is True  # double tap on "send"
    assert pro.put(f"/pro/quotes/{q['id']}", json={"items": ITEMS}).json()["detail"] == "quote_not_editable"
    msgs = run(mdb.messages.find({"conversation_id": ObjectId(sent["conversation_id"]), "quote_id": ObjectId(q["id"])}).to_list(5))
    assert len(msgs) == 1 and "4 500 DA" in msgs[0]["body"]
    assert pro.get(f"/pro/leads/{rid}").json()["status"] == "quoted"

    seen = client.get(f"/quotes/{q['id']}").json()
    assert seen["role"] == "client" and seen["total_minor"] == 450000 and "client_id" not in seen
    assert client.post(f"/quotes/{q['id']}/accept").json()["status"] == "accepted"
    assert client.post(f"/quotes/{q['id']}/reject", json={}).json()["detail"] == "quote_already_decided"
    assert pro.post(f"/quotes/{q['id']}/accept").status_code == 404  # only the client answers
    assert pro.get(f"/pro/leads/{rid}").json()["status"] == "won"

    dash = pro.get("/pro/dashboard?period=month").json()
    assert dash["quotes_sent"] >= 1 and dash["quotes_accepted"] >= 1 and dash["amount_accepted_minor"] >= 450000
    assert dash["leads_received"] >= 1 and isinstance(dash["tips"], list)
    for action in ("pro_ai.quote_created", "pro_ai.quote_sent", "pro_ai.quote_accepted", "pro_ai.lead_status"):
        assert run(mdb.audit_logs.count_documents({"action": action})) >= 1, action


def test_followups_are_capped_can_be_muted_and_remind_the_pro(lead, mdb):
    client, pro, rid = lead
    q = _quote(pro, rid)
    sent = pro.post(f"/pro/quotes/{q['id']}/send", json={"message": "Voici mon devis"}).json()
    run(mdb.quotes.update_one({"_id": ObjectId(q["id"])}, {"$set": {"sent_at": datetime.now(timezone.utc) - timedelta(days=4)}}))
    todo = pro.get("/pro/followups").json()
    assert any(s["quote"]["id"] == q["id"] for s in todo["to_follow"])

    body = {"lead_id": rid, "quote_id": q["id"], "message": "Avez-vous pu regarder mon devis ?"}
    assert pro.post("/pro/followups/send", json=body).status_code == 201
    assert pro.post("/pro/followups/send", json=body).json()["detail"] == "followup_quota"  # min. 24 h between two
    assert not any(s["quote"]["id"] == q["id"] for s in pro.get("/pro/followups").json()["to_follow"])

    # the client opts out: no more follow-ups in this conversation
    assert client.post(f"/conversations/{sent['conversation_id']}/followups-mute", json={"muted": True}).json()["muted"] is True
    assert pro.post(f"/conversations/{sent['conversation_id']}/followups-mute", json={"muted": False}).status_code == 404
    run(mdb.pro_followups.delete_many({"request_id": ObjectId(rid)}))
    assert pro.post("/pro/followups/send", json=body).json()["detail"] == "followups_muted"
    assert client.get(f"/quotes/{q['id']}").json()["followups_muted"] is True

    # a planned follow-up only reminds the pro
    due = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    f = pro.post("/pro/followups", json={"lead_id": rid, "due_at": due, "note": "Rappeler Amine"}).json()
    run(mdb.pro_followups.update_one({"_id": ObjectId(f["id"])}, {"$set": {"due_at": datetime.now(timezone.utc) - timedelta(minutes=1)}}))
    assert run(scheduler.run_once())["followups_reminded"] >= 1
    assert run(mdb.notifications.count_documents({"user_id": _uid(mdb, PRO), "type": "followup"})) >= 1

    # validity: past expiry the client can no longer accept, then the scheduler marks it expired
    run(mdb.quotes.update_one({"_id": ObjectId(q["id"])}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}}))
    assert client.post(f"/quotes/{q['id']}/accept").json()["detail"] == "quote_expired"
    assert run(scheduler.run_once())["quotes_expired"] >= 1
    assert client.get(f"/quotes/{q['id']}").json()["status"] == "expired"


def test_assistant_agenda_settings_and_data(lead, mdb):
    client, pro, rid = lead
    reply = pro.post("/pro/assistant/draft", json={"purpose": "reply", "lead_id": rid, "lang": "fr"}).json()
    assert reply["generated_by"] == "template" and "{" not in reply["text"] and reply["text"].startswith("Bonjour ")
    ar = pro.post("/pro/assistant/draft", json={"purpose": "reply", "lead_id": rid, "lang": "ar", "tone": "friendly"}).json()
    assert "مرحبًا" in ar["text"]
    assert pro.post("/pro/assistant/draft", json={"purpose": "quote_intro", "lead_id": rid}).json()["detail"] == "quote_required"
    q = _quote(pro, rid)
    fu = pro.post("/pro/assistant/draft", json={"purpose": "followup", "quote_id": q["id"], "lang": "en"}).json()
    assert fu["purpose"] == "followup_quote" and q["ref"] in fu["text"] and "4,801.25 DA" in fu["text"]
    assert run(mdb.messages.count_documents({"body": fu["text"]})) == 0  # the assistant never sends

    start = (datetime.now(timezone.utc) + timedelta(days=3)).replace(minute=0, second=0, microsecond=0)
    a = pro.post("/pro/appointments", json={"lead_id": rid, "start_at": start.isoformat(), "duration_min": 90, "price_da": 4500})
    assert a.status_code == 201, a.text
    assert a.json()["status"] == "proposed" and a.json()["duration_min"] == 90
    clash = {"lead_id": rid, "start_at": (start + timedelta(minutes=60)).isoformat(), "duration_min": 60}
    assert pro.post("/pro/appointments", json=clash).json()["detail"] == "time_conflict"
    assert pro.post("/pro/appointments", json=clash | {"allow_conflict": True}).status_code == 201
    agenda = pro.get(f"/pro/appointments?start={(start - timedelta(hours=1)).isoformat().replace('+', '%2B')}&days=2").json()["items"]
    assert len(agenda) == 2 and all(x["conflict"] for x in agenda)

    assert pro.patch("/pro/settings", json={"followup_after_days": 5, "reminders": False}).json()["followup_after_days"] == 5
    assert pro.get("/pro/settings").json()["reminders"] is False
    pro.post(f"/pro/quotes/{q['id']}/send", json={})
    _quote(pro, rid)  # another draft
    exported = pro.get("/pro/export").json()
    assert len(exported["quotes"]) == 2 and exported["settings"]["followup_after_days"] == 5
    gone = pro.delete("/pro/data").json()
    assert gone["drafts"] == 1
    left = pro.get("/pro/quotes").json()["items"]
    assert [x["status"] for x in left] == ["sent"]  # the client keeps the quote he received
    assert pro.get("/pro/settings").json()["followup_after_days"] == 3


def test_pro_ai_requires_a_pro_profile_and_the_flag(mdb):
    client = login("premium.client@gofix.dz")
    assert client.get("/pro/leads").json()["detail"] == "profile_not_found"
    run(mdb.feature_flags.update_one({"key": "pro_ai"}, {"$set": {"enabled": False}}))
    try:
        assert login(PRO).get("/pro/dashboard").json()["detail"] == "feature_disabled"
    finally:
        run(mdb.feature_flags.update_one({"key": "pro_ai"}, {"$set": {"enabled": True}}))
