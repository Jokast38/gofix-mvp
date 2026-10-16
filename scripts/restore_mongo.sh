#!/usr/bin/env bash
# Restore: ./scripts/restore_mongo.sh backups/gofix-gofix-YYYYMMDD-HHMMSS.archive.gz
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f "${1:-}" ] || { echo "Usage: $0 backups/<file>.archive.gz"; exit 1; }
AUTH=()
MONGO_ROOT_USER="$(grep -E '^MONGO_ROOT_USER=' .env | cut -d= -f2- || true)"
if [ -n "$MONGO_ROOT_USER" ]; then
  MONGO_ROOT_PASSWORD="$(grep -E '^MONGO_ROOT_PASSWORD=' .env | cut -d= -f2-)"
  AUTH=(--username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin)
fi
docker compose exec -T mongo mongorestore "${AUTH[@]}" --drop --archive="/backups/$(basename "$1")" --gzip
echo "Restore OK"
