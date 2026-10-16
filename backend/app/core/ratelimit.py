import time
from collections import defaultdict, deque

from fastapi import HTTPException

# In-process limiter (single backend instance). Swap for Redis when scaling horizontally.
_buckets: dict[str, deque] = defaultdict(deque)


def hit(key: str, limit: int, window_s: int):
    now = time.monotonic()
    q = _buckets[key]
    while q and q[0] <= now - window_s:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "rate_limited")
    q.append(now)
