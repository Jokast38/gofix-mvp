from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.access_policy import apply_policy, resolve_access
from app.services.notify import notify
from app.services.visibility import PUBLIC_PROFILE

router = APIRouter(tags=["social"])

Kind = Literal["professional", "teacher"]


def _now():
    return datetime.now(timezone.utc)


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except InvalidId:
        raise HTTPException(404, "not_found")


def _coll(kind: str):
    return db.professional_profiles if kind == "professional" else db.teacher_profiles


def _js(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, list):
        return [_js(x) for x in v]
    if isinstance(v, dict):
        return {k: _js(x) for k, x in v.items()}
    return v


def _clean(doc: dict) -> dict:
    out = {k: _js(v) for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc["_id"])
    return out


# ---------- Favorites ----------
class FavIn(BaseModel):
    kind: Kind
    profile_id: str


@router.get("/favorites")
async def list_favorites(user: User = Depends(get_current_user)):
    favs = await db.favorites.find({"user_id": ObjectId(user.id)}).sort("created_at", -1).to_list(200)
    access = {k: await resolve_access(user, k) for k in ("professional", "teacher")}
    items = []
    for f in favs:
        p = await _coll(f["kind"]).find_one({"_id": f["profile_id"], **PUBLIC_PROFILE})
        if not p:
            continue
        view = apply_policy(p, access[f["kind"]], f["kind"])
        cat = await db.taxonomy_categories.find_one({"key": p.get("category_key")}, {"_id": 0}) if p.get("category_key") else None
        items.append({**view, "profile_id": str(p["_id"]), "category": cat, "favorited_at": f["created_at"]})
    return {"items": items, "ids": [str(f["profile_id"]) for f in favs]}


@router.post("/favorites", status_code=201)
async def add_favorite(body: FavIn, user: User = Depends(get_current_user)):
    pid = _oid(body.profile_id)
    if not await _coll(body.kind).find_one({"_id": pid}):
        raise HTTPException(404, "not_found")
    await db.favorites.update_one({"user_id": ObjectId(user.id), "profile_id": pid},
                                  {"$set": {"kind": body.kind}, "$setOnInsert": {"created_at": _now()}}, upsert=True)
    return {"favorite": True}


@router.delete("/favorites/{profile_id}", status_code=204)
async def remove_favorite(profile_id: str, user: User = Depends(get_current_user)):
    await db.favorites.delete_one({"user_id": ObjectId(user.id), "profile_id": _oid(profile_id)})


# ---------- Messaging ----------
class StartIn(BaseModel):
    kind: Kind
    profile_id: str
    body: str = Field(min_length=1, max_length=2000)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


async def _conv_view(c: dict, me: ObjectId) -> dict:
    other_id = c["provider_user_id"] if c["client_id"] == me else c["client_id"]
    other = await db.users.find_one({"_id": other_id}, {"full_name": 1, "photo_thumb_key": 1})
    unread = await db.messages.count_documents({"conversation_id": c["_id"], "sender_id": {"$ne": me}, "read_at": None})
    out = _clean(c)
    profile = await _coll(c.get("kind", "professional")).find_one({"_id": c["profile_id"]}, {"photo_thumb_key": 1}) if other_id == c["provider_user_id"] else None
    out["other"] = {"id": str(other_id), "name": c.get("provider_display_name") if other_id == c["provider_user_id"] else (other or {}).get("full_name"),
                    "photo_thumb_key": (profile or {}).get("photo_thumb_key") if profile else (other or {}).get("photo_thumb_key")}
    out["unread"] = unread
    out["role"] = "client" if c["client_id"] == me else "provider"
    return out


@router.post("/conversations", status_code=201)
async def start_conversation(body: StartIn, user: User = Depends(get_current_user)):
    pid = _oid(body.profile_id)
    profile = await _coll(body.kind).find_one({"_id": pid, **PUBLIC_PROFILE})
    if not profile:
        raise HTTPException(404, "not_found")
    if profile["user_id"] == ObjectId(user.id):
        raise HTTPException(400, "cannot_message_self")
    me = ObjectId(user.id)
    existing = await db.conversations.find_one({"client_id": me, "profile_id": pid})
    if not existing:
        acc = await resolve_access(user, body.kind)
        if acc.blurred or not acc.can_message:
            raise HTTPException(402, "plan_required")
    now = _now()
    if existing:
        conv_id = existing["_id"]
    else:
        conv_id = (await db.conversations.insert_one({"client_id": me, "provider_user_id": profile["user_id"], "profile_id": pid,
                                                      "kind": body.kind, "provider_display_name": profile["display_name"],
                                                      "created_at": now, "updated_at": now, "last_message": None})).inserted_id
        await db.contact_events.insert_one({"user_id": me, "profile_id": pid, "source": "message", "created_at": now})
        await _coll(body.kind).update_one({"_id": pid}, {"$inc": {"free_access.requests_received": 1}})
    await _send(conv_id, me, body.body, profile["user_id"], user.full_name)
    return await _conv_view(await db.conversations.find_one({"_id": conv_id}), me)


async def _send(conv_id, sender: ObjectId, text: str, recipient: ObjectId, sender_name: str):
    now = _now()
    await db.messages.insert_one({"conversation_id": conv_id, "sender_id": sender, "body": text, "created_at": now, "read_at": None})
    await db.conversations.update_one({"_id": conv_id}, {"$set": {"updated_at": now, "last_message": {"body": text[:120], "sender_id": sender, "at": now}}})
    await notify(recipient, "message", f"Nouveau message de {sender_name}", text[:140], f"/messages/{conv_id}", channels=("inapp", "push"))


@router.get("/conversations")
async def list_conversations(user: User = Depends(get_current_user)):
    me = ObjectId(user.id)
    convs = await db.conversations.find({"$or": [{"client_id": me}, {"provider_user_id": me}]}).sort("updated_at", -1).to_list(100)
    return {"items": [await _conv_view(c, me) for c in convs]}


@router.get("/conversations/unread-count")
async def unread_count(user: User = Depends(get_current_user)):
    me = ObjectId(user.id)
    ids = [c["_id"] async for c in db.conversations.find({"$or": [{"client_id": me}, {"provider_user_id": me}]}, {"_id": 1})]
    n = await db.messages.count_documents({"conversation_id": {"$in": ids}, "sender_id": {"$ne": me}, "read_at": None})
    return {"unread": n}


async def _my_conv(cid: str, user: User) -> dict:
    me = ObjectId(user.id)
    c = await db.conversations.find_one({"_id": _oid(cid), "$or": [{"client_id": me}, {"provider_user_id": me}]})
    if not c:
        raise HTTPException(404, "not_found")
    return c


@router.get("/conversations/{cid}")
async def get_conversation(cid: str, user: User = Depends(get_current_user)):
    c = await _my_conv(cid, user)
    me = ObjectId(user.id)
    await db.messages.update_many({"conversation_id": c["_id"], "sender_id": {"$ne": me}, "read_at": None}, {"$set": {"read_at": _now()}})
    msgs = await db.messages.find({"conversation_id": c["_id"]}).sort("created_at", 1).to_list(500)
    view = await _conv_view(c, me)
    view["messages"] = [{**_clean(m), "mine": m["sender_id"] == me} for m in msgs]
    return view


@router.post("/conversations/{cid}/messages", status_code=201)
async def post_message(cid: str, body: MessageIn, user: User = Depends(get_current_user)):
    c = await _my_conv(cid, user)
    me = ObjectId(user.id)
    recipient = c["provider_user_id"] if c["client_id"] == me else c["client_id"]
    await _send(c["_id"], me, body.body, recipient, user.full_name)
    return {"sent": True}


# ---------- Notifications ----------
@router.get("/notifications")
async def notifications(user: User = Depends(get_current_user)):
    me = ObjectId(user.id)
    docs = await db.notifications.find({"user_id": me}).sort("created_at", -1).to_list(30)
    unread = await db.notifications.count_documents({"user_id": me, "read": False})
    return {"unread": unread, "items": [_clean(d) for d in docs]}


@router.post("/notifications/read-all")
async def read_all(user: User = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": ObjectId(user.id), "read": False}, {"$set": {"read": True}})
    return {"ok": True}
