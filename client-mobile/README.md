# PlusPuls Expo client

Universal Expo Router client for Android and EAS Hosting. Render continues to
serve the Express API and PostgreSQL from the same `android` branch.

## Local setup

```bash
cd client-mobile
cp .env.example .env.local
npm ci
npx expo-doctor
npm run web
```

Set `EXPO_PUBLIC_API_URL` to the HTTPS Render API origin. Variables prefixed
with `EXPO_PUBLIC_` are bundled into the app and must never contain secrets.

## Live map

Android renders the `dev` branch map from reference commit `2849e90`: CARTO/OSM
tiles, demand hexes, animated road-flow signals, layers and time forecasts. The
radial signal remains an invisible point-response input; no radial rings are
drawn. API data crosses a validated native/WebView bridge and the page CSP only
permits pinned Leaflet assets and CARTO tiles. No Google Maps key is required.
Foreground location is optional and is requested only after the driver taps the
location control. Background location is explicitly blocked.

## DEV parity

- Public dashboard and exact live demand map remain available without an account.
- Login, registration, approval status and driver/fleet profile selection use the
  same cookie session and API as the Render web app.
- Planner, earnings and notification preferences are protected Premium features.
- Settings expose privacy/trust pages, reporting, subscription status and
  password-confirmed account deletion.
- Admin approval and CSV import intentionally remain web operations.

## First EAS setup

```bash
cd client-mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build:configure
```

Keep the Android package `pl.pluspuls.app`. Let EAS create and securely retain
the Android keystore, then record a protected backup of that credential.

## Signed internal APK

```bash
npm run build:preview
```

The preview profile explicitly disables the development client, uses EAS internal
distribution and produces a standalone installable APK that does not need Metro
or QR scanning. Uninstall a locally signed debug build before installing it if
Android reports a signing conflict.
Copy the HTTPS build URL into `EXPO_PUBLIC_ANDROID_APK_URL`, set the release
version and optional SHA-256, then redeploy the web client.

## Google Play AAB

```bash
npm run build:production
npm run submit:production
```

Production uses store distribution and creates an Android App Bundle. It also
disables the external subscription-management link. Complete Play Billing before
selling digital access in the Play build. See `docs/GOOGLE-PLAY-READINESS.md`.

## EAS Hosting / PWA

```bash
npm run export:web
npm run deploy:web
```

The web build uses a fixed server-side `/api/heat` route so the browser does
not need cross-origin session cookies or a permissive backend CORS policy.

## Release checks

```bash
npm ci --ignore-scripts
npm run typecheck
npx expo-doctor
npm run export:android
npm run export:web
```

Never commit `.env`, keystores, service-account JSON, or EAS access tokens.
