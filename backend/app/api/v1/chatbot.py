from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.adapters.llm import get_llm_adapter
from app.core.db import db
from app.core.deps import client_ip, get_optional_user
from app.core.logging import get_logger
from app.core.phone import normalize_dz_phone
from app.core.ratelimit import hit
from app.models.user import User
from app.services.config_store import get_setting, is_enabled
from app.services.faq_search import norm, search

router = APIRouter(prefix="/chatbot", tags=["chatbot"])
log = get_logger("chatbot")

SYSTEM = ("Tu es l'assistant de GoFix (Algérie). Réponds UNIQUEMENT à partir des extraits de FAQ fournis, en {lang}, "
          "en 3 phrases maximum. N'invente rien. Si les extraits ne répondent pas à la question, réponds exactement : NO_ANSWER. "
          "Ne donne jamais d'avis juridique, médical ou technique engageant.")


class AskIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    lang: Literal["fr", "ar"] = "fr"


class HandoffIn(BaseModel):
    message: str = Field(min_length=3, max_length=2000)
    name: str = Field(min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def _p(cls, v):
        return normalize_dz_phone(v) if v else v


def _q(e: dict, lang: str) -> str:
    return e.get(f"question_{lang}") or e["question_fr"]


async def _rephrase(question: str, hits: list[dict], lang: str) -> str | None:
    if not await is_enabled("chatbot_llm"):
        return None
    llm = get_llm_adapter()
    if not llm.enabled:
        return None
    snippets = "\n\n".join(f"Q : {e['question_fr']}\nR : {e['answer_fr']}" for e in hits)
    try:
        out = await llm.complete(SYSTEM.format(lang="arabe" if lang == "ar" else "français"),
                                 f"Extraits FAQ :\n{snippets}\n\nQuestion de l'utilisateur : {question}")
    except Exception:
        log.exception("llm_failed")
        return None
    return None if not out or "NO_ANSWER" in out else out.strip()


@router.post("/ask")
async def ask(body: AskIn, request: Request, user: User | None = Depends(get_optional_user)):
    if not await is_enabled("chatbot"):
        raise HTTPException(403, "feature_disabled")
    hit(f"chatbot:{client_ip(request)}", 30, 300)
    entries = await db.faq_entries.find({"active": True}).to_list(500)
    ranked = search(body.message, entries)
    min_conf = float(await get_setting("chatbot_min_confidence"))
    best_score, best = ranked[0] if ranked else (0.0, None)
    answered = bool(best) and best_score >= min_conf
    suggestions = [{"id": str(e["_id"]), "question": _q(e, body.lang)} for s, e in ranked[(1 if answered else 0):4] if s >= 0.2][:3]
    await db.chatbot_logs.insert_one({"message": body.message.strip(), "normalized": norm(body.message), "lang": body.lang,
                                      "answered": answered, "confidence": best_score, "faq_id": best["_id"] if answered else None,
                                      "user_id": ObjectId(user.id) if user else None, "created_at": datetime.now(timezone.utc)})
    if not answered:
        return {"answered": False, "confidence": best_score, "answer": None, "suggestions": suggestions, "handoff": True}
    answer = best.get(f"answer_{body.lang}") or best["answer_fr"]
    rephrased = await _rephrase(body.message, [e for s, e in ranked[:3] if s >= min_conf / 2], body.lang)
    return {"answered": True, "confidence": best_score, "faq_id": str(best["_id"]), "question": _q(best, body.lang),
            "answer": rephrased or answer, "rephrased": bool(rephrased), "suggestions": suggestions, "handoff": False}


@router.get("/faq/{faq_id}")
async def faq_entry(faq_id: str, lang: Literal["fr", "ar"] = "fr"):
    try:
        e = await db.faq_entries.find_one({"_id": ObjectId(faq_id), "active": True})
    except Exception:
        e = None
    if not e:
        raise HTTPException(404, "not_found")
    return {"id": faq_id, "question": _q(e, lang), "answer": e.get(f"answer_{lang}") or e["answer_fr"]}


@router.post("/handoff", status_code=201)
async def handoff(body: HandoffIn, request: Request, user: User | None = Depends(get_optional_user)):
    """« Parler à un conseiller » : creates a support ticket visible in the back-office."""
    hit(f"handoff:{client_ip(request)}", 5, 3600)
    if not (body.email or body.phone or user):
        raise HTTPException(422, "contact_required")
    res = await db.support_tickets.insert_one({
        "name": body.name, "email": body.email or (user.email if user else None), "phone": body.phone or (user.phone if user else None),
        "subject": "Chatbot – demande de conseiller", "message": body.message, "source": "chatbot", "status": "open",
        "user_id": ObjectId(user.id) if user else None, "created_at": datetime.now(timezone.utc)})
    return {"ticket_id": str(res.inserted_id)}
