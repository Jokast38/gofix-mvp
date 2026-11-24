"""GOFIX VOICE: dictated text -> summary to check -> confirmation (corrections recorded, no text stored),
plus the extraction rate measured on a corpus of dictated requests (FR / AR / darija / mixed / EN)."""
import json
import os
from collections import defaultdict

from bson import ObjectId

from tests.conftest import Api, login, run

CORPUS = json.load(open(os.path.join(os.path.dirname(__file__), "data", "voice_corpus.json"), encoding="utf-8"))["items"]


def test_dictation_is_analysed_then_confirmed_without_keeping_the_text(mdb):
    api = Api()
    text = "J'ai besoin d'un plombier à Bab Ezzouar, c'est urgent"
    r = api.post("/voice/intents", json={"text": text, "locale": "fr-FR", "engine": "device", "duration_s": 6.2})
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["category_key"] == "plumber" and v["wilaya_code"] == 16 and v["urgency"] == "high" and v["missing"] == []
    doc = run(mdb.voice_intents.find_one({"_id": ObjectId(v["intent_id"])}))
    assert text not in json.dumps(doc, default=str) and doc["text_len"] == len(text) and doc["expires_at"]

    # the user corrects the place before searching: the correction is recorded, nothing else
    c = api.post(f"/voice/intents/{v['intent_id']}/confirm", json={"category_key": "plumber", "wilaya_code": 9, "urgency": "high"}).json()
    assert c["corrected"] == ["wilaya_code", "commune"]
    assert api.post(f"/voice/intents/{v['intent_id']}/confirm", json={"category_key": "plumber"}).status_code == 404  # once

    # a signed-in user's dictation can only be confirmed by them
    mine = login("premium.client@gofix.dz").post("/voice/intents", json={"text": "un électricien à Oran", "locale": "fr-FR"}).json()
    assert Api().post(f"/voice/intents/{mine['intent_id']}/confirm", json={"category_key": "electrician"}).status_code == 404

    stats = login("moderateur@gofix.dz").get("/admin/voice/stats").json()["items"]
    fr = next(x for x in stats if x["locale"] == "fr-FR")
    assert fr["analysed"] >= 2 and fr["confirmed"] >= 1 and fr["place_ok_pct"] is not None
    assert Api().get("/admin/voice/stats").status_code == 401


def test_voice_is_behind_its_flag(mdb):
    run(mdb.feature_flags.update_one({"key": "voice"}, {"$set": {"enabled": False}}))
    try:
        assert Api().post("/voice/intents", json={"text": "un plombier"}).json()["detail"] == "feature_disabled"
    finally:
        run(mdb.feature_flags.update_one({"key": "voice"}, {"$set": {"enabled": True}}))


def test_extraction_rate_on_the_dictation_corpus():
    """Measured per language; darija is the hardest. Thresholds are the bar for opening a language to everybody."""
    api = Api()
    score = defaultdict(lambda: {"n": 0, "trade": 0, "place": 0, "urgency": 0, "fails": []})
    for it in CORPUS:
        v = api.post("/voice/intents", json={"text": it["text"], "locale": "ar-DZ" if it["lang"] != "fr" else "fr-FR"}).json()
        s = score[it["lang"]]
        s["n"] += 1
        ok_trade, ok_place, ok_urg = v["category_key"] == it["category_key"], v["wilaya_code"] == it["wilaya_code"], v["urgency"] == it["urgency"]
        s["trade"] += ok_trade
        s["place"] += ok_place
        s["urgency"] += ok_urg
        if not (ok_trade and ok_place and ok_urg):
            s["fails"].append((it["text"], v["category_key"], v["wilaya_code"], v["urgency"]))
    total = {k: sum(s[k] for s in score.values()) for k in ("n", "trade", "place", "urgency")}
    for lang, s in sorted(score.items()):
        print(f"{lang:11} n={s['n']:2} trade={s['trade'] * 100 // s['n']:3}% place={s['place'] * 100 // s['n']:3}% urgency={s['urgency'] * 100 // s['n']:3}%")
        for f in s["fails"]:
            print("   MISS", f)
    assert total["trade"] / total["n"] >= 0.9, total
    assert total["place"] / total["n"] >= 0.85, total
    assert total["urgency"] / total["n"] >= 0.9, total
