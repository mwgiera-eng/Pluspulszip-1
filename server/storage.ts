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


// If DB is disabled, export a safe demo storage implementation so the public
// Render preview still shows Krakow demand data before Postgres is configured.
const demoUpdatedAt = new Date("2026-08-12T00:00:00.000Z");

const DEMO_ZONES: Zone[] = [
  {
    id: 1,
    name: "Kraków Airport (Balice)",
    type: "airport",
    lat: "50.0777",
    lng: "19.7848",
    radius: 2000,
    description: "Main international airport, high demand for pickups.",
    demandLevel: "surge",
    surgeMultiplier: "1.5",
    updatedAt: demoUpdatedAt,
  },
  {
    id: 2,
    name: "Old Town (Rynek)",
    type: "center",
    lat: "50.0614",
    lng: "19.9366",
    radius: 1000,
    description: "Historical center, high tourist traffic.",
    demandLevel: "high",
    surgeMultiplier: "1.2",
    updatedAt: demoUpdatedAt,
  },
  {
    id: 3,
    name: "Kazimierz",
    type: "nightlife",
    lat: "50.0526",
    lng: "19.9455",
    radius: 800,
    description: "Nightlife district, busy in evenings/weekends.",
    demandLevel: "medium",
    surgeMultiplier: "1.3",
    updatedAt: demoUpdatedAt,
  },
  {
    id: 4,
    name: "Kraków Główny Station",
    type: "station",
    lat: "50.0678",
    lng: "19.9470",
    radius: 600,
    description: "Main railway station and bus terminal. Commuters and travelers.",
    demandLevel: "high",
    surgeMultiplier: "1.3",
    updatedAt: demoUpdatedAt,
  },
  {
    id: 5,
    name: "Nowa Huta",
    type: "residential",
    lat: "50.0725",
    lng: "20.0375",
    radius: 2500,
    description: "Large residential district east of center.",
    demandLevel: "low",
    surgeMultiplier: "1.0",
    updatedAt: demoUpdatedAt,
  },
  {
    id: 6,
    name: "Galeria Krakowska & Bonarka",
    type: "mall",
    lat: "50.0669",
    lng: "19.9458",
    radius: 800,
    description: "Major shopping malls. Busy afternoons and weekends.",
    demandLevel: "medium",
    surgeMultiplier: "1.1",
    updatedAt: demoUpdatedAt,
  },
  {
    id: 7,
    name: "Tauron Arena",
    type: "event",
    lat: "50.0697",
    lng: "20.0108",
    radius: 1000,
    description: "Large event venue. Major surge when concerts and events end.",
    demandLevel: "medium",
    surgeMultiplier: "1.0",
    updatedAt: demoUpdatedAt,
  },
  {
    id: 8,
    name: "Wawel & Planty Area",
    type: "tourism",
    lat: "50.0540",
    lng: "19.9354",
    radius: 1200,
    description: "Wawel Castle, Planty gardens, and tourist corridor.",
    demandLevel: "high",
    surgeMultiplier: "1.2",
    updatedAt: demoUpdatedAt,
  },
];

const DEMO_POIS: Poi[] = [
  {
    id: 1,
    name: "Wawel Royal Castle",
    category: "tourism",
    lat: "50.0540",
    lng: "19.9354",
    openingTime: "09:00",
    closingTime: "17:00",
    popularityScore: 10,
    description: "Major tourist attraction.",
  },
  {
    id: 2,
    name: "Schindler's Factory",
    category: "tourism",
    lat: "50.0474",
    lng: "19.9618",
    openingTime: "10:00",
    closingTime: "18:00",
    popularityScore: 9,
    description: "Popular museum.",
  },
  {
    id: 3,
    name: "Main Square Hotels",
    category: "tourism",
    lat: "50.0614",
    lng: "19.9366",
    openingTime: "00:00",
    closingTime: "23:59",
    popularityScore: 10,
    description: "Hotel and restaurant pickup corridor.",
  },
];

const DEMO_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 1,
    zoneId: null,
    action: "MOVE",
    reason: "Najwyzszy przewidywany potencjal zarobku w Krakowie.",
    targetZoneId: 1,
    validFrom: demoUpdatedAt,
    validUntil: new Date(demoUpdatedAt.getTime() + 60 * 60 * 1000),
    priority: 10,
  },
];

export let storage: IStorage;
if (!DB_ENABLED) {
  class DemoStorage implements IStorage {
    private zones = [...DEMO_ZONES];
    private pois = [...DEMO_POIS];
    private recommendations = [...DEMO_RECOMMENDATIONS];

    async getZones(): Promise<Zone[]> { return this.zones; }
    async getZone(id: number): Promise<Zone | undefined> { return this.zones.find((zone) => zone.id === id); }
    async createZone(zone: InsertZone): Promise<Zone> {
      const created = { ...zone, id: this.zones.length + 1, updatedAt: new Date() } as Zone;
      this.zones.push(created);
      return created;
    }
    async updateZone(id: number, updates: Partial<InsertZone>): Promise<Zone> {
      const existing = await this.getZone(id);
      if (!existing) throw new Error("Zone not found");
      Object.assign(existing, updates, { updatedAt: new Date() });
      return existing;
    }
    async deleteZone(id: number): Promise<void> {
      this.zones = this.zones.filter((zone) => zone.id !== id);
    }

    async getEarnings(_userId: string): Promise<Earning[]> { return []; }
    async createEarning(_earning: InsertEarning): Promise<Earning> { throw new Error("Database required for earnings"); }
    async getEarningsStats(_userId: string): Promise<{ totalEarnings: number, totalTrips: number, averagePerTrip: number }> {
      return { totalEarnings: 0, totalTrips: 0, averagePerTrip: 0 };
    }

    async getPois(): Promise<Poi[]> { return this.pois; }
    async createPoi(poi: InsertPoi): Promise<Poi> {
      const created = { ...poi, id: this.pois.length + 1 } as Poi;
      this.pois.push(created);
      return created;
    }

    async getRecommendations(): Promise<Recommendation[]> { return this.recommendations; }
    async createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation> {
      const created = {
        ...recommendation,
        id: this.recommendations.length + 1,
        validFrom: recommendation.validFrom ?? new Date(),
        validUntil: recommendation.validUntil ?? new Date(Date.now() + 60 * 60 * 1000),
      } as Recommendation;
      this.recommendations.push(created);
      return created;
    }
    async clearRecommendations(): Promise<void> { this.recommendations = []; }

    async getNotificationPreferences(_userId: string): Promise<NotificationPreference | undefined> { return undefined; }
    async upsertNotificationPreferences(userId: string, prefs: Partial<InsertNotificationPreference>): Promise<NotificationPreference> {
      return {
        id: 1,
        userId,
        airportInfo: prefs.airportInfo ?? true,
        events: prefs.events ?? true,
        hotZones: prefs.hotZones ?? true,
        relocate: prefs.relocate ?? true,
        bestEarnings: prefs.bestEarnings ?? true,
        frequency: prefs.frequency ?? "hourly",
      } as NotificationPreference;
    }

    async getPayments(_userId: string): Promise<Payment[]> { return []; }
    async createPayment(_payment: InsertPayment): Promise<Payment> { throw new Error("Database required for payments"); }
    async updatePaymentStatus(_id: number, _status: string): Promise<Payment> { throw new Error("Database required for payments"); }
    async getPaymentBySessionId(_sessionId: string): Promise<Payment | undefined> { return undefined; }
    async getPaymentByToken(_token: string): Promise<Payment | undefined> { return undefined; }

    async createShiftSession(_session: InsertShiftSession): Promise<ShiftSession> { throw new Error("Database required for shifts"); }
    async getActiveShiftSession(_userId: string): Promise<ShiftSession | undefined> { return undefined; }
    async updateShiftSession(_id: number, _updates: Partial<InsertShiftSession>): Promise<ShiftSession> { throw new Error("Database required for shifts"); }
    async endShiftSession(_id: number): Promise<ShiftSession> { throw new Error("Database required for shifts"); }
    async getRecentShiftSessions(_userId: string, _limit: number): Promise<ShiftSession[]> { return []; }

    async createCopilotRecommendation(_rec: InsertCopilotRecommendation): Promise<CopilotRecommendationRecord> { throw new Error("Database required for copilot recommendations"); }
    async getRecentCopilotRecommendations(_userId: string, _limit: number): Promise<CopilotRecommendationRecord[]> { return []; }

    async createRecommendationOutcome(_outcome: InsertRecommendationOutcome): Promise<RecommendationOutcomeRecord> { throw new Error("Database required for recommendation outcomes"); }
    async getRecommendationOutcomes(_userId: string, _limit: number): Promise<RecommendationOutcomeRecord[]> { return []; }

    async createReplayEvent(_event: InsertReplayEvent): Promise<ReplayEventRecord> { throw new Error("Database required for replay events"); }
    async getReplayEvents(_shiftSessionId: number): Promise<ReplayEventRecord[]> { return []; }

    async createDriverInsight(_insight: InsertDriverInsight): Promise<DriverInsightRecord> { throw new Error("Database required for driver insights"); }
    async getDriverInsights(_userId: string): Promise<DriverInsightRecord[]> { return []; }
    async markInsightSeen(_id: number): Promise<DriverInsightRecord> { throw new Error("Database required for driver insights"); }
  }

  storage = new DemoStorage();
} else {
  storage = new DatabaseStorage();
}
