"""Single definition of a publicly listable profile + suspension propagation.
A suspended account must never appear in the catalogue, AI Match results, open requests or new conversations."""
from bson import ObjectId

from app.core.db import db

PUBLIC_PROFILE = {"verification_status": {"$in": ["verified", "unverified"]}, "suspended": {"$ne": True}}


async def set_profiles_suspended(user_id, suspended: bool):
    uid = ObjectId(str(user_id))
    for coll in (db.professional_profiles, db.teacher_profiles):
        await coll.update_many({"user_id": uid}, {"$set": {"suspended": suspended}})
