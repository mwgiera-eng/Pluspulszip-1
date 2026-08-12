# ShiftOptima - Driver Intelligence Platform

## Production deployment (Render)

This repository now includes a Render Blueprint (`render.yaml`) for the web
service and PostgreSQL database. Deploy the Blueprint, run the checked-in SQL
migration, and configure the environment described in `SECURITY.md`.

Authentication is first-party email/password authentication and does not depend
on Replit. Passwords are salted and hashed, sessions are persisted in PostgreSQL,
and production cookies are secure. Copy `.env.example` for local configuration,
run the migration, then use `npm run dev`. Administrator promotion is an
explicit database operation; registration never grants administrative access.

## Overview

ShiftOptima is a real-time optimization web application for professional ride-hailing drivers in Krakow, Poland. It provides demand analytics, zone-based positioning recommendations, earnings tracking from CSV uploads, and an interactive live map to help drivers maximize their revenue.

Key features:
- **Auth Gating with Registration Approval**: Full flow — email/password registration → account type selection → admin approval check (status="pending" shows Pending screen) → dashboard access. New users get status="pending"; admin must approve via Admin Console.
- **Account Type Selection**: New users choose between "Independent Driver" (individual, green accent) or "Fleet Manager" (company/provider, violet accent) during onboarding. Fleet managers enter a company name. Account type is stored in users.accountType field and shown as badges in the Admin Console.
- **User Registration System**: users.status field (pending/approved/rejected). New users see a Pending Approval waiting screen. Admins can approve/reject registrations from the Admin Console with immediate effect.
- **Public Read-Only Access**: / and /map routes are accessible without login via PublicRoute. Unauthenticated visitors see the live map, zone heat, popular routes, and flights. Personal data (earnings, AI advice, recommendations) is hidden; a top banner prompts register/sign-in.
- **Progressive Web App (PWA) — Full**: Service worker at /sw.js (cache-first shell, network-first API, offline navigation fallback to /offline.html); branded offline page; complete icon set (120/152/167/180/192/512px); viewport-fit=cover with iOS safe-area CSS; mobile bottom navigation bar; install prompt banner (Android beforeinstallprompt + iOS Share hint, 30-day localStorage dismissal). Manifest v2 with id/scope/lang/display_override fields.
- **Day Planner**: Hour-by-hour shift planner using flight windows, events, and demand regimes; promotes Uber Reserve for scheduled airport rides
- **Notifications Preferences**: Configurable alerts for airport info, events, hot zones, relocation tips, and best earnings with frequency control
- **Admin Console**: Hidden admin panel accessed via 5-tap easter egg on version number in Settings; shows user list, stats; server-side role check
- **Live Map**: Leaflet-based map centered on Krakow showing demand zones, POIs, and driver positioning
- **Zone Engine**: City divided into semantic zones (Airport, Center, Residential, Event) with demand levels and surge multipliers
- **Earnings Tracking**: CSV upload and parsing of driver trip data with statistics and visualizations
- **Recommendations Engine**: Actionable suggestions (MOVE/WAIT/TAKE) based on zone scores, time regimes, and historical earnings
- **Predictive Timing**: Anticipates demand 15-120 minutes BEFORE events happen (airport departures 2h early, arrival alerts 75min, zone pre-transition boost 30min, POI closing-time spikes 15-30min)
- **Airport Flight Intelligence**: Tabbed Arrivals/Departures view for Balice Airport with 14 flight windows (7 arrivals + 7 departures), each showing airline names, time ranges, status (ACTIVE NOW/UPCOMING/SCHEDULED), surge multipliers, flight counts, countdown timers, and driver positioning instructions
- **Strategic Advice**: GPS-based location-aware tips with travel time estimates to airport and distance-aware recommendations
- **Popular Routes**: Time-of-day aware route suggestions from 14 key city locations with PLN/min profitability scoring (most profitable first), location-aware filtering, compact card grid UI, event surge tips. All prices are estimated (base 5 PLN + 2.5 PLN/km, 8 PLN minimum), shown with amber "Est. prices" badge.
- **Krakow Events Integration**: Scrapes real upcoming events from krakow.travel (server/krakowEvents.ts), maps venues to known locations, provides event-aware scoring (only boosts event venues with confirmed events, penalizes empty venues)
- **OSRM Road Routing**: Real road geometry visualization on map via OSRM API (server/osrmService.ts), 1 purple pulsing line for nearest most profitable dropoff + 3 green lines for top 3 profitable routes, 15-minute auto-refresh, 1h geometry cache
- **Subscription & Payments**: 21-day free trial for all new users; 9.99 PLN/month premium via Przelewy24; admin users always have full access; premium features gated: Day Planner, Earnings, Notifications; free features: Dashboard (public), Map (public), Settings, Subscription page; payment webhook verification; payment history tracking
  - **Multi-Payment Methods**: BLIK (direct in-app via `/paymentMethod/blik/chargeByCode`), Card (Visa/Mastercard/Apple Pay/Google Pay via P24 redirect, channel=1), Bank Transfer (P24 redirect, channel=2)
  - **P24 Sign Calculation**: Uses `JSON.stringify({sessionId, merchantId, amount, currency, crc})` + SHA-384 for registration; `JSON.stringify({sessionId, orderId, amount, currency, crc})` + SHA-384 for verification/webhook
  - **P24 Auth**: Basic auth with `posId:apiKey` base64-encoded
  - **Sandbox Mode**: When `P24_SANDBOX=true` and no credentials, simulates payments locally; shows amber "Sandbox Mode" badge in UI
  - **Payment Return Handling**: Redirect payments return to `/subscription?payment=complete&sessionId=...`; polls `/api/subscription/payment-status/:sessionId` for confirmation with proper pending/success/failed states
- **Dashboard**: Command center with stats cards, recommendation cards, popular routes, arrivals windows, and map overview
- **Zone Profit Heatmap**: Time-shifted profit scoring (0-100) per zone with gradient visualization on map, time slider (Live to +12h), transition narratives
- **Uber Deep Links**: Every popular route includes an Uber comparison link for fare comparison

## Compliance & Branding

ShiftOptima is an independent analytics tool. It is **not affiliated with, endorsed by, or associated with** Bolt Technology OÜ, Uber Technologies Inc., or any ride-hailing platform.

- Disclaimer is displayed prominently on the Login page, About section in Settings, and the left panel footer
- No platform-specific copy (removed all "Bolt drivers" / "drive on Bolt" references)
- No web scraping of any ride-hailing platform (boltScraper.ts was fully deleted in Task #6)
- Platform tips in Day Planner use qualified language ("often reported by drivers", "tends to")
- All route pricing is clearly marked as estimated (~) with amber badges

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, built using Vite
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state, with custom hooks per resource (zones, earnings, POIs, recommendations)
- **UI Components**: shadcn/ui (new-york style) with Radix primitives, styled with Tailwind CSS
- **Mapping**: Leaflet via react-leaflet, centered on Krakow (50.0647, 19.9450)
- **Icons**: lucide-react + react-icons/si for platform logos (Uber)

### Backend
- **Runtime**: Node.js 20 with Express 5 (TypeScript)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: First-party email/password accounts with scrypt password hashing, Passport.js sessions, and PostgreSQL session storage
- **Payments**: Przelewy24 (P24) API integration with BLIK, card, and bank transfer support. PayPal hosted button available as alternative.
- **External APIs**: OSRM (road routing), Kraków Airport flight board scraping, Kraków.travel events scraping

### Key Server Files
- `server/routes.ts` — All API routes
- `server/storage.ts` — Database abstraction layer (IStorage interface + DrizzleStorage)
- `server/popularRoutes.ts` — Estimated route generation for 14 key Kraków locations
- `server/recommendationEngine.ts` — Zone profit heat, MOVE/WAIT/TAKE recommendations
- `server/dayPlanner.ts` — 24-hour block planner with flight/event awareness
- `server/krakowEvents.ts` — Event scraping and venue mapping
- `server/krakowAirportScraper.ts` — Balice airport flight board scraping
- `server/osrmService.ts` — OSRM road geometry fetching
- `server/signals.ts` — Data freshness signal tracking (airport, events, zone heat, GPS, weather, history)
- `server/copilotDecision.ts` — Copilot mode determination (full_live / partial_live / heuristic_only)
- `server/subscriptionService.ts` — Subscription status, trial management
- `server/przelewy24Service.ts` — P24 payment registration, BLIK, webhook verification
- `server/replit_integrations/auth/` — Replit OIDC auth, user storage

### Shared
- `shared/schema.ts` — Drizzle schema + Zod insert schemas
- `shared/routes.ts` — Typed API route definitions
- `shared/copilot.ts` — Copilot types (DataSourceId, CopilotMode, etc.)

## Admin Access
Administrators must be promoted explicitly through a controlled database operation.

## Deployment
Use the included `render.yaml` Blueprint to deploy the application and its PostgreSQL database on Render.
