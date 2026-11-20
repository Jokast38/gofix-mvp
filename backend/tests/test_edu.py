"""EDU AI level tests: bank, server-side scoring, visitor vs signed-in learner, back office."""
from app.data import edu_bank as BANK
from tests.conftest import Api, login, register, run


def _right_answers(mdb, start: dict, wrong: int = 0) -> dict:
    """Answers picking the correct option for every question except the first `wrong` ones."""
    correct = {d["key"]: d["correct"] for d in run(mdb.edu_items.find({"key": {"$in": [q["key"] for q in start["questions"]]}}).to_list(100))}
    answers = {}
    for i, q in enumerate(start["questions"]):
        good = q["options"].index(correct[q["key"]])
        answers[q["key"]] = (good + 1) % 4 if i < wrong else good
    return answers


def test_bank_matches_the_documents():
    items = BANK.all_items()
    assert len(items) == 522 and len({i["key"] for i in items}) == 522
    by = {i["key"]: i for i in items}
    # A few answers from the documents' answer keys.
    assert by["C-1AP-1-1"]["correct"] == "13" and by["C-3AM-5-1"]["correct"] == "870" and by["C-2AS-5-3"]["correct"] == "551"
    assert sorted(by["C-1AS-4-3"]["distractors"]) == ["299", "340", "441"]
    assert by["L-ar-2-6"]["correct"] == "الألف" and by["GFEDU-0072"]["correct"] == "Une paire de clés"
    assert all(len({i["correct"], *i["distractors"]}) == 4 for i in items)


def test_catalog_lists_classes_languages_and_tracks():
    cat = Api().get("/edu/catalog").json()
    assert [c["level"] for c in cat["classes"]] == list(BANK.CLASSES)
    assert all(len(c["tests"]) == 5 and c["extra"][0]["key"] == f"express-{c['level']}" for c in cat["classes"])
    assert [lang["lang"] for lang in cat["languages"]] == ["fr", "en", "ar"] and len(cat["higher"]) == 12
    assert cat["classes"][0]["tests"][0] == {"key": "class-1AP-1", "count": 6, "draft": True, "number": 1}


def test_visitor_sees_the_result_once(mdb):
    api = Api()
    s = api.post("/edu/attempts", json={"test_key": "class-1AP-1"}).json()
    assert s["token"] and len(s["questions"]) == 6 and s["draft"] is True
    assert all(len(q["options"]) == 4 and "correct" not in q for q in s["questions"])  # answers stay on the server
    r = api.post(f"/edu/attempts/{s['id']}/finish", json={"answers": _right_answers(mdb, s, wrong=2), "token": s["token"]}).json()
    assert (r["correct"], r["total"], r["score"], r["band"], r["passed"], r["saved"]) == (4, 6, 67, "satisfactory", True, False)
    assert r["next_test_key"] == "class-1AP-2" and r["student_pass"] is False
    assert r["recommendation"] == {"subject_key": "math", "level_key": "primary"}
    french = next(s for s in r["subjects"] if s["subject"] == "french")
    assert french["total"] == 1 and french["pct"] is None  # one question: "insufficient data"
    assert all("explanation" in c for c in r["corrections"])
    # Shown once: the attempt is gone, and a wrong token never scores.
    assert api.post(f"/edu/attempts/{s['id']}/finish", json={"answers": {}, "token": s["token"]}).status_code == 404
    s2 = api.post("/edu/attempts", json={"test_key": "lang-en-1"}).json()
    assert api.post(f"/edu/attempts/{s2['id']}/finish", json={"answers": {}, "token": "nope"}).status_code == 404


def test_signed_in_learner_keeps_progress(mdb):
    eleve = login("eleve@gofix.dz")
    s = eleve.post("/edu/attempts", json={"test_key": "class-3AS-2"}).json()
    assert s["token"] is None
    r = eleve.post(f"/edu/attempts/{s['id']}/finish", json={"answers": _right_answers(mdb, s)}).json()
    assert (r["score"], r["band"], r["saved"], r["student_pass"]) == (100, "very_good", True, True)
    assert r["recommendation"]["level_key"] == "secondary"
    # Sent twice: scored once, same result.
    again = eleve.post(f"/edu/attempts/{s['id']}/finish", json={"answers": {}}).json()
    assert again["score"] == 100 and again["id"] == s["id"]
    hist = eleve.get("/edu/history").json()
    assert hist[0]["test_key"] == "class-3AS-2" and hist[0]["score"] == 100
    assert eleve.get(f"/edu/attempts/{s['id']}").json()["corrections"]
    assert eleve.get("/edu/catalog").json()["classes"][-1]["tests"][1]["best"] == 100
    # Nobody else can read or finish it.
    other, _ = register()
    assert other.get(f"/edu/attempts/{s['id']}").status_code == 404
    assert Api().get("/edu/history").status_code == 401
    # A failed test does not unlock the next one.
    s = eleve.post("/edu/attempts", json={"test_key": "lang-fr-2"}).json()
    r = eleve.post(f"/edu/attempts/{s['id']}/finish", json={"answers": _right_answers(mdb, s, wrong=4)}).json()
    assert r["score"] == 33 and r["band"] == "to_strengthen" and r["next_test_key"] is None
    assert r["recommendation"] == {"subject_key": "french", "level_key": None}


def test_back_office_archives_and_imports(mdb):
    mod, support = login("moderateur@gofix.dz"), login("support@gofix.dz")
    assert support.get("/admin/edu/items", params={"test_key": "class-2AM-1"}).json()["total"] == 6
    assert support.patch("/admin/edu/items/C-2AM-1-1", json={"status": "archived"}).status_code == 403
    assert mod.patch("/admin/edu/items/C-2AM-1-1", json={"status": "archived"}).json()["status"] == "archived"
    s = Api().post("/edu/attempts", json={"test_key": "class-2AM-1"}).json()
    assert len(s["questions"]) == 5  # an archived question is no longer asked
    assert mod.post("/admin/edu/tests/class-2AM-1/status", json={"status": "published"}).json()["items"] == 6
    assert Api().post("/edu/attempts", json={"test_key": "class-2AM-1"}).json()["draft"] is False

    good = {"id": "IMP-0001", "level": "1AM", "subject": "Mathématiques", "skill": "Calcul", "question": "2 + 2 = ?",
            "options": [{"id": "A", "text": "3"}, {"id": "B", "text": "4"}, {"id": "C", "text": "5"}, {"id": "D", "text": "6"}],
            "correct_option": "B", "explanation": "2 + 2 = 4.", "language": "fr"}
    bad = good | {"id": "IMP-0002", "correct_option": "E"}
    r = mod.post("/admin/edu/import", json={"items": [good, bad]})
    assert r.status_code == 422 and r.json()["detail"]["errors"][0]["error"] == "invalid_correct_option"
    assert not run(mdb.edu_items.find_one({"key": "IMP-0001"}))  # nothing written
    assert mod.post("/admin/edu/import", json={"items": [good]}).json() == {"created": 1, "updated": 0}
    item = run(mdb.edu_items.find_one({"key": "IMP-0001"}))
    assert (item["correct"], item["subject"], item["test_key"], item["status"]) == ("4", "math", "import-1AM", "draft")
    assert mod.post("/admin/edu/import", json={"items": [good]}).status_code == 422  # duplicate id
    assert mod.post("/admin/edu/import", json={"items": [good], "replace": True}).json()["updated"] == 1
    cat = Api().get("/edu/catalog").json()
    assert any(t["key"] == "import-1AM" for c in cat["classes"] for t in c["extra"])
    run(mdb.edu_items.delete_one({"key": "IMP-0001"}))


def test_feature_flag_switches_it_off(mdb):
    run(mdb.feature_flags.update_one({"key": "edu_ai"}, {"$set": {"enabled": False}}))
    try:
        assert Api().get("/edu/catalog").json()["detail"] == "feature_disabled"
    finally:
        run(mdb.feature_flags.update_one({"key": "edu_ai"}, {"$set": {"enabled": True}}))
