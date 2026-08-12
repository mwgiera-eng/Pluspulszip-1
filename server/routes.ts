import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertZoneSchema, insertEarningSchema, insertPoiSchema } from "@shared/schema";
import type { InsertEarning } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated, requireAdmin } from "./replit_integrations/auth";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { generateRecommendations, getArrivalsWindowEstimate, generateLocationAwareAdvice, getZoneProfitHeat } from "./recommendationEngine";
import { getSubscriptionStatus, activateSubscription } from "./subscriptionService";
import { registerTransaction, processBlikPayment, verifyWebhookSignature, verifyTransaction, isSandboxMode, type PaymentMethod } from "./przelewy24Service";
import { getPopularRoutes } from "./popularRoutes";
import { fetchMultipleRouteGeometries } from "./osrmService";
import { startEventsRefreshLoop, getActiveEvents, refreshEvents, getEventsCacheMeta, getAllCachedEvents } from "./krakowEvents";
import { generateDayPlan } from "./dayPlanner";
import { clearAirportCache, getAirportCacheMeta, getKrakowAirportFlights } from "./krakowAirportScraper";
import multer from "multer";
import { parse } from "csv-parse/sync";

const publicUser = <T extends { passwordHash?: string | null }>(user: T) => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const requirePremium: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const dbUser = await authStorage.getUser(user.claims.sub);
  if (!dbUser) {
    return res.status(404).json({ message: "User not found" });
  }
  const sub = getSubscriptionStatus(dbUser);
  if (!sub.isPremium) {
    return res.status(403).json({ message: "Premium subscription required", subscriptionStatus: sub.status });
  }
  next();
};

const isAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const dbUser = await authStorage.getUser(user.claims.sub);
  if (!dbUser || dbUser.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // === Account Type ===
  app.patch("/api/auth/account-type", isAuthenticated, async (req: any, res) => {
    try {
      const { accountType, companyName } = req.body;
      if (!accountType || !["driver", "provider"].includes(accountType)) {
        return res.status(400).json({ message: "accountType must be 'driver' or 'provider'" });
      }
      if (accountType === "provider" && (!companyName || typeof companyName !== "string" || companyName.trim().length < 2)) {
        return res.status(400).json({ message: "companyName required for fleet managers" });
      }
      const userId = req.user.claims.sub;
      const user = await authStorage.updateAccountType(userId, accountType, accountType === "provider" ? companyName?.trim() : undefined);
      res.json(publicUser(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to update account type" });
    }
  });

  // === Phone Number ===
  app.patch("/api/auth/phone", isAuthenticated, async (req: any, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber || typeof phoneNumber !== "string" || phoneNumber.trim().length < 6) {
        return res.status(400).json({ message: "Valid phone number required" });
      }
      const userId = req.user.claims.sub;
      const user = await authStorage.updateUserPhone(userId, phoneNumber.trim());
      res.json(publicUser(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to update phone number" });
    }
  });

  // === Notification Preferences ===
  app.get("/api/notification-preferences", isAuthenticated, requirePremium, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const prefs = await storage.getNotificationPreferences(userId);
    res.json(prefs || {
      userId,
      airportInfo: true,
      events: true,
      hotZones: true,
      relocate: true,
      bestEarnings: true,
      frequency: "hourly",
    });
  });

  app.put("/api/notification-preferences", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { airportInfo, events, hotZones, relocate, bestEarnings, frequency } = req.body;
      const validFrequencies = ["realtime", "hourly", "daily", "off"];
      if (frequency && !validFrequencies.includes(frequency)) {
        return res.status(400).json({ message: "Invalid frequency" });
      }
      const prefs = await storage.upsertNotificationPreferences(userId, {
        airportInfo, events, hotZones, relocate, bestEarnings, frequency,
      });
      res.json(prefs);
    } catch (error) {
      res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  // === Admin Routes ===
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req, res) => {
    const users = await authStorage.getAllUsers();
    res.json(users.map(publicUser));
  });

  app.get("/api/admin/users/pending", isAuthenticated, isAdmin, async (_req, res) => {
    const pending = await authStorage.getPendingUsers();
    res.json(pending.map(publicUser));
  });

  app.post("/api/admin/users/:id/approve", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await authStorage.updateUserStatus(id, "approved");
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to approve user" });
    }
  });

  app.post("/api/admin/users/:id/reject", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await authStorage.updateUserStatus(id, "rejected");
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to reject user" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req, res) => {
    const userCount = await authStorage.getUserCount();
    res.json({ userCount });
  });

  app.post("/api/heartbeat", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const lat = typeof req.body?.lat === "number" ? req.body.lat : undefined;
    const lng = typeof req.body?.lng === "number" ? req.body.lng : undefined;
    await authStorage.updateHeartbeat(userId, lat, lng);
    res.json({ ok: true });
  });

  app.get("/api/admin/active-users", isAuthenticated, isAdmin, async (_req, res) => {
    const activeUsers = await authStorage.getActiveUsers(30);
    const allZones = await storage.getZones();

    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const result = activeUsers.map((u) => {
      let nearestZone: string | null = null;
      if (u.lastSeenLat && u.lastSeenLng) {
        const lat = parseFloat(u.lastSeenLat);
        const lng = parseFloat(u.lastSeenLng);
        let minDist = Infinity;
        for (const zone of allZones) {
          const d = haversine(lat, lng, Number(zone.lat), Number(zone.lng));
          if (d < minDist) { minDist = d; nearestZone = zone.name; }
        }
        if (minDist > 5) nearestZone = "Outside Kraków";
      }
      return { ...publicUser(u), nearestZone };
    }).sort((a, b) => new Date(b.lastSeenAt!).getTime() - new Date(a.lastSeenAt!).getTime());

    res.json(result);
  });

  // === Subscription & Payments ===
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dbUser = await authStorage.getUser(userId);
      if (!dbUser) return res.status(404).json({ message: "User not found" });
      const sub = getSubscriptionStatus(dbUser);
      res.json({ ...sub, sandbox: isSandboxMode() });
    } catch (err) {
      console.error("[Subscription] Error:", err);
      res.status(500).json({ message: "Failed to get subscription status" });
    }
  });

  app.post("/api/subscription/pay", isAuthenticated, async (req: any, res) => {
    try {
      const { blikCode } = req.body;
      if (!blikCode || typeof blikCode !== "string" || !/^\d{6}$/.test(blikCode)) {
        return res.status(400).json({ message: "Valid 6-digit BLIK code required" });
      }

      const userId = req.user.claims.sub;
      const dbUser = await authStorage.getUser(userId);
      if (!dbUser) return res.status(404).json({ message: "User not found" });

      const amount = 9.99;
      const registration = await registerTransaction(
        userId,
        dbUser.email || "driver@example.com",
        amount,
        "blik",
        "ShiftOptima Premium - 1 month"
      );

      const payment = await storage.createPayment({
        userId,
        amount: amount.toString(),
        currency: "PLN",
        status: "pending",
        p24SessionId: registration.sessionId,
        p24Token: registration.token,
        paymentMethod: "blik",
      });

      const blikResult = await processBlikPayment(registration.token, blikCode);

      if (blikResult.success) {
        const currentPayment = await storage.getPaymentBySessionId(registration.sessionId);
        if (currentPayment && currentPayment.status !== "completed") {
          await storage.updatePaymentStatus(
            payment.id,
            "completed",
            blikResult.orderId?.toString()
          );
          await activateSubscription(userId, 1);
        }

        res.json({
          success: true,
          message: "Payment successful! Premium activated for 30 days.",
          orderId: blikResult.orderId,
        });
      } else {
        await storage.updatePaymentStatus(payment.id, "failed");
        res.status(400).json({
          success: false,
          message: blikResult.error || "Payment failed. Please try again.",
        });
      }
    } catch (err: any) {
      console.error("[Payment] Error:", err);
      res.status(500).json({ message: "Payment processing failed. Please try again." });
    }
  });

  app.post("/api/subscription/webhook", async (req, res) => {
    try {
      const body = req.body;

      if (!verifyWebhookSignature(body)) {
        console.warn("[P24 Webhook] Invalid signature");
        return res.status(400).json({ message: "Invalid signature" });
      }

      const payment = await storage.getPaymentBySessionId(body.sessionId);
      if (!payment) {
        console.warn("[P24 Webhook] Payment not found for session:", body.sessionId);
        return res.status(404).json({ message: "Payment not found" });
      }

      if (payment.status === "completed") {
        console.log(`[P24 Webhook] Payment already completed for session ${body.sessionId}, skipping`);
        return res.json({ status: "OK" });
      }

      const verified = await verifyTransaction(
        body.orderId,
        body.sessionId,
        parseFloat(payment.amount)
      );

      if (verified) {
        await storage.updatePaymentStatus(payment.id, "completed", body.orderId.toString());
        await activateSubscription(payment.userId, 1);
        console.log(`[P24 Webhook] Payment verified for user ${payment.userId}`);
      } else {
        await storage.updatePaymentStatus(payment.id, "failed");
        console.warn(`[P24 Webhook] Verification failed for order ${body.orderId}`);
      }

      res.json({ status: "OK" });
    } catch (err) {
      console.error("[P24 Webhook] Error:", err);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.post("/api/subscription/pay-redirect", isAuthenticated, async (req: any, res) => {
    try {
      const { method } = req.body;
      const validMethods: PaymentMethod[] = ["card", "transfer", "all"];
      if (!method || !validMethods.includes(method)) {
        return res.status(400).json({ message: "Valid payment method required: card, transfer, or all" });
      }

      const userId = req.user.claims.sub;
      const dbUser = await authStorage.getUser(userId);
      if (!dbUser) return res.status(404).json({ message: "User not found" });

      const amount = 9.99;
      const registration = await registerTransaction(
        userId,
        dbUser.email || "driver@example.com",
        amount,
        method as PaymentMethod,
        "ShiftOptima Premium - 1 month"
      );

      await storage.createPayment({
        userId,
        amount: amount.toString(),
        currency: "PLN",
        status: "pending",
        p24SessionId: registration.sessionId,
        p24Token: registration.token,
        paymentMethod: method,
      });

      res.json({
        redirectUrl: registration.redirectUrl,
        sessionId: registration.sessionId,
      });
    } catch (err: any) {
      console.error("[Payment Redirect] Error:", err);
      res.status(500).json({ message: "Failed to initialize payment. Please try again." });
    }
  });

  app.get("/api/subscription/payment-status/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const payment = await storage.getPaymentBySessionId(req.params.sessionId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      if (payment.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json({
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        completedAt: payment.completedAt,
      });
    } catch (err) {
      console.error("[Payment Status] Error:", err);
      res.status(500).json({ message: "Failed to check payment status" });
    }
  });

  // PayPal webhook endpoint (no auth - PayPal calls directly)
  app.post("/api/subscription/paypal/webhook", async (req: any, res) => {
    try {
      const { handlePayPalWebhook } = await import("./paypalWebhook");
      const result = await handlePayPalWebhook(
        req.body,
        req.headers
      );
      res.status(result.success ? 200 : 400).json(result);
    } catch (err: any) {
      console.error("[PayPal Webhook] Error:", err);
      res.status(400).json({ success: false, message: "Webhook processing failed" });
    }
  });

  // PayPal status polling endpoint
  app.get("/api/subscription/paypal/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dbUser = await authStorage.getUser(userId);
      if (!dbUser) return res.status(404).json({ message: "User not found" });
      
      res.json({
        subscriptionStatus: dbUser.subscriptionStatus,
        subscriptionSource: "paypal",
        subscriptionExpiresAt: dbUser.subscriptionExpiresAt,
      });
    } catch (err) {
      console.error("[PayPal Status] Error:", err);
      res.status(500).json({ message: "Failed to check status" });
    }
  });

  app.get("/api/payments", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const userPayments = await storage.getPayments(userId);
    res.json(userPayments);
  });

  // === Day Planner ===
  app.get("/api/day-plan", isAuthenticated, requirePremium, async (req: any, res) => {
    const tomorrow = req.query.tomorrow === "true";
    const [allZones, allPois] = await Promise.all([
      storage.getZones(),
      storage.getPois(),
    ]);
    const plan = generateDayPlan(allZones, allPois, tomorrow);
    res.json(plan);
  });

  // === Zones ===
  app.get(api.zones.list.path, async (req, res) => {
    const zones = await storage.getZones();
    res.json(zones);
  });

  app.get(api.zones.get.path, async (req, res) => {
    const zone = await storage.getZone(Number(req.params.id));
    if (!zone) return res.status(404).json({ message: "Zone not found" });
    res.json(zone);
  });

  app.post(api.zones.create.path, isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const input = insertZoneSchema.parse(req.body);
      const zone = await storage.createZone(input);
      res.status(201).json(zone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put(api.zones.update.path, isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const input = insertZoneSchema.partial().parse(req.body);
      const zone = await storage.updateZone(Number(req.params.id), input);
      res.json(zone);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete(api.zones.delete.path, isAuthenticated, requireAdmin, async (req, res) => {
    await storage.deleteZone(Number(req.params.id));
    res.status(204).send();
  });

  // === Earnings ===
  app.get(api.earnings.list.path, isAuthenticated, requirePremium, async (req, res) => {
    const earnings = await storage.getEarnings((req.user as any).claims.sub);
    res.json(earnings);
  });

  app.get(api.earnings.stats.path, isAuthenticated, requirePremium, async (req, res) => {
    const stats = await storage.getEarningsStats((req.user as any).claims.sub);
    res.json({
        ...stats,
        topZones: []
    });
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post(api.earnings.upload.path, isAuthenticated, requirePremium, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const userId = (req.user as any).claims.sub;

    try {
      let csvText = req.file.buffer.toString("utf-8");
      if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ",",
        quote: '"',
        relax_column_count: true,
        bom: true,
      }) as Record<string, string>[];

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        try {
          const row = records[i];
          const parsed = parseEarningsRow(row, userId);
          if (parsed) {
            await storage.createEarning(parsed);
            processed++;
          } else {
            failed++;
            errors.push(`Row ${i + 2}: Could not parse row data`);
          }
        } catch (rowErr: any) {
          failed++;
          errors.push(`Row ${i + 2}: ${rowErr.message}`);
        }
      }

      res.json({ processed, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      console.error("CSV parse error:", err);
      res.status(400).json({ message: `Failed to parse CSV: ${err.message}` });
    }
  });

  // === POIs ===
  app.get(api.pois.list.path, async (req, res) => {
    const pois = await storage.getPois();
    res.json(pois);
  });

  app.post(api.pois.create.path, isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const input = insertPoiSchema.parse(req.body);
      const poi = await storage.createPoi(input);
      res.status(201).json(poi);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // === Recommendations ===
  app.get(api.recommendations.list.path, async (req, res) => {
    const [allZones, allPois] = await Promise.all([
      storage.getZones(),
      storage.getPois(),
    ]);
    const recs = generateRecommendations(allZones, allPois);
    const saved: any[] = [];
    await storage.clearRecommendations();
    for (const rec of recs) {
      const s = await storage.createRecommendation(rec);
      saved.push(s);
    }
    res.json(saved);
  });

  app.post(api.recommendations.generate.path, isAuthenticated, requireAdmin, async (req, res) => {
    const [allZones, allPois] = await Promise.all([
      storage.getZones(),
      storage.getPois(),
    ]);
    const recs = generateRecommendations(allZones, allPois);
    await storage.clearRecommendations();
    const saved: any[] = [];
    for (const rec of recs) {
      const s = await storage.createRecommendation(rec);
      saved.push(s);
    }
    res.json({ message: "Recommendations generated", count: saved.length });
  });

  app.get("/api/arrivals-windows", async (_req, res) => {
    const estimate = getArrivalsWindowEstimate();
    res.json(estimate);
  });

  app.get("/api/flight-windows", async (_req, res) => {
    const { getAllFlightWindows } = await import("./recommendationEngine");
    const data = getAllFlightWindows();
    res.json(data);
  });

  app.get("/api/airport-flights", async (_req, res) => {
    const { getKrakowAirportFlights } = await import("./krakowAirportScraper");
    const data = await getKrakowAirportFlights();
    res.json(data);
  });

  app.get("/api/strategic-advice", async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: "lat and lng query params required" });
    }

    const [allZones, allPois] = await Promise.all([
      storage.getZones(),
      storage.getPois(),
    ]);

    const advice = generateLocationAwareAdvice(lat, lng, allZones, allPois);
    res.json(advice);
  });

  // === Active Events ===
  app.get("/api/active-events", async (_req, res) => {
    const events = getActiveEvents();
    res.json(events.map(e => ({
      title: e.event.title,
      venue: e.event.venueName,
      venueKey: e.event.venueKey,
      status: e.status,
      minutesUntilSurge: e.minutesUntilSurge,
      surgeTip: e.surgeTip,
      crowdSize: e.event.expectedCrowdSize,
      surgeMultiplier: e.event.surgeMultiplier,
      source: e.event.source,
    })));
  });

  // === Krakow Events (Unified Schema) ===
  app.get("/api/krakow-events", (_req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    const events = getAllCachedEvents();
    const meta = getEventsCacheMeta();
    res.json({
      events: events.map(e => ({
        id: e.id,
        name: e.title,
        category: e.category,
        venue_name: e.venueName,
        expected_attendance: null,
        source: e.source,
        start_time: e.startDate.toISOString(),
        end_time: e.endDate?.toISOString() ?? null,
      })),
      last_refresh: meta.lastFetchedAt,
    });
  });

  app.post("/api/krakow-events/refresh", isAuthenticated, requireAdmin, async (_req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    try {
      const beforeCount = getAllCachedEvents().length;
      await refreshEvents();
      const afterCount = getAllCachedEvents().length;
      const meta = getEventsCacheMeta();
      res.json({
        refreshed: afterCount,
        delta: afterCount - beforeCount,
        last_refresh: meta.lastFetchedAt,
        failed: meta.lastFetchFailed,
      });
    } catch (err) {
      console.error("[Krakow Events Refresh]", err);
      res.status(500).json({ error: "Refresh failed", message: String(err) });
    }
  });

  // === Integral Intelligence API (multi-source + confidence) ===
  app.get("/api/intelligence/integral", async (req, res) => {
    const EVENTS_FRESH_TTL_MS = 6 * 60 * 60 * 1000;
    const AIRPORT_FRESH_TTL_MS = 30 * 60 * 1000;

    const asSingle = (v: unknown): string | undefined =>
      Array.isArray(v) ? v[0] : typeof v === "string" ? v : undefined;

    const forceRefresh = asSingle(req.query.forceRefresh) === "true";
    const hourRaw = asSingle(req.query.hour);
    const latRaw = asSingle(req.query.lat);
    const lngRaw = asSingle(req.query.lng);

    const hour = hourRaw !== undefined ? parseInt(hourRaw, 10) : undefined;
    const lat = latRaw !== undefined ? parseFloat(latRaw) : undefined;
    const lng = lngRaw !== undefined ? parseFloat(lngRaw) : undefined;

    if (hour !== undefined && (Number.isNaN(hour) || hour < 0 || hour > 23)) {
      return res.status(400).json({ message: "hour must be an integer between 0 and 23" });
    }
    if ((lat !== undefined && Number.isNaN(lat)) || (lng !== undefined && Number.isNaN(lng))) {
      return res.status(400).json({ message: "lat/lng must be valid numbers" });
    }

    const warnings: string[] = [];
    if (forceRefresh) {
      clearAirportCache();
      try {
        await refreshEvents();
      } catch (err) {
        console.warn("[integral-intelligence] Failed to refresh events", err);
        warnings.push("events_refresh_failed");
      }
    }

    let flights;
    try {
      flights = await getKrakowAirportFlights();
    } catch (err) {
      console.warn("[integral-intelligence] Failed to fetch airport flights", err);
      warnings.push("airport_flights_failed");
      flights = { arrivals: [], departures: [] };
    }

    const [allZones, allPois] = await Promise.all([
      storage.getZones(),
      storage.getPois(),
    ]);

    const arrivalsWindows = getArrivalsWindowEstimate();
    const activeEvents = getActiveEvents();
    const popularRoutes = getPopularRoutes({ hour, lat, lng });
    const topRoutes = [...popularRoutes]
      .sort((a, b) => b.plnPerMin - a.plnPerMin)
      .slice(0, 5);
    const zoneHeat = getZoneProfitHeat(allZones, allPois, 0, 0);

    const eventsMeta = getEventsCacheMeta();
    const airportMeta = getAirportCacheMeta();
    const eventsAgeMs = typeof eventsMeta.lastFetchedAt === "number" ? Date.now() - eventsMeta.lastFetchedAt : null;
    const eventsFresh = typeof eventsAgeMs === "number"
      ? eventsAgeMs <= EVENTS_FRESH_TTL_MS
      : false;
    const airportFresh = typeof airportMeta.cacheAgeMs === "number"
      ? airportMeta.cacheAgeMs <= AIRPORT_FRESH_TTL_MS
      : false;

    const signals = [
      { key: "airportFlights", ok: flights.arrivals.length + flights.departures.length > 0, weight: 0.25 },
      { key: "activeEvents", ok: activeEvents.length > 0, weight: 0.15 },
      { key: "routeCoverage", ok: popularRoutes.length >= 10, weight: 0.15 },
      { key: "eventsFreshness", ok: eventsFresh && !eventsMeta.lastFetchFailed, weight: 0.15 },
      { key: "airportFreshness", ok: airportFresh, weight: 0.1 },
    ];

    const weightedOk = signals
      .filter((sig) => sig.ok)
      .reduce((sum, sig) => sum + sig.weight, 0);
    const confidenceScore = Math.round(weightedOk * 100);

    res.json({
      generatedAt: new Date().toISOString(),
      forceRefresh,
      query: { hour, lat, lng },
      warnings,
      confidence: {
        score: confidenceScore,
        label: confidenceScore >= 85 ? "high" : confidenceScore >= 60 ? "medium" : "low",
        signals,
      },
      freshness: {
        eventsLastFetchedAt: eventsMeta.lastFetchedAt,
        eventsAgeMs,
        eventsLastFetchFailed: eventsMeta.lastFetchFailed,
        eventsFresh,
        airportLastFetchedAt: airportMeta.lastFetchedAt,
        airportCacheAgeMs: airportMeta.cacheAgeMs,
        airportFresh,
      },
      counts: {
        arrivals: flights.arrivals.length,
        departures: flights.departures.length,
        activeEvents: activeEvents.length,
        popularRoutes: popularRoutes.length,
        heatZones: zoneHeat.zones.length,
      },
      data: {
        flights,
        arrivalsWindows,
        activeEvents: activeEvents.map((e) => ({
          title: e.event.title,
          venue: e.event.venueName,
          status: e.status,
          surgeMultiplier: e.event.surgeMultiplier,
          source: e.event.source,
        })),
        topRoutes,
        topHeatZones: [...zoneHeat.zones].sort((a, b) => b.profitScore - a.profitScore).slice(0, 5),
      },
    });
  });

  // === Zone Profit Heat ===
  app.get("/api/zone-profit-heat", async (req, res) => {
    const hoursAhead = req.query.hoursAhead ? parseFloat(req.query.hoursAhead as string) : 0;
    const minutesAhead = req.query.minutesAhead ? parseFloat(req.query.minutesAhead as string) : 0;

    const [allZones, allPois] = await Promise.all([
      storage.getZones(),
      storage.getPois(),
    ]);

    const heat = getZoneProfitHeat(allZones, allPois, hoursAhead, minutesAhead);
    res.json(heat);
  });

  // === Popular Routes ===
  app.get("/api/popular-routes", async (req, res) => {
    const hour = req.query.hour ? parseInt(req.query.hour as string) : undefined;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const routes = getPopularRoutes({ hour, lat, lng });
    res.json(routes);
  });

  // === Route Geometries (OSRM) ===
  app.get("/api/route-geometries", async (req, res) => {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const hour = req.query.hour ? parseInt(req.query.hour as string) : undefined;

    const routes = getPopularRoutes({ hour, lat, lng });

    const sortedByProfit = [...routes].sort((a, b) => b.plnPerMin - a.plnPerMin);

    const nearestProfitable = sortedByProfit[0];

    const topGreen = sortedByProfit.slice(1, 4);

    const allForGeometry = nearestProfitable
      ? [nearestProfitable, ...topGreen]
      : topGreen;

    const routeGeomRequests = allForGeometry.map(r => ({
      fromLat: r.fromLat,
      fromLng: r.fromLng,
      toLat: r.toLat,
      toLng: r.toLng,
    }));

    if (lat && lng && nearestProfitable) {
      routeGeomRequests.push({
        fromLat: lat,
        fromLng: lng,
        toLat: nearestProfitable.fromLat,
        toLng: nearestProfitable.fromLng,
      });
    }

    const geometries = await fetchMultipleRouteGeometries(routeGeomRequests);

    const result: any[] = allForGeometry.map((route, i) => ({
      id: route.id,
      fromShort: route.fromShort,
      toShort: route.toShort,
      estimatedPricePLN: route.estimatedPricePLN,
      plnPerMin: route.plnPerMin,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      role: i === 0 && nearestProfitable ? "nearest_profitable" : "top_route",
      geometry: geometries[i]?.coordinates || [
        [route.fromLat, route.fromLng],
        [route.toLat, route.toLng],
      ],
      realDistanceKm: geometries[i]
        ? Math.round(geometries[i].distanceMeters / 100) / 10
        : route.distanceKm,
      realDurationMin: geometries[i]
        ? Math.round(geometries[i].durationSeconds / 60)
        : route.durationMin,
    }));

    if (lat && lng && nearestProfitable) {
      const pickupGeomIdx = allForGeometry.length;
      const pickupGeom = geometries[pickupGeomIdx];
      if (pickupGeom && pickupGeom.coordinates.length > 1) {
        result.push({
          id: "drive-to-pickup",
          fromShort: "You",
          toShort: nearestProfitable.fromShort,
          estimatedPricePLN: 0,
          plnPerMin: 0,
          distanceKm: Math.round(pickupGeom.distanceMeters / 100) / 10,
          durationMin: Math.round(pickupGeom.durationSeconds / 60),
          role: "drive_to_pickup",
          geometry: pickupGeom.coordinates,
          realDistanceKm: Math.round(pickupGeom.distanceMeters / 100) / 10,
          realDurationMin: Math.round(pickupGeom.durationSeconds / 60),
        });
      }
    }

    res.json(result);
  });

  // === Map Data (Combined) ===
  app.get(api.map.data.path, async (req, res) => {
    const [allZones, allPois] = await Promise.all([
      storage.getZones(),
      storage.getPois(),
    ]);
    const recs = generateRecommendations(allZones, allPois);
    
    const heatmapPoints = allZones.map(z => ({ 
        lat: Number(z.lat), 
        lng: Number(z.lng), 
        weight: z.demandLevel === 'high' ? 1.0 : z.demandLevel === 'surge' ? 1.5 : 0.5 
    }));

    res.json({ zones: allZones, pois: allPois, recommendations: recs, heatmapPoints });
  });

  startEventsRefreshLoop();

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingZones = await storage.getZones();
  if (existingZones.length === 0) {
    console.log("Seeding database...");
    
    // Seed Zones
    await storage.createZone({
      name: "Kraków Airport (Balice)",
      type: "airport",
      lat: "50.0777",
      lng: "19.7848",
      radius: 2000,
      description: "Main international airport, high demand for pickups.",
      demandLevel: "high",
      surgeMultiplier: "1.5"
    });

    await storage.createZone({
      name: "Old Town (Rynek)",
      type: "center",
      lat: "50.0614",
      lng: "19.9366",
      radius: 1000,
      description: "Historical center, high tourist traffic.",
      demandLevel: "medium",
      surgeMultiplier: "1.2"
    });

    await storage.createZone({
      name: "Kazimierz",
      type: "nightlife",
      lat: "50.0526",
      lng: "19.9455",
      radius: 800,
      description: "Nightlife district, busy in evenings/weekends.",
      demandLevel: "medium",
      surgeMultiplier: "1.3"
    });

    await storage.createZone({
      name: "Kraków Główny Station",
      type: "station",
      lat: "50.0678",
      lng: "19.9470",
      radius: 600,
      description: "Main railway station and bus terminal. Commuters and travelers.",
      demandLevel: "high",
      surgeMultiplier: "1.3"
    });

    await storage.createZone({
      name: "Nowa Huta",
      type: "residential",
      lat: "50.0725",
      lng: "20.0375",
      radius: 2500,
      description: "Large residential district east of center. Morning/evening commuter demand.",
      demandLevel: "low",
      surgeMultiplier: "1.0"
    });

    await storage.createZone({
      name: "Galeria Krakowska & Bonarka",
      type: "mall",
      lat: "50.0669",
      lng: "19.9458",
      radius: 800,
      description: "Major shopping malls. Busy afternoons and weekends.",
      demandLevel: "medium",
      surgeMultiplier: "1.1"
    });

    await storage.createZone({
      name: "Tauron Arena",
      type: "event",
      lat: "50.0697",
      lng: "20.0108",
      radius: 1000,
      description: "Large event venue. Major surge when concerts and events end.",
      demandLevel: "low",
      surgeMultiplier: "1.0"
    });

    await storage.createZone({
      name: "Wawel & Planty Area",
      type: "tourism",
      lat: "50.0540",
      lng: "19.9354",
      radius: 1200,
      description: "Wawel Castle, Planty gardens, and tourist corridor. Daytime demand.",
      demandLevel: "medium",
      surgeMultiplier: "1.2"
    });

    // Seed POIs
    await storage.createPoi({
      name: "Wawel Royal Castle",
      category: "tourism",
      lat: "50.0540",
      lng: "19.9354",
      openingTime: "09:00",
      closingTime: "17:00",
      popularityScore: 10,
      description: "Major tourist attraction."
    });

    await storage.createPoi({
      name: "Schindler's Factory",
      category: "tourism",
      lat: "50.0474",
      lng: "19.9618",
      openingTime: "10:00",
      closingTime: "18:00",
      popularityScore: 9,
      description: "Popular museum."
    });
    
    // Seed Recommendations
    const airport = (await storage.getZones()).find(z => z.type === 'airport');
    if (airport) {
        await storage.createRecommendation({
            action: "MOVE",
            reason: "Incoming flights surge expected in 30 mins.",
            targetZoneId: airport.id,
            priority: 10
        });
    }

    console.log("Database seeded!");
  }
}

function parseGermanDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return new Date(
    parseInt(year), parseInt(month) - 1, parseInt(day),
    parseInt(hour), parseInt(minute)
  );
}

function parseDecimal(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(",", ".").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num.toString();
}

function findColumn(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    const key = Object.keys(row).find(k => k.toLowerCase().includes(c.toLowerCase()));
    if (key && row[key] !== undefined) return row[key];
  }
  return "";
}

function parseEarningsRow(row: Record<string, string>, userId: string): InsertEarning | null {
  const totalStr = findColumn(row, "Preis gesamt", "Total", "Gesamt");
  const netStr = findColumn(row, "Preis (ohne", "Price (excl", "Net");
  const amountStr = parseDecimal(totalStr) || parseDecimal(netStr);
  if (!amountStr) return null;

  const tripDateStr = findColumn(row, "Datum der Fahrt", "Trip date", "Ride date");
  const invoiceDateStr = findColumn(row, "Datum");
  const tripDate = parseGermanDate(tripDateStr) || parseGermanDate(invoiceDateStr);
  if (!tripDate) return null;

  const pickup = findColumn(row, "Abholadresse", "Pickup", "Pick-up");
  const paymentMethod = findColumn(row, "Zahlungsart", "Payment");
  const passenger = findColumn(row, "Empfänger", "Recipient", "Passenger");
  const invoiceNo = findColumn(row, "Rechnungs-Nr", "Invoice");

  return {
    userId,
    pickupAddress: pickup || null,
    pickupLat: null,
    pickupLng: null,
    dropoffAddress: null,
    dropoffLat: null,
    dropoffLng: null,
    amount: amountStr,
    currency: "PLN",
    tripDate,
    durationMinutes: null,
    distanceKm: null,
    source: "csv",
    originalRowData: {
      invoiceNo,
      paymentMethod,
      passenger,
      net: parseDecimal(netStr),
      vat: parseDecimal(findColumn(row, "MwSt", "VAT", "Tax")),
      total: amountStr,
    },
  };
}
