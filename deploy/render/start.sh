#!/bin/sh
# Render: demo data on the first start only, then the API (127.0.0.1:8001) behind Nginx on $PORT.
set -e
# /tmp is empty at run time on Render (the build-time folders are not kept): create Nginx's work folders here.
mkdir -p /tmp/nginx/body /tmp/nginx/proxy /tmp/nginx/fastcgi /tmp/nginx/uwsgi /tmp/nginx/scgi
envsubst '${PORT}' < /srv/render/nginx.conf.template > /tmp/nginx/nginx.conf
python -m app.seed --if-empty || echo "seed failed: the API starts anyway"
uvicorn server:app --host 127.0.0.1 --port 8001 --proxy-headers --forwarded-allow-ips 127.0.0.1 &
API_PID=$!
nginx -c /tmp/nginx/nginx.conf -g 'daemon off;' &
NGINX_PID=$!
# Whichever stops first stops the container, so Render restarts it.
while kill -0 $API_PID 2>/dev/null && kill -0 $NGINX_PID 2>/dev/null; do sleep 5; done
kill $API_PID $NGINX_PID 2>/dev/null || true
exit 1
