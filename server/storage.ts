import { db, DB_ENABLED } from "./db";
import {
  zones, earnings, pois, recommendations, notificationPreferences, payments,
  shiftSessions, copilotRecommendations, recommendationOutcomes, replayEvents, driverInsights,
  type Zone, type InsertZone,
  type Earning, type InsertEarning,
  type Poi, type InsertPoi,
  type Recommendation, type InsertRecommendation,
  type NotificationPreference, type InsertNotificationPreference,
  type Payment, type InsertPayment,
  type ShiftSession, type InsertShiftSession,
  type CopilotRecommendationRecord, type InsertCopilotRecommendation,
  type RecommendationOutcomeRecord, type InsertRecommendationOutcome,
  type ReplayEventRecord, type InsertReplayEvent,
  type DriverInsightRecord, type InsertDriverInsight
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // Zones
  getZones(): Promise<Zone[]>;
  getZone(id: number): Promise<Zone | undefined>;
  createZone(zone: InsertZone): Promise<Zone>;
  updateZone(id: number, updates: Partial<InsertZone>): Promise<Zone>;
  deleteZone(id: number): Promise<void>;

  // Earnings
  getEarnings(userId: string): Promise<Earning[]>;
  createEarning(earning: InsertEarning): Promise<Earning>;
  getEarningsStats(userId: string): Promise<{ totalEarnings: number, totalTrips: number, averagePerTrip: number }>;

  // POIs
  getPois(): Promise<Poi[]>;
  createPoi(poi: InsertPoi): Promise<Poi>;

  // Recommendations
  getRecommendations(): Promise<Recommendation[]>;
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  clearRecommendations(): Promise<void>;

  // Notification Preferences
  getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined>;
  upsertNotificationPreferences(userId: string, prefs: Partial<InsertNotificationPreference>): Promise<NotificationPreference>;

  // Payments
  getPayments(userId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePaymentStatus(id: number, status: string, p24OrderId?: string, paypalOrderId?: string, paypalSubscriptionId?: string, paypalPayerId?: string): Promise<Payment>;
  getPaymentBySessionId(sessionId: string): Promise<Payment | undefined>;
  getPaymentByToken(token: string): Promise<Payment | undefined>;

  // Shift Sessions
  createShiftSession(session: InsertShiftSession): Promise<ShiftSession>;
  getActiveShiftSession(userId: string): Promise<ShiftSession | undefined>;
  updateShiftSession(id: number, updates: Partial<InsertShiftSession>): Promise<ShiftSession>;
  endShiftSession(id: number): Promise<ShiftSession>;
  getRecentShiftSessions(userId: string, limit: number): Promise<ShiftSession[]>;

  // Copilot Recommendations
  createCopilotRecommendation(rec: InsertCopilotRecommendation): Promise<CopilotRecommendationRecord>;
  getRecentCopilotRecommendations(userId: string, limit: number): Promise<CopilotRecommendationRecord[]>;

  // Recommendation Outcomes
  createRecommendationOutcome(outcome: InsertRecommendationOutcome): Promise<RecommendationOutcomeRecord>;
  getRecommendationOutcomes(userId: string, limit: number): Promise<RecommendationOutcomeRecord[]>;

  // Replay Events
  createReplayEvent(event: InsertReplayEvent): Promise<ReplayEventRecord>;
  getReplayEvents(shiftSessionId: number): Promise<ReplayEventRecord[]>;

  // Driver Insights
  createDriverInsight(insight: InsertDriverInsight): Promise<DriverInsightRecord>;
  getDriverInsights(userId: string): Promise<DriverInsightRecord[]>;
  markInsightSeen(id: number): Promise<DriverInsightRecord>;
}

export class DatabaseStorage implements IStorage {
  // Zones
  async getZones(): Promise<Zone[]> {
    return await db.select().from(zones);
  }

  async getZone(id: number): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.id, id));
    return zone;
  }

  async createZone(insertZone: InsertZone): Promise<Zone> {
    const [zone] = await db.insert(zones).values(insertZone).returning();
    return zone;
  }

  async updateZone(id: number, updates: Partial<InsertZone>): Promise<Zone> {
    const [updated] = await db.update(zones).set(updates).where(eq(zones.id, id)).returning();
    return updated;
  }

  async deleteZone(id: number): Promise<void> {
    await db.delete(zones).where(eq(zones.id, id));
  }

  // Earnings
  async getEarnings(userId: string): Promise<Earning[]> {
    return await db.select().from(earnings).where(eq(earnings.userId, userId)).orderBy(desc(earnings.tripDate));
  }

  async createEarning(insertEarning: InsertEarning): Promise<Earning> {
    const [earning] = await db.insert(earnings).values(insertEarning).returning();
    return earning;
  }

  async getEarningsStats(userId: string): Promise<{ totalEarnings: number, totalTrips: number, averagePerTrip: number }> {
    const result = await db
      .select({
        totalEarnings: sql<number>`sum(${earnings.amount})`,
        totalTrips: sql<number>`count(${earnings.id})`
      })
      .from(earnings)
      .where(eq(earnings.userId, userId));

    const totalEarnings = Number(result[0]?.totalEarnings) || 0;
    const totalTrips = Number(result[0]?.totalTrips) || 0;
    const averagePerTrip = totalTrips > 0 ? totalEarnings / totalTrips : 0;

    return { totalEarnings, totalTrips, averagePerTrip };
  }

  // POIs
  async getPois(): Promise<Poi[]> {
    return await db.select().from(pois);
  }

  async createPoi(insertPoi: InsertPoi): Promise<Poi> {
    const [poi] = await db.insert(pois).values(insertPoi).returning();
    return poi;
  }

  // Recommendations
  async getRecommendations(): Promise<Recommendation[]> {
    return await db.select().from(recommendations).orderBy(desc(recommendations.priority));
  }

  async createRecommendation(insertRecommendation: InsertRecommendation): Promise<Recommendation> {
    const [recommendation] = await db.insert(recommendations).values(insertRecommendation).returning();
    return recommendation;
  }

  async clearRecommendations(): Promise<void> {
    await db.delete(recommendations);
  }

  // Notification Preferences
  async getNotificationPreferences(userId: string): Promise<NotificationPreference | undefined> {
    const [pref] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
    return pref;
  }

  async upsertNotificationPreferences(userId: string, prefs: Partial<InsertNotificationPreference>): Promise<NotificationPreference> {
    const [result] = await db
      .insert(notificationPreferences)
      .values({ ...prefs, userId })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: prefs,
      })
      .returning();
    return result;
  }

  // Payments
  async getPayments(userId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [result] = await db.insert(payments).values(payment).returning();
    return result;
  }

  async updatePaymentStatus(id: number, status: string, p24OrderId?: string, paypalOrderId?: string, paypalSubscriptionId?: string, paypalPayerId?: string): Promise<Payment> {
    const set: Record<string, any> = { status };
    if (status === "completed") {
      set.completedAt = new Date();
    }
    if (p24OrderId) {
      set.p24OrderId = p24OrderId;
    }
    if (paypalOrderId) {
      set.paypalOrderId = paypalOrderId;
    }
    if (paypalSubscriptionId) {
      set.paypalSubscriptionId = paypalSubscriptionId;
    }
    if (paypalPayerId) {
      set.paypalPayerId = paypalPayerId;
    }
    const [result] = await db.update(payments).set(set).where(eq(payments.id, id)).returning();
    return result;
  }

  async getPaymentBySessionId(sessionId: string): Promise<Payment | undefined> {
    const [result] = await db.select().from(payments).where(eq(payments.p24SessionId, sessionId));
    return result;
  }

  async getPaymentByToken(token: string): Promise<Payment | undefined> {
    const [result] = await db.select().from(payments).where(eq(payments.p24Token, token));
    return result;
  }

  // Shift Sessions
  async createShiftSession(session: InsertShiftSession): Promise<ShiftSession> {
    const [result] = await db.insert(shiftSessions).values(session).returning();
    return result;
  }

  async getActiveShiftSession(userId: string): Promise<ShiftSession | undefined> {
    const [result] = await db.select().from(shiftSessions)
      .where(and(eq(shiftSessions.userId, userId), eq(shiftSessions.isActive, true)))
      .orderBy(desc(shiftSessions.startTime))
      .limit(1);
    return result;
  }

  async updateShiftSession(id: number, updates: Partial<InsertShiftSession>): Promise<ShiftSession> {
    const [result] = await db.update(shiftSessions).set(updates).where(eq(shiftSessions.id, id)).returning();
    return result;
  }

  async endShiftSession(id: number): Promise<ShiftSession> {
    const [result] = await db.update(shiftSessions)
      .set({ isActive: false, endTime: new Date() })
      .where(eq(shiftSessions.id, id))
      .returning();
    return result;
  }

  async getRecentShiftSessions(userId: string, limit: number): Promise<ShiftSession[]> {
    return await db.select().from(shiftSessions)
      .where(eq(shiftSessions.userId, userId))
      .orderBy(desc(shiftSessions.startTime))
      .limit(limit);
  }

  // Copilot Recommendations
  async createCopilotRecommendation(rec: InsertCopilotRecommendation): Promise<CopilotRecommendationRecord> {
    const [result] = await db.insert(copilotRecommendations).values(rec).returning();
    return result;
  }

  async getRecentCopilotRecommendations(userId: string, limit: number): Promise<CopilotRecommendationRecord[]> {
    return await db.select().from(copilotRecommendations)
      .where(eq(copilotRecommendations.userId, userId))
      .orderBy(desc(copilotRecommendations.createdAt))
      .limit(limit);
  }

  // Recommendation Outcomes
  async createRecommendationOutcome(outcome: InsertRecommendationOutcome): Promise<RecommendationOutcomeRecord> {
    const [result] = await db.insert(recommendationOutcomes).values(outcome).returning();
    return result;
  }

  async getRecommendationOutcomes(userId: string, limit: number): Promise<RecommendationOutcomeRecord[]> {
    return await db.select()
      .from(recommendationOutcomes)
      .innerJoin(copilotRecommendations, eq(recommendationOutcomes.recommendationId, copilotRecommendations.id))
      .where(eq(copilotRecommendations.userId, userId))
      .orderBy(desc(recommendationOutcomes.createdAt))
      .limit(limit)
      .then(rows => rows.map(r => r.recommendation_outcomes));
  }

  // Replay Events
  async createReplayEvent(event: InsertReplayEvent): Promise<ReplayEventRecord> {
    const [result] = await db.insert(replayEvents).values(event).returning();
    return result;
  }

  async getReplayEvents(shiftSessionId: number): Promise<ReplayEventRecord[]> {
    return await db.select().from(replayEvents)
      .where(eq(replayEvents.shiftSessionId, shiftSessionId))
      .orderBy(replayEvents.timestamp);
  }

  // Driver Insights
  async createDriverInsight(insight: InsertDriverInsight): Promise<DriverInsightRecord> {
    const [result] = await db.insert(driverInsights).values(insight).returning();
    return result;
  }

  async getDriverInsights(userId: string): Promise<DriverInsightRecord[]> {
    return await db.select().from(driverInsights)
      .where(eq(driverInsights.userId, userId))
      .orderBy(desc(driverInsights.createdAt));
  }

  async markInsightSeen(id: number): Promise<DriverInsightRecord> {
    const [result] = await db.update(driverInsights)
      .set({ isNew: false })
      .where(eq(driverInsights.id, id))
      .returning();
    return result;
  }
}


// If DB is disabled, export a safe Noop storage implementation so the app can start
if (!DB_ENABLED) {
  class NoopStorage implements IStorage {
    // Zones
    async getZones() { return []; }
    async getZone(_id: number) { return undefined; }
    async createZone(_zone: InsertZone) { throw new Error('DB not enabled'); }
    async updateZone(_id: number, _updates: Partial<InsertZone>) { throw new Error('DB not enabled'); }
    async deleteZone(_id: number) { /* no-op */ }

    // Earnings
    async getEarnings(_userId: string) { return []; }
    async createEarning(_earning: InsertEarning) { throw new Error('DB not enabled'); }
    async getEarningsStats(_userId: string) { return { totalEarnings: 0, totalTrips: 0, averagePerTrip: 0 }; }

    // POIs
    async getPois() { return []; }
    async createPoi(_poi: InsertPoi) { throw new Error('DB not enabled'); }

    // Recommendations
    async getRecommendations() { return []; }
    async createRecommendation(_recommendation: InsertRecommendation) { throw new Error('DB not enabled'); }
    async clearRecommendations() { /* no-op */ }

    // Notification Preferences
    async getNotificationPreferences(_userId: string) { return undefined; }
    async upsertNotificationPreferences(userId: string, prefs: Partial<InsertNotificationPreference>) { return { userId, airportInfo: true, events: true, hotZones: true, relocate: true, bestEarnings: true, frequency: 'hourly' } as any; }

    // Payments
    async getPayments(_userId: string) { return []; }
    async createPayment(_payment: InsertPayment) { throw new Error('DB not enabled'); }
    async updatePaymentStatus(_id: number, _status: string) { throw new Error('DB not enabled'); }
    async getPaymentBySessionId(_sessionId: string) { return undefined; }
    async getPaymentByToken(_token: string) { return undefined; }

    // Shift Sessions
    async createShiftSession(_session: InsertShiftSession) { throw new Error('DB not enabled'); }
    async getActiveShiftSession(_userId: string) { return undefined; }
    async updateShiftSession(_id: number, _updates: Partial<InsertShiftSession>) { throw new Error('DB not enabled'); }
    async endShiftSession(_id: number) { throw new Error('DB not enabled'); }
    async getRecentShiftSessions(_userId: string, _limit: number) { return []; }

    // Copilot Recommendations
    async createCopilotRecommendation(_rec: InsertCopilotRecommendation) { throw new Error('DB not enabled'); }
    async getRecentCopilotRecommendations(_userId: string, _limit: number) { return []; }

    // Recommendation Outcomes
    async createRecommendationOutcome(_outcome: InsertRecommendationOutcome) { throw new Error('DB not enabled'); }
    async getRecommendationOutcomes(_userId: string, _limit: number) { return []; }

    // Replay Events
    async createReplayEvent(_event: InsertReplayEvent) { throw new Error('DB not enabled'); }
    async getReplayEvents(_shiftSessionId: number) { return []; }

    // Driver Insights
    async createDriverInsight(_insight: InsertDriverInsight) { throw new Error('DB not enabled'); }
    async getDriverInsights(_userId: string) { return []; }
    async markInsightSeen(_id: number) { throw new Error('DB not enabled'); }
  }

  export let storage: IStorage;
  storage = new NoopStorage();
} else {
  storage = new DatabaseStorage();
}

