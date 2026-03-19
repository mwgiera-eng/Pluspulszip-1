import type { TrapDefinition, ShiftPhase } from "../shared/copilot";
import { distanceBetween } from "../shared/copilot";
import { GEOGRAPHIC_TRAPS, BEHAVIORAL_TRAPS, TEMPORAL_TRAPS } from "./copilotData";

const GEOGRAPHIC_PROXIMITY_M = 500;

export function detectGeographicTraps(
  driverLat: number,
  driverLng: number,
  currentPhase: ShiftPhase
): TrapDefinition[] {
  return GEOGRAPHIC_TRAPS.filter((trap) => {
    if (trap.lat === undefined || trap.lng === undefined) return false;

    const dist = distanceBetween(driverLat, driverLng, trap.lat, trap.lng);
    if (dist > GEOGRAPHIC_PROXIMITY_M) return false;

    if (trap.relevantPhases.length > 0 && !trap.relevantPhases.includes(currentPhase.id)) {
      return false;
    }

    return true;
  });
}

interface ShiftStats {
  idleMinutes: number;
  durationMin: number;
  rideCount: number;
}

interface RecentRecommendation {
  action: string;
  driverFollowed: boolean;
  createdAt: string;
}

interface RecentRide {
  score?: number;
  label?: string;
}

export function detectBehavioralTraps(
  shiftStats: ShiftStats | null,
  recentRecommendations: RecentRecommendation[],
  recentRideScores: RecentRide[],
  currentPhase: ShiftPhase,
  driverInOversuppliedZone: boolean
): TrapDefinition[] {
  const triggered: TrapDefinition[] = [];

  if (shiftStats && driverInOversuppliedZone && shiftStats.idleMinutes > 11) {
    const trap = BEHAVIORAL_TRAPS.find((t) => t.id === "trap_idle_oversupply");
    if (trap && trap.relevantPhases.includes(currentPhase.id)) {
      triggered.push(trap);
    }
  }

  if (shiftStats && shiftStats.durationMin > 0) {
    const isLateShift = shiftStats.durationMin >= 360;
    if (isLateShift) {
      const recentWeakOutbound = recentRideScores.filter(
        (r) => r.label === "weak" || r.label === "reject"
      );
      if (recentWeakOutbound.length >= 2) {
        const trap = BEHAVIORAL_TRAPS.find((t) => t.id === "trap_weak_outbound_final");
        if (trap && trap.relevantPhases.includes(currentPhase.id)) {
          triggered.push(trap);
        }
      }
    }
  }

  const repositionRecs = recentRecommendations.filter(
    (r) => r.action === "REPOSITION" || r.action === "SHIFT_TO_CORRIDOR"
  );
  const ignoredReposition = repositionRecs.filter((r) => !r.driverFollowed);
  if (ignoredReposition.length >= 2) {
    const trap = BEHAVIORAL_TRAPS.find((t) => t.id === "trap_ignoring_reposition");
    if (trap && trap.relevantPhases.includes(currentPhase.id)) {
      triggered.push(trap);
    }
  }

  const last3Rides = recentRideScores.slice(-3);
  if (last3Rides.length >= 3) {
    const allWeak = last3Rides.every(
      (r) => r.label === "reject" || r.label === "weak"
    );
    if (allWeak) {
      const trap = BEHAVIORAL_TRAPS.find((t) => t.id === "trap_consecutive_rejects");
      if (trap && trap.relevantPhases.includes(currentPhase.id)) {
        triggered.push(trap);
      }
    }
  }

  const loopRecs = recentRecommendations.filter(
    (r) => r.action === "HOLD" && r.driverFollowed === false
  );
  if (loopRecs.length >= 2) {
    const trap = BEHAVIORAL_TRAPS.find((t) => t.id === "trap_loop_abandonment");
    if (trap && trap.relevantPhases.includes(currentPhase.id)) {
      triggered.push(trap);
    }
  }

  return triggered;
}

export function detectTemporalTraps(
  hour: number,
  shiftDurationMin: number,
  currentPhase: ShiftPhase
): TrapDefinition[] {
  const triggered: TrapDefinition[] = [];

  if (hour >= 17 && hour < 19) {
    const trap = TEMPORAL_TRAPS.find((t) => t.id === "trap_early_evening_suburb");
    if (trap) {
      triggered.push(trap);
    }
  }

  if ((hour >= 7 && hour < 9) || (hour >= 16 && hour < 19)) {
    const trap = TEMPORAL_TRAPS.find((t) => t.id === "trap_surge_no_traffic_check");
    if (trap) {
      triggered.push(trap);
    }
  }

  if (shiftDurationMin >= 360) {
    const trap = TEMPORAL_TRAPS.find((t) => t.id === "trap_unprotected_final_hours");
    if (trap) {
      triggered.push(trap);
    }
  }

  return triggered;
}

export function detectAllTraps(
  driverLat: number | null,
  driverLng: number | null,
  currentPhase: ShiftPhase,
  hour: number,
  shiftStats: ShiftStats | null,
  shiftDurationMin: number,
  recentRecommendations: RecentRecommendation[],
  recentRideScores: RecentRide[],
  driverInOversuppliedZone: boolean
): { nearbyTraps: TrapDefinition[]; behavioralTraps: TrapDefinition[] } {
  let nearbyTraps: TrapDefinition[] = [];
  if (driverLat !== null && driverLng !== null) {
    nearbyTraps = detectGeographicTraps(driverLat, driverLng, currentPhase);
  }

  const behavioral = detectBehavioralTraps(
    shiftStats,
    recentRecommendations,
    recentRideScores,
    currentPhase,
    driverInOversuppliedZone
  );

  const temporal = detectTemporalTraps(hour, shiftDurationMin, currentPhase);

  return {
    nearbyTraps,
    behavioralTraps: [...behavioral, ...temporal],
  };
}
