# Render deployment

This repository is a full-stack Replit-origin app. Deploy it to Render as a **Web Service**, not as a Static Site.

## What Render should create

- Web Service: `pluspuls-app`
- Postgres database: `pluspuls-db`
- Health check: `/health`

The checked-in `render.yaml` uses free plans. Confirm Render pricing in the dashboard before creating paid resources.

## Manual Render settings

Use these values if you do not deploy from the Blueprint:

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Branch | `dev` or this PR branch |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |

## Required environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | Set to `production`. |
| `DATABASE_URL` | yes | Use the Render Postgres internal connection string. |
| `SESSION_SECRET` | yes | Long random string. |
| `APP_BASE_URL` | yes for payments | Example: `https://pluspuls-app.onrender.com`. |
| `P24_SANDBOX` | optional | Keep `true` until Przelewy24 is fully configured. |
| `P24_MERCHANT_ID` | optional | Required for real Przelewy24 payments. |
| `P24_POS_ID` | optional | Defaults to merchant id when omitted. |
| `P24_CRC_KEY` | optional | Required for real Przelewy24 payments. |
| `P24_API_KEY` | optional | Required for real Przelewy24 payments. |
| `PAYPAL_SANDBOX` | optional | Keep `true` until PayPal is fully configured. |
| `PAYPAL_CLIENT_ID` | optional | Required for real PayPal webhooks. |
| `PAYPAL_CLIENT_SECRET` | optional | Required for real PayPal webhooks. |
| `PAYPAL_WEBHOOK_ID` | optional | Required for real PayPal webhook verification. |

## Database setup

After Render creates Postgres and the web service has `DATABASE_URL`, run the schema push once:

```bash
npm run db:push
```

You can run this locally against the Render database or from a Render shell if available.

## Verification

After deploy:

```bash
curl -I https://pluspuls-app.onrender.com/health
```

Expected response: `200 OK`.

Protected routes currently fail closed until production authentication is configured. That is intentional: unauthenticated callers must not be trusted.
