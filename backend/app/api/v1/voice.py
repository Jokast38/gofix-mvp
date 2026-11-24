"""GOFIX VOICE: a request dictated by voice, then checked by the user, then sent to AI MATCH.

- Speech is recognised ON THE PHONE (Android / iOS recognizer, or the browser's): no audio ever reaches GoFix.
- The server receives the recognised text, extracts trade / place / urgency with the AI MATCH parser, and returns a
  summary. Nothing is searched or sent before the user confirms or corrects it.
- What is kept, for quality measurement only (no text, no audio): locale, engine, extracted fields, confidence, and on
  confirmation which fields the user had to correct. Records expire after 90 days.
"""
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import db
from app.core.deps import client_ip, get_optional_user, require_admin
from app.core.ratelimit import hit
from app.models.user import User
from app.services import intent as intent_svc
from app.services.config_store import is_enabled

router = APIRouter(tags=["voice"])

RETENTION = timedelta(days=90)
LOCALES = ("fr-FR", "fr-DZ", "ar-DZ", "ar-SA", "en-US", "en-GB")


def _now():
    return datetime.now(timezone.utc)


async def _enabled():
    if not await is_enabled("voice"):
        raise HTTPException(404, "feature_disabled")


class VoiceIn(BaseModel):
    text: str = Field(min_length=2, max_length=500)
    locale: str = Field(default="fr-FR", max_length=10)
    engine: Literal["device", "on_device", "web"] = "device"
    duration_s: Optional[float] = Field(default=None, ge=0, le=60)
    kind: Optional[Literal["professional", "teacher"]] = None


class ConfirmIn(BaseModel):
    category_key: Optional[str] = Field(default=None, max_length=80)
    subject_key: Optional[str] = Field(default=None, max_length=80)
    wilaya_code: Optional[int] = Field(default=None, ge=1, le=58)
    commune: Optional[str] = Field(default=None, max_length=80)
    urgency: Literal["high", "normal"] = "normal"
    text_edited: bool = False


@router.post("/voice/intents")
async def analyse(body: VoiceIn, request: Request, user: User | None = Depends(get_optional_user)):
    """Recognised text -> summary to check (trade, place, urgency, missing fields). The text itself is not stored."""
    await _enabled()
    await hit(f"voice:{client_ip(request)}", 30, 60)
    parsed = await intent_svc.parse(body.text, body.kind)
    doc = {"user_id": ObjectId(user.id) if user else None, "locale": body.locale if body.locale in LOCALES else "other",
           "engine": body.engine, "duration_s": body.duration_s, "text_len": len(body.text.strip()), "language": parsed["language"],
           "kind": parsed["kind"], "parsed": {k: parsed.get(k) for k in ("category_key", "subject_key", "wilaya_code", "commune", "urgency")},
           "missing": parsed["missing"], "confidence": parsed["confidence"], "status": "analysed",
           "created_at": _now(), "expires_at": _now() + RETENTION}
    vid = (await db.voice_intents.insert_one(doc)).inserted_id
    return {"intent_id": str(vid), **{k: parsed.get(k) for k in ("kind", "category_key", "subject_key", "level_key", "wilaya_code", "commune",
                                                                 "urgency", "when", "mode", "missing", "confidence", "language")}}


@router.post("/voice/intents/{vid}/confirm")
async def confirm(vid: str, body: ConfirmIn, user: User | None = Depends(get_optional_user)):
    """The user validated (and maybe corrected) the summary: we only record which fields needed a correction."""
    await _enabled()
    try:
        oid = ObjectId(vid)
    except (InvalidId, TypeError):
        raise HTTPException(404, "not_found")
    doc = await db.voice_intents.find_one({"_id": oid, "status": "analysed"})
    if not doc or (doc.get("user_id") and (not user or doc["user_id"] != ObjectId(user.id))):
        raise HTTPException(404, "not_found")
    final = body.model_dump(exclude={"text_edited"})
    p = doc["parsed"]
    corrected = [f for f in ("category_key", "subject_key", "wilaya_code", "commune", "urgency") if (final.get(f) or None) != (p.get(f) or None)]
    await db.voice_intents.update_one({"_id": oid}, {"$set": {"status": "confirmed", "confirmed_at": _now(), "corrected": corrected,
                                                             "text_edited": body.text_edited}})
    return {"ok": True, "corrected": corrected}


@router.get("/admin/voice/stats")
async def stats(days: int = 30, _: User = Depends(require_admin("moderator", "support"))):
    """Quality per locale, to decide when to open a language (darija...) to everybody: share of dictations confirmed,
    and among them, how often the trade or the place had to be corrected."""
    since = _now() - timedelta(days=max(1, min(days, 90)))
    rows = {}
    async for d in db.voice_intents.find({"created_at": {"$gte": since}}):
        r = rows.setdefault(d["locale"], {"locale": d["locale"], "analysed": 0, "confirmed": 0, "trade_ok": 0, "place_ok": 0, "text_edited": 0, "confidence_sum": 0.0})
        r["analysed"] += 1
        r["confidence_sum"] += d.get("confidence") or 0
        if d["status"] == "confirmed":
            r["confirmed"] += 1
            corr = d.get("corrected") or []
            r["trade_ok"] += not ({"category_key", "subject_key"} & set(corr))
            r["place_ok"] += not ({"wilaya_code", "commune"} & set(corr))
            r["text_edited"] += bool(d.get("text_edited"))
    out = []
    for r in rows.values():
        c = r["confirmed"] or 1
        out.append({"locale": r["locale"], "analysed": r["analysed"], "confirmed": r["confirmed"],
                    "confirm_rate": round(r["confirmed"] * 100 / r["analysed"]), "trade_ok_pct": round(r["trade_ok"] * 100 / c) if r["confirmed"] else None,
                    "place_ok_pct": round(r["place_ok"] * 100 / c) if r["confirmed"] else None,
                    "text_edited_pct": round(r["text_edited"] * 100 / c) if r["confirmed"] else None,
                    "avg_confidence": round(r["confidence_sum"] / r["analysed"], 2)})
    return {"days": days, "items": sorted(out, key=lambda x: -x["analysed"])}
