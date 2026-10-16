from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING

from app.core.config import settings

client = AsyncIOMotorClient(settings.mongo_url, tz_aware=True)
db = client[settings.db_name]

_STR = {"$type": "string"}


async def init_indexes():
    try:  # legacy: one review per (request, profile) — reviews are now one per completed job
        await db.reviews.drop_index("request_id_1_profile_id_1")
    except Exception:
        pass
    await db.users.create_index("email", unique=True, partialFilterExpression={"email": _STR})
    await db.users.create_index("phone", unique=True, partialFilterExpression={"phone": _STR})
    await db.users.create_index("roles")
    await db.refresh_tokens.create_index("jti", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier", unique=True)
    await db.payment_config.create_index("key", unique=True)
    await db.push_tokens.create_index("token", unique=True)
    await db.push_tokens.create_index("user_id")
    await db.login_attempts.create_index("updated_at", expireAfterSeconds=24 * 3600)
    await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.otp_codes.create_index("phone")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.wilayas.create_index("code", unique=True)
    await db.communes.create_index([("wilaya_code", ASCENDING), ("name_fr", ASCENDING)], unique=True)
    for c in ("taxonomy_families", "taxonomy_categories", "taxonomy_roles", "taxonomy_specialties",
              "academy_subjects", "academy_levels", "plans", "feature_flags", "settings"):
        await db[c].create_index("key", unique=True)
    await db.taxonomy_categories.create_index("family_id")
    await db.onboarding_drafts.create_index([("user_id", ASCENDING), ("kind", ASCENDING)], unique=True)
    await db.favorites.create_index([("user_id", ASCENDING), ("profile_id", ASCENDING)], unique=True)
    await db.conversations.create_index([("client_id", ASCENDING), ("profile_id", ASCENDING)], unique=True)
    await db.conversations.create_index("provider_user_id")
    await db.messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])
    await db.notifications.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await db.payment_orders.create_index("order_number", unique=True)
    await db.payment_orders.create_index("user_id")
    await db.subscriptions.create_index([("user_id", ASCENDING), ("status", ASCENDING), ("ends_at", DESCENDING)])
    await db.invoices.create_index("number", unique=True)
    await db.professional_profiles.create_index("user_id", unique=True)
    await db.professional_profiles.create_index([("category_key", ASCENDING), ("zones.wilaya_code", ASCENDING)])
    await db.professional_profiles.create_index("verification_status")
    await db.teacher_profiles.create_index("user_id", unique=True)
    await db.teacher_profiles.create_index("subjects.subject_id")
    await db.unlock_matrix.create_index([("audience", ASCENDING), ("plan_key", ASCENDING)], unique=True)
    await db.audit_logs.create_index([("created_at", DESCENDING)])
    await db.audit_logs.create_index("action")
    await db.consents.create_index("user_id")
    await db.faq_entries.create_index([("category", ASCENDING), ("lang", ASCENDING)])
    await db.support_tickets.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    await db.onboarding_events.create_index([("user_id", ASCENDING), ("kind", ASCENDING), ("step", ASCENDING)], unique=True)
    await db.category_requests.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    await db.requests.create_index([("client_id", ASCENDING), ("created_at", DESCENDING)])
    await db.requests.create_index("recipients.provider_user_id")
    await db.reviews.create_index([("profile_id", ASCENDING), ("created_at", DESCENDING)])
    await db.reports.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    await db.trust_events.create_index([("profile_id", ASCENDING), ("created_at", DESCENDING)])
    await db.trust_contests.create_index([("status", ASCENDING), ("created_at", DESCENDING)])
    await db.profile_views.create_index([("user_id", ASCENDING), ("month", ASCENDING), ("profile_id", ASCENDING)], unique=True)
    await db.match_impressions.create_index([("user_id", ASCENDING), ("profile_id", ASCENDING), ("created_at", DESCENDING)])
    await db.contact_events.create_index([("user_id", ASCENDING), ("profile_id", ASCENDING), ("created_at", DESCENDING)])
    await db.chatbot_logs.create_index([("answered", ASCENDING), ("created_at", DESCENDING)])
    await db.payment_orders.create_index("gateway_order_id")
    await db.jobs.create_index([("client_id", ASCENDING), ("scheduled_at", DESCENDING)])
    await db.jobs.create_index([("provider_user_id", ASCENDING), ("scheduled_at", DESCENDING)])
    await db.jobs.create_index([("profile_id", ASCENDING), ("status", ASCENDING)])
    await db.jobs.create_index("conversation_id")
    await db.jobs.create_index("dispute.status", sparse=True)
    await db.match_results.create_index([("created_at", DESCENDING)])
    await db.match_feedback.create_index([("match_result_id", ASCENDING), ("profile_id", ASCENDING)])
    await db.reviews.create_index("job_id", unique=True, partialFilterExpression={"job_id": {"$type": "objectId"}})
