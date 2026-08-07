# Threat Model

## Project Overview

ShiftOptima is a Node.js/Express + React/TypeScript ride-hailing analytics platform for drivers in Kraków, Poland. It offers demand zone maps, earnings CSV upload, an AI recommendation engine, a day planner, airport flight data, and a premium subscription (9.99 PLN/month) paid via Przelewy24 (BLIK/card/transfer) and PayPal. Authentication uses Google OAuth (passport-google-oauth20) and local email/password; sessions are stored in PostgreSQL. Deployed on Replit Autoscale at `https://pluspulszip-1-1.replit.app` (public visibility).

## Assets

- **User accounts & sessions** — Google profile data, email addresses, hashed passwords (local auth), session cookies. Admin account controls user approval and the whole platform.
- **Subscription/payment state** — Whether a user has an active premium subscription; Przelewy24 session IDs and tokens; PayPal subscription IDs.
- **Zone and POI data** — Shared geo-data that drives recommendations for all users. Corruption affects every subscriber.
- **Earnings data** — Per-user trip CSV records containing pickup addresses, amounts, and passenger info.
- **Application secrets** — `SESSION_SECRET`, `DATABASE_URL`, Google OAuth credentials, P24 merchant/CRC/API keys, PayPal client ID/secret, `PAYPAL_WEBHOOK_ID`.
- **Admin identity** — The hardcoded admin email that grants platform-wide admin privileges on login.

## Trust Boundaries

- **Internet → Express API**: All inbound HTTP. Unauthenticated callers must be restricted to read-only public endpoints. Currently violated by zone/POI/recommendation mutation endpoints.
- **API → PostgreSQL**: Drizzle ORM with parameterized queries throughout. No raw SQL concatenation observed; low injection risk.
- **API → P24 / PayPal**: Outbound payment calls using credentials from environment variables. Webhook paths must verify signatures before acting.
- **Authenticated user → Admin**: Role stored in DB (`users.role`). Admin email is hardcoded in source, which is a privilege-escalation risk if that email account is compromised.
- **Authenticated → Premium**: `requirePremium` middleware checks `subscriptionStatus` server-side before exposing earnings, day planner, and notifications. Correctly enforced.

## Scan Anchors

- **Entry points**: `server/routes.ts` (all HTTP routes), `server/replit_integrations/auth/routes.ts` (auth routes), `server/replit_integrations/auth/replitAuth.ts` (Google OAuth + session), `server/replit_integrations/auth/localAuth.ts` (local login).
- **Highest-risk areas**: Zone/POI/recommendation CRUD (missing auth), webhook handlers (`/api/subscription/webhook`, `/api/subscription/paypal/webhook`), admin routes, `przelewy24Service.ts`, `paypalWebhook.ts`.
- **Public surfaces**: `/`, `/map`, `/api/zones` (read), `/api/pois` (read), `/api/recommendations` (read — but also clears+regenerates!), `/api/popular-routes`, `/api/krakow-events`, `/api/airport-flights`, `/api/strategic-advice`.
- **Authenticated surfaces**: Earnings, day planner, notifications, heartbeat, subscription management, payment initiation.
- **Admin surfaces**: `/api/admin/*` — user list, approval, stats, active users. Protected by `isAdmin` middleware.
- **Dev-only areas**: None identified; sandbox payment mode is an env-var flag, not a code branch.

## Threat Categories

### Spoofing

Google OAuth identity is verified by passport; session tokens are httpOnly, secure, sameSite=lax with a 1-week TTL — acceptable. The admin role is assigned on login based on a hardcoded email constant; if the iCloud/Google account behind that email is compromised, an attacker is automatically granted admin. **Required guarantee**: admin identity must come from an environment variable, not source code.

### Tampering

Zone, POI, and recommendation data are mutable by unauthenticated callers. Any internet visitor can insert fake zones/POIs or delete real ones, corrupting the map and recommendation engine for all users. **Required guarantee**: all mutating endpoints (POST/PUT/DELETE for zones, POIs, recommendations, and events-refresh) must require at least `isAuthenticated`, and ideally `isAdmin`.

### Information Disclosure

User email addresses appear in server logs (PayPal webhook). The admin's personal email is committed to source code and the project README. **Required guarantees**: (1) PII must not be logged verbatim — use a user ID or masked form; (2) admin email must be stored in `ADMIN_EMAIL` env var, not source.

### Elevation of Privilege

P24 webhook signature verification is unconditionally bypassed when `P24_SANDBOX=true && !hasCredentials`, allowing any caller to forge a webhook and activate a premium subscription for a targeted user (given a guessable session ID). **Required guarantee**: webhook verification must never be silently bypassed in a publicly reachable deployment; use a test CRC key in sandbox instead of skipping verification.

### Denial of Service

The `POST /api/krakow-events/refresh` endpoint triggers an outbound HTTP scrape of krakow.travel with no authentication and no rate limit. Continuous calls will exhaust connections, cause the server IP to be blocked by the third-party site, and break the events feed for all users. The recommendation list endpoints (`GET/POST /api/recommendations`) perform a database clear + bulk insert on every call with no auth, creating unnecessary write amplification. **Required guarantee**: admin-triggerable or rate-limited endpoints must require authentication.
