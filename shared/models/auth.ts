import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 1024 }),
  phoneNumber: varchar("phone_number", { length: 64 }),
  role: varchar("role", { length: 50 }).default("user"),
  status: varchar("status", { length: 50 }).default("pending"),
  accountType: varchar("account_type", { length: 50 }),
  companyName: varchar("company_name", { length: 255 }),
  trialStartDate: timestamp("trial_start_date").defaultNow(),
  subscriptionStatus: varchar("subscription_status", { length: 50 }).default("trial"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  p24CustomerId: varchar("p24_customer_id", { length: 255 }),
  lastSeenAt: timestamp("last_seen_at"),
  lastSeenLat: varchar("last_seen_lat", { length: 64 }),
  lastSeenLng: varchar("last_seen_lng", { length: 64 }),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  privacyAcceptedAt: timestamp("privacy_accepted_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
