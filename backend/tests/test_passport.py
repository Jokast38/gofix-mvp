"""GOFIX PASSPORT: pro side, public page by QR link, revocation and the "never verified without proof" rules."""
import json
from datetime import datetime, timedelta, timezone

import pytest

from tests.conftest import Api, login, register, run


def _token(share: dict) -> str:
    return share["url"].rsplit("/p/", 1)[1]


@pytest.fixture()
def pro(mdb):
    """pro@gofix.dz with a fresh passport (restored afterwards)."""
    p = run(mdb.professional_profiles.find_one({"display_name": {"$exists": True}, "user_id": run(mdb.users.find_one({"email": "pro@gofix.dz"}))["_id"]}))
    saved = {k: p.get(k) for k in ("passport", "documents", "suspended")}
    run(mdb.professional_profiles.update_one({"_id": p["_id"]}, {"$set": {"passport": {"enabled": False, "slug": None}}}))
    yield login("pro@gofix.dz"), p
    run(mdb.professional_profiles.update_one({"_id": p["_id"]}, {"$set": saved}))


def test_pro_builds_publishes_and_shares_a_passport(pro, mdb):
    api, p = pro
    me = api.get("/me/passport").json()
    assert me["status"] == "draft" and me["share"] is None and 0 <= me["completeness"] < 100
    assert api.post("/me/passport/skills", json={"label": "Recherche de fuite"}).status_code == 201
    assert api.post("/me/passport/skills", json={"label": "recherche  de FUITE"}).json()["detail"] == "skill_exists"
    me = api.post("/me/passport/skills", json={"label": "Installation sanitaire"}).json()
    assert [s["verified"] for s in me["skills"]] == [False, False]  # declared, never verified by the pro themselves
    me = api.post("/me/passport/publish", json={"published": True}).json()
    shared = api.post("/me/passport/share").json()["share"]
    assert shared["qr"].startswith("data:image/png;base64,") and "/p/" in shared["url"]
    token = _token(shared)
    assert len(token) == 22 and token not in json.dumps(run(mdb.professional_profiles.find_one({"_id": p["_id"]})), default=str)  # only a hash is stored
    assert api.post("/me/passport/share").json()["share"]["url"] == shared["url"]  # the owner can display it again

    page = Api().get(f"/passports/{token}").json()
    assert page["profile_id"] == str(p["_id"]) and [s["label"] for s in page["skills"]] == ["Recherche de fuite", "Installation sanitaire"]
    raw = json.dumps(page)
    for secret in ("phone", "email", '"key"', "documents/", "documents", "user_id", "token_hash"):
        assert secret not in raw  # allow-list only
    assert page["name"].endswith(".")  # short name by default

    # A moderator verifies one skill: only that one shows as verified.
    sid = me["skills"][0]["id"]
    mod = login("moderateur@gofix.dz")
    assert api.patch(f"/admin/passports/professional/{p['_id']}/skills/{sid}", json={"verified": True}).status_code == 403
    assert mod.patch(f"/admin/passports/professional/{p['_id']}/skills/{sid}", json={"verified": True}).json() == {"ok": True}
    assert [s["verified"] for s in Api().get(f"/passports/{token}").json()["skills"]] == [True, False]

    # Visibility per field.
    api.patch("/me/passport", json={"visibility": {"full_name": True, "city": False}})
    page = Api().get(f"/passports/{token}").json()
    assert page["name"] == p["display_name"] and "wilayas" not in page
    hist = api.get("/me/passport/history").json()
    assert {"passport.skill_verified", "passport.link_created", "passport.published"} <= {h["action"] for h in hist}
    assert next(h for h in hist if h["action"] == "passport.skill_verified")["by"] == "gofix"


def test_revoked_unpublished_or_suspended_passport_is_not_found(pro, mdb):
    api, p = pro
    api.post("/me/passport/publish", json={"published": True})
    old = _token(api.post("/me/passport/share").json()["share"])
    assert Api().get(f"/passports/{old}").status_code == 200
    api.post("/me/passport/share/revoke")
    assert Api().get(f"/passports/{old}").json()["detail"] == "passport_not_found"
    new = _token(api.post("/me/passport/share").json()["share"])
    assert new != old and Api().get(f"/passports/{new}").status_code == 200 and Api().get(f"/passports/{old}").status_code == 404
    api.post("/me/passport/publish", json={"published": False})
    assert Api().get(f"/passports/{new}").status_code == 404
    api.post("/me/passport/publish", json={"published": True})
    run(mdb.professional_profiles.update_one({"_id": p["_id"]}, {"$set": {"suspended": True}}))
    assert Api().get(f"/passports/{new}").status_code == 404  # updated at once, nothing frozen in the QR
    assert Api().get("/passports/not-a-real-token").status_code == 404


def test_identity_badge_needs_a_validated_unexpired_document(pro, mdb):
    api, p = pro
    api.post("/me/passport/publish", json={"published": True})
    token = _token(api.post("/me/passport/share").json()["share"])
    future, past = datetime.now(timezone.utc) + timedelta(days=300), datetime.now(timezone.utc) - timedelta(days=1)

    def docs(*rows):
        run(mdb.professional_profiles.update_one({"_id": p["_id"]}, {"$set": {"documents": [
            {"type": t, "status": st, "key": f"x/{t}.pdf", "expires_at": exp} for t, st, exp in rows]}}))
        return Api().get(f"/passports/{token}").json()

    assert docs(("id_card", "submitted", None))["identity_verified"] is False
    page = docs(("id_card", "validated", future), ("diploma", "submitted", None))
    assert page["identity_verified"] is True and page["credentials"] == [{"type": "diploma", "verified": False}]
    assert docs(("id_card", "validated", past))["identity_verified"] is False  # expired: the badge goes away by itself
    assert api.get("/me/passport").json()["credentials"]["id_card"]["status"] == "expired"


def test_only_a_public_profile_can_publish_and_nobody_edits_someone_else():
    waiting = login("attente.pro@gofix.dz")  # profile still pending validation
    assert waiting.post("/me/passport/publish", json={"published": True}).json()["detail"] == "profile_not_public"
    client, _ = register()
    assert client.get("/me/passport").status_code == 404  # no professional profile
    assert Api().get("/me/passport").status_code == 401
