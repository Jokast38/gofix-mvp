"""Fixeur du mois / top rated, sponsored banners (admin CRUD, image, dates, click counting) and communication settings."""
import io
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image

from app.core.config import settings
from tests.conftest import Api, login, run


def _super() -> Api:
    r = Api().post("/auth/login", json={"identifier": settings.admin_email, "password": settings.admin_password})
    return Api(r.json()["access_token"])


def _png(w=1500, h=500) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), "teal").save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _clean(mdb):
    run(mdb.ad_banners.delete_many({"seed": {"$ne": True}}))
    yield
    run(mdb.ad_banners.delete_many({"seed": {"$ne": True}}))
    run(mdb.settings.update_one({"key": "fixer_of_month_email"}, {"$set": {"value": ""}}))
    run(mdb.settings.update_one({"key": "highlights_show_identity"}, {"$set": {"value": True}}))


def test_highlights_rank_month_reviews_and_manual_pick(mdb):
    # One pro with three 5/5 reviews this month must be the "Fixeur du mois" (Bayesian average beats a single 5/5).
    pros = run(mdb.professional_profiles.find({"verification_status": "verified"}).to_list(3))
    now = datetime.now(timezone.utc)
    rows = [{"profile_id": pros[0]["_id"], "kind": "professional", "rating": 5, "created_at": now - timedelta(minutes=i), "test_promo": True} for i in range(3)]
    rows.append({"profile_id": pros[1]["_id"], "kind": "professional", "rating": 5, "created_at": now, "test_promo": True})
    run(mdb.reviews.insert_many(rows))
    try:
        data = Api().get("/highlights").json()
        assert data["period"] == now.strftime("%Y-%m")
        assert data["fixer"]["id"] == str(pros[0]["_id"]) and data["fixer"]["month"]["count"] >= 3
        assert data["fixer"]["display_name"]  # identity shown by default (contacts stay protected)
        assert all(c["id"] != data["fixer"]["id"] for c in data["best_of_month"])
        assert len(data["top_rated"]) <= 6 and all(c["rating_count"] >= 3 for c in data["top_rated"])
        # Manual pick from the back-office wins.
        sup = _super()
        assert sup.put("/admin/settings/fixer_of_month_email", json={"value": "pro@gofix.dz"}).status_code == 200
        picked = Api().get("/highlights").json()
        assert picked["manual"] is True and picked["fixer"]["display_name"]
        pro_user = run(mdb.users.find_one({"email": "pro@gofix.dz"}))
        assert picked["fixer"]["id"] == str(run(mdb.professional_profiles.find_one({"user_id": pro_user["_id"]}))["_id"])
        # Identity hidden for visitors when the setting is off.
        sup.put("/admin/settings/highlights_show_identity", json={"value": False})
        hidden = Api().get("/highlights").json()
        assert hidden["fixer"]["display_name"] is None and hidden["fixer"]["photo_key"] is None
    finally:
        run(mdb.reviews.delete_many({"test_promo": True}))


def test_banner_admin_lifecycle(mdb):
    sup = _super()
    body = {"title": "Promo test", "advertiser": "Marque Test", "link_url": "https://example.com/promo", "placements": ["home", "search"]}
    assert login("moderateur@gofix.dz").post("/admin/banners", json=body).status_code == 403
    for bad in ("javascript:alert(1)", "http://example.com", "//evil.com"):
        assert sup.post("/admin/banners", json=body | {"link_url": bad}).json()["detail"] == "invalid_link"
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert sup.post("/admin/banners", json=body | {"starts_at": past, "ends_at": past}).json()["detail"] == "invalid_dates"

    b = sup.post("/admin/banners", json=body).json()
    ids = lambda placement: [x["id"] for x in Api().get(f"/promos?placement={placement}").json()]  # noqa: E731
    assert b["id"] not in ids("home")  # no image yet: never shown
    r = sup._req("POST", f"/admin/banners/{b['id']}/image", files={"file": ("b.png", _png(), "image/png")})
    assert r.status_code == 200 and r.json()["image_key"].endswith(".webp")
    assert b["id"] in ids("home") and b["id"] in ids("search")

    # Click: counted then redirected to the advertiser.
    click = Api().get(f"/promos/{b['id']}/click", follow_redirects=False)
    assert click.status_code == 302 and click.headers["location"] == "https://example.com/promo"
    stats = next(x for x in sup.get("/admin/banners").json() if x["id"] == b["id"])
    assert stats["clicks"] == 1 and stats["impressions"] >= 2

    # Ended campaign or inactive banner: hidden.
    ended = body | {"starts_at": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(), "ends_at": past}
    assert sup.put(f"/admin/banners/{b['id']}", json=ended).status_code == 200
    assert b["id"] not in ids("home")
    sup.put(f"/admin/banners/{b['id']}", json=body | {"active": False})
    assert b["id"] not in ids("home")
    assert Api().get(f"/promos/{b['id']}/click", follow_redirects=False).headers["location"] == settings.frontend_url

    assert sup.delete(f"/admin/banners/{b['id']}").status_code == 204
    assert run(mdb.audit_logs.count_documents({"action": {"$regex": "^promo.banner_"}, "target_id": b["id"]})) >= 3


def test_internal_banner_link():
    sup = _super()
    b = sup.post("/admin/banners", json={"title": "Annoncez", "advertiser": "GoFix", "link_url": "/contact"}).json()
    sup._req("POST", f"/admin/banners/{b['id']}/image", files={"file": ("b.png", _png(), "image/png")})
    view = next(x for x in Api().get("/promos?placement=home").json() if x["id"] == b["id"])
    assert view["internal_path"] == "/contact" and view["sponsored"] is True
    assert Api().post(f"/promos/{b['id']}/click").status_code == 204
    assert Api().get(f"/promos/{b['id']}/click", follow_redirects=False).headers["location"] == f"{settings.frontend_url}/contact"


def test_social_links_and_videos_settings():
    sup = _super()
    assert sup.put("/admin/settings/social_instagram_url", json={"value": "http://instagram.com/gofix"}).json()["detail"] == "invalid_url"
    assert sup.put("/admin/settings/social_instagram_url", json={"value": "https://instagram.com/gofix"}).status_code == 200
    bad = [{"url": "https://vimeo.com/123", "title": "x"}]
    assert sup.put("/admin/settings/youtube_videos", json={"value": bad}).json()["detail"] == "invalid_youtube_url"
    ok = [{"url": " https://www.youtube.com/watch?v=dQw4w9WgXcQ ", "title": "Épisode 1"}, {"url": "https://youtu.be/dQw4w9WgXcQ", "title": ""}]
    assert sup.put("/admin/settings/youtube_videos", json={"value": ok}).status_code == 200
    cfg = Api().get("/config").json()["settings"]
    assert cfg["social_instagram_url"] == "https://instagram.com/gofix"
    assert cfg["youtube_videos"][0] == {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "title": "Épisode 1"}
    assert "fixer_of_month_email" not in cfg  # private setting
    sup.put("/admin/settings/youtube_videos", json={"value": []})
    sup.put("/admin/settings/social_instagram_url", json={"value": ""})
