import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

// === TABLE DEFINITIONS ===

// Zones: Defined areas (e.g., "Airport", "City Center")
export const zones = pgTable("zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'airport', 'center', 'residential', 'event'
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  radius: integer("radius").notNull(), // meters
  description: text("description"),
  demandLevel: text("demand_level").default("medium"), // 'low', 'medium', 'high', 'surge'
  surgeMultiplier: numeric("surge_multiplier").default("1.0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Earnings: Historical data from driver CSVs
export const earnings = pgTable("earnings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  pickupAddress: text("pickup_address"),
  pickupLat: numeric("pickup_lat"),
  pickupLng: numeric("pickup_lng"),
  dropoffAddress: text("dropoff_address"),
  dropoffLat: numeric("dropoff_lat"),
  dropoffLng: numeric("dropoff_lng"),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("PLN"),
  tripDate: timestamp("trip_date").notNull(),
  durationMinutes: integer("duration_minutes"),
  distanceKm: numeric("distance_km"),
  source: text("source").default("csv"), // 'csv', 'manual'
  originalRowData: jsonb("original_row_data"), // Store raw CSV row for debugging
});

// POIs: High traffic locations (GetYourGuide proxies or manual)
export const pois = pgTable("pois", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"), // 'tourism', 'nightlife', 'transport'
  lat: numeric("lat").notNull(),
  lng: numeric("lng").notNull(),
  openingTime: text("opening_time"),
  closingTime: text("closing_time"),
  popularityScore: integer("popularity_score").default(5), // 1-10
  description: text("description"),
});

// Recommendations: Generated actions for drivers
export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").references(() => zones.id),
  action: text("action").notNull(), // 'MOVE', 'WAIT', 'TAKE'
  reason: text("reason").notNull(),
  targetZoneId: integer("target_zone_id").references(() => zones.id), // If action is MOVE
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  priority: integer("priority").default(1),
});

// Payments: Transaction records for subscriptions
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  amount: numeric("amount").notNull(),
  currency: text("currency").default("PLN"),
  status: text("status").notNull().default("pending"),
  p24OrderId: text("p24_order_id"),
  p24SessionId: text("p24_session_id"),
  p24Token: text("p24_token"),
  paypalOrderId: text("paypal_order_id"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  paypalPayerId: text("paypal_payer_id"),
  paymentMethod: text("payment_method").default("blik"),
  subscriptionSource: text("subscription_source"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Notification Preferences: Per-user notification settings
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull().unique(),
  airportInfo: boolean("airport_info").default(true),
  events: boolean("events").default(true),
  hotZones: boolean("hot_zones").default(true),
  relocate: boolean("relocate").default(true),
  bestEarnings: boolean("best_earnings").default(true),
  frequency: text("frequency").default("hourly"),
});

// Shift Sessions: DB-backed shift state for Copilot
export const shiftSessions = pgTable("shift_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  totalEarnings: numeric("total_earnings").default("0").notNull(),
  totalRides: integer("total_rides").default(0).notNull(),
  totalIdleMinutes: integer("total_idle_minutes").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Copilot Recommendations: Track every recommendation issued
export const copilotRecommendations = pgTable("copilot_recommendations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  shiftSessionId: integer("shift_session_id").references(() => shiftSessions.id),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  confidenceTotal: integer("confidence_total").notNull(),
  targetName: text("target_name"),
  dataSources: text("data_sources"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Recommendation Outcomes: Did following the recommendation help?
export const recommendationOutcomes = pgTable("recommendation_outcomes", {
  id: serial("id").primaryKey(),
  recommendationId: integer("recommendation_id").references(() => copilotRecommendations.id).notNull(),
  driverFollowed: boolean("driver_followed").notNull(),
  idleAfterMinutes: integer("idle_after_minutes"),
  earningsNext30Min: numeric("earnings_next_30_min"),
  outcomeQuality: text("outcome_quality"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Replay Events: Timeline events within a shift
export const replayEvents = pgTable("replay_events", {
  id: serial("id").primaryKey(),
  shiftSessionId: integer("shift_session_id").references(() => shiftSessions.id).notNull(),
  eventType: text("event_type").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  lat: numeric("lat"),
  lng: numeric("lng"),
  data: text("data"),
  durationMin: integer("duration_min"),
  earningsImpact: numeric("earnings_impact"),
});

// Driver Insights: Long-term behavioral learning
export const driverInsights = pgTable("driver_insights", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").notNull(),
  confidence: integer("confidence").notNull(),
  suggestedAction: text("suggested_action").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isNew: boolean("is_new").default(true).notNull(),
});

// === SCHEMAS ===

export const insertZoneSchema = createInsertSchema(zones).omit({ id: true, updatedAt: true });
export const insertEarningSchema = createInsertSchema(earnings).omit({ id: true });
export const insertPoiSchema = createInsertSchema(pois).omit({ id: true });
export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true });
export const insertShiftSessionSchema = createInsertSchema(shiftSessions).omit({ id: true, startTime: true });
export const insertCopilotRecommendationSchema = createInsertSchema(copilotRecommendations).omit({ id: true, createdAt: true });
export const insertRecommendationOutcomeSchema = createInsertSchema(recommendationOutcomes).omit({ id: true, createdAt: true });
export const insertReplayEventSchema = createInsertSchema(replayEvents).omit({ id: true });
export const insertDriverInsightSchema = createInsertSchema(driverInsights).omit({ id: true, createdAt: true });

// === TYPES ===

export type Zone = typeof zones.$inferSelect;
export type InsertZone = z.infer<typeof insertZoneSchema>;

export type Earning = typeof earnings.$inferSelect;
export type InsertEarning = z.infer<typeof insertEarningSchema>;

export type Poi = typeof pois.$inferSelect;
export type InsertPoi = z.infer<typeof insertPoiSchema>;

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferencesSchema>;

export type ShiftSession = typeof shiftSessions.$inferSelect;
export type InsertShiftSession = z.infer<typeof insertShiftSessionSchema>;

export type CopilotRecommendationRecord = typeof copilotRecommendations.$inferSelect;
export type InsertCopilotRecommendation = z.infer<typeof insertCopilotRecommendationSchema>;

export type RecommendationOutcomeRecord = typeof recommendationOutcomes.$inferSelect;
export type InsertRecommendationOutcome = z.infer<typeof insertRecommendationOutcomeSchema>;

export type ReplayEventRecord = typeof replayEvents.$inferSelect;
export type InsertReplayEvent = z.infer<typeof insertReplayEventSchema>;

export type DriverInsightRecord = typeof driverInsights.$inferSelect;
export type InsertDriverInsight = z.infer<typeof insertDriverInsightSchema>;

// === API TYPES ===

export type ZoneResponse = Zone;
export type EarningResponse = Earning;
export type PoiResponse = Poi;
export type RecommendationResponse = Recommendation;

// CSV Upload Response
export interface CsvUploadResponse {
  processed: number;
  failed: number;
  errors?: string[];
}

// Map Data Response (Combined view)
export interface MapDataResponse {
  zones: Zone[];
  pois: Poi[];
  recommendations: Recommendation[];
  heatmapPoints: { lat: number; lng: number; weight: number }[];
}
