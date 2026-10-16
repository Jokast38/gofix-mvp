# Single-container image for Render (TEST environment): React build + FastAPI API + internal Nginx, one public URL.
# Build context = repository root:  docker build -f deploy/render/Dockerfile -t gofix-render .
# Production (Algérie Télécom VPS) keeps using docker-compose.yml.

FROM node:20-alpine AS web
WORKDIR /srv/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY frontend/ .
RUN rm -f .env
# Same origin: the browser calls /api/... and the internal Nginx forwards it to the API.
ENV REACT_APP_BACKEND_URL="" GENERATE_SOURCEMAP=false INLINE_RUNTIME_CHUNK=false
RUN yarn build

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=10000
RUN apt-get update && apt-get install -y --no-install-recommends nginx gettext-base && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/backend
COPY backend/requirements.prod.txt .
RUN pip install --no-cache-dir -r requirements.prod.txt
COPY backend/app ./app
COPY backend/server.py .
COPY --from=web /srv/frontend/build /srv/www
COPY deploy/render/nginx.conf.template deploy/render/start.sh /srv/render/

RUN useradd -r -u 10001 gofix && mkdir -p /data/storage /tmp/nginx \
    && chmod +x /srv/render/start.sh && chown -R gofix /data/storage /srv/backend /tmp/nginx
USER gofix

EXPOSE 10000
CMD ["/srv/render/start.sh"]
