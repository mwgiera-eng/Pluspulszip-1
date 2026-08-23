# Android map release gate

The Android map uses `react-native-maps` with Google Maps. Heat cells, traffic signals, and route geometry are native geographic overlays; the WebView/Leaflet implementation is not used on Android.

## Google Cloud

1. Enable **Maps SDK for Android** in the release Google Cloud project.
2. Create separate local-development, CI-emulator, and production API keys.
3. Restrict each key to **Android apps**.
4. Add package `pl.pluspuls.app` and every matching app-signing SHA-1 certificate fingerprint.
5. For Play builds, copy fingerprints from **Play Console → Protected with Play → Play app signing → App signing key**. Never use the upload-key fingerprint.
6. New Play apps use quantum-ready hybrid signing. Register all **three distinct app-signing SHA-1 fingerprints** as separate Android application entries with the same package:
   - legacy classical key used for older Android devices;
   - hybrid classical key used on Android 17+;
   - PQC ML-DSA key used on Android 17+.
7. Add API restrictions so the key can call only **Maps SDK for Android** (`maps-android-backend.googleapis.com`).

Google Play explicitly requires all three fingerprints to be registered with API providers for quantum-ready apps. A single SHA-1 can work in CI or on one Android generation while Play-installed builds on another generation receive a blank map.

Official references:

- https://support.google.com/googleplay/android-developer/answer/9842756?hl=en
- https://developers.google.com/maps/api-security-best-practices
- https://docs.cloud.google.com/sdk/gcloud/reference/services/api-keys/update

Never prefix this value with `EXPO_PUBLIC_`; it must not be included in the JavaScript bundle.

## Cloud Shell verification

These commands verify the project, enabled SDK, key resource, and restrictions without printing the key value:

```bash
PROJECT_ID=trans-aurora-502114-a6
PACKAGE=pl.pluspuls.app
gcloud config set project "$PROJECT_ID"

gcloud billing projects describe "$PROJECT_ID"
gcloud services list --enabled --project="$PROJECT_ID" \
  --filter='NAME:maps-android-backend.googleapis.com'
gcloud services api-keys list --project="$PROJECT_ID"

read -rsp "Maps key from the AAB: " MAPS_KEY; echo
KEY_RESOURCE="$(gcloud services api-keys lookup "$MAPS_KEY" --format='value(name)')"
unset MAPS_KEY
gcloud services api-keys describe "$KEY_RESOURCE" \
  --format='yaml(displayName,restrictions)'
```

To repair an existing key, enter all three SHA-1 values from Play Console. `gcloud` expects fingerprints without colons:

```bash
read -rp "SHA-1 legacy classical: " SHA1_LEGACY
read -rp "SHA-1 hybrid classical: " SHA1_HYBRID
read -rp "SHA-1 PQC ML-DSA: " SHA1_PQC

SHA1_LEGACY="${SHA1_LEGACY//:/}"
SHA1_HYBRID="${SHA1_HYBRID//:/}"
SHA1_PQC="${SHA1_PQC//:/}"

gcloud services api-keys update "$KEY_RESOURCE" \
  --api-target=service=maps-android-backend.googleapis.com \
  --allowed-application="sha1_fingerprint=$SHA1_LEGACY,package_name=$PACKAGE" \
  --allowed-application="sha1_fingerprint=$SHA1_HYBRID,package_name=$PACKAGE" \
  --allowed-application="sha1_fingerprint=$SHA1_PQC,package_name=$PACKAGE"
```

Changing restrictions on the existing key does not require another AAB. Force-stop and reopen the Play-installed app after propagation.

Cloud Shell cannot functionally authenticate Maps SDK for Android because it does not run a Play-signed Android application. There is no supported key-validation HTTP endpoint. An empty Metrics graph only means that no request is shown under the selected project, credential, API, filters, and time window; it is not a key-authentication test. Runtime authorization is verified by the Play-installed app or, when a device is attached, `adb logcat -e "Google Maps Android API"`.

## Key rotation

Use **Rotate key** in Google Cloud or create a second Android-restricted key with the same three application entries and Maps SDK-only API restriction. Put the replacement value in the EAS `production` environment and build a new AAB. Keep the old, still-restricted key active while older installed versions use it; remove it only after migration is complete and its usage has stopped. Unlike a restriction repair, changing the key value always requires a new application build.

## EAS production secret

```powershell
npx eas-cli@latest env:create --environment production --name GOOGLE_MAPS_ANDROID_API_KEY --value "YOUR_RESTRICTED_KEY" --visibility secret
```

Use a separately restricted local/debug key in `client-mobile/.env` for `npx expo run:android`.

## GitHub map gate

Configure the credentials in these exact scopes:

- GitHub Actions **repository or organization secret** `GOOGLE_MAPS_ANDROID_CI_API_KEY`: Maps SDK for Android key restricted to package `pl.pluspuls.app` and the generated CI debug-certificate SHA-1. The smoke job has no GitHub Environment binding, so an Environment-only secret will resolve empty.
- GitHub **production Environment secret** `EXPO_TOKEN`: Expo access token used only by the gated AAB workflow, whose `build-aab` job is bound to that Environment.

The CI Maps secret is released only for `refs/heads/android`; a manually dispatched run on any other ref cannot execute the secret-bearing emulator job. Keep `android` protected against unreviewed direct pushes. Configure the GitHub `production` Environment to allow only `android` deployments and require a reviewer. Use a least-privilege Expo robot-user token for `EXPO_TOKEN`, not a personal owner token: https://docs.expo.dev/accounts/programmatic-access/

The production Maps key has one source of truth: the EAS `production` secret created above. It is not copied to GitHub and is never pulled into the candidate-controlled runner. The local EAS submission pass uses a non-working sentinel while resolving dynamic config; the EAS builder evaluates the config again with `EAS_BUILD=true`, receives the production secret, and fails closed if it is absent.

The `Native map emulator smoke` job deliberately generates the native project and reads the SHA-1 directly from its generated debug keystore before checking the secret. On first setup, open the failed job, copy `CI debug SHA-1` from `Print CI signing certificate fingerprint`, create the Android-restricted CI key for `pl.pluspuls.app`, save it as the repository/organization secret `GOOGLE_MAPS_ANDROID_CI_API_KEY`, and rerun the workflow. No placeholder or production key is needed to bootstrap the fingerprint. The emulator gate then installs a release APK on API 36, injects a Kraków GPS fix, and opens `pluspuls://map`. At the settled initial, zoom-in, zoom-out, and real swipe/pan cameras it gates the bare Google tiles for brightness, contrast, coverage, and stability and counts the production heat, road, animated-signal, and route colors. The final state must contain an active GPS-derived `drive_to_pickup` route, and isolated heat, traffic, and route screenshots must add enough of their exact overlay colors. Maps authorization and Android fatal errors also fail the job.

This smoke test proves the native map renderer, overlays, and Render API contract against the CI debug certificate. It cannot prove production authorization by Google Play's three app-signing certificates; that external restriction must be verified separately before each first release or signing-key upgrade.

## Required release sequence

1. Push the exact commit to `android`. `Mobile CI` runs unit/contracts, live API checks, Expo validation, and the API 36 native-map emulator gate.
2. `Build Play AAB` starts from that same push but waits for the exact-SHA `Mobile CI` result. A failed or timed-out CI run blocks the AAB.
3. The release gate verifies clean/exact Git provenance, then asks EAS for one production AAB. The production Maps key exists only in the remote EAS build environment.
4. Review the uploaded native-map screenshots and install a same-commit preview when human visual sign-off is required; only then upload the generated AAB to the Play internal track.

The release is push-triggered because GitHub only exposes `workflow_dispatch` when the workflow file exists on the repository's default branch. If the release workflow is later placed on protected `main`, it can safely return to an approved manual dispatch model.

For a local fallback, pull the green `android` commit, remove generated `client-mobile/android` and `client-mobile/ios` directories, keep the entire worktree clean, and run `npm run build:production`. The verifier now blocks untracked files and native trees as well as stale/wrong-branch/keyless builds.

Never upload the PR compile artifact to Play. Only the production EAS AAB created from the exact green SHA is a release candidate.
