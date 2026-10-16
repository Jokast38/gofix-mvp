# Audit de sécurité GoFix — V1 (octobre 2026)

Périmètre : API FastAPI (`backend/`), web React (`frontend/`), application Expo (`mobile/`), Docker Compose et Nginx (`deploy/`).
Méthode : revue manuelle du code (authentification, autorisations, uploads, paiement, données personnelles), revue de la configuration,
audit des dépendances (`pip-audit`, `npm audit`, `expo-doctor`), tests automatisés de non-régression (`backend/tests/test_security.py`).

## Points déjà solides (constatés)

- Mots de passe hachés avec bcrypt ; JWT d'accès court (15 min) et refresh avec rotation et détection de réutilisation.
- Contrôle d'accès côté serveur : floutage des profils (`AccessPolicy`), matrice de déverrouillage, rôles admin vérifiés par dépendance.
- Requêtes MongoDB construites à partir de champs typés (Pydantic) : pas d'injection d'opérateurs `$`.
- Pièces d'identité stockées dans `storage/private`, jamais servies par Nginx, lisibles uniquement par l'API admin.
- Photos ré-encodées en WebP via Pillow (métadonnées EXIF et contenus piégés supprimés).
- Paiement : callbacks vérifiés auprès de la passerelle, règlement idempotent, montants fixés côté serveur.
- Journal d'audit des actions sensibles ; CORS par liste blanche.
- Dépendances Python : `pip-audit` sans vulnérabilité.

## Vulnérabilités trouvées et corrigées

| # | Gravité | Problème | Correctif |
|---|---|---|---|
| F1 | **Haute** | L'IP client était lue dans le 1er élément de `X-Forwarded-For`, que le client contrôle : on pouvait contourner tous les limiteurs (connexion, OTP, mot de passe oublié) et fausser le journal d'audit. | L'API lit `X-Real-IP`, que Nginx **écrase** ; Nginx écrase aussi `X-Forwarded-For`. |
| F2 | **Haute** | Verrouillage de connexion seulement par couple IP + identifiant : force brute distribuée possible sur un compte. | Second verrou par compte : 10 échecs, toutes IP confondues → 15 min de blocage. Compteurs purgés après 24 h (index TTL). |
| F3 | **Haute** | Rien n'empêchait un déploiement en production avec la configuration de développement (paiement fictif qui active un abonnement sans payer, secret JWT faible, CORS localhost…). | `APP_ENV=production` : l'API **refuse de démarrer** si `JWT_SECRET` est faible, `ADMIN_PASSWORD` est faible, `FRONTEND_URL` n'est pas en https, `CORS_ORIGINS` contient localhost ou `PAYMENT_PROVIDER=mock`. Avertissements pour SMS/e-mail console et MongoDB sans mot de passe. Les routes de paiement fictif sont refusées en production. |
| F4 | Moyenne | Aucun en-tête de sécurité sur le site web (clickjacking, pas de CSP) ; version de Nginx affichée. | CSP stricte (aucun script externe ni inline), `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `server_tokens off`. Build avec `INLINE_RUNTIME_CHUNK=false`. HSTS prêt dans le bloc HTTPS. |
| F5 | Moyenne | Documentation interactive de l'API (`/api/docs`) exposée publiquement. | Masquée en production (sauf `EXPOSE_API_DOCS=true`). |
| F6 | Moyenne | Type des pièces justificatives fondé sur le `Content-Type` déclaré par le client : un HTML déguisé en PDF pouvait être ouvert par un administrateur. | Contrôle du contenu réel (signature `%PDF-`, vérification Pillow et format cohérent) ; le document est servi avec `Content-Security-Policy: sandbox`. |
| F7 | Moyenne | Suppression de compte incomplète (loi 18-07) : nom conservé dans les demandes et avis, photos et pièces d'identité restées sur disque, brouillons, favoris et notifications conservés. | Effacement des fichiers (publics et privés), des profils, brouillons, favoris, notifications, OTP ; anonymisation du nom dans demandes, avis, conversations et rendez-vous. |
| F8 | Basse | Filtre du journal d'audit passé tel quel dans une regex (ReDoS) ; brouillons d'inscription sans limite de taille ; consentement cookies sans limite de débit. | `re.escape`, brouillon limité à 64 Ko, 20 consentements par heure et par IP. |
| F9 | Basse (fonctionnel) | Le lien « mot de passe oublié » envoyé par e-mail menait à une page inexistante sur le web. | Pages `/forgot-password` et `/reset-password`, lien sur la page de connexion, traductions FR et AR. |
| F10 | Basse | MongoDB sans authentification (non exposé à l'extérieur, mais aucune défense en profondeur). | Authentification activable par `MONGO_ROOT_USER`, `MONGO_ROOT_PASSWORD` et `MONGO_URL` (voir `.env.example`). |
| F12 | Basse | Jeton de réinitialisation consommé en deux temps (course possible entre deux requêtes). | Consommation atomique (`find_one_and_update`). Limite de 3 e-mails de réinitialisation par heure et par adresse. |
| F15 | Basse | Callback de paiement sans limite de débit (chaque appel interroge la passerelle). | 60 appels par 10 min et par IP. |
| F20 | Moyenne | Un modérateur pouvait suspendre un administrateur, y compris le super-admin, directement ou via un signalement. | Seul un super-admin peut changer le statut d'un compte administrateur. |
| — | Basse | Réponses de l'API potentiellement mises en cache. | `Cache-Control: no-store` par défaut sur l'API. |
| — | Moyenne | Dépendance web `axios` vulnérable. | Mise à jour vers 1.20.0. |

Chaque correctif est couvert par un test (`backend/tests/test_security.py`). Suite complète : **50 tests réussis**.

## Risques résiduels acceptés pour la V1

- **Limiteur de débit en mémoire** : valable avec un seul processus API (configuration actuelle). Le passer sur Redis ou MongoDB avant de multiplier les workers.
- **Jetons dans `localStorage` (web)** : exposés en cas de faille XSS. Atténué par la CSP stricte et l'échappement React. Évolution possible : refresh token en cookie `HttpOnly`. Le mobile utilise SecureStore.
- **Énumération des comptes à l'inscription** (« e-mail déjà utilisé ») : inévitable pour l'ergonomie, limitée par le débit.
- **Pas de double authentification pour les administrateurs** : à ajouter en V1.1 (TOTP).
- **Pas de chiffrement applicatif des pièces d'identité** : chiffrement du disque du serveur recommandé dès la V1.
- **Outils de build** : les alertes `npm audit` restantes concernent `react-scripts` (build uniquement, non livré aux navigateurs) et l'outillage Expo. Migration vers Vite recommandée.
- **SATIM** jamais testé en conditions réelles : faire une transaction de test avec le compte marchand avant l'ouverture.

## Checklist de mise en production

1. `.env` de production : `APP_ENV=production`, `JWT_SECRET` (`openssl rand -hex 32`), `ADMIN_PASSWORD` de 12 caractères minimum, `FRONTEND_URL=https://…`, `CORS_ORIGINS` limité au domaine réel (supprimer `http://localhost:8090` et `http://localhost:8081`).
2. `PAYMENT_PROVIDER=satim`, `SMS_PROVIDER=http` et `EMAIL_PROVIDER=smtp` avec de vrais identifiants.
3. Certificat TLS, puis décommenter le bloc 443 et la redirection 80 → 443 dans `deploy/nginx/conf.d/gofix.conf`.
4. Authentification MongoDB activée sur un volume neuf ; sauvegardes chiffrées et testées.
5. Ne jamais lancer `seed.py` (comptes de démonstration) en production.
6. Pare-feu : n'ouvrir que les ports 80 et 443 (et SSH par clé).
