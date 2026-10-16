#!/usr/bin/env bash
# Install or update GoFix on the server (run as root from the code folder, e.g. /opt/gofix):
#   bash scripts/deploy.sh /opt/gofix-release.tar.gz   # new version from an archive (built by scripts/package_release.ps1)
#   bash scripts/deploy.sh                             # rebuild / restart the code already in place (e.g. after git pull)
# Steps: checks .env -> backs up the database -> unpacks the archive (.env is never overwritten) -> builds and starts
#        -> waits for /api/health -> loads reference data (idempotent) -> cleans old Docker images.
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="${1:-}"
cd "$APP_DIR"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERREUR : %s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || fail "Docker n'est pas installé (voir dossier technique, F.3)."
docker compose version >/dev/null 2>&1 || fail "Le plugin « docker compose » est absent."
docker info >/dev/null 2>&1 || fail "Le service Docker ne tourne pas (systemctl start docker)."
trap 'fail "la commande de la ligne $LINENO a échoué (voir les messages ci-dessus)."' ERR
[ -f .env ] || fail "Fichier $APP_DIR/.env absent : cp .env.example .env puis le remplir (dossier technique, E.2 / F.5)."
sed -i 's/\r$//' .env
grep -q '^APP_ENV=production' .env || echo "ATTENTION : APP_ENV n'est pas « production » dans .env (garde-fous de production inactifs)."

if docker compose ps --status running --services 2>/dev/null | grep -qx mongo; then
  say "Sauvegarde de la base avant mise à jour"
  bash scripts/backup_mongo.sh
fi

if [ -n "$ARCHIVE" ]; then
  [ -f "$ARCHIVE" ] || fail "Archive introuvable : $ARCHIVE"
  say "Installation de $(basename "$ARCHIVE")"
  tar xzf "$ARCHIVE" -C "$APP_DIR" --exclude='.env' --exclude='./.env'
fi
# Files read by Linux tools need LF line endings (the project is edited on Windows).
find scripts deploy -type f \( -name '*.sh' -o -name '*.conf' \) -exec sed -i 's/\r$//' {} +
chmod +x scripts/*.sh

say "Construction et démarrage (plusieurs minutes la première fois)"
docker compose up -d --build

BIND="$(grep -E '^HTTP_BIND=' .env | tail -n1 | cut -d= -f2- || true)"
BIND="${BIND:-80}"
[[ "$BIND" == *:* ]] && URL="http://$BIND" || URL="http://127.0.0.1:$BIND"
say "Attente de l'API sur $URL/api/health"
for _ in $(seq 1 60); do
  if curl -fsS "$URL/api/health" >/dev/null 2>&1; then OK=1; break; fi
  sleep 3
done
if [ -z "${OK:-}" ]; then
  docker compose ps
  docker compose logs --tail 40 backend
  fail "L'API ne répond pas. Lire les lignes ci-dessus (ex. « Unsafe production configuration » = valeur du .env à corriger)."
fi
curl -fsS "$URL/api/health"; echo

say "Référentiels (wilayas, métiers, matières, offres, FAQ)"
docker compose exec -T backend python -m app.seed --reference-only

docker image prune -f >/dev/null
say "Déploiement terminé"
docker compose ps
