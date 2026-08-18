# PlusPuls fleet learning

The Android fleet flow preserves the production model: real pickup/drop-off, mileage, time and net income are used to calculate route economics and learn time-aware patterns from the strongest drivers. Personal names in example data are randomized; the application does not treat the example as synthetic trip economics.

## Privacy boundary

The source CSV is opened on the Android device. Before a PlusPuls API request, the app:

1. validates the fixed export columns, price arithmetic, dates, mileage and CSV-formula safety;
2. converts exact pickup and drop-off locations into precision-5 geohashes;
3. replaces platform trip and driver identifiers with random UUIDs and sends only a generated `Kierowca XXXXXX` label;
4. removes passenger, invoice, company, tax and exact-address fields;
5. hashes the serialized sanitized batch so the server can reject altered payloads.

Only the reduced trip fields are transmitted over HTTPS. The original file is never uploaded to PlusPuls. Android's platform geocoder may process an address while producing the local coarse zone; this should be disclosed in the privacy notice.

## Pattern engine

- Server-computed metric: net income / real supplied mileage (or geohash distance only when mileage is absent).
- A profile needs at least 20 accepted trips to be eligible as a leader.
- The top quartile of eligible fleet profiles supplies leader patterns.
- A zone/time/day pattern needs at least 5 leader trips.
- Guidance is generated from the current hour/day and compares the driver average against the leader pattern.

Every fleet-management query is authenticated, premium-gated and scoped to its owner. Guidance additionally supports a driver profile explicitly linked to the authenticated user. No endpoint returns raw source fields. Driver enrollment and push-token delivery are separate deployment work and are not implied by the pattern engine.

## Deployment

1. Apply `migrations/0004_fleet_learning.sql` to the Render PostgreSQL database (or run the repository's normal Drizzle migration workflow).
2. Deploy the Render service from the `android` branch.
3. Build a new native binary because Expo Crypto, Document Picker, Notifications and Speech are native modules:

   ```powershell
   Set-Location C:\pp\client-mobile
   npm.cmd ci
   npx.cmd expo-doctor
   npx.cmd eas-cli@21.8.0 build --platform android --profile preview
   ```

4. Test with a provider account, a non-production CSV copy and Android notification/voice settings enabled.

Remote closed-app push delivery still requires Expo/FCM credentials and a server-side scheduler. Local foreground guidance and spoken prompts work in the rebuilt APK without that scheduler.
