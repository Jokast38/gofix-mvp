"""Integration tests against a real MongoDB (separate `gofix_test` database, dropped at start).
Run inside the backend container:  docker compose exec backend sh -c "pip install -q -r requirements-dev.txt && python -m pytest -q"
"""
import asyncio
import os
import uuid

os.environ["DB_NAME"] = os.environ.get("TEST_DB_NAME", "gofix_test")
os.environ["APP_ENV"] = "test"
os.environ["PAYMENT_PROVIDER"] = "mock"
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

# One loop for the whole session, set BEFORE the app (and its Motor client) is imported.
LOOP = asyncio.new_event_loop()
asyncio.set_event_loop(LOOP)

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.core import ratelimit  # noqa: E402
from app.core.db import client as mongo_client, db  # noqa: E402
from app.main import app, startup  # noqa: E402

DEMO_PASSWORD = "GoFix@Demo2026"


def run(coro):
    return LOOP.run_until_complete(coro)


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    from app import seed
    run(mongo_client.drop_database(os.environ["DB_NAME"]))
    run(startup())
    run(seed.main())
    yield
    run(mongo_client.drop_database(os.environ["DB_NAME"]))


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    ratelimit._buckets.clear()


class Api:
    """Tiny sync wrapper around an ASGI httpx client."""

    def __init__(self, token: str | None = None):
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

    def _req(self, method, url, **kw):
        async def go():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                return await c.request(method, f"/api/v1{url}", headers=self.headers | kw.pop("headers", {}), **kw)
        return run(go())

    def get(self, url, **kw):
        return self._req("GET", url, **kw)

    def post(self, url, **kw):
        return self._req("POST", url, **kw)

    def put(self, url, **kw):
        return self._req("PUT", url, **kw)

    def patch(self, url, **kw):
        return self._req("PATCH", url, **kw)


def login(email: str, password: str = DEMO_PASSWORD) -> Api:
    r = Api().post("/auth/login", json={"identifier": email, "password": password})
    assert r.status_code == 200, r.text
    return Api(r.json()["access_token"])


def register(account_type: str = "client") -> tuple[Api, dict]:
    n = uuid.uuid4().int % 10_000_000
    body = {"full_name": "Test Utilisateur", "email": f"t{n}@test.dz", "phone": f"07{n:08d}", "password": "Secret123",
            "account_type": account_type, "accept_terms": True, "accept_privacy": True}
    r = Api().post("/auth/register", json=body)
    assert r.status_code == 201, r.text
    return Api(r.json()["access_token"]), r.json()["user"]


@pytest.fixture
def api():
    return Api()


@pytest.fixture
def mdb():
    return db
