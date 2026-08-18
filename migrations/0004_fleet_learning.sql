CREATE TABLE IF NOT EXISTS fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(200) NOT NULL,
  owner_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT fleets_owner_unique UNIQUE(owner_user_id)
);

CREATE TABLE IF NOT EXISTS fleet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fleet_id UUID NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL, anonymous_driver_id VARCHAR(64) NOT NULL,
  display_name VARCHAR(100) NOT NULL, joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  is_leader_driver BOOLEAN DEFAULT FALSE NOT NULL, avg_earnings_per_km DECIMAL(10,4),
  total_trips_analyzed INTEGER DEFAULT 0 NOT NULL, percentile_rank INTEGER,
  CONSTRAINT fleet_profiles_driver_unique UNIQUE(fleet_id, anonymous_driver_id)
);
CREATE INDEX IF NOT EXISTS fleet_profiles_fleet_idx ON fleet_profiles(fleet_id);

CREATE TABLE IF NOT EXISTS sanitized_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fleet_profile_id UUID NOT NULL REFERENCES fleet_profiles(id) ON DELETE CASCADE,
  trip_id VARCHAR(64) NOT NULL, pickup_geohash VARCHAR(8) NOT NULL, dropoff_geohash VARCHAR(8) NOT NULL,
  start_epoch INTEGER NOT NULL, net_income DECIMAL(10,2) NOT NULL, distance_km DECIMAL(10,2) NOT NULL,
  earnings_per_km DECIMAL(10,4) NOT NULL, time_slot INTEGER NOT NULL CHECK(time_slot BETWEEN 0 AND 23),
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT sanitized_trips_profile_trip_unique UNIQUE(fleet_profile_id, trip_id)
);
CREATE INDEX IF NOT EXISTS sanitized_trips_pattern_idx ON sanitized_trips(fleet_profile_id, pickup_geohash, time_slot, day_of_week);

CREATE TABLE IF NOT EXISTS driver_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fleet_id UUID NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  zone_geohash VARCHAR(8) NOT NULL, time_slot INTEGER NOT NULL CHECK(time_slot BETWEEN 0 AND 23),
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), avg_earnings_per_km DECIMAL(10,4) NOT NULL,
  trip_count INTEGER NOT NULL, leader_percentage DECIMAL(5,2) NOT NULL, generated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT driver_patterns_slot_unique UNIQUE(fleet_id, zone_geohash, time_slot, day_of_week)
);

CREATE TABLE IF NOT EXISTS fleet_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), fleet_profile_id UUID NOT NULL REFERENCES fleet_profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW() NOT NULL, is_active BOOLEAN DEFAULT TRUE NOT NULL,
  initial_score DECIMAL(10,4), latest_score DECIMAL(10,4), improvement_pct DECIMAL(10,2), last_evaluated_at TIMESTAMP
);
