"""Account editing + profile photo for every user, mobile push tokens, wilaya detection from a position."""
import asyncio
import io

from bson import ObjectId
from PIL import Image

from app.services import push
from app.services.notify import notify
from tests.conftest import Api, login, register, run

TOKEN = "ExponentPushToken[abcdefghijklmnopqrstuv]"


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 300), "orange").save(buf, "PNG")
    return buf.getvalue()


def test_client_edits_account_and_phone_needs_new_verification():
    c, u = register()
    r = c.patch("/users/me", json={"full_name": "Nouveau Nom", "wilaya_code": 31, "phone": "0661 23 45 67"})
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["full_name"] == "Nouveau Nom" and me["wilaya_code"] == 31 and me["phone"] == "+213661234567"
    assert me["phone_verified"] is False
    other, _ = register()
    assert other.patch("/users/me", json={"phone": "0661234567"}).json()["detail"] == "phone_taken"
    assert c.patch("/users/me", json={"phone": "12"}).status_code == 422


def test_profile_photo_for_any_user_and_visible_in_messaging(mdb):
    c = login("client@gofix.dz")
    r = c._req("POST", "/users/me/photo", files={"file": ("me.png", _png(), "image/png")})
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["photo_key"].endswith(".webp") and me["photo_thumb_key"]
    assert Api().get(f"/files/public/{me['photo_thumb_key']}").status_code == 200
    # The pro talking with this client now sees the client's photo in the conversation list.
    convs = login("pro@gofix.dz").get("/conversations").json()
    items = convs["items"] if isinstance(convs, dict) else convs
    mine = [x for x in items if x["role"] == "provider" and x["other"]["name"] == me["full_name"]]
    assert mine and mine[0]["other"]["photo_thumb_key"] == me["photo_thumb_key"]
    # Not an image -> refused; removal clears the keys.
    assert c._req("POST", "/users/me/photo", files={"file": ("x.png", b"not an image", "image/png")}).status_code == 415
    assert c._req("DELETE", "/users/me/photo").json()["photo_key"] is None


def test_push_tokens_and_delivery(mdb, monkeypatch):
    sent = []

    async def fake_send(messages):
        sent.extend(messages)

    monkeypatch.setattr(push, "_send", fake_send)
    c, u = register()
    assert c.post("/users/me/push-tokens", json={"token": "not-a-token"}).json()["detail"] == "push_token_invalid"
    assert c.post("/users/me/push-tokens", json={"token": TOKEN, "platform": "android"}).status_code == 204
    run(notify(u["id"], "test", "Nouveau message", "Karim vous a répondu", "/messages"))
    run(asyncio.sleep(0.05))
    assert sent and sent[0]["to"] == TOKEN and sent[0]["title"] == "Nouveau message" and sent[0]["data"] == {"link": "/messages"}
    # Flag off -> nothing sent; token removed on logout -> nothing sent.
    run(mdb.feature_flags.update_one({"key": "push_notifications"}, {"$set": {"enabled": False}}))
    sent.clear()
    run(notify(u["id"], "test", "A", "B")); run(asyncio.sleep(0.05))
    assert not sent
    run(mdb.feature_flags.update_one({"key": "push_notifications"}, {"$set": {"enabled": True}}))
    assert c.post("/users/me/push-tokens/remove", json={"token": TOKEN}).status_code == 204
    run(notify(u["id"], "test", "A", "B")); run(asyncio.sleep(0.05))
    assert not sent
    assert not run(mdb.push_tokens.find_one({"user_id": ObjectId(u["id"])}))


def test_wilaya_detection_from_position():
    assert Api().get("/geo/locate", params={"lat": 36.75, "lng": 3.05}).json()["code"] == 16       # Alger
    assert Api().get("/geo/locate", params={"lat": 35.69, "lng": -0.64}).json()["code"] == 31      # Oran
    assert Api().get("/geo/locate", params={"lat": 36.36, "lng": 6.63}).json()["code"] == 25       # Constantine
    oran = Api().get("/geo/locate", params={"lat": 35.69, "lng": -0.64}).json()
    assert oran["name_fr"] == "Oran" and oran["distance_km"] < 5
    assert Api().get("/geo/locate", params={"lat": 48.85, "lng": 2.35}).json()["detail"] == "outside_algeria"


def test_account_deletion_removes_photo_and_devices(mdb):
    c, u = register()
    c._req("POST", "/users/me/photo", files={"file": ("me.png", _png(), "image/png")})
    c.post("/users/me/push-tokens", json={"token": "ExponentPushToken[zzzzzzzzzzzzzzzzzzzzzz]"})
    assert c._req("DELETE", "/users/me", json={"password": "Secret123"}).status_code == 204
    doc = run(mdb.users.find_one({"_id": ObjectId(u["id"])}))
    assert doc["photo_key"] is None and not run(mdb.push_tokens.find_one({"user_id": ObjectId(u["id"])}))


def test_new_message_is_pushed_to_the_other_party(mdb, monkeypatch):
    sent = []

    async def fake_send(messages):
        sent.extend(messages)

    monkeypatch.setattr(push, "_send", fake_send)
    pro, client = login("pro@gofix.dz"), login("client@gofix.dz")
    token = "ExponentPushToken[proprophoneproprophone]"
    assert pro.post("/users/me/push-tokens", json={"token": token, "platform": "ios"}).status_code == 204
    convs = client.get("/conversations").json()
    conv = (convs["items"] if isinstance(convs, dict) else convs)[0]
    assert client.post(f"/conversations/{conv['id']}/messages", json={"body": "Bonjour, êtes-vous disponible demain ?"}).status_code in (200, 201)
    run(asyncio.sleep(0.05))
    pushed = [m for m in sent if m["to"] == token]
    assert pushed and pushed[0]["data"] == {"link": f"/messages/{conv['id']}"} and "disponible demain" in pushed[0]["body"]
    pro.post("/users/me/push-tokens/remove", json={"token": token})
