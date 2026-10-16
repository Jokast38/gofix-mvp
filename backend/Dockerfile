FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/backend

COPY requirements.prod.txt .
RUN pip install --no-cache-dir -r requirements.prod.txt

COPY app ./app
COPY server.py .

RUN useradd -r -u 10001 gofix && mkdir -p /data/storage && chown -R gofix /data/storage /srv/backend
USER gofix

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8001/api/health')"
# Single worker: the in-process rate limiter assumes one process (switch to Redis before scaling out).
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "*"]

# Test image (not deployed): docker compose --profile test run --rm tests
FROM runtime AS test
USER root
COPY requirements-dev.txt pytest.ini ./
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY tests ./tests
CMD ["python", "-m", "pytest", "-q"]

# Default build target (Render, plain `docker build`): the runtime image, never the test one.
FROM runtime AS release
