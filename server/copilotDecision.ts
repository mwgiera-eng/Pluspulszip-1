import type {
  CopilotMode,
  CopilotAction,
  CopilotRecommendation,
  ConfidenceComposition,
  DataSourceStatus,
  MicroZoneDemand,
  ShiftPhase,
  MicroZone,
} from "../shared/copilot";
import { ACTION_COOLDOWNS, getDemandLabel, distanceBetween } from "../shared/copilot";
import { signalService } from "./signals";
import { getCurrentPhase, getMinutesRemainingInPhase } from "./copilotPhases";
import { MICRO_ZONES } from "./copilotData";

interface LastRecommendation {
  action: CopilotAction;
  generatedAt: number;
  stableUntil: number;
  targetLat?: number;
  targetLng?: number;
}

const userLastRecommendations = new Map<string, LastRecommendation>();

export function calculateConfidence(
  signals: DataSourceStatus[],
  clarityGap: number,
  phase: ShiftPhase
): ConfidenceComposition {
  const freshCount = signals.filter((s) => s.isFresh).length;
  const totalCount = signals.length;
  const sourceFreshness = Math.round((freshCount / Math.max(totalCount, 1)) * 40);

  const recommendationClarity = Math.round(Math.min(clarityGap, 1) * 30);

  const availableCount = signals.filter((s) => s.isAvailable).length;
  const dataCompleteness = Math.round((availableCount / Math.max(totalCount, 1)) * 20);

  const phaseConfidence = phase.earningsPotentialLabel === "high" ? 10 : phase.earningsPotentialLabel === "moderate" ? 7 : 4;
  const phaseCertainty = phaseConfidence;

  const total = sourceFreshness + recommendationClarity + dataCompleteness + phaseCertainty;

  return {
    sourceFreshness,
    recommendationClarity,
    dataCompleteness,
    phaseCertainty,
    total,
  };
}

export function determineMode(signals: DataSourceStatus[], hasGps: boolean): CopilotMode {
  if (!hasGps) {
    return "heuristic_only";
  }

  const freshSources = signals.filter((s) => s.isFresh);
  const keySources = ["zone_heat", "gps_location", "events"];
  const keyFresh = freshSources.filter((s) => keySources.includes(s.sourceId));

  if (keyFresh.length >= 2 && freshSources.length >= 4) {
    return "full_live";
  }

  if (freshSources.length >= 2) {
    return "partial_live";
  }

  return "heuristic_only";
}

export function estimateMicroZoneDemand(
  hour: number,
  isWeekend: boolean,
  isRaining: boolean,
  activeEventNearbyZoneIds: string[],
  flightWaveActive: boolean
): MicroZoneDemand[] {
  return MICRO_ZONES.map((zone) => {
    const baseDemand = isWeekend
      ? zone.weekendDemandByHour[hour] ?? 0
      : zone.weekdayDemandByHour[hour] ?? 0;

    let adjustedDemand = baseDemand;
    const influencedBy: import("../shared/copilot").DataSourceId[] = [];

    if (isRaining) {
      adjustedDemand *= zone.rainMultiplier;
      influencedBy.push("weather");
    }

    if (activeEventNearbyZoneIds.includes(zone.id)) {
      adjustedDemand += zone.eventSensitivity * 3;
      influencedBy.push("events");
    }

    if (flightWaveActive && zone.airportSensitivity > 0.3) {
      adjustedDemand += zone.airportSensitivity * 2;
      influencedBy.push("airport_flights");
    }

    adjustedDemand = Math.min(Math.max(adjustedDemand, 0), 10);

    return {
      microZoneId: zone.id,
      name: zone.name,
      currentDemand: Math.round(adjustedDemand * 10) / 10,
      demandLabel: getDemandLabel(adjustedDemand),
      influencedBy,
    };
  });
}

interface GenerateRecommendationParams {
  userId: string;
  driverLat: number | null;
  driverLng: number | null;
  phase: ShiftPhase;
  signals: DataSourceStatus[];
  zoneDemand: MicroZoneDemand[];
  idleMinutes: number;
  shiftDurationMin: number;
  activeEventEndingSoonWithin2km: { name: string; minutesUntilEnd: number; lat: number; lng: number } | null;
  flightWaveIn30Min: { minutesUntil: number; lat: number; lng: number } | null;
  phaseJustChanged: boolean;
  hasActiveLoop: boolean;
}

export function generateRecommendation(params: GenerateRecommendationParams): CopilotRecommendation {
  const {
    userId,
    driverLat,
    driverLng,
    phase,
    signals,
    zoneDemand,
    idleMinutes,
    activeEventEndingSoonWithin2km,
    flightWaveIn30Min,
    phaseJustChanged,
    hasActiveLoop,
  } = params;

  const now = Date.now();
  const lastRec = userLastRecommendations.get(userId);

  if (lastRec && now < lastRec.stableUntil && !phaseJustChanged) {
    const cooldownRemainingMs = lastRec.stableUntil - now;
    return buildRecommendation(
      lastRec.action,
      "Previous recommendation still active (cooldown period).",
      signals,
      phase,
      0.5,
      lastRec.targetLat,
      lastRec.targetLng,
      undefined,
      cooldownRemainingMs
    );
  }

  const mode = determineMode(signals, driverLat !== null);

  if (mode === "heuristic_only") {
    const rec = buildRecommendation(
      "HOLD",
      `Limited data available. Based on ${phase.displayName} phase, stay in ${phase.optimalZoneTypes.join(" or ")} zones. Monitor for improved data connectivity.`,
      signals,
      phase,
      0.2
    );
    storeLastRecommendation(userId, rec, "HOLD");
    return rec;
  }

  if (activeEventEndingSoonWithin2km && activeEventEndingSoonWithin2km.minutesUntilEnd <= 10) {
    const rec = buildRecommendation(
      "PREP_EVENT_EXIT",
      `${activeEventEndingSoonWithin2km.name} ending in ~${activeEventEndingSoonWithin2km.minutesUntilEnd} min. Position at exit roads for surge window.`,
      signals,
      phase,
      0.85,
      activeEventEndingSoonWithin2km.lat,
      activeEventEndingSoonWithin2km.lng,
      activeEventEndingSoonWithin2km.name
    );
    storeLastRecommendation(userId, rec, "PREP_EVENT_EXIT");
    return rec;
  }

  if (flightWaveIn30Min && driverLat !== null && driverLng !== null) {
    const distToAirport = distanceBetween(driverLat, driverLng, flightWaveIn30Min.lat, flightWaveIn30Min.lng);
    if (distToAirport < 10000) {
      const rec = buildRecommendation(
        "PREP_AIRPORT",
        `Flight arrivals expected in ~${flightWaveIn30Min.minutesUntil} min. Position at airport feeder zone for first-wave pickups.`,
        signals,
        phase,
        0.75,
        flightWaveIn30Min.lat,
        flightWaveIn30Min.lng,
        "Airport Feeder Zone"
      );
      storeLastRecommendation(userId, rec, "PREP_AIRPORT");
      return rec;
    }
  }

  if (idleMinutes > 10 && driverLat !== null && driverLng !== null) {
    const bestZone = findBestNearbyZone(driverLat, driverLng, zoneDemand);
    if (bestZone) {
      const zone = MICRO_ZONES.find((z) => z.id === bestZone.microZoneId);
      if (zone) {
        const dist = distanceBetween(driverLat, driverLng, zone.lat, zone.lng);
        if (dist > 300) {
          const rec = buildRecommendation(
            "REPOSITION",
            `Idle for ${idleMinutes} min. ${bestZone.name} has ${bestZone.demandLabel} demand (${Math.round(dist / 1000 * 10) / 10} km away). Repositioning could reduce idle time.`,
            signals,
            phase,
            0.7,
            zone.lat,
            zone.lng,
            zone.name
          );
          storeLastRecommendation(userId, rec, "REPOSITION");
          return rec;
        }
      }
    }
  }

  if (driverLat !== null && driverLng !== null) {
    const currentZoneDemand = findCurrentZoneDemand(driverLat, driverLng, zoneDemand);
    if (currentZoneDemand && (currentZoneDemand.demandLabel === "dead" || currentZoneDemand.demandLabel === "low")) {
      const currentZone = MICRO_ZONES.find((z) => z.id === currentZoneDemand.microZoneId);
      if (currentZone && currentZone.oversupplyRisk === "high") {
        const bestZone = findBestNearbyZone(driverLat, driverLng, zoneDemand);
        if (bestZone) {
          const zone = MICRO_ZONES.find((z) => z.id === bestZone.microZoneId);
          if (zone) {
            const rec = buildRecommendation(
              "REPOSITION",
              `Current zone (${currentZoneDemand.name}) is oversupplied with ${currentZoneDemand.demandLabel} demand. ${bestZone.name} has better conditions.`,
              signals,
              phase,
              0.6,
              zone.lat,
              zone.lng,
              zone.name
            );
            storeLastRecommendation(userId, rec, "REPOSITION");
            return rec;
          }
        }
      }
    }
  }

  if (hasActiveLoop) {
    const rec = buildRecommendation(
      "HOLD",
      `Continue active loop. ${phase.displayName} phase suits current route. Follow waypoint guidance.`,
      signals,
      phase,
      0.6
    );
    storeLastRecommendation(userId, rec, "HOLD");
    return rec;
  }

  const rec = buildRecommendation(
    "HOLD",
    `Stay in current area. ${phase.displayName} phase with ${phase.earningsPotentialLabel} earning potential. Monitor for ride opportunities.`,
    signals,
    phase,
    0.5
  );
  storeLastRecommendation(userId, rec, "HOLD");
  return rec;
}

function buildRecommendation(
  action: CopilotAction,
  reason: string,
  signals: DataSourceStatus[],
  phase: ShiftPhase,
  clarityGap: number,
  targetLat?: number,
  targetLng?: number,
  targetName?: string,
  remainingCooldownMs?: number
): CopilotRecommendation {
  const confidence = calculateConfidence(signals, clarityGap, phase);
  const now = new Date();
  const cooldownMin = ACTION_COOLDOWNS[action];
  const stableUntil = remainingCooldownMs
    ? new Date(now.getTime() + remainingCooldownMs)
    : new Date(now.getTime() + cooldownMin * 60 * 1000);

  return {
    action,
    reason,
    confidence,
    targetLat,
    targetLng,
    targetName,
    dataSources: signals,
    generatedAt: now.toISOString(),
    stableUntil: stableUntil.toISOString(),
  };
}

function storeLastRecommendation(userId: string, rec: CopilotRecommendation, action: CopilotAction): void {
  userLastRecommendations.set(userId, {
    action,
    generatedAt: Date.now(),
    stableUntil: new Date(rec.stableUntil).getTime(),
    targetLat: rec.targetLat,
    targetLng: rec.targetLng,
  });
}

function findBestNearbyZone(
  driverLat: number,
  driverLng: number,
  zoneDemand: MicroZoneDemand[]
): MicroZoneDemand | null {
  const zonesWithDistance = zoneDemand
    .map((zd) => {
      const zone = MICRO_ZONES.find((z) => z.id === zd.microZoneId);
      if (!zone) return null;
      const dist = distanceBetween(driverLat, driverLng, zone.lat, zone.lng);
      return { ...zd, dist };
    })
    .filter((z): z is MicroZoneDemand & { dist: number } => z !== null)
    .filter((z) => z.dist > 200 && z.dist < 8000)
    .sort((a, b) => {
      const scoreA = a.currentDemand - a.dist / 2000;
      const scoreB = b.currentDemand - b.dist / 2000;
      return scoreB - scoreA;
    });

  return zonesWithDistance[0] ?? null;
}

function findCurrentZoneDemand(
  driverLat: number,
  driverLng: number,
  zoneDemand: MicroZoneDemand[]
): MicroZoneDemand | null {
  let closest: { demand: MicroZoneDemand; dist: number } | null = null;

  for (const zd of zoneDemand) {
    const zone = MICRO_ZONES.find((z) => z.id === zd.microZoneId);
    if (!zone) continue;
    const dist = distanceBetween(driverLat, driverLng, zone.lat, zone.lng);
    if (!closest || dist < closest.dist) {
      closest = { demand: zd, dist };
    }
  }

  if (closest && closest.dist < 1000) {
    return closest.demand;
  }

  return null;
}

export function clearUserRecommendation(userId: string): void {
  userLastRecommendations.delete(userId);
}
