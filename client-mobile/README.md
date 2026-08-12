# PlusPuls Expo client

Universal Expo Router client for Android and EAS Hosting. The existing Express
API remains a separate deployment.

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

## First EAS setup

```bash
cd client-mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build:configure
```

Keep the Android package `pl.pluspuls.app`. Let EAS create and securely retain
the Android keystore, then record a protected backup of that credential.

## Signed APK

```bash
npm run build:preview
# after validation
npm run build:apk
```

Both profiles use EAS internal distribution and produce an installable APK.
Copy the HTTPS build URL into `EXPO_PUBLIC_ANDROID_APK_URL`, set the release
version and optional SHA-256, then redeploy the web client.

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
npm run export:web
```

Never commit `.env`, keystores, service-account JSON, or EAS access tokens.
