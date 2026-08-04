-- Initial schema migration for GCP/Postgres
-- Removes any Replit-specific objects and prepares a clean DB for deployment.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE,
  first_name varchar(255),
  last_name varchar(255),
  profile_image_url varchar(1024),
  phone_number varchar(64),
  role varchar(50) DEFAULT 'user',
  status varchar(50) DEFAULT 'pending',
  account_type varchar(50),
  company_name varchar(255),
  trial_start_date timestamptz DEFAULT now(),
  subscription_status varchar(50) DEFAULT 'trial',
  subscription_expires_at timestamptz,
  p24_customer_id varchar(255),
  last_seen_at timestamptz,
  last_seen_lat varchar(64),
  last_seen_lng varchar(64),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Session storage (generic)
CREATE TABLE IF NOT EXISTS sessions (
  sid varchar(255) PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions(expire);

-- Zones
CREATE TABLE IF NOT EXISTS zones (
  id serial PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  radius integer NOT NULL,
  description text,
  demand_level text DEFAULT 'medium',
  surge_multiplier numeric DEFAULT 1.0,
  updated_at timestamptz DEFAULT now()
);

-- Earnings
CREATE TABLE IF NOT EXISTS earnings (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES users(id) NOT NULL,
  pickup_address text,
  pickup_lat numeric,
  pickup_lng numeric,
  dropoff_address text,
  dropoff_lat numeric,
  dropoff_lng numeric,
  amount numeric NOT NULL,
  currency text DEFAULT 'PLN',
  trip_date timestamptz NOT NULL,
  duration_minutes integer,
  distance_km numeric,
  source text DEFAULT 'csv',
  original_row_data jsonb
);

-- POIs
CREATE TABLE IF NOT EXISTS pois (
  id serial PRIMARY KEY,
  name text NOT NULL,
  category text,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  opening_time text,
  closing_time text,
  popularity_score integer DEFAULT 5,
  description text
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  id serial PRIMARY KEY,
  zone_id integer REFERENCES zones(id),
  action text NOT NULL,
  reason text NOT NULL,
  target_zone_id integer REFERENCES zones(id),
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  priority integer DEFAULT 1
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES users(id) NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'PLN',
  status text NOT NULL DEFAULT 'pending',
  p24_order_id text,
  p24_session_id text,
  p24_token text,
  paypal_order_id text,
  paypal_subscription_id text,
  paypal_payer_id text,
  payment_method text DEFAULT 'blik',
  subscription_source text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id serial PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES users(id) NOT NULL,
  airport_info boolean DEFAULT true,
  events boolean DEFAULT true,
  hot_zones boolean DEFAULT true,
  relocate boolean DEFAULT true,
  best_earnings boolean DEFAULT true,
  frequency text DEFAULT 'hourly'
);

-- Shift sessions
CREATE TABLE IF NOT EXISTS shift_sessions (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES users(id) NOT NULL,
  start_time timestamptz DEFAULT now() NOT NULL,
  end_time timestamptz,
  total_earnings numeric DEFAULT 0 NOT NULL,
  total_rides integer DEFAULT 0 NOT NULL,
  total_idle_minutes integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL
);

-- Copilot recommendations
CREATE TABLE IF NOT EXISTS copilot_recommendations (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES users(id) NOT NULL,
  shift_session_id integer REFERENCES shift_sessions(id),
  action text NOT NULL,
  reason text NOT NULL,
  confidence_total integer NOT NULL,
  target_name text,
  data_sources text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Recommendation outcomes
CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id serial PRIMARY KEY,
  recommendation_id integer REFERENCES copilot_recommendations(id) NOT NULL,
  driver_followed boolean NOT NULL,
  idle_after_minutes integer,
  earnings_next_30_min numeric,
  outcome_quality text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Replay events
CREATE TABLE IF NOT EXISTS replay_events (
  id serial PRIMARY KEY,
  shift_session_id integer REFERENCES shift_sessions(id) NOT NULL,
  event_type text NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  lat numeric,
  lng numeric,
  data text,
  duration_min integer,
  earnings_impact numeric
);

-- Driver insights
CREATE TABLE IF NOT EXISTS driver_insights (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES users(id) NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  evidence text NOT NULL,
  confidence integer NOT NULL,
  suggested_action text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  is_new boolean DEFAULT true NOT NULL
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_earnings_userid ON earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_userid ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_userid ON shift_sessions(user_id);
