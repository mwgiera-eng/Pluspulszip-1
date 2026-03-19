import type {
  AdaptiveLoop,
  LoopDefinition,
  LoopModification,
  LoopWaypoint,
  ShiftPhase,
  DataSourceId,
} from "../shared/copilot";
import { distanceBetween } from "../shared/copilot";
import { LOOP_DEFINITIONS, MICRO_ZONES } from "./copilotData";

interface LoopState {
  activeLoop: AdaptiveLoop | null;
  lastEvaluatedAt: number;
}

const userLoopStates = new Map<string, LoopState>();

const WAYPOINT_PROXIMITY_M = 200;
const BASE_LOCK_MINUTES = 10;
const ADAPTED_LOCK_MINUTES = 15;

export function selectLoop(
  userId: string,
  phase: ShiftPhase,
  driverLat: number,
  driverLng: number,
  flightWaveActive: boolean,
  activeEventZoneIds: string[]
): AdaptiveLoop | null {
  const state = userLoopStates.get(userId);
  const now = Date.now();

  if (state?.activeLoop) {
    const lockedUntil = new Date(state.activeLoop.lockedUntil).getTime();
    if (now < lockedUntil) {
      return state.activeLoop;
    }
  }

  const suitableLoops = LOOP_DEFINITIONS.filter((loop) =>
    loop.idealPhases.includes(phase.id)
  );

  if (suitableLoops.length === 0) {
    const fallback = findClosestLoop(driverLat, driverLng);
    if (fallback) {
      return createAdaptiveLoop(userId, fallback, driverLat, driverLng, flightWaveActive, activeEventZoneIds);
    }
    return null;
  }

  let bestLoop: LoopDefinition | null = null;
  let bestScore = -Infinity;

  for (const loop of suitableLoops) {
    const avgDist = loop.waypoints.reduce((sum, wp) => {
      return sum + distanceBetween(driverLat, driverLng, wp.lat, wp.lng);
    }, 0) / loop.waypoints.length;

    const closestWp = loop.waypoints.reduce((min, wp) => {
      const d = distanceBetween(driverLat, driverLng, wp.lat, wp.lng);
      return d < min ? d : min;
    }, Infinity);

    const score = -closestWp * 0.6 - avgDist * 0.4;

    if (score > bestScore) {
      bestScore = score;
      bestLoop = loop;
    }
  }

  if (!bestLoop) return null;

  return createAdaptiveLoop(userId, bestLoop, driverLat, driverLng, flightWaveActive, activeEventZoneIds);
}

function createAdaptiveLoop(
  userId: string,
  loop: LoopDefinition,
  driverLat: number,
  driverLng: number,
  flightWaveActive: boolean,
  activeEventZoneIds: string[]
): AdaptiveLoop {
  const waypoints = [...loop.waypoints];
  const modifications: LoopModification[] = [];

  if (flightWaveActive) {
    const airportFeeder = MICRO_ZONES.find((z) => z.id === "airport_feeder");
    if (airportFeeder) {
      const hasAirportWp = waypoints.some(
        (wp) => distanceBetween(wp.lat, wp.lng, airportFeeder.lat, airportFeeder.lng) < 1000
      );
      if (!hasAirportWp) {
        waypoints.push({
          name: "Airport Feeder (adapted)",
          lat: airportFeeder.lat,
          lng: airportFeeder.lng,
          instruction: "Flight wave detected. Extend to airport feeder zone for high-value pickups.",
        });
        modifications.push({
          reason: "Flight wave active, extending loop to airport feeder",
          sourceId: "airport_flights" as DataSourceId,
          description: "Added airport feeder waypoint to capture incoming flight passengers",
        });
      }
    }
  }

  if (activeEventZoneIds.length > 0) {
    for (const zoneId of activeEventZoneIds) {
      const eventZone = MICRO_ZONES.find((z) => z.id === zoneId);
      if (!eventZone) continue;

      const hasEventWp = waypoints.some(
        (wp) => distanceBetween(wp.lat, wp.lng, eventZone.lat, eventZone.lng) < 500
      );
      if (!hasEventWp && eventZone.eventSensitivity >= 0.7) {
        waypoints.push({
          name: `${eventZone.name} (event spill)`,
          lat: eventZone.lat,
          lng: eventZone.lng,
          instruction: `Event active near ${eventZone.name}. Insert into loop for spill corridor pickups.`,
        });
        modifications.push({
          reason: `Event active near ${eventZone.name}`,
          sourceId: "events" as DataSourceId,
          description: `Inserted ${eventZone.name} spill corridor waypoint`,
        });
      }
    }
  }

  let closestIdx = 0;
  let closestDist = Infinity;
  waypoints.forEach((wp, idx) => {
    const d = distanceBetween(driverLat, driverLng, wp.lat, wp.lng);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = idx;
    }
  });

  const now = Date.now();
  const lockMinutes = modifications.length > 0 ? ADAPTED_LOCK_MINUTES : BASE_LOCK_MINUTES;
  const lockedUntil = new Date(now + lockMinutes * 60 * 1000).toISOString();

  const nextIdx = (closestIdx + 1) % waypoints.length;
  const nextWaypoint = waypoints[nextIdx] ?? null;
  const distToNext = nextWaypoint
    ? distanceBetween(driverLat, driverLng, nextWaypoint.lat, nextWaypoint.lng)
    : 0;

  const adaptiveLoop: AdaptiveLoop = {
    baseLoopId: loop.id,
    baseLoopName: loop.name,
    waypoints,
    modifications,
    currentWaypointIndex: closestIdx,
    nextWaypoint,
    distanceToNextM: Math.round(distToNext),
    selectedAt: new Date(now).toISOString(),
    lockedUntil,
  };

  userLoopStates.set(userId, {
    activeLoop: adaptiveLoop,
    lastEvaluatedAt: now,
  });

  return adaptiveLoop;
}

function findClosestLoop(driverLat: number, driverLng: number): LoopDefinition | null {
  let closest: LoopDefinition | null = null;
  let closestDist = Infinity;

  for (const loop of LOOP_DEFINITIONS) {
    for (const wp of loop.waypoints) {
      const d = distanceBetween(driverLat, driverLng, wp.lat, wp.lng);
      if (d < closestDist) {
        closestDist = d;
        closest = loop;
      }
    }
  }

  return closest;
}

export function trackWaypointProgress(
  userId: string,
  driverLat: number,
  driverLng: number
): AdaptiveLoop | null {
  const state = userLoopStates.get(userId);
  if (!state?.activeLoop) return null;

  const loop = state.activeLoop;
  const nextWp = loop.nextWaypoint;

  if (nextWp) {
    const dist = distanceBetween(driverLat, driverLng, nextWp.lat, nextWp.lng);

    if (dist <= WAYPOINT_PROXIMITY_M) {
      const newIdx = (loop.currentWaypointIndex + 1) % loop.waypoints.length;
      const nextNextIdx = (newIdx + 1) % loop.waypoints.length;
      const nextNextWp = loop.waypoints[nextNextIdx] ?? null;

      loop.currentWaypointIndex = newIdx;
      loop.nextWaypoint = nextNextWp;
      loop.distanceToNextM = nextNextWp
        ? Math.round(distanceBetween(driverLat, driverLng, nextNextWp.lat, nextNextWp.lng))
        : 0;

      state.activeLoop = loop;
      userLoopStates.set(userId, state);
    } else {
      loop.distanceToNextM = Math.round(dist);
    }
  }

  return loop;
}

export function getActiveLoop(userId: string): AdaptiveLoop | null {
  const state = userLoopStates.get(userId);
  return state?.activeLoop ?? null;
}

export function clearUserLoop(userId: string): void {
  userLoopStates.delete(userId);
}

export function shouldReevaluateLoop(userId: string, phaseChanged: boolean): boolean {
  if (phaseChanged) return true;

  const state = userLoopStates.get(userId);
  if (!state?.activeLoop) return true;

  const lockedUntil = new Date(state.activeLoop.lockedUntil).getTime();
  return Date.now() >= lockedUntil;
}
