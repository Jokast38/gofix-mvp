# GOFIX — MVP web (Algérie)

Plateforme de mise en relation particuliers ↔ professionnels et élèves ↔ professeurs (GoFix Academy).
Stack : React (PWA) + FastAPI + MongoDB + Nginx. Aucune dépendance cloud étrangère (pas de CDN, polices embarquées, pas de traceurs).

- **Guide d'installation et de mise en ligne (PDF, pour l'équipe de déploiement)** : [`docs/dossier/GoFix_Guide_Installation.pdf`](docs/dossier/GoFix_Guide_Installation.pdf) — serveur, SATIM, Google Play / App Store, recette
- **Dossier technique et guide de prise en main (PDF)** : [`docs/dossier/GoFix_Dossier_Technique.pdf`](docs/dossier/GoFix_Dossier_Technique.pdf) — source HTML dans le même dossier, régénération : `python scripts/build_docs.py`
- Mise en ligne sur le VPS Algérie Télécom (aaPanel) : section F du dossier technique (`HTTP_BIND=127.0.0.1:8080` + reverse proxy aaPanel)
- Audit de sécurité : [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md)
- Architecture, schéma des collections et liste des endpoints : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Documentation OpenAPI : `https://<domaine>/api/docs`

## Déploiement sur un serveur Linux autonome

Prérequis : Debian/Ubuntu récent, Docker Engine + plugin Compose, ports 80/443 ouverts.

```bash
# 1. Récupérer le code
sudo mkdir -p /opt/gofix && cd /opt/gofix   # copier le dépôt ici

# 2. Configuration
cp .env.example .env
openssl rand -hex 32        # → coller dans JWT_SECRET
nano .env                   # FRONTEND_URL, CORS_ORIGINS, ADMIN_EMAIL, ADMIN_PASSWORD, DB_NAME…

# 3. Démarrage (construit les images, lance mongo + backend + frontend + nginx)
docker compose up -d --build
docker compose ps
curl http://localhost/api/health

# 4. Référentiels (58 wilayas, taxonomie, offres, FAQ) — en production : --reference-only
docker compose exec backend python -m app.seed --reference-only
#    Développement uniquement : + 20 pros, 8 profs et comptes de démo (refusé si APP_ENV=production)
docker compose exec backend python -m app.seed
```

Le super-admin défini par `ADMIN_EMAIL` / `ADMIN_PASSWORD` est créé (ou son mot de passe mis à jour) à chaque démarrage.

### HTTPS
1. Placer `fullchain.pem` et `privkey.pem` dans `deploy/nginx/certs/` (certificat d'une AC ou via `certbot certonly --standalone` exécuté sur l'hôte).
2. Dans `deploy/nginx/conf.d/gofix.conf` : décommenter le bloc `server 443` et la ligne `return 301 https://…`.
3. `docker compose restart nginx`.

### Mises à jour
```bash
git pull && docker compose up -d --build
```

## Application mobile (iOS + Android)
Application React Native (Expo) dans [`mobile/`](mobile/README.md) : mêmes endpoints `/api/v1`, mêmes fonctionnalités que le site (hors back-office).
Variable serveur : `MOBILE_APP_SCHEME=gofix` (retour de paiement vers l'app).

## Tests automatisés
```bash
docker compose --profile test run --rm tests   # base dédiée gofix_test, supprimée à la fin
```
67 tests (sécurité, moyen de paiement paramétrable, profil + photo, notifications push, géolocalisation, non-régressions). Couvrent : profils suspendus jamais affichés, AI MATCH (texte libre FR/AR, raisons, traçabilité, explications), Trust Score v2 (statuts, sous-indicateurs, événements audités), cycle RDV / litiges / avis vérifiés, floutage serveur (aucun nom/photo/téléphone pour un visiteur), paiements (succès, échec, annulation, double callback, callback falsifié, expiration, relances), accès gratuit pro (30 j / 5 demandes), Academy (demandes multiples, acceptation/refus, messagerie, avis par matière), Trust Score (non achetable), AI Match, chatbot.

## Sauvegarde MongoDB
```bash
./scripts/backup_mongo.sh                      # → backups/gofix-<db>-<date>.archive.gz (rétention 14 j, RETENTION_DAYS)
./scripts/restore_mongo.sh backups/<fichier>   # restauration (--drop)
```
Cron conseillé : `30 2 * * * cd /opt/gofix && ./scripts/backup_mongo.sh >> backups/backup.log 2>&1`.
Copier régulièrement `backups/` et le volume `storage_data` (fichiers envoyés) vers un second support situé en Algérie.

## Intégrations (adapters, choisies par variables d'environnement)
| Adapter | Dev (défaut) | Réel |
|---|---|---|
| PaymentAdapter | `PAYMENT_PROVIDER=mock` | `satim` (CIB/Edahabia : `SATIM_*`) |
| SmsAdapter | `console` (code OTP dans les logs) | `http` (passerelle SMS : `SMS_HTTP_*`) |
| EmailAdapter | `console` | `smtp` (`SMTP_*`) |
| LlmAdapter | `none` | `openai_compatible` (`LLM_*`) + flag `chatbot_llm` |
| StorageAdapter | `local` (`public/` servi par Nginx, `private/` jamais exposé) | S3/MinIO (à brancher) |

## Exploitation
- Logs JSON sur stdout : `docker compose logs -f backend` (request_id, durée, statut).
- `GET /api/health` : état API + base.
- Journal d'audit : back-office → Journal d'audit.
- Feature flags et paramètres : back-office (sans redéploiement).
- Rate-limit applicatif en mémoire : garder 1 worker backend (ou passer à Redis avant de scaler).

## Communes
Le seed crée le chef-lieu de chaque wilaya + les principales communes des grandes villes. Pour la liste complète (1 541 communes), déposer `backend/app/data/communes.json` (`[{"wilaya_code": 16, "name_fr": "…", "name_ar": "…"}]`) puis relancer le seed.

## Logos
Déposer les fichiers officiels dans `frontend/src/assets/brand/` et mettre à jour `frontend/src/assets/brand/index.js` ; icônes PWA dans `frontend/public/assets/brand/icon-192.png` et `icon-512.png`.

## Avant la mise en production (checklist)
- [ ] Pages légales validées par un juriste algérien ; déclaration ANPDP (loi n° 18-07).
- [ ] Seuil d'âge du consentement parental confirmé (`minor_age_threshold`).
- [ ] Identifiants marchands SATIM, passerelle SMS, SMTP.
- [ ] HTTPS activé, `JWT_SECRET` et `ADMIN_PASSWORD` forts, `CORS_ORIGINS` restreint au domaine.
- [ ] Sauvegardes automatisées et testées (restauration).
