import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { driverPatterns, fleetProfiles, sanitizedTrips } from "@shared/fleetSchema";
import type { DriverPatternDTO, DriverProfileDTO, FleetGuidanceDTO, SanitizedTrip } from "@shared/fleetTypes";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const MIN_LEADER_TRIPS = 20;
const MIN_PATTERN_TRIPS = 5;

function decodeGeohash(hash: string) {
  let even = true, minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  for (const character of hash.toLowerCase()) {
    const value = BASE32.indexOf(character);
    for (let bit = 4; bit >= 0; bit -= 1) {
      const active = (value >> bit) & 1;
      if (even) { const middle = (minLng + maxLng) / 2; if (active) minLng = middle; else maxLng = middle; }
      else { const middle = (minLat + maxLat) / 2; if (active) minLat = middle; else maxLat = middle; }
      even = !even;
    }
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

function haversineKm(left: { lat: number; lng: number }, right: { lat: number; lng: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitude = radians(right.lat - left.lat), longitude = radians(right.lng - left.lng);
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(radians(left.lat)) * Math.cos(radians(right.lat)) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function recalculateFleetProfiles(fleetId: string) {
  const profiles = await db.select().from(fleetProfiles).where(eq(fleetProfiles.fleetId, fleetId));
  const calculated: { id: string; average: number; count: number }[] = [];
  for (const profile of profiles) {
    const rows = await db.select({ value: sanitizedTrips.earningsPerKm }).from(sanitizedTrips).where(eq(sanitizedTrips.fleetProfileId, profile.id));
    const values = rows.map((row: { value: string }) => Number(row.value)).filter(Number.isFinite);
    calculated.push({ id: profile.id, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0, count: values.length });
  }
  calculated.sort((left, right) => right.average - left.average);
  for (let index = 0; index < calculated.length; index += 1) {
    const profile = calculated[index]!;
    const percentileRank = calculated.length === 1 ? 100 : Math.round((1 - index / (calculated.length - 1)) * 100);
    await db.update(fleetProfiles).set({ avgEarningsPerKm: profile.average.toFixed(4), totalTripsAnalyzed: profile.count, percentileRank, isLeaderDriver: profile.count >= MIN_LEADER_TRIPS && percentileRank >= 75 }).where(eq(fleetProfiles.id, profile.id));
  }
}

export async function ingestSanitizedTrips(fleetId: string, userId: string, anonymousDriverId: string, displayName: string, trips: SanitizedTrip[]) {
  const existing = await db.select().from(fleetProfiles).where(and(eq(fleetProfiles.fleetId, fleetId), eq(fleetProfiles.anonymousDriverId, anonymousDriverId))).limit(1);
  const profile = existing[0] ?? (await db.insert(fleetProfiles).values({ fleetId, userId, anonymousDriverId, displayName }).returning())[0];
  if (!profile) throw new Error("Could not create fleet profile");

  const rows = trips.flatMap((trip) => {
    const calculatedDistance = trip.distanceKm ?? haversineKm(decodeGeohash(trip.pickupGeohash), decodeGeohash(trip.dropoffGeohash));
    if (!Number.isFinite(calculatedDistance) || calculatedDistance < 0.1 || calculatedDistance > 500) return [];
    return [{ fleetProfileId: profile.id, tripId: trip.tripId, pickupGeohash: trip.pickupGeohash, dropoffGeohash: trip.dropoffGeohash, startEpoch: trip.startEpoch, netIncome: trip.netIncome.toFixed(2), distanceKm: calculatedDistance.toFixed(2), earningsPerKm: (trip.netIncome / calculatedDistance).toFixed(4), timeSlot: trip.timeSlot, dayOfWeek: trip.dayOfWeek }];
  });
  let processed = 0;
  for (let index = 0; index < rows.length; index += 250) {
    const inserted = await db.insert(sanitizedTrips).values(rows.slice(index, index + 250)).onConflictDoNothing().returning({ id: sanitizedTrips.id });
    processed += inserted.length;
  }
  return { profileId: profile.id, processed, rejected: trips.length - rows.length };
}

export async function extractFleetPatterns(fleetId: string): Promise<DriverPatternDTO[]> {
  await recalculateFleetProfiles(fleetId);
  const leaders = await db.select({ id: fleetProfiles.id }).from(fleetProfiles).where(and(eq(fleetProfiles.fleetId, fleetId), eq(fleetProfiles.isLeaderDriver, true)));
  if (!leaders.length) {
    await db.delete(driverPatterns).where(eq(driverPatterns.fleetId, fleetId));
    return [];
  }
  const rows = await db.select().from(sanitizedTrips).where(inArray(sanitizedTrips.fleetProfileId, leaders.map((leader: { id: string }) => leader.id)));
  const groups = new Map<string, { zoneGeohash: string; timeSlot: number; dayOfWeek: number; values: number[] }>();
  const zoneTotals = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.pickupGeohash}:${row.timeSlot}:${row.dayOfWeek}`;
    const group = groups.get(key) ?? { zoneGeohash: row.pickupGeohash, timeSlot: row.timeSlot, dayOfWeek: row.dayOfWeek, values: [] };
    group.values.push(Number(row.earningsPerKm)); groups.set(key, group);
    zoneTotals.set(row.pickupGeohash, (zoneTotals.get(row.pickupGeohash) ?? 0) + 1);
  }
  const patterns = [...groups.values()].filter((group) => group.values.length >= MIN_PATTERN_TRIPS).map((group) => ({
    zoneGeohash: group.zoneGeohash, timeSlot: group.timeSlot, dayOfWeek: group.dayOfWeek,
    avgEarningsPerKm: Math.round(group.values.reduce((sum, value) => sum + value, 0) / group.values.length * 20) / 20,
    tripCount: group.values.length, leaderPercentage: Math.round(group.values.length / (zoneTotals.get(group.zoneGeohash) ?? group.values.length) * 100),
  })).sort((left, right) => right.avgEarningsPerKm - left.avgEarningsPerKm);
  await db.delete(driverPatterns).where(eq(driverPatterns.fleetId, fleetId));
  if (patterns.length) await db.insert(driverPatterns).values(patterns.map((pattern) => ({ fleetId, ...pattern, avgEarningsPerKm: pattern.avgEarningsPerKm.toFixed(4), leaderPercentage: pattern.leaderPercentage.toFixed(2) })));
  return patterns;
}

export async function getFleetLeaderboard(fleetId: string): Promise<DriverProfileDTO[]> {
  const profiles = await db.select().from(fleetProfiles).where(eq(fleetProfiles.fleetId, fleetId)).orderBy(desc(fleetProfiles.avgEarningsPerKm));
  return profiles.map((profile: typeof fleetProfiles.$inferSelect) => ({ id: profile.id, anonymousDriverId: profile.anonymousDriverId, displayName: profile.displayName, isLeaderDriver: profile.isLeaderDriver, avgEarningsPerKm: Number(profile.avgEarningsPerKm ?? 0), percentileRank: profile.percentileRank ?? 0, totalTripsAnalyzed: profile.totalTripsAnalyzed }));
}

export async function getFleetPatterns(fleetId: string): Promise<DriverPatternDTO[]> {
  const patterns = await db.select().from(driverPatterns).where(eq(driverPatterns.fleetId, fleetId)).orderBy(desc(driverPatterns.avgEarningsPerKm));
  return patterns.map((pattern: typeof driverPatterns.$inferSelect) => ({ zoneGeohash: pattern.zoneGeohash, timeSlot: pattern.timeSlot, dayOfWeek: pattern.dayOfWeek, avgEarningsPerKm: Number(pattern.avgEarningsPerKm), tripCount: pattern.tripCount, leaderPercentage: Number(pattern.leaderPercentage) }));
}

export async function generateFleetGuidance(fleetId: string, profileId: string, now = new Date()): Promise<FleetGuidanceDTO[]> {
  const profile = (await db.select().from(fleetProfiles).where(and(eq(fleetProfiles.id, profileId), eq(fleetProfiles.fleetId, fleetId))).limit(1))[0];
  if (!profile) return [];
  const patterns = (await getFleetPatterns(fleetId)).filter((pattern) => pattern.timeSlot === now.getHours() && pattern.dayOfWeek === now.getDay()).slice(0, 3);
  const ownAverage = Number(profile.avgEarningsPerKm ?? 0);
  return patterns.map((pattern, index) => { const gain = ownAverage > 0 ? Math.max(0, Math.round((pattern.avgEarningsPerKm - ownAverage) / ownAverage * 100)) : 0; return { type: index === 0 ? "LEADER_ZONE_DETECTED" : "PATTERN_SUGGESTION", priority: index === 0 ? "high" : "medium", title: `Jedź w stronę strefy ${pattern.zoneGeohash}`, body: `Najlepsi kierowcy floty osiągają tu średnio ${pattern.avgEarningsPerKm.toFixed(2)} PLN/km o tej porze.`, zoneGeohash: pattern.zoneGeohash, estimatedGainPct: gain } as FleetGuidanceDTO; });
}
