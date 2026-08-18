import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated, authStorage } from "./auth";
import { db } from "./db";
import { extractFleetPatterns, generateFleetGuidance, getFleetLeaderboard, getFleetPatterns, ingestSanitizedTrips } from "./fleetLearning";
import { getSubscriptionStatus } from "./subscriptionService";
import { fleetProfiles, fleets } from "@shared/fleetSchema";

const GEOHASH = /^[0123456789bcdefghjkmnpqrstuvwxyz]{5,7}$/;
const uploadSchema = z.object({
  fleetId: z.string().uuid(), anonymousDriverId: z.string().uuid(), displayName: z.string().regex(/^Kierowca [A-F0-9]{6}$/), payloadDigest: z.string().regex(/^[a-f0-9]{64}$/),
  trips: z.array(z.object({ tripId: z.string().uuid(), pickupGeohash: z.string().regex(GEOHASH), dropoffGeohash: z.string().regex(GEOHASH), startEpoch: z.number().int().min(1_577_836_800).max(2_147_483_647), netIncome: z.number().positive().max(100_000), distanceKm: z.number().positive().max(500).optional(), timeSlot: z.number().int().min(0).max(23), dayOfWeek: z.number().int().min(0).max(6) }).strict()).min(1).max(1_500),
}).strict();
const createFleetSchema = z.object({ name: z.string().trim().min(2).max(200) }).strict();
const rate = new Map<string, number[]>();
const userId = (request: any) => String(request.user?.id ?? request.user?.claims?.sub ?? "");

const requireFleetPremium: RequestHandler = async (request: any, response, next) => {
  if (!request.isAuthenticated() || !userId(request)) return response.status(401).json({ message: "Unauthorized" });
  const user = await authStorage.getUser(userId(request));
  if (!user || !["approved", "active"].includes(user.status ?? "")) return response.status(403).json({ message: "Approved account required" });
  if (!getSubscriptionStatus(user).isPremium) return response.status(403).json({ message: "Premium subscription required" });
  response.locals.fleetUser = user; next();
};

async function ownedFleet(request: any, fleetId: string) {
  return (await db.select().from(fleets).where(and(eq(fleets.id, fleetId), eq(fleets.ownerUserId, userId(request)))).limit(1))[0] ?? null;
}

function permitUpload(identity: string) {
  const now = Date.now(), recent = (rate.get(identity) ?? []).filter((value) => now - value < 15 * 60_000);
  if (recent.length >= 40) return false;
  recent.push(now); rate.set(identity, recent); return true;
}

export function registerFleetRoutes(app: Express) {
  app.get("/api/fleet/me", isAuthenticated, requireFleetPremium, async (request: any, response, next) => {
    try { response.json((await db.select().from(fleets).where(eq(fleets.ownerUserId, userId(request))).limit(1))[0] ?? null); } catch (error) { next(error); }
  });

  app.post("/api/fleet", isAuthenticated, requireFleetPremium, async (request: any, response, next) => {
    try {
      const user = response.locals.fleetUser;
      if (user.role !== "admin" && user.accountType !== "provider") return response.status(403).json({ message: "Fleet provider account required" });
      const input = createFleetSchema.parse(request.body);
      const existing = (await db.select().from(fleets).where(eq(fleets.ownerUserId, userId(request))).limit(1))[0];
      if (existing) return response.json(existing);
      return response.status(201).json((await db.insert(fleets).values({ name: input.name, ownerUserId: userId(request) }).returning())[0]);
    } catch (error) { next(error); }
  });

  app.post("/api/fleet/upload", isAuthenticated, requireFleetPremium, async (request: any, response, next) => {
    try {
      if (!permitUpload(userId(request))) return response.status(429).json({ message: "Upload limit reached. Try again later." });
      const input = uploadSchema.parse(request.body);
      if (!(await ownedFleet(request, input.fleetId))) return response.status(404).json({ message: "Fleet not found" });
      const digest = crypto.createHash("sha256").update(JSON.stringify(input.trips)).digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(input.payloadDigest, "hex"))) return response.status(400).json({ message: "Payload integrity check failed" });
      const result = await ingestSanitizedTrips(input.fleetId, userId(request), input.anonymousDriverId, input.displayName, input.trips);
      response.status(201).json(result);
    } catch (error) { next(error); }
  });

  app.post("/api/fleet/:fleetId/patterns/extract", isAuthenticated, requireFleetPremium, async (request: any, response, next) => {
    try { if (!(await ownedFleet(request, request.params.fleetId))) return response.status(404).json({ message: "Fleet not found" }); const patterns = await extractFleetPatterns(request.params.fleetId); response.json({ patterns, count: patterns.length }); } catch (error) { next(error); }
  });
  app.get("/api/fleet/:fleetId/leaderboard", isAuthenticated, requireFleetPremium, async (request: any, response, next) => {
    try { if (!(await ownedFleet(request, request.params.fleetId))) return response.status(404).json({ message: "Fleet not found" }); response.json(await getFleetLeaderboard(request.params.fleetId)); } catch (error) { next(error); }
  });
  app.get("/api/fleet/:fleetId/patterns", isAuthenticated, requireFleetPremium, async (request: any, response, next) => {
    try { if (!(await ownedFleet(request, request.params.fleetId))) return response.status(404).json({ message: "Fleet not found" }); response.json({ patterns: await getFleetPatterns(request.params.fleetId) }); } catch (error) { next(error); }
  });
  app.get("/api/fleet/:fleetId/profile/:profileId/guidance", isAuthenticated, requireFleetPremium, async (request: any, response, next) => {
    try {
      const owner = await ownedFleet(request, request.params.fleetId);
      const ownProfile = (await db.select().from(fleetProfiles).where(and(eq(fleetProfiles.id, request.params.profileId), eq(fleetProfiles.fleetId, request.params.fleetId), eq(fleetProfiles.userId, userId(request)))).limit(1))[0];
      if (!owner && !ownProfile) return response.status(404).json({ message: "Fleet profile not found" });
      response.json(await generateFleetGuidance(request.params.fleetId, request.params.profileId));
    } catch (error) { next(error); }
  });
}
