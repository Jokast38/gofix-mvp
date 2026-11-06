"""Search sorted by distance (base point of each profile) and by rating; providers can place their base point."""
import uuid

import pytest
from bson import ObjectId

from app.data.wilaya_coords import WILAYA_CAPITALS
from app.services import geo
from tests.conftest import Api, login, run

HYDRA = (36.742, 3.030)  # client position in Algiers


@pytest.fixture(autouse=True)
def _cleanup(mdb):
    yield
    run(mdb.professional_profiles.delete_many({"category_key": {"$regex": "^test_geo_"}}))


def _pros(mdb, rows):
    """Published test pros in a category of their own: rows = (name, zones, rating_avg, rating_count)."""
    cat = f"test_geo_{uuid.uuid4().hex[:6]}"
    for name, zones, avg, count in rows:
        doc = {"user_id": ObjectId(), "display_name": name, "category_key": cat, "family_key": "home_services", "zones": zones,
               "verification_status": "verified", "trust_score": 60, "rating_avg": avg, "rating_count": count}
        doc["_id"] = run(mdb.professional_profiles.insert_one(doc)).inserted_id
        run(geo.refresh_location("professional_profiles", doc))
    return cat


def _names(r):
    assert r.status_code == 200, r.text
    return [i["display_name"] for i in r.json()["items"]]


def test_nearest_sort_uses_commune_then_wilaya_and_hides_the_point(mdb):
    cat = _pros(mdb, [("Oran", [{"wilaya_code": 31, "commune_names": []}], 5, 30),
                      ("Bab Ezzouar", [{"wilaya_code": 16, "commune_names": ["Bab Ezzouar"]}], 4, 3),
                      ("Hydra", [{"wilaya_code": 16, "commune_names": ["Hydra"]}], 3, 2),
                      ("Blida", [{"wilaya_code": 9, "commune_names": []}], 4.5, 8)])
    client = login("premium.client@gofix.dz")
    r = client.get("/catalog/professionals", params={"category_key": cat, "sort": "distance", "lat": HYDRA[0], "lng": HYDRA[1]})
    assert _names(r) == ["Hydra", "Bab Ezzouar", "Blida", "Oran"]
    items = r.json()["items"]
    assert r.json()["sort"] == "distance" and items[0]["distance_km"] == 1 and 300 < items[-1]["distance_km"] < 400
    assert all("location" not in i for i in items)  # clients get a rounded distance, never the point
    # No position: the searched wilaya's capital is the reference; without either, the sort cannot work.
    assert _names(client.get("/catalog/professionals", params={"category_key": cat, "sort": "distance", "wilaya": 31})) == ["Oran"]
    assert Api().get("/catalog/professionals", params={"category_key": cat, "sort": "distance"}).json()["detail"] == "position_required"
    assert Api().get("/catalog/professionals", params={"category_key": cat, "lat": 48.85, "lng": 2.35}).json()["detail"] == "outside_algeria"


def test_best_rated_sort_does_not_trust_a_single_review(mdb):
    cat = _pros(mdb, [("One review", [{"wilaya_code": 16}], 5, 1), ("Many reviews", [{"wilaya_code": 16}], 4.8, 40),
                      ("No review", [{"wilaya_code": 16}], 0, 0), ("Poor", [{"wilaya_code": 16}], 2, 12)])
    r = login("premium.client@gofix.dz").get("/catalog/professionals", params={"category_key": cat, "sort": "rating"})
    assert _names(r) == ["Many reviews", "One review", "No review", "Poor"]
    assert "distance_km" not in r.json()["items"][0]


def test_provider_places_and_resets_base_point(mdb):
    pro = login("pro@gofix.dz")
    p = pro.get("/provider/me").json()["profile"]
    assert p["location"] and p["location"]["source"] in ("commune", "wilaya")
    assert pro.put("/provider/location", json={"lat": 48.85, "lng": 2.35}).json()["detail"] == "outside_algeria"
    out = pro.put("/provider/location", json={"lat": 36.7531234, "lng": 3.0412345}).json()
    assert out["location"] == {"lat": 36.7531, "lng": 3.0412, "source": "gps"}
    # Changing the zones keeps a point the provider placed; resetting goes back to the zones.
    zones = p["zones"]
    assert pro.patch("/provider/profile", json={"zones": zones}).json()["location"]["source"] == "gps"
    back = pro.delete("/provider/location").json()["location"]
    assert back["source"] in ("commune", "wilaya")
    if back["source"] == "wilaya":
        assert (back["lat"], back["lng"]) == WILAYA_CAPITALS[zones[0]["wilaya_code"]]
