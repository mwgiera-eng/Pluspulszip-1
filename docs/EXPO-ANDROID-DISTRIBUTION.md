# Expo Android and PWA distribution

The Expo project lives in `client-mobile/`. It is intentionally separate from
the existing Vite client and Express backend so the Android work cannot break
the current production site.

## Deployment model

1. Render continues serving the Express API and PostgreSQL.
2. EAS Hosting serves the Expo Router web/PWA deployment.
3. EAS Build signs an Android APK for internal distribution or an AAB for Google Play.
4. The PWA route **Instalacja** links only to the current internal APK URL.

## Required one-time values

- Expo account/project created with `eas init`.
- Stable Android keystore generated or uploaded through EAS credentials.
- `EXPO_PUBLIC_API_URL` set to the production Render HTTPS origin.
- After a successful APK build, `EXPO_PUBLIC_ANDROID_APK_URL` set to its EAS
  internal-distribution URL.

## Important

EAS can create a signed APK without a Google Play developer account. This is
direct distribution: Android users must approve installation from their
browser, and every future APK must use the same signing key and package name.

The `production` EAS profile is intentionally different: it produces an AAB,
uses store distribution and hides external subscription purchase links. Keep
the internal APK on `preview`; do not repurpose the Play profile as an APK.
