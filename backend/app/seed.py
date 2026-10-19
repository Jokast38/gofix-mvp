"""Idempotent seed (from backend/).
  python -m app.seed --reference-only   reference data only: wilayas, taxonomy, plans, FAQ (production)
  python -m app.seed                    + demo accounts and activity (password GoFix@Demo2026): never in production
"""
import asyncio
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.adapters.storage import get_storage
from app.core.config import settings
from app.core.db import db, init_indexes
from app.core.security import hash_password
from app.data import seed_data as S
from app.data.seed_media import avatar, cover, save_set
from app.services import trust
from app.services.config_store import ensure_defaults

DEMO_PASSWORD = "GoFix@Demo2026"
now = datetime.now(timezone.utc)


async def upsert(coll, key_filter, doc):
    await db[coll].update_one(key_filter, {"$set": doc, "$setOnInsert": {"created_at": now}}, upsert=True)


async def seed_geo():
    for code, fr, ar in S.WILAYAS:
        await upsert("wilayas", {"code": code}, {"code": code, "name_fr": fr, "name_ar": ar})
        await upsert("communes", {"wilaya_code": code, "name_fr": fr}, {"wilaya_code": code, "name_fr": fr, "name_ar": ar, "is_capital": True})
    for code, items in S.EXTRA_COMMUNES.items():
        for fr, ar in items:
            await upsert("communes", {"wilaya_code": code, "name_fr": fr}, {"wilaya_code": code, "name_fr": fr, "name_ar": ar, "is_capital": False})
    full = Path(__file__).parent / "data" / "communes.json"
    if full.exists():
        for c in json.loads(full.read_text(encoding="utf-8")):
            await upsert("communes", {"wilaya_code": c["wilaya_code"], "name_fr": c["name_fr"]}, c)


async def seed_taxonomy():
    for i, (k, fr, ar, icon) in enumerate(S.FAMILIES + S.EXTRA_FAMILIES):
        await upsert("taxonomy_families", {"key": k}, {"key": k, "name_fr": fr, "name_ar": ar, "icon": icon, "order": i, "active": True})
    for i, (k, fam, fr, ar) in enumerate(S.CATEGORIES):
        await upsert("taxonomy_categories", {"key": k}, {"key": k, "family_key": fam, "name_fr": fr, "name_ar": ar,
                                                          "icon": S.CATEGORY_ICONS.get(k, "wrench"), "order": i, "active": True,
                                                          "home_section": "services" if k in S.HOME_SERVICES else ("academy" if k in S.HOME_ACADEMY else None),
                                                          "required_documents": ["id_card"] + (["diploma"] if fam == "academy" else ["trade_register"])})
    for i, (k, fr, ar, fams) in enumerate(S.ROLES):
        await upsert("taxonomy_roles", {"key": k}, {"key": k, "name_fr": fr, "name_ar": ar, "family_keys": fams, "order": i, "active": True})
    for i, (k, cat, fr, ar) in enumerate(S.SPECIALTIES):
        await upsert("taxonomy_specialties", {"key": k}, {"key": k, "category_key": cat, "name_fr": fr, "name_ar": ar, "order": i, "active": True})
    for i, (k, fr, ar) in enumerate(S.SUBJECTS):
        await upsert("academy_subjects", {"key": k}, {"key": k, "name_fr": fr, "name_ar": ar, "order": i, "active": True})
    for i, (k, fr, ar) in enumerate(S.LEVELS):
        await upsert("academy_levels", {"key": k}, {"key": k, "name_fr": fr, "name_ar": ar, "order": i, "active": True})


async def seed_plans_faq():
    for i, (aud, k, fr, ar, price, days, perks) in enumerate(S.PLANS):
        await upsert("plans", {"key": f"{aud}_{k}"}, {"key": f"{aud}_{k}", "audience": aud, "tier": k, "name_fr": fr, "name_ar": ar,
                                                    "price_da": price, "price_tbd": price is None, "duration_days": days,
                                                    "perks_fr": perks, "order": i, "active": True})
    for row in S.UNLOCK_MATRIX:
        await upsert("unlock_matrix", {"audience": row["audience"], "plan_key": row["plan_key"]}, row)
    await db.faq_entries.delete_many({"question_fr": {"$in": S.FAQ_LEGACY_QUESTIONS}})
    for i, (cat, q_fr, q_ar, a_fr, variants) in enumerate(S.FAQ):
        await upsert("faq_entries", {"question_fr": q_fr}, {"category": cat, "question_fr": q_fr, "question_ar": q_ar,
                                                             "answer_fr": a_fr, "answer_ar": None, "variants": variants,
                                                             "lang": "fr", "order": i, "active": True})


async def ensure_user(email, full_name, phone, roles, mode, admin_role=None, **extra):
    existing = await db.users.find_one({"email": email})
    if existing:
        return existing["_id"]
    doc = {"email": email, "phone": phone, "password_hash": hash_password(DEMO_PASSWORD), "full_name": full_name,
           "roles": roles, "active_mode": mode, "admin_role": admin_role, "status": "active", "email_verified": True,
           "phone_verified": True, "preferred_language": "fr", "theme": "dark", "week_start": "saturday",
           "guardian": {}, "created_at": now - timedelta(days=random.randint(0, 13)), "updated_at": now, **extra}
    return (await db.users.insert_one(doc)).inserted_id


def _phone(n):
    return f"+21355{n:07d}"


async def seed_people():
    random.seed(42)
    cats = {c["key"]: c async for c in db.taxonomy_categories.find()}
    await ensure_user("client@gofix.dz", "Amina Client", _phone(1), ["client"], "client")
    await ensure_user("eleve@gofix.dz", "Yanis Élève", _phone(2), ["client", "student"], "student", birth_year=2005)
    # Client with an active Premium subscription (messaging + phone unlocked) for demos
    puid = await ensure_user("premium.client@gofix.dz", "Nadia Premium", _phone(8), ["client"], "client")
    if not await db.subscriptions.find_one({"user_id": puid, "status": "active"}):
        await db.subscriptions.insert_one({"user_id": puid, "plan_key": "client_premium", "tier": "premium", "audience": "client",
                                           "status": "active", "starts_at": now, "ends_at": now + timedelta(days=365), "order_id": None,
                                           "created_at": now, "updated_at": now})
    await ensure_user("moderateur@gofix.dz", "Modérateur GOFIX", _phone(3), ["client"], "client", admin_role="moderator")
    await ensure_user("support@gofix.dz", "Support GOFIX", _phone(4), ["client"], "client", admin_role="support")
    # Fresh accounts without any profile: to test the onboarding tunnel from scratch
    await ensure_user("nouveau.pro@gofix.dz", "Nassim Nouveau", _phone(5), ["client"], "client")
    await ensure_user("nouveau.prof@gofix.dz", "Meriem Nouvelle", _phone(6), ["client"], "client")
    # Pending profiles for admin validation
    uid = await ensure_user("attente.pro@gofix.dz", "Lotfi En Attente", _phone(7), ["client", "professional"], "professional")
    await upsert("professional_profiles", {"user_id": uid}, {
        "user_id": uid, "display_name": "Lotfi En Attente", "family_key": "food", "category_key": "pastry", "role_key": "independent",
        "specialty_keys": [], "zones": [{"wilaya_code": 16, "commune_names": ["Kouba"], "radius_km": 10}],
        "bio": "Pâtissier à domicile : gâteaux d'anniversaire, mariages et fêtes. Livraison sur Alger.", "experience_years": 4,
        "price_hint_da": 2500, "availability": {"week_start": "saturday", "slots": []},
        "verification_status": "pending", "documents": [], "trust_score": 40, "rating_avg": 0, "rating_count": 0, "response_rate": 1.0,
        "free_access": {"started_at": now, "requests_received": 0}, "onboarding": {"completed": True, "step": 7},
        "plan_key": "professional_free", "passport": {"enabled": False, "slug": None}, "ai": {}, "updated_at": now})
    for i, name in enumerate(S.PRO_NAMES):
        email = "pro@gofix.dz" if i == 0 else f"pro{i + 1:02d}@demo.gofix.dz"
        uid = await ensure_user(email, name, _phone(100 + i), ["client", "professional"], "professional")
        cat = cats[S.PRO_CATS[i]]
        verified = i % 3 != 2
        await upsert("professional_profiles", {"user_id": uid}, {
            "user_id": uid, "display_name": name, "family_key": cat["family_key"], "category_key": cat["key"],
            "role_key": ["independent", "company", "apprentice"][i % 3] if i % 5 else "company",
            "specialty_keys": [s["key"] async for s in db.taxonomy_specialties.find({"category_key": cat["key"]})][:2],
            "zones": [{"wilaya_code": S.PRO_WILAYAS[i], "commune_names": [], "radius_km": random.choice([5, 10, 20, 30])}],
            "bio": f"{cat['name_fr']} expérimenté, intervention rapide et travail soigné.",
            "experience_years": random.randint(1, 20), "price_hint_da": random.choice([None, 1500, 2500, 3000, 5000]),
            "verification_status": "verified" if verified else "unverified",
            "free_access": {"started_at": now - timedelta(days=random.randint(0, 40)), "requests_received": random.randint(0, 6)},
            "onboarding": {"completed": True, "step": 7}, "plan_key": "professional_free",
            "passport": {"enabled": False, "slug": None}, "ai": {}, "updated_at": now})
    for i, (name, subjects, formats, wilaya) in enumerate(S.TEACHERS):
        uid = await ensure_user("prof@gofix.dz" if i == 0 else f"prof{i + 1:02d}@demo.gofix.dz", name, _phone(200 + i),
                                ["client", "teacher"], "teacher")
        await upsert("teacher_profiles", {"user_id": uid}, {
            "user_id": uid, "display_name": name, "role_key": "private_teacher",
            "subjects": [{"subject_key": s, "level_keys": lv} for s, lv in subjects], "formats": formats,
            "teaching_languages": ["fr", "ar"], "zones": [{"wilaya_code": wilaya, "commune_names": [], "radius_km": 10}],
            "bio": "Professeur expérimenté, méthode claire et suivi personnalisé.",
            "experience_years": random.randint(2, 25), "price_hint_da_hour": random.choice([800, 1000, 1500, 2000]),
            "verification_status": "verified",
            "availability": {"week_start": "saturday", "slots": []}, "onboarding": {"completed": True, "step": 7},
            "plan_key": "professional_free", "ai": {}, "updated_at": now})


DEMO_EMAIL_RX = {"$regex": r"@(demo\.)?gofix\.dz$"}
DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"]


async def seed_enrich():
    """Demo covers/avatars (every other profile keeps initials), availability, seniority, then Trust Score by rules."""
    storage = get_storage()
    rnd = random.Random(7)
    demo_ids = [u["_id"] async for u in db.users.find({"email": DEMO_EMAIL_RX}, {"_id": 1})]
    showcase = {u["_id"] async for u in db.users.find({"email": {"$in": ["pro@gofix.dz", "prof@gofix.dz"]}}, {"_id": 1})}
    for kind, coll in (("professional", db.professional_profiles), ("teacher", db.teacher_profiles)):
        async for i, p in _aenum(coll.find({"user_id": {"$in": demo_ids}}).sort("_id", 1)):
            upd = {}
            seed = (1 if kind == "professional" else 100) + i
            if not p.get("cover_key"):
                upd |= save_set(storage, cover, seed, "cover")
            if not p.get("photo_key") and i % 2 == 0 and p.get("verification_status") != "pending":
                upd |= save_set(storage, avatar, seed, "photo")
            if not (p.get("availability") or {}).get("slots"):
                days = rnd.sample(DAYS, rnd.randint(2, 6))
                upd["availability"] = {"week_start": "saturday", "slots": [{"day": d, "slot": rnd.choice(["morning", "afternoon", "evening"])} for d in days]}
            if not p.get("seed_backdated"):
                upd |= {"created_at": now - timedelta(days=rnd.randint(20, 900)), "seed_backdated": True}
            if kind == "teacher" and not p.get("free_access"):
                upd["free_access"] = {"started_at": now - timedelta(days=rnd.randint(0, 20)), "requests_received": rnd.randint(0, 3)}
            if p["user_id"] in showcase:  # predictable availability for demos/acceptance cases (e.g. "mardi soir")
                upd["availability"] = {"week_start": "saturday", "slots": [{"day": d, "slot": sl} for d in DAYS for sl in ("morning", "evening")]}
            if p["user_id"] in showcase:  # pro@gofix.dz / prof@gofix.dz: free access in progress, for the dashboard demo
                upd["free_access"] = {"started_at": now - timedelta(days=12), "requests_received": 2}
            if upd:
                await coll.update_one({"_id": p["_id"]}, {"$set": upd})


async def _aenum(cursor):
    i = 0
    async for x in cursor:
        yield i, x
        i += 1


async def seed_demo_activity():
    """A few requests/conversations so every role has something to look at. Idempotent."""
    if await db.requests.count_documents({}):
        return
    users = {u["email"]: u async for u in db.users.find({"email": {"$in": ["client@gofix.dz", "eleve@gofix.dz", "pro@gofix.dz", "prof@gofix.dz"]}})}
    pro = await db.professional_profiles.find_one({"user_id": users["pro@gofix.dz"]["_id"]})
    teachers = await db.teacher_profiles.find({"subjects.subject_key": "math"}).to_list(3)
    client, eleve = users["client@gofix.dz"], users["eleve@gofix.dz"]
    t0 = now - timedelta(days=2)

    def rec(p, status, conv=None):
        return {"profile_id": p["_id"], "provider_user_id": p["user_id"], "display_name": p["display_name"], "photo_thumb_key": p.get("photo_thumb_key"),
                "status": status, "locked": False, "conversation_id": conv, "seen_at": t0, "responded_at": t0 if status in ("accepted", "refused") else None}

    conv = (await db.conversations.insert_one({"client_id": client["_id"], "provider_user_id": pro["user_id"], "profile_id": pro["_id"],
                                               "kind": "professional", "provider_display_name": pro["display_name"], "created_at": t0,
                                               "updated_at": t0, "last_message": None})).inserted_id
    msg = "Bonjour, j'ai une fuite sous l'évier de la cuisine à Kouba. Pouvez-vous passer cette semaine ?"
    reply = "Bonjour, oui je peux passer jeudi matin. Pouvez-vous m'envoyer une photo de la fuite ?"
    await db.messages.insert_many([{"conversation_id": conv, "sender_id": client["_id"], "body": msg, "created_at": t0, "read_at": t0},
                                   {"conversation_id": conv, "sender_id": pro["user_id"], "body": reply, "created_at": t0 + timedelta(minutes=20), "read_at": None}])
    await db.conversations.update_one({"_id": conv}, {"$set": {"last_message": {"body": reply, "sender_id": pro["user_id"], "at": t0 + timedelta(minutes=20)}}})
    await db.requests.insert_one({"client_id": client["_id"], "client_name": client["full_name"], "kind": "professional", "mode": "open",
                                  "category_key": "plumber", "wilaya_code": 16, "commune": "Kouba", "message": msg,
                                  "recipients": [rec(pro, "accepted", conv)], "status": "open", "created_at": t0, "updated_at": t0})
    if teachers:
        await db.requests.insert_one({"client_id": eleve["_id"], "client_name": eleve["full_name"], "kind": "teacher", "mode": "targeted",
                                      "subject_key": "math", "level_key": "secondary", "format": "online", "wilaya_code": 16,
                                      "message": "Bonjour, je prépare le BAC et je cherche des cours de maths 2 fois par semaine.",
                                      "recipients": [rec(t, "sent") for t in teachers], "status": "open", "created_at": t0, "updated_at": t0})
    if not await db.subscriptions.find_one({"user_id": eleve["_id"], "status": "active"}):
        await db.subscriptions.insert_one({"user_id": eleve["_id"], "plan_key": "student_student_pass", "tier": "student_pass", "audience": "student",
                                           "status": "active", "starts_at": now, "ends_at": now + timedelta(days=30), "order_id": None,
                                           "reminders_sent": [], "created_at": now, "updated_at": now})


COMMENTS = ["Travail soigné et ponctuel, je recommande.", "Très professionnel, prix correct.", "Rapide et efficace.",
            "Bon contact, explications claires.", "Satisfait du résultat.", "Un peu de retard mais travail bien fait.",
            "Excellent, je referai appel à lui.", "Pédagogue et patient, mon fils a progressé."]


async def _conversation(client, profile, kind, request_id, at):
    conv = await db.conversations.find_one({"client_id": client["_id"], "profile_id": profile["_id"]})
    if conv:
        return conv["_id"]
    return (await db.conversations.insert_one({"client_id": client["_id"], "provider_user_id": profile["user_id"], "profile_id": profile["_id"],
                                               "kind": kind, "provider_display_name": profile["display_name"], "request_id": request_id,
                                               "created_at": at, "updated_at": at, "last_message": None})).inserted_id


async def _history_job(rnd, client, profile, kind, *, days_ago, outcome, subject=None):
    """Request accepted -> conversation -> job (completed / cancelled by provider) -> verified review."""
    at = now - timedelta(days=days_ago)
    rec = {"profile_id": profile["_id"], "provider_user_id": profile["user_id"], "display_name": profile["display_name"],
           "photo_thumb_key": profile.get("photo_thumb_key"), "status": "accepted", "locked": False, "conversation_id": None,
           "seen_at": at, "responded_at": at + timedelta(hours=rnd.randint(1, 20))}
    req = {"client_id": client["_id"], "client_name": client["full_name"], "kind": kind, "mode": "targeted", "seed": True,
           "category_key": profile.get("category_key"), "subject_key": subject, "level_key": None, "wilaya_code": (profile.get("zones") or [{}])[0].get("wilaya_code"),
           "message": "Bonjour, êtes-vous disponible prochainement ?", "recipients": [rec], "status": "closed", "created_at": at, "updated_at": at}
    rid = (await db.requests.insert_one(req)).inserted_id
    conv = await _conversation(client, profile, kind, rid, at)
    await db.requests.update_one({"_id": rid}, {"$set": {"recipients.0.conversation_id": conv}})
    when = at + timedelta(days=rnd.randint(1, 4), hours=rnd.randint(8, 17))
    job = {"conversation_id": conv, "request_id": rid, "kind": kind, "client_id": client["_id"], "provider_user_id": profile["user_id"],
           "profile_id": profile["_id"], "provider_display_name": profile["display_name"], "category_key": profile.get("category_key"),
           "subject_key": subject, "scheduled_at": when, "mode": "online" if kind == "teacher" and rnd.random() < 0.4 else "home",
           "note": "", "price_da": profile.get("price_hint_da") or profile.get("price_hint_da_hour"), "proposed_by": "provider",
           "confirmed_at": at + timedelta(hours=2), "reviewed": False, "seed": True, "created_at": at, "updated_at": when}
    if outcome == "completed":
        job |= {"status": "completed", "completed_at": when + timedelta(hours=2),
                "history": [{"status": "proposed", "by": "provider", "reason": "", "at": at}, {"status": "scheduled", "by": "client", "reason": "", "at": at},
                            {"status": "completed", "by": "client", "reason": "", "at": when + timedelta(hours=2)}]}
    else:
        job |= {"status": "cancelled", "cancelled_by": "provider", "late_cancel": rnd.random() < 0.5, "cancel_reason": "Empêchement",
                "history": [{"status": "cancelled", "by": "provider", "reason": "Empêchement", "at": when - timedelta(hours=10)}]}
    jid = (await db.jobs.insert_one(job)).inserted_id
    if outcome == "completed" and rnd.random() < 0.85:
        rating = rnd.choices([5, 4, 3, 2], weights=[55, 32, 10, 3])[0]
        await db.jobs.update_one({"_id": jid}, {"$set": {"reviewed": True}})
        await db.reviews.insert_one({"job_id": jid, "request_id": rid, "profile_id": profile["_id"], "kind": kind, "client_id": client["_id"],
                                     "author_name": f"{client['full_name'].split()[0]} {client['full_name'].split()[-1][0]}.", "rating": rating,
                                     "subject_key": subject, "comment": rnd.choice(COMMENTS), "verified": True, "seed": True,
                                     "created_at": when + timedelta(hours=rnd.randint(3, 48))})


async def seed_history():
    """Realistic reputation for demo profiles: completed jobs/lessons with verified reviews (idempotent)."""
    seeded = set(await db.jobs.distinct("profile_id", {"seed": True}))
    first_run = not seeded
    rnd = random.Random(2026)
    first = ["Yasmine", "Rachid", "Kenza", "Samir", "Lina", "Walid", "Meriem", "Hakim", "Sonia", "Bilal", "Nour", "Adel"]
    last = ["Bensaid", "Kaci", "Mebarki", "Ouali", "Haddad", "Ziane", "Belaid", "Toumi", "Saidi", "Amrani", "Cherif", "Lounis"]
    clients = []
    for i in range(12):
        cid = await ensure_user(f"client{i + 1:02d}@demo.gofix.dz", f"{first[i]} {last[i]}", _phone(300 + i), ["client"], "client")
        clients.append(await db.users.find_one({"_id": cid}))
    for kind, coll in (("professional", db.professional_profiles), ("teacher", db.teacher_profiles)):
        async for p in coll.find({"verification_status": {"$in": ["verified", "unverified"]}}):
            if p["_id"] in seeded:
                continue
            n = rnd.randint(3, 9) if p["verification_status"] == "verified" else rnd.randint(0, 2)
            subjects = [s["subject_key"] for s in p.get("subjects") or []]
            for k in range(n):
                await _history_job(rnd, rnd.choice(clients), p, kind, days_ago=rnd.randint(10, 420), outcome="completed",
                                   subject=rnd.choice(subjects) if subjects else None)
            if rnd.random() < 0.25:
                await _history_job(rnd, rnd.choice(clients), p, kind, days_ago=rnd.randint(10, 200), outcome="cancelled",
                                   subject=subjects[0] if subjects else None)
    if not first_run:
        return
    # Showcase: client@ <-> pro@ already talk (seed_demo_activity): one past job to rate + one upcoming appointment.
    client = await db.users.find_one({"email": "client@gofix.dz"})
    pro_user = await db.users.find_one({"email": "pro@gofix.dz"})
    pro = await db.professional_profiles.find_one({"user_id": pro_user["_id"]})
    conv = await db.conversations.find_one({"client_id": client["_id"], "profile_id": pro["_id"]})
    if conv:
        base = {"conversation_id": conv["_id"], "request_id": conv.get("request_id"), "kind": "professional", "client_id": client["_id"],
                "provider_user_id": pro["user_id"], "profile_id": pro["_id"], "provider_display_name": pro["display_name"],
                "category_key": pro.get("category_key"), "subject_key": None, "mode": "home", "price_da": pro.get("price_hint_da"),
                "proposed_by": "provider", "reviewed": False, "seed": True, "created_at": now - timedelta(days=9), "updated_at": now}
        await db.jobs.insert_one(base | {"scheduled_at": now - timedelta(days=7), "status": "completed", "completed_at": now - timedelta(days=7),
                                         "confirmed_at": now - timedelta(days=8), "note": "Réparation fuite sous évier",
                                         "history": [{"status": "completed", "by": "client", "reason": "", "at": now - timedelta(days=7)}]})
        tomorrow = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)  # 10:00 Algiers
        await db.jobs.insert_one(base | {"scheduled_at": tomorrow, "status": "scheduled", "confirmed_at": now, "note": "Contrôle du chauffe-eau",
                                         "history": [{"status": "proposed", "by": "provider", "reason": "", "at": now},
                                                     {"status": "scheduled", "by": "client", "reason": "", "at": now}]})


async def seed_more_pros():
    """Demo catalogue: every category (except private tutoring, covered by teachers) gets several pros, with varied
    names, wilayas and pitches. Idempotent: only the missing ones are created (pro21@demo.gofix.dz, pro22@...)."""
    rnd = random.Random(5150)
    cats = [c async for c in db.taxonomy_categories.find({"active": True, "key": {"$ne": "private_tutoring"}}).sort("order", 1)]
    roles = {r[0]: r[3] for r in S.ROLES}
    n = 21
    for cat in cats:
        target = S.MORE_PROS_HOME if cat.get("home_section") else S.MORE_PROS_PER_CATEGORY
        have = await db.professional_profiles.count_documents({"category_key": cat["key"]})
        fam = cat["family_key"]
        allowed = [k for k, fams in roles.items() if fam in fams] or ["independent"]
        specialties = [x["key"] async for x in db.taxonomy_specialties.find({"category_key": cat["key"]})]
        while have < target:
            email = f"pro{n:02d}@demo.gofix.dz"
            name = f"{rnd.choice(S.MORE_FIRST)} {rnd.choice(S.MORE_LAST)}"
            uid = await ensure_user(email, name, _phone(400 + n), ["client", "professional"], "professional")
            if await db.professional_profiles.find_one({"user_id": uid}):
                n += 1
                continue
            pitch = rnd.sample(S.FAMILY_PITCH.get(fam, S.FAMILY_PITCH["home_services"]), 2)
            role = "private_teacher" if fam == "academy" else rnd.choice(allowed)
            await upsert("professional_profiles", {"user_id": uid}, {
                "user_id": uid, "display_name": (await db.users.find_one({"_id": uid}))["full_name"], "family_key": fam,
                "category_key": cat["key"], "role_key": role, "specialty_keys": rnd.sample(specialties, min(len(specialties), rnd.randint(1, 2))),
                "zones": [{"wilaya_code": rnd.choice(S.MORE_WILAYAS), "commune_names": [], "radius_km": rnd.choice([5, 10, 20, 30, 50])}],
                "bio": f"{cat['name_fr']} – {pitch[0]} {pitch[1]}", "experience_years": rnd.randint(1, 25),
                "price_hint_da": rnd.choice([None, 1000, 1500, 2000, 2500, 3000, 4000, 5000]),
                "verification_status": "verified" if rnd.random() < 0.8 else "unverified",
                "free_access": {"started_at": now - timedelta(days=rnd.randint(0, 40)), "requests_received": rnd.randint(0, 6)},
                "onboarding": {"completed": True, "step": 7}, "plan_key": "professional_free",
                "passport": {"enabled": False, "slug": None}, "ai": {}, "seed_more": True, "updated_at": now})
            have += 1
            n += 1


def _banner_image(lines, seed):
    """Example banner (1200x400) drawn locally: brand gradient + three lines of text."""
    from PIL import ImageDraw, ImageFont
    img = cover(seed)
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle((0, 0, 1200, 400), fill=(5, 7, 15, 90))
    # Built-in font (no accents): large text, still readable once the banner is shrunk to a phone width.
    fonts = [ImageFont.load_default(size) for size in (88, 46, 46)]
    y = 70
    for text, font, fill in zip(lines, fonts, [(255, 255, 255, 255), (220, 230, 255, 255), (0, 209, 255, 255)]):
        d.text((70, y), text, font=font, fill=fill)
        y += 122 if font is fonts[0] else 76
    d.rounded_rectangle((1010, 24, 1176, 64), radius=18, fill=(255, 255, 255, 40))
    d.text((1030, 30), "EXEMPLE", font=ImageFont.load_default(24), fill=(255, 255, 255, 230))
    return img


async def seed_promos():
    """Two example sponsored banners (only when no banner exists yet), so the placements can be seen in demos."""
    if await db.ad_banners.count_documents({}):
        return
    from app.data.seed_media import _webp
    storage = get_storage()
    for i, b in enumerate(S.DEMO_BANNERS):
        img = _banner_image(b["lines"], 900 + i)
        keys = {"image_key": storage.save(_webp(img), "webp", folder="seed/banners"),
                "image_thumb_key": storage.save(_webp(img.resize((600, 200))), "webp", folder="seed/banners")}
        doc = {k: v for k, v in b.items() if k != "lines"} | keys | {
            "active": True, "starts_at": None, "ends_at": None, "impressions": 0, "clicks": 0, "seed": True,
            "created_at": now, "updated_at": now, "created_by": "seed"}
        await db.ad_banners.insert_one(doc)


DEMO_VERSION = 2  # bump when new demo steps must reach existing demo databases (Render)


async def upgrade_demo():
    """Existing demo database: run only the idempotent steps added since (does not reset what testers changed)."""
    await seed_more_pros()
    await seed_enrich()
    await seed_history()
    await seed_trust()
    await seed_promos()


async def seed_trust():
    """Displayed ratings derive from verified reviews, then Trust Score v2 is recomputed for every demo profile."""
    for kind, coll in (("professional", db.professional_profiles), ("teacher", db.teacher_profiles)):
        async for p in coll.find({}):
            reviews = await db.reviews.find({"profile_id": p["_id"]}, {"rating": 1, "subject_key": 1}).to_list(5000)
            upd = {"rating_count": len(reviews), "rating_avg": round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else 0}
            if kind == "teacher":
                by = {}
                for r in reviews:
                    if r.get("subject_key"):
                        by.setdefault(r["subject_key"], []).append(r["rating"])
                upd["ratings_by_subject"] = {k: {"avg": round(sum(v) / len(v), 1), "count": len(v)} for k, v in by.items()}
            upd.pop("response_rate", None)
            await coll.update_one({"_id": p["_id"]}, {"$set": upd, "$unset": {"response_rate": ""}})
            await trust.recompute(kind, p["_id"], "seed", "seed")


async def main(reference_only: bool = False, if_empty: bool = False):
    if if_empty and await db.users.find_one({"email": "client@gofix.dz"}):
        meta = await db.app_meta.find_one({"key": "demo_seed"}) or {}
        if meta.get("version", 1) >= DEMO_VERSION:
            print("Demo data already present: seed skipped.")  # test servers restarting (Render): keep what testers did
            return
        await init_indexes()
        await ensure_defaults()
        await upgrade_demo()
        await db.app_meta.update_one({"key": "demo_seed"}, {"$set": {"version": DEMO_VERSION, "updated_at": now}}, upsert=True)
        print(f"Demo data upgraded to version {DEMO_VERSION}.")
        return
    await init_indexes()
    await ensure_defaults()
    await seed_geo()
    await seed_taxonomy()
    await seed_plans_faq()
    if reference_only:
        print({c: await db[c].count_documents({}) for c in ("wilayas", "communes", "taxonomy_categories", "plans", "faq_entries")})
        return
    await seed_people()
    await seed_more_pros()
    await seed_enrich()
    await seed_demo_activity()
    await seed_history()
    await seed_trust()
    await seed_promos()
    await db.app_meta.update_one({"key": "demo_seed"}, {"$set": {"version": DEMO_VERSION, "updated_at": now}}, upsert=True)
    print({c: await db[c].count_documents({}) for c in ("wilayas", "communes", "taxonomy_categories", "users",
                                                        "professional_profiles", "teacher_profiles", "plans", "faq_entries", "requests", "jobs", "reviews", "trust_events")})


if __name__ == "__main__":
    ref_only = "--reference-only" in sys.argv
    if not ref_only and settings.app_env == "production":
        sys.exit("Refused: demo accounts share a public password. In production use: python -m app.seed --reference-only")
    asyncio.run(main(reference_only=ref_only, if_empty="--if-empty" in sys.argv))
