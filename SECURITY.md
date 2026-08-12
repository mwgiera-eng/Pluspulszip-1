# Security and deployment

Authentication uses an opaque, HTTP-only cookie backed by the PostgreSQL `sessions` table. Production cookies are `Secure` and `SameSite=Lax`. All non-safe API requests are checked against the `APP_URL` Origin; payment webhooks are exempt from Origin checks and continue to use provider signature verification. Do not enable wildcard credentialed CORS.

Run `migrations/0001_production_auth.sql` before starting a deployment. Configure `DATABASE_URL`, a randomly generated `SESSION_SECRET` of at least 32 characters, and the canonical HTTPS `APP_URL` in Render. Payment credentials are only required when their integrations are enabled.

Email verification and password reset tokens are random, stored only as SHA-256 digests, expire, and are consumed once. To deliver them, configure an HTTPS account-email adapter using `EMAIL_DELIVERY_URL` and `EMAIL_API_KEY`. The adapter receives `{ to, template, actionUrl }`. Raw tokens are never logged. Without this optional adapter, token records are still created but no email is sent.

Promote administrators explicitly in PostgreSQL (`UPDATE users SET role = 'admin' ...`) through a controlled operational process. Registration never grants administrator privileges.
