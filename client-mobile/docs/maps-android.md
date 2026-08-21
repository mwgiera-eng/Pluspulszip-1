# Android map release gate

The Android map uses `react-native-maps` with Google Maps. Heat cells, traffic signals, and route geometry are native geographic overlays; the WebView/Leaflet implementation is not used on Android.

## Google Cloud

1. Enable **Maps SDK for Android** in the release Google Cloud project.
2. Create separate local-development, CI-emulator, and production API keys.
3. Restrict each key to **Android apps**.
4. Add package `pl.pluspuls.app` and the matching SHA-1 certificate fingerprint.
5. For Play builds, copy the SHA-1 from **Play Console → Setup → App integrity → App signing key certificate**. This can differ from the upload-key SHA-1.
6. Add API restrictions so the key can call only **Maps SDK for Android**.

Never prefix this value with `EXPO_PUBLIC_`; it must not be included in the JavaScript bundle.

## EAS production secret

```powershell
npx eas-cli@latest env:create --environment production --name GOOGLE_MAPS_ANDROID_API_KEY --value "YOUR_RESTRICTED_KEY" --visibility secret
```

Use a separately restricted local/debug key in `client-mobile/.env` for `npx expo run:android`.

## GitHub map gate

Configure these repository/environment secrets:

- `GOOGLE_MAPS_ANDROID_CI_API_KEY`: Maps SDK for Android key restricted to package `pl.pluspuls.app` and the CI release-certificate SHA-1.
- `EXPO_TOKEN`: Expo access token used only by the gated AAB workflow.

The production Maps key has one source of truth: the EAS `production` secret created above. It is not copied to GitHub and is never pulled into the candidate-controlled runner. The local EAS submission pass uses a non-working sentinel while resolving dynamic config; the EAS builder evaluates the config again with `EAS_BUILD=true`, receives the production secret, and fails closed if it is absent.

The `Native map emulator smoke` job prints its signing report. On first setup, a non-empty temporary CI value can be used to obtain that SHA-1; replace it immediately with the correctly restricted CI key. The emulator gate then installs a release APK on API 36, injects a Kraków GPS fix, and opens `pluspuls://map`. At the settled initial, zoom-in, and zoom-out cameras it first disables every overlay and gates the bare Google tiles for brightness, contrast, coverage, and stability; it then restores all overlays and separately counts unique heat, road, animated-signal, and route colors. The final state must contain an active GPS-derived `drive_to_pickup` route, and isolated heat, traffic, and route screenshots must add enough of their exact overlay colors. Maps authorization and Android fatal errors also fail the job.

## Required release sequence

1. Push the exact commit to `android`. `Mobile CI` runs unit/contracts, live API checks, Expo validation, and the API 36 native-map emulator gate.
2. `Build Play AAB` starts from that same push but waits for the exact-SHA `Mobile CI` result. A failed or timed-out CI run blocks the AAB.
3. The release gate verifies clean/exact Git provenance, then asks EAS for one production AAB. The production Maps key exists only in the remote EAS build environment.
4. Review the uploaded native-map screenshots and install a same-commit preview when human visual sign-off is required; only then upload the generated AAB to the Play internal track.

The release is push-triggered because GitHub only exposes `workflow_dispatch` when the workflow file exists on the repository's default branch. If the release workflow is later placed on protected `main`, it can safely return to an approved manual dispatch model.

For a local fallback, pull the green `android` commit, remove generated `client-mobile/android` and `client-mobile/ios` directories, keep the entire worktree clean, and run `npm run build:production`. The verifier now blocks untracked files and native trees as well as stale/wrong-branch/keyless builds.

Never upload the PR compile artifact to Play. Only the production EAS AAB created from the exact green SHA is a release candidate.
