#!/bin/sh
# Initialise once, then start the web workers. Several workers need Redis (shared rate limits): without REDIS_URL
# the backend stays on a single worker, as before.
set -e
python -m app.prestart
workers="${WEB_CONCURRENCY:-2}"
if [ -z "$REDIS_URL" ]; then workers=1; fi
export GOFIX_PRESTARTED=1
exec uvicorn server:app --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips "*" --workers "$workers"
