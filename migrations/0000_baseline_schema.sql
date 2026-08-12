CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar UNIQUE,
  "password_hash" varchar,
  "display_name" varchar(160),
  "first_name" varchar,
  "last_name" varchar,
  "profile_image_url" varchar,
  "phone_number" varchar,
  "role" varchar DEFAULT 'user',
  "status" varchar DEFAULT 'pending',
  "email_verified" boolean DEFAULT false NOT NULL,
  "last_login_at" timestamp,
  "account_type" varchar,
  "company_name" varchar,
  "trial_start_date" timestamp DEFAULT now(),
  "subscription_status" varchar DEFAULT 'trial',
  "subscription_expires_at" timestamp,
  "p24_customer_id" varchar,
  "last_seen_at" timestamp,
  "last_seen_lat" varchar,
  "last_seen_lng" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "zones" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "lat" numeric NOT NULL,
  "lng" numeric NOT NULL,
  "radius" integer NOT NULL,
  "description" text,
  "demand_level" text DEFAULT 'medium',
  "surge_multiplier" numeric DEFAULT '1.0',
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "earnings" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "pickup_address" text,
  "pickup_lat" numeric,
  "pickup_lng" numeric,
  "dropoff_address" text,
  "dropoff_lat" numeric,
  "dropoff_lng" numeric,
  "amount" numeric NOT NULL,
  "currency" text DEFAULT 'PLN',
  "trip_date" timestamp NOT NULL,
  "duration_minutes" integer,
  "distance_km" numeric,
  "source" text DEFAULT 'csv',
  "original_row_data" jsonb
);

CREATE TABLE IF NOT EXISTS "pois" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "lat" numeric NOT NULL,
  "lng" numeric NOT NULL,
  "opening_time" text,
  "closing_time" text,
  "popularity_score" integer DEFAULT 5,
  "description" text
);

CREATE TABLE IF NOT EXISTS "recommendations" (
  "id" serial PRIMARY KEY NOT NULL,
  "zone_id" integer REFERENCES "zones"("id"),
  "action" text NOT NULL,
  "reason" text NOT NULL,
  "target_zone_id" integer REFERENCES "zones"("id"),
  "valid_from" timestamp DEFAULT now(),
  "valid_until" timestamp,
  "priority" integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "amount" numeric NOT NULL,
  "currency" text DEFAULT 'PLN',
  "status" text DEFAULT 'pending' NOT NULL,
  "p24_order_id" text,
  "p24_session_id" text,
  "p24_token" text,
  "paypal_order_id" text,
  "paypal_subscription_id" text,
  "paypal_payer_id" text,
  "payment_method" text DEFAULT 'blik',
  "subscription_source" text,
  "created_at" timestamp DEFAULT now(),
  "completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id"),
  "airport_info" boolean DEFAULT true,
  "events" boolean DEFAULT true,
  "hot_zones" boolean DEFAULT true,
  "relocate" boolean DEFAULT true,
  "best_earnings" boolean DEFAULT true,
  "frequency" text DEFAULT 'hourly'
);

CREATE TABLE IF NOT EXISTS "shift_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "start_time" timestamp DEFAULT now() NOT NULL,
  "end_time" timestamp,
  "total_earnings" numeric DEFAULT '0' NOT NULL,
  "total_rides" integer DEFAULT 0 NOT NULL,
  "total_idle_minutes" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "copilot_recommendations" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "shift_session_id" integer REFERENCES "shift_sessions"("id"),
  "action" text NOT NULL,
  "reason" text NOT NULL,
  "confidence_total" integer NOT NULL,
  "target_name" text,
  "data_sources" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recommendation_outcomes" (
  "id" serial PRIMARY KEY NOT NULL,
  "recommendation_id" integer NOT NULL REFERENCES "copilot_recommendations"("id"),
  "driver_followed" boolean NOT NULL,
  "idle_after_minutes" integer,
  "earnings_next_30_min" numeric,
  "outcome_quality" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "replay_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "shift_session_id" integer NOT NULL REFERENCES "shift_sessions"("id"),
  "event_type" text NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL,
  "lat" numeric,
  "lng" numeric,
  "data" text,
  "duration_min" integer,
  "earnings_impact" numeric
);

CREATE TABLE IF NOT EXISTS "driver_insights" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "category" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "evidence" text NOT NULL,
  "confidence" integer NOT NULL,
  "suggested_action" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "is_new" boolean DEFAULT true NOT NULL
);
