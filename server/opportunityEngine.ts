import type {
  Opportunity,
  OpportunityType,
  DataSourceId,
  ShiftPhase,
  DataSourceStatus,
} from "../shared/copilot";
import { distanceBetween } from "../shared/copilot";
import { getActiveEvents } from "./krakowEvents";
import { getAllFlightWindows } from "./recommendationEngine";
import { getCurrentPhase, getNextPhase, getMinutesRemainingInPhase } from "./copilotPhases";

const AIRPORT_LAT = 50.0778;
const AIRPORT_LNG = 19.7848;

let opportunityIdCounter = 0;

function nextOpportunityId(): string {
  opportunityIdCounter++;
  return `opp_${Date.now()}_${opportunityIdCounter}`;
}

function detectFlightOpportunities(
  driverLat: number | null,
  driverLng: number | null
): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const { arrivals } = getAllFlightWindows();

  const upcomingArrivals = arrivals.filter(
    (a) => a.status === "upcoming" || a.status === "active"
  );

  for (const window of upcomingArrivals) {
    const flightCountNum = parseInt(window.flightCount) || 0;
    if (flightCountNum < 3) continue;

    let confidence = Math.min(85, 40 + flightCountNum * 5);
    if (driverLat !== null && driverLng !== null) {
      const distToAirport = distanceBetween(driverLat, driverLng, AIRPORT_LAT, AIRPORT_LNG);
      if (distToAirport < 10000) confidence = Math.min(95, confidence + 10);
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + window.minutesInfo * 60 * 1000);

    opportunities.push({
      id: nextOpportunityId(),
      type: "flight_arrivals",
      title: `Flight arrival wave: ${window.flightCount} flights`,
      description: `${window.label} — ${window.airlines}. High probability demand window near airport.`,
      windowStart: now.toISOString(),
      windowEnd: windowEnd.toISOString(),
      targetLat: AIRPORT_LAT,
      targetLng: AIRPORT_LNG,
      targetName: "KRK Airport (Balice)",
      confidence,
      dataSources: ["airport_flights"] as DataSourceId[],
      dismissed: false,
    });
  }

  return opportunities;
}

function detectEventOpportunities(
  driverLat: number | null,
  driverLng: number | null
): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const activeEvents = getActiveEvents();

  const endingSoon = activeEvents.filter(
    (e) => e.status === "ending_soon" || e.status === "just_ended"
  );

  for (const eventInfo of endingSoon) {
    const { event, minutesUntilSurge } = eventInfo;
    if (minutesUntilSurge > 60) continue;

    let confidence = 60;
    if (event.expectedCrowdSize === "massive") confidence = 85;
    else if (event.expectedCrowdSize === "large") confidence = 75;
    else if (event.expectedCrowdSize === "medium") confidence = 65;

    if (eventInfo.status === "just_ended") confidence = Math.min(95, confidence + 10);

    const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
      tauronArena: { lat: 50.0675, lng: 19.9917 },
      halaForum: { lat: 50.0188, lng: 19.963 },
      iceKrakow: { lat: 50.0475, lng: 19.9265 },
      mainSquare: { lat: 50.0614, lng: 19.9366 },
      kazimierzDistrict: { lat: 50.0526, lng: 19.9455 },
      mainStation: { lat: 50.0656, lng: 19.9472 },
      galeriaBonarka: { lat: 50.0283, lng: 19.9536 },
    };

    const venueCoords = event.venueKey ? VENUE_COORDS[event.venueKey] : null;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + Math.max(minutesUntilSurge, 30) * 60 * 1000);

    opportunities.push({
      id: nextOpportunityId(),
      type: "event_ending",
      title: `${event.title} ending soon`,
      description: `${event.expectedCrowdSize} crowd expected at ${event.venueName}. High probability demand window.`,
      windowStart: now.toISOString(),
      windowEnd: windowEnd.toISOString(),
      targetLat: venueCoords?.lat,
      targetLng: venueCoords?.lng,
      targetName: event.venueName,
      confidence,
      dataSources: ["events"] as DataSourceId[],
      dismissed: false,
    });
  }

  return opportunities;
}

function detectPhaseTransitionOpportunities(
  currentPhase: ShiftPhase
): Opportunity[] {
  const opportunities: Opportunity[] = [];
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "12");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");

  const remaining = getMinutesRemainingInPhase(hour, minute, currentPhase);
  const nextPhase = getNextPhase(currentPhase);

  if (remaining <= 20 && nextPhase.earningsPotentialLabel === "high") {
    const windowStart = new Date(now.getTime() + remaining * 60 * 1000);
    const windowEnd = new Date(
      windowStart.getTime() + (nextPhase.timeRange[1] - nextPhase.timeRange[0]) * 60 * 60 * 1000
    );

    opportunities.push({
      id: nextOpportunityId(),
      type: "phase_transition",
      title: `${nextPhase.displayName} starting in ${remaining} min`,
      description: `Transition to ${nextPhase.displayName}: ${nextPhase.description}. Position in ${nextPhase.optimalZoneTypes.join(", ")} zones.`,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      confidence: 70 + Math.max(0, 20 - remaining),
      dataSources: [] as DataSourceId[],
      dismissed: false,
    });
  }

  return opportunities;
}

export function detectOpportunities(
  signals: DataSourceStatus[],
  currentPhase: ShiftPhase,
  driverLat: number | null,
  driverLng: number | null
): Opportunity[] {
  const allOpportunities: Opportunity[] = [];

  const airportSignal = signals.find((s) => s.sourceId === "airport_flights");
  if (airportSignal?.isAvailable) {
    allOpportunities.push(...detectFlightOpportunities(driverLat, driverLng));
  }

  const eventsSignal = signals.find((s) => s.sourceId === "events");
  if (eventsSignal?.isAvailable) {
    allOpportunities.push(...detectEventOpportunities(driverLat, driverLng));
  }

  allOpportunities.push(...detectPhaseTransitionOpportunities(currentPhase));

  allOpportunities.sort((a, b) => b.confidence - a.confidence);

  return allOpportunities.slice(0, 3);
}
