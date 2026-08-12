import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phoneNumber: varchar("phone_number"),
  role: varchar("role").default("user"),
  status: varchar("status").default("pending"),
  accountType: varchar("account_type"),
  companyName: varchar("company_name"),
  trialStartDate: timestamp("trial_start_date").defaultNow(),
  subscriptionStatus: varchar("subscription_status").default("trial"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  p24CustomerId: varchar("p24_customer_id"),
  lastSeenAt: timestamp("last_seen_at"),
  lastSeenLat: varchar("last_seen_lat"),
  lastSeenLng: varchar("last_seen_lng"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
