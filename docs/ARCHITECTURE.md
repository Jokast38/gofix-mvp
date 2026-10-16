# GOFIX — Architecture du socle (lot 0)

API-first : toute la logique est dans l'API REST `/api/v1` (FastAPI, OpenAPI sur `/api/docs`). Le web (React PWA) et la future app mobile consomment les mêmes endpoints, authentifiés par **JWT Bearer** (access 15 min + refresh 30 j avec rotation et détection de réutilisation).

```
backend/app/
  core/        config (env), db (Motor + index), security (bcrypt/JWT), deps (auth, rôles admin), ratelimit, logging JSON, phone (+213)
  models/      BaseDocument (_id ↔ id), User, AuditLog, Consent
  adapters/    payment (mock | satim), sms (console | http), email (console | smtp), llm (none | openai_compatible), storage (local, S3/MinIO plus tard)
  services/    audit, config_store (feature flags + paramètres)
  api/v1/      auth, users, catalog (géo + taxonomie), public (config, consentements, contact, FAQ), admin
  data/        wilayas/taxonomie/offres/FAQ de seed, registre des traitements, valeurs par défaut
  seed.py      seed idempotent : python -m app.seed
frontend/src/
  i18n/        fr.js, ar.js (RTL), registre LANGUAGES extensible (en, tz)
  lib/         api.js (axios + refresh), format.js (DA, JJ/MM/AAAA Africa/Algiers, téléphone), ui.js (classes de design)
  services/    appels API purs (portables React Native)
  hooks/       AuthProvider, ThemeProvider, usePublic (react-query)
  components/  brand/Logo (unique), layout/, home/, auth/, account/
  pages/       Home, Login, Register, Account, admin/*, Legal, Faq, Contact, AppLanding, ComingSoon, NotFound
```

## Collections MongoDB

Conventions : `_id` ObjectId exposé en `id` ; dates en UTC (`datetime` BSON) affichées en Africa/Algiers ; clés métier stables `key` (snake_case anglais) pour les référentiels ; libellés `name_fr` / `name_ar`.

### Socle (implémentées)
| Collection | Champs principaux | Index |
|---|---|---|
| `users` | email, phone (+213…), email_verified, phone_verified, password_hash, full_name, roles[client, professional, teacher, student], active_mode, admin_role (super_admin, moderator, support), status (active, suspended, deleted), preferred_language, theme, week_start (saturday, sunday), wilaya_code, birth_year, guardian{managed_by_guardian, guardian_name, guardian_phone, consent_at}, created_at, updated_at, last_login_at, deleted_at | email unique (partiel), phone unique (partiel), roles |
| `refresh_tokens` | jti, user_id, revoked, created_at, expires_at | jti unique, TTL expires_at |
| `login_attempts` | identifier (ip:login), count, locked_until | identifier unique |
| `otp_codes` | phone, purpose (login, verify_phone), code_hash, attempts, expires_at | TTL, phone |
| `password_reset_tokens` | token_hash, user_id, used, expires_at | TTL, token_hash unique |
| `consents` | user_id, anonymous_id, type (terms, privacy, cookies, parental), choice, version, ip, created_at | user_id |
| `wilayas` | code (1–58), name_fr, name_ar | code unique |
| `communes` | wilaya_code, name_fr, name_ar, is_capital | (wilaya_code, name_fr) unique |
| `taxonomy_families` | key, name_fr, name_ar, icon, order, active | key unique |
| `taxonomy_categories` | key, family_key, name_fr, name_ar, required_documents[], order, active | key unique, family_key |
| `taxonomy_roles` | key, name_fr, name_ar, family_keys[], order, active | key unique |
| `taxonomy_specialties` | key, category_key, name_fr, name_ar | key unique |
| `academy_subjects` / `academy_levels` | key, name_fr, name_ar, order, active | key unique |
| `professional_profiles` | user_id, display_name, family_key, category_key, role_key, specialty_keys[], zones[{wilaya_code, commune_names[], radius_km}], bio, experience_years, price_hint_da, photo_key, availability{week_start, slots[]}, verification_status, documents[], trust_score, rating_avg, rating_count, response_rate, free_access{started_at, requests_received}, onboarding{completed, step}, plan_key, passport{enabled, slug}, ai{} | user_id unique, (category_key, zones.wilaya_code) |
| `teacher_profiles` | user_id, display_name, role_key, subjects[{subject_key, level_keys[]}], formats[home, online, center], teaching_languages[], zones[], price_hint_da_hour, verification_status, trust_score, ratings_by_subject{subject: {avg, count}}, availability, onboarding, plan_key, ai{} | user_id unique, subjects.subject_id |
| `plans` | key (audience_tier), audience (professional, client, student), tier, name_fr, name_ar, price_da (null = [À DÉFINIR]), price_tbd, duration_days, perks_fr[], active | key unique |
| `unlock_matrix` | audience, plan_key, blurred, visible_fields[], monthly_views_limit (null = illimité), direct_contact | (audience, plan_key) unique |
| `faq_entries` | category, question_fr, question_ar, answer_fr, answer_ar, variants[], lang, order, active | (category, lang) |
| `support_tickets` | source (contact_form, chatbot), name, email, phone, subject, message, status, user_id, created_at | (status, created_at) |
| `feature_flags` | key, enabled, mvp, description | key unique |
| `settings` | key, value, public, options[], description | key unique |
| `audit_logs` | actor_id, actor_email, action, target_type, target_id, meta, ip, created_at | created_at, action |

### Prévues pour les lots suivants (schéma réservé, non créées)
| Lot | Collections |
|---|---|
| P2 tunnel | `onboarding_drafts` (user_id, kind, step, data, updated_at), `funnel_events` (session_id, user_id, step, event, at), `category_requests` (label, family_key, user_id, status) |
| P3 catalogue | `profile_views` (viewer_id, profile_id, month, at) — compteur de consultations par palier |
| P4 paiement | `orders` (number, user_id, plan_key, amount_da, status, gateway, gateway_order_id, idempotency_key), `payment_events` (order_id, type, payload_hash, at), `subscriptions` (user_id, plan_key, status active/expired/pending_payment/cancelled, starts_at, ends_at), `invoices` (number, order_id, pdf_key), `notifications` |
| P5 Academy / mise en relation | `service_requests` (requester_id, kind service/academy, category_key or subject_key+level_key, wilaya_code, format, description), `request_recipients` (request_id, recipient_id, status sent/seen/accepted/refused), `conversations`, `messages`, `reviews` (author_id, target_id, subject_key, rating, request_id) |
| P6 chatbot | `chat_logs` (question, matched_faq_id, confidence, answered, lang) |
| P7 modération | `reports` (reporter_id, target_type, target_id, reason, status), `verification_documents` (profile_id, type, storage_key privé, status, reason) |
| P8 confiance | `trust_events` (profile_id, type, source, weight, proof, at), `trust_disputes`, `match_logs` (query, shown_ids, contacted_id) |
| Hors MVP (flags à false) | `ai_jobs` générique (vision, voice, edu_ai, pro_ai) + champs `ai{}` et `passport{}` déjà présents dans les profils |

## Endpoints (v1)

| Méthode | Chemin | Accès | Rôle |
|---|---|---|---|
| GET | /api/health, /api/v1/health | public | santé + ping DB |
| POST | /api/v1/auth/register | public (rate-limit) | inscription e-mail + téléphone + mot de passe, consentements horodatés, consentement parental si mineur |
| POST | /api/v1/auth/login | public (verrou 5 échecs / 15 min) | connexion e-mail OU téléphone |
| POST | /api/v1/auth/refresh | refresh token | rotation, révocation en cas de réutilisation |
| POST | /api/v1/auth/logout | refresh token | révocation |
| GET | /api/v1/auth/me | Bearer | profil courant |
| POST | /api/v1/auth/otp/request, /otp/verify | flag `auth_phone_otp` | OTP SMS (SmsAdapter), 3 envois/10 min, 5 essais |
| POST | /api/v1/auth/password/forgot, /password/reset | public | lien via EmailAdapter (1 h) |
| PATCH | /api/v1/users/me | Bearer | nom, e-mail, langue, thème, premier jour de semaine, wilaya |
| POST | /api/v1/users/me/roles | Bearer | ajoute professional OU teacher, ou student |
| PUT | /api/v1/users/me/mode | Bearer | sélecteur de mode |
| GET | /api/v1/users/me/export | Bearer | export JSON (droit d'accès) |
| DELETE | /api/v1/users/me | Bearer + mot de passe | suppression/anonymisation + audit |
| GET | /api/v1/geo/wilayas, /geo/wilayas/{code}/communes | public | géographie |
| GET | /api/v1/taxonomy/families, /categories?family_key, /roles?family_key, /specialties?category_key | public | taxonomie |
| GET | /api/v1/academy/subjects, /academy/levels | public | référentiels Academy |
| GET | /api/v1/config | public | flags + paramètres publics |
| POST | /api/v1/consents/cookies | public | consentement cookies horodaté |
| POST | /api/v1/contact | public (rate-limit) | ticket support |
| GET | /api/v1/faq | public | FAQ |
| GET | /api/v1/admin/stats | admin | tableau de bord |
| GET | /api/v1/admin/users | super_admin, moderator, support | recherche utilisateurs |
| PATCH | /api/v1/admin/users/{id}/status | super_admin, moderator | suspension/réactivation avec motif (audit) |
| PATCH | /api/v1/admin/users/{id}/admin-role | super_admin | rôles admin (audit) |
| GET/PUT | /api/v1/admin/feature-flags[/{key}] | lecture admin / écriture super_admin | feature flags (audit) |
| GET/PUT | /api/v1/admin/settings[/{key}] | lecture admin / écriture super_admin | paramètres typés (audit) |
| GET | /api/v1/admin/audit-logs | super_admin | journal d'audit |
| GET | /api/v1/admin/processing-register | super_admin | registre des traitements (loi 18-07) |
| GET/PUT | /api/v1/admin/payment-config | super_admin | moyen de paiement (mock / satim) et accès SATIM ; mot de passe chiffré (Fernet), jamais renvoyé, audit sans secret |
| POST | /api/v1/admin/payment-config/test | super_admin | test de connexion SATIM sans débit (rate-limit) |

Erreurs : `{"detail": "<code>"}` (ex. `invalid_credentials`, `phone_invalid`, `email_taken`) traduit côté client ; erreurs 500 → `{"detail": "internal_error", "request_id"}` (jamais de trace exposée).

## Points « à confirmer » rendus configurables (admin → Paramètres)
`client_unlock_mode` (abonnement client distinct / paliers pros), `academy_access_mode` (floutage ou gratuit), `free_access_days` / `free_access_max_requests` (30 / 5), `minor_age_threshold` (18), `session_formats`, flag `video_calls` (false), flag `auth_phone_otp` (false — à activer plus tard).
