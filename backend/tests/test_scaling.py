"""Several backend workers: the scheduler runs in one of them only, and rate limits still block."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.core import lease, ratelimit
from tests.conftest import run


def test_only_one_worker_holds_the_scheduler_lease(mdb, monkeypatch):
    run(mdb.leases.delete_many({"_id": "test-job"}))
    assert run(lease.acquire("test-job", 60)) is True
    assert run(lease.acquire("test-job", 60)) is True  # the holder renews it
    monkeypatch.setattr(lease, "OWNER", "other-worker:2")
    assert run(lease.acquire("test-job", 60)) is False  # another worker cannot take a live lease
    run(mdb.leases.update_one({"_id": "test-job"}, {"$set": {"until": datetime.now(timezone.utc) - timedelta(seconds=1)}}))
    assert run(lease.acquire("test-job", 60)) is True  # ... but takes over once it has expired
    run(mdb.leases.delete_many({"_id": "test-job"}))


def test_rate_limit_blocks_after_the_limit():
    for _ in range(3):
        run(ratelimit.hit("test-key", 3, 60))
    with pytest.raises(HTTPException) as e:
        run(ratelimit.hit("test-key", 3, 60))
    assert e.value.status_code == 429
