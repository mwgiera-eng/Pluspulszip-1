# DEV → Android migration

## Baseline

- Web/API source: `dev` at `4e49374` (17 August 2026).
- Mobile source before migration: `android` at `36035d7` (14 August 2026).
- Map behavior is anchored to `2849e90`: point-response remains part of the
  signal model while radial rings stay hidden.

The Android branch is merged with the latest DEV tree so Render, web/PWA and
the Expo client share one deployable backend contract.

## Feature translation

| DEV capability | Android implementation | Access |
| --- | --- | --- |
| City Pulse dashboard | Native Expo dashboard and signals | Public |
| Live Demand Map | Leaflet in a constrained WebView; CARTO/OSM tiles, heat hexes, road signals, POIs, routes and radar | Public |
| Optional driver position | Explicit foreground-location control; no background permission | Public opt-in |
| Password auth | Native login and registration over the Render session API | Public entry |
| Registration approval | Native pending-status screen and refresh | Authenticated |
| Driver/fleet profile | Native account-type setup | Approved account |
| Day planner | Native timeline using `/api/day-plan` | Premium |
| Earnings | Native metrics using `/api/earnings/stats` | Premium |
| Alert preferences | Native synchronized preferences | Premium |
| Subscription status | Native status; external management only in private APK channels | Authenticated |
| Trust center/reporting | Native accessibility, privacy, terms, conduct, company and reporting routes | Public |
| Account deletion | Password-confirmed API plus Android and web deletion paths | Authenticated |
| Admin approval / CSV import | Retained in the protected web app | Web only |

## Architectural boundary

The app is not a wrapper around the DEV website. Navigation, account flows,
planner, earnings, preferences and settings are native React Native views. The
map alone uses a WebView because Leaflet/CARTO reproduces the existing map
without a Google Maps SDK key. Native code validates data before injecting it,
and the embedded document restricts its network policy to the map dependencies.

## Remaining launch work

1. Configure Play Console app signing and an EAS submit service account.
2. Integrate Google Play Billing before selling Premium inside the Play build.
3. Complete Data safety answers against the production vendors and retention policy.
4. Publish final legal entity/controller fields and support contacts.
5. Configure native push credentials only when push delivery is implemented.
