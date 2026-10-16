import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Settings:
    def __init__(self):
        e = os.environ
        self.app_env = e.get("APP_ENV", "development")
        self.app_version = "1.0.0"
        self.mongo_url = e["MONGO_URL"]
        self.db_name = e["DB_NAME"]
        self.jwt_secret = e["JWT_SECRET"]
        self.access_ttl_minutes = int(e.get("JWT_ACCESS_TTL_MINUTES", "15"))
        self.refresh_ttl_days = int(e.get("JWT_REFRESH_TTL_DAYS", "30"))
        self.cors_origins = [o.strip() for o in e["CORS_ORIGINS"].split(",") if o.strip()]
        self.admin_email = e["ADMIN_EMAIL"].strip().lower()
        self.admin_password = e["ADMIN_PASSWORD"]
        self.frontend_url = e["FRONTEND_URL"].rstrip("/")
        self.storage_backend = e.get("STORAGE_BACKEND", "local")
        self.storage_local_root = e["STORAGE_LOCAL_ROOT"]
        self.sms_provider = e.get("SMS_PROVIDER", "console")
        self.email_provider = e.get("EMAIL_PROVIDER", "console")
        self.payment_provider = e.get("PAYMENT_PROVIDER", "mock")
        self.llm_provider = e.get("LLM_PROVIDER", "none")


settings = Settings()
