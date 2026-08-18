# Google Play readiness

This checklist is an engineering aid, not legal advice. Validate declarations
against the production service and the current Play Console questionnaire.

## Build and release

- Package ID stays `pl.pluspuls.app`; never rotate the signing identity for updates.
- Internal testing: `npm run build:apk` produces an APK through the `preview` profile.
- Play testing/release: `npm run build:production` produces an AAB through the
  `production` profile, then `npm run submit:production` uploads to the internal track.
- EAS uses remote app-version management and auto-increments the Play build number.
- From 31 August 2026, new Play submissions and updates must target Android 16
  / API level 36. Confirm the generated AAB target before upload.

Official references:

- https://support.google.com/googleplay/android-developer/answer/11926878
- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/build-reference/apk/
- https://docs.expo.dev/submit/android/
- https://docs.expo.dev/build-reference/app-versions/

## Permissions and user data

- Only coarse/fine foreground location is declared. Background location is blocked.
- Permission is requested from an explicit map control, after the user can see why
  it is useful; the public Kraków map still works when permission is denied.
- Nearby-route requests may send the selected position to the Render API over HTTPS.
- Provide the public privacy URL and account-deletion URL in the listing:
  `/trust/privacy` and `/account-deletion` on the production Render origin.
- Account deletion requires an authenticated session, password confirmation and
  explicit text confirmation. It deletes account-linked PlusPuls records.
- Complete Data safety for account/contact data, optional location, trip/earnings
  records, subscription/payment references, preferences and support reports, and
  identify every processor actually used in production.

Official references:

- https://support.google.com/googleplay/android-developer/answer/17033915
- https://developer.android.com/privacy-and-security/declare-data-use
- https://support.google.com/googleplay/android-developer/answer/13327111

## Payments and product behavior

- The Play profile sets `EXPO_PUBLIC_ALLOW_EXTERNAL_SUBSCRIPTIONS=false`, so it
  does not direct users to external checkout for digital Premium access.
- Do not enable in-app Premium purchasing in the Play build until Google Play
  Billing and purchase verification are implemented.
- The app has substantial native functionality. Only the specialized live map is
  embedded; it is not a general-purpose website WebView.
- Store screenshots and descriptions must match live functionality, identify
  estimates, avoid earnings guarantees and retain the independent-service disclaimer.

Official references:

- https://support.google.com/googleplay/android-developer/answer/1153485
- https://support.google.com/googleplay/android-developer/answer/17190352
- https://developer.android.com/distribute/play-policies

## GitHub delivery controls

`.github/workflows/mobile-ci.yml` installs from the lockfile, runs TypeScript,
Expo Doctor, and both Android and web exports. Pull requests also run GitHub's
dependency review. Enable branch protection so these checks are required before
merging.

Official references:

- https://docs.github.com/actions/guides/building-and-testing-nodejs
- https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql
- https://docs.github.com/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action
