"""AI MATCH guided flow: radius around the client, distance reasons, request reference and double-tap protection."""
import re
import uuid

import pytest
from bson import ObjectId

from app.services import geo
from tests.conftest import login, run

HYDRA = (36.742, 3.030)


@pytest.fixture(autouse=True)
def _cleanup(mdb):
    yield
    run(mdb.professional_profiles.delete_many({"category_key": {"$regex": "^test_match_"}}))


def _pros(mdb, rows):
    cat = f"test_match_{uuid.uuid4().hex[:6]}"
    for name, zones, *gps in rows:
        doc = {"user_id": ObjectId(), "display_name": name, "category_key": cat, "family_key": "home_services", "zones": zones,
               "verification_status": "verified", "trust_score": 60, "rating_avg": 4.5, "rating_count": 10}
        doc["_id"] = run(mdb.professional_profiles.insert_one(doc)).inserted_id
        if gps:  # base point placed by the provider from their phone
            run(mdb.professional_profiles.update_one({"_id": doc["_id"]}, {"$set": {"location": geo.point(*gps[0]), "location_source": "gps"}}))
        else:
            run(geo.refresh_location("professional_profiles", doc))
    return cat


def test_radius_keeps_nearby_pros_and_explains_the_distance(mdb):
    # All three cover Algiers; the third one is based in Boumerdes, about 40 km from Hydra.
    cat = _pros(mdb, [("Hydra", [{"wilaya_code": 16, "commune_names": ["Hydra"]}]),
                      ("Bab Ezzouar", [{"wilaya_code": 16, "commune_names": ["Bab Ezzouar"]}]),
                      ("Boumerdes", [{"wilaya_code": 16, "commune_names": []}], (36.766, 3.477))])
    client = login("premium.client@gofix.dz")
    body = {"kind": "professional", "category_key": cat, "wilaya_code": 16, "lat": HYDRA[0], "lng": HYDRA[1]}
    wide = client.post("/match/recommend", json=body).json()
    assert len(wide["items"]) == 3 and wide["origin_source"] == "gps"
    near = client.post("/match/recommend", json=body | {"radius_km": 15}).json()
    names = [i["display_name"] for i in near["items"]]
    assert names[0] == "Hydra" and "Boumerdes" not in names and near["radius_km"] == 15
    hydra = near["items"][0]
    assert hydra["distance_km"] == 1 and {"code": "distance", "params": {"km": 1}} in hydra["match"]["reasons"]
    assert "location" not in hydra  # the client gets a rounded distance, never the point
    # Without a position, the chosen commune is the centre of the search.
    by_commune = client.post("/match/recommend", json={"kind": "professional", "category_key": cat, "wilaya_code": 16,
                                                       "commune": "Hydra", "radius_km": 5}).json()
    assert by_commune["origin_source"] == "commune" and [i["display_name"] for i in by_commune["items"]] == ["Hydra"]


def test_request_gets_a_reference_and_a_double_tap_creates_it_once(mdb):
    cat = _pros(mdb, [("Hydra", [{"wilaya_code": 16, "commune_names": ["Hydra"]}])])
    client = login("premium.client@gofix.dz")
    pid = client.post("/match/recommend", json={"kind": "professional", "category_key": cat, "wilaya_code": 16}).json()["items"][0]["id"]
    body = {"kind": "professional", "profile_ids": [pid], "category_key": cat, "wilaya_code": 16, "message": "Fuite sous l'évier de la cuisine"}
    key = {"Idempotency-Key": uuid.uuid4().hex}
    first = client.post("/requests", json=body, headers=key)
    assert first.status_code == 201, first.text
    ref = first.json()["ref"]
    assert re.fullmatch(r"DEM-\d{4}-\d{6}", ref)
    again = client.post("/requests", json=body, headers=key).json()
    assert again["id"] == first.json()["id"] and again["ref"] == ref and again["replayed"] is True
    assert run(mdb.requests.count_documents({"idempotency_key": key["Idempotency-Key"]})) == 1
    other = client.post("/requests", json=body, headers={"Idempotency-Key": uuid.uuid4().hex}).json()
    assert other["ref"] != ref  # a new request gets the next number
    mine = client.get("/requests/mine").json()["items"]
    assert any(r["ref"] == ref for r in mine)
    run(mdb.requests.delete_many({"category_key": cat}))
