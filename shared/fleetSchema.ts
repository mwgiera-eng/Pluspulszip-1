import { boolean, decimal, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./models/auth";

export const fleets = pgTable("fleets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("fleets_owner_unique").on(table.ownerUserId)]);

export const fleetProfiles = pgTable("fleet_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  fleetId: uuid("fleet_id").notNull().references(() => fleets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  anonymousDriverId: varchar("anonymous_driver_id", { length: 64 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  isLeaderDriver: boolean("is_leader_driver").default(false).notNull(),
  avgEarningsPerKm: decimal("avg_earnings_per_km", { precision: 10, scale: 4 }),
  totalTripsAnalyzed: integer("total_trips_analyzed").default(0).notNull(),
  percentileRank: integer("percentile_rank"),
}, (table) => [uniqueIndex("fleet_profiles_driver_unique").on(table.fleetId, table.anonymousDriverId), index("fleet_profiles_fleet_idx").on(table.fleetId)]);

export const sanitizedTrips = pgTable("sanitized_trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  fleetProfileId: uuid("fleet_profile_id").notNull().references(() => fleetProfiles.id, { onDelete: "cascade" }),
  tripId: varchar("trip_id", { length: 64 }).notNull(),
  pickupGeohash: varchar("pickup_geohash", { length: 8 }).notNull(),
  dropoffGeohash: varchar("dropoff_geohash", { length: 8 }).notNull(),
  startEpoch: integer("start_epoch").notNull(),
  netIncome: decimal("net_income", { precision: 10, scale: 2 }).notNull(),
  distanceKm: decimal("distance_km", { precision: 10, scale: 2 }).notNull(),
  earningsPerKm: decimal("earnings_per_km", { precision: 10, scale: 4 }).notNull(),
  timeSlot: integer("time_slot").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("sanitized_trips_profile_trip_unique").on(table.fleetProfileId, table.tripId), index("sanitized_trips_pattern_idx").on(table.fleetProfileId, table.pickupGeohash, table.timeSlot, table.dayOfWeek)]);

export const driverPatterns = pgTable("driver_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  fleetId: uuid("fleet_id").notNull().references(() => fleets.id, { onDelete: "cascade" }),
  zoneGeohash: varchar("zone_geohash", { length: 8 }).notNull(),
  timeSlot: integer("time_slot").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  avgEarningsPerKm: decimal("avg_earnings_per_km", { precision: 10, scale: 4 }).notNull(),
  tripCount: integer("trip_count").notNull(),
  leaderPercentage: decimal("leader_percentage", { precision: 5, scale: 2 }).notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("driver_patterns_slot_unique").on(table.fleetId, table.zoneGeohash, table.timeSlot, table.dayOfWeek)]);

export const fleetAssignments = pgTable("fleet_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  fleetProfileId: uuid("fleet_profile_id").notNull().references(() => fleetProfiles.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  initialScore: decimal("initial_score", { precision: 10, scale: 4 }),
  latestScore: decimal("latest_score", { precision: 10, scale: 4 }),
  improvementPct: decimal("improvement_pct", { precision: 10, scale: 2 }),
  lastEvaluatedAt: timestamp("last_evaluated_at"),
});
