-- Reliable first-party authentication for registration and admin access.
-- Idempotent so it is safe to run on the existing Render PostgreSQL database.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE TABLE IF NOT EXISTS sessions (
  sid varchar PRIMARY KEY NOT NULL,
  sess jsonb NOT NULL,
  expire timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);
