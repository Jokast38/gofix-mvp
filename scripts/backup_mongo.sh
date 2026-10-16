#!/usr/bin/env bash
# MongoDB backup (gzip archive) into ./backups, keeps the last RETENTION_DAYS days.
# Cron example (daily 02:30):  30 2 * * * cd /opt/gofix && ./scripts/backup_mongo.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
source <(grep -E '^DB_NAME=' .env)
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="gofix-${DB_NAME}-${STAMP}.archive.gz"
mkdir -p backups
AUTH=()
MONGO_ROOT_USER="$(grep -E '^MONGO_ROOT_USER=' .env | cut -d= -f2- || true)"
if [ -n "$MONGO_ROOT_USER" ]; then
  MONGO_ROOT_PASSWORD="$(grep -E '^MONGO_ROOT_PASSWORD=' .env | cut -d= -f2-)"
  AUTH=(--username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin)
fi
docker compose exec -T mongo mongodump "${AUTH[@]}" --db "$DB_NAME" --archive="/backups/${FILE}" --gzip
find backups -name 'gofix-*.archive.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Backup OK: backups/${FILE}"
