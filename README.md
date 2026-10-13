# GoFix — application mobile (iOS + Android)

Application **React Native (Expo SDK 57, Expo Router)**. Elle utilise **exactement la même API REST** que le site (`/api/v1`) : mêmes comptes, mêmes données, mêmes règles côté serveur (floutage, abonnements, accès gratuit des pros, Trust Score, AI MATCH, RDV).

## Fonctionnalités
- Accueil, recherche intelligente en texte libre (AI MATCH : « Nous avons compris », meilleurs profils, « Pourquoi ? »), filtres wilaya/catégorie.
- Catalogue Services + Soutien scolaire (sélection multiple de professeurs), fiches avec couverture, miniature ou initiales, indicateurs de confiance, avis vérifiés.
- Connexion (mot de passe ou code SMS si activé), inscription avec consentements et consentement parental.
- Demandes (ouvertes ou ciblées), messagerie, rendez-vous (proposer, confirmer, terminer, annuler, litige, avis vérifié), favoris, notifications.
- Offres et paiement CIB / Edahabia (page SATIM hébergée, retour par lien `gofix://payment/result`, confirmation côté serveur), factures PDF.
- Espace pro : accès gratuit / blocage, demandes reçues, RDV, édition de la fiche (photo, couverture, zones, disponibilités, pièces), Trust Score avec contestation.
- Tunnel d'inscription pro / prof en 7 étapes avec brouillon (appareil + serveur).
- Assistant (chatbot FAQ + conseiller), FAQ, contact, pages légales, export / suppression des données.
- Français et arabe (RTL natif, police **Tajawal embarquée**), thème sombre (défaut) et clair.
- Modules **à venir** affichés comme tels : VOICE™, VISION™, EDU AI™, PRO AI™, PASSPORT™.
- Le back-office reste sur la version web.

## Démarrer en développement
```bash
cd mobile
npm install
# Adresse du serveur GoFix vue depuis le téléphone (pas "localhost" sur un vrai téléphone) :
#   Windows : ipconfig  ->  adresse IPv4 du PC, ex. 192.168.1.20
EXPO_PUBLIC_API_URL=http://192.168.1.20 npx expo start
```
Scannez le QR code avec **Expo Go** (Android / iOS). Le téléphone et le PC doivent être sur le même réseau.
Côté serveur, ajoutez l'origine utilisée par le navigateur de développement dans `CORS_ORIGINS` si vous testez la version web de l'app (`npx expo start --web`).

## Traductions
Les textes viennent des dictionnaires du site (`frontend/src/i18n`), source unique. Après toute modification :
```bash
npm run i18n:sync
```
Les textes propres à l'app sont dans `src/i18n/mobile.js`.

## Builds iOS / Android
L'app utilise la génération native continue (dossiers `ios/` et `android/` générés, jamais modifiés à la main).

**Build local, sans service cloud :**
```bash
npx expo prebuild
npx expo run:android --variant release   # nécessite Android Studio / SDK
npx expo run:ios --configuration Release # nécessite un Mac avec Xcode
```
**Option cloud (EAS, facultative) :** `npx eas-cli@latest build --platform all`.

Avant publication :
- Définir `EXPO_PUBLIC_API_URL=https://<votre-domaine>` (HTTPS obligatoire en production).
- Côté serveur : `MOBILE_APP_SCHEME=gofix` (retour de paiement vers l'app).
- Identifiants : `dz.gofix.app` (iOS bundle id / Android package) dans `app.json`.

## Vérifications effectuées
- `npx expo-doctor` : 21/21 contrôles OK.
- Bundles `npx expo export` Android (Hermes), iOS et web : compilés sans erreur.
- Parcours vérifiés à 390 px sur l'API réelle (version web de l'app) en français et en arabe.
