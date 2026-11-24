"""Anti-abuse rate limits (sliding window).

With REDIS_URL set, the counters live in Redis and are shared by every backend worker (several processes on the VPS).
Without it (local development, tests, a single Render instance) they stay in memory, which is only correct with ONE
worker: start.sh then forces a single worker. If Redis is briefly unreachable, the in-memory limiter takes over
rather than blocking every user."""
import time
import uuid
from collections import defaultdict, deque

from fastapi import HTTPException

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("ratelimit")
_buckets: dict[str, deque] = defaultdict(deque)
_redis = None
_redis_down_logged = False


def _client():
    global _redis
    if _redis is None and settings.redis_url:
        import redis.asyncio as redis  # only needed when Redis is configured
        _redis = redis.from_url(settings.redis_url, socket_timeout=0.5, socket_connect_timeout=0.5)
    return _redis


def _hit_memory(key: str, limit: int, window_s: int):
    now = time.monotonic()
    q = _buckets[key]
    while q and q[0] <= now - window_s:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "rate_limited")
    q.append(now)


async def hit(key: str, limit: int, window_s: int):
    """Counts one attempt for `key`; 429 once `limit` attempts were made in the last `window_s` seconds."""
    global _redis_down_logged
    r = _client()
    if r is None:
        return _hit_memory(key, limit, window_s)
    k, now, member = f"rl:{key}", time.time(), uuid.uuid4().hex
    try:
        async with r.pipeline(transaction=True) as p:
            p.zremrangebyscore(k, 0, now - window_s)
            p.zcard(k)
            p.zadd(k, {member: now})
            p.expire(k, window_s)
            _, count, _, _ = await p.execute()
        _redis_down_logged = False
    except Exception:
        if not _redis_down_logged:
            log.warning("ratelimit_redis_unavailable")
            _redis_down_logged = True
        return _hit_memory(key, limit, window_s)
    if count >= limit:
        try:
            await r.zrem(k, member)  # a rejected attempt does not extend the block
        except Exception:
            pass
        raise HTTPException(429, "rate_limited")
