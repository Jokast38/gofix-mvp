"""P3 — server-side blurring: a visitor can never get a name, phone or photo through the API."""
from app.data.seed_data import PRO_NAMES, TEACHERS
from tests.conftest import Api, login, run

SECRET_FIELDS = ("photo_key", "photo_thumb_key", "cover_key", "cover_thumb_key", "bio", "phone", "user_id", "documents", "price_hint_da")
NAMES = PRO_NAMES + [t[0] for t in TEACHERS]


def _assert_blurred(item: dict):
    assert item["blurred"] is True
    assert item["display_name"] is None
    for f in SECRET_FIELDS:
        assert f not in item or item[f] is None, f
    for z in item.get("wilayas", []):
        assert not z.get("communes")


def _assert_no_names(raw: str):
    for name in NAMES:
        assert name not in raw, name
        assert name.split()[-1] not in raw, name


def test_visitor_list_and_detail_are_masked(api: Api):
    for url in ("/catalog/professionals?page_size=50", "/catalog/teachers?page_size=50"):
        r = api.get(url)
        assert r.status_code == 200
        body = r.json()
        assert body["blurred"] is True and body["total"] > 0
        _assert_no_names(r.text)
        assert '"avg"' not in r.text and '"rating_avg"' not in r.text
        for it in body["items"]:
            _assert_blurred(it)
            detail = api.get(f"/catalog/{'professionals' if it['kind'] == 'professional' else 'teachers'}/{it['id']}")
            assert detail.status_code == 200
            _assert_blurred(detail.json())
            _assert_no_names(detail.text)


def test_visitor_search_by_name_reveals_nothing(api: Api):
    r = api.get("/catalog/professionals", params={"q": PRO_NAMES[0]})
    _assert_no_names(r.text)


def test_free_client_is_blurred_too():
    c = login("client@gofix.dz")
    body = c.get("/catalog/professionals?page_size=50").json()
    assert body["blurred"] is True
    for it in body["items"]:
        _assert_blurred(it)


def test_free_client_favorites_do_not_leak():
    c = login("client@gofix.dz")
    pid = c.get("/catalog/professionals").json()["items"][0]["id"]
    assert c.post("/favorites", json={"kind": "professional", "profile_id": pid}).status_code == 201
    r = c.get("/favorites")
    _assert_no_names(r.text)


def test_free_client_cannot_message_directly():
    c = login("client@gofix.dz")
    pid = c.get("/catalog/professionals").json()["items"][0]["id"]
    r = c.post("/conversations", json={"kind": "professional", "profile_id": pid, "body": "Bonjour"})
    assert r.status_code == 402


def test_premium_client_sees_full_profile_and_phone():
    c = login("premium.client@gofix.dz")
    body = c.get("/catalog/professionals").json()
    assert body["blurred"] is False
    it = body["items"][0]
    assert it["display_name"] in NAMES
    detail = c.get(f"/catalog/professionals/{it['id']}").json()
    assert detail["phone"].startswith("+213")
    assert detail["can_contact"] is True


def test_pro_tier_monthly_view_quota(mdb):
    from tests.conftest import register
    c, user = register()
    from bson import ObjectId
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    run(mdb.subscriptions.insert_one({"user_id": ObjectId(user["id"]), "plan_key": "client_pro", "tier": "pro", "audience": "client",
                                      "status": "active", "starts_at": now, "ends_at": now + timedelta(days=30)}))
    run(mdb.unlock_matrix.update_one({"audience": "client", "plan_key": "pro"}, {"$set": {"monthly_views_limit": 2}}))
    try:
        ids = [x["id"] for x in c.get("/catalog/professionals").json()["items"][:3]]
        first = c.get(f"/catalog/professionals/{ids[0]}").json()
        assert first["blurred"] is False and first["display_name"]
        assert c.get(f"/catalog/professionals/{ids[1]}").json()["blurred"] is False
        third = c.get(f"/catalog/professionals/{ids[2]}").json()
        assert third["quota_exceeded"] is True and third["display_name"] is None and "phone" not in third
        assert c.get(f"/catalog/professionals/{ids[0]}").json()["blurred"] is False  # already viewed this month
    finally:
        run(mdb.unlock_matrix.update_one({"audience": "client", "plan_key": "pro"}, {"$set": {"monthly_views_limit": 20}}))
