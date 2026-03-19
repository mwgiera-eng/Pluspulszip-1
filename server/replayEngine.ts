import type {
  ReplayEvent,
  ShiftReplaySummary,
  ShiftPhase,
  HourlyBand,
} from "../shared/copilot";
import { getHourlyBand } from "../shared/copilot";
import { getCurrentPhase, getAllPhases } from "./copilotPhases";
import { MICRO_ZONES } from "./copilotData";

export function generateReplaySummary(
  shiftSessionId: number,
  replayEvents: ReplayEvent[]
): ShiftReplaySummary {
  const sorted = [...replayEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let totalEarnings = 0;
  let totalRides = 0;
  let totalIdleMin = 0;
  let longestIdleMin = 0;
  let recommendationsIssued = 0;
  let recommendationsFollowed = 0;
  const zoneVisits: Record<string, { earnings: number; rides: number }> = {};
  const phasesSeenIds = new Set<string>();

  for (const event of sorted) {
    const data = event.data || {};

    switch (event.eventType) {
      case "ride_completed": {
        const fare = typeof data.fare === "number" ? data.fare : 0;
        totalEarnings += fare;
        totalRides++;
        const zone = typeof data.zone === "string" ? data.zone : "unknown";
        if (!zoneVisits[zone]) zoneVisits[zone] = { earnings: 0, rides: 0 };
        zoneVisits[zone].earnings += fare;
        zoneVisits[zone].rides++;
        break;
      }
      case "idle_segment": {
        const idleDuration = event.durationMin || 0;
        totalIdleMin += idleDuration;
        if (idleDuration > longestIdleMin) longestIdleMin = idleDuration;
        break;
      }
      case "recommendation_issued":
        recommendationsIssued++;
        break;
      case "recommendation_followed":
        recommendationsFollowed++;
        break;
      case "phase_transition": {
        const phaseId = typeof data.phaseId === "string" ? data.phaseId : null;
        if (phaseId) phasesSeenIds.add(phaseId);
        break;
      }
    }
  }

  const shiftStart = sorted.find((e) => e.eventType === "shift_start");
  const shiftEnd = sorted.find((e) => e.eventType === "shift_end");
  let durationMin = 0;
  if (shiftStart && shiftEnd) {
    durationMin = Math.round(
      (new Date(shiftEnd.timestamp).getTime() -
        new Date(shiftStart.timestamp).getTime()) /
        60000
    );
  } else if (sorted.length >= 2) {
    durationMin = Math.round(
      (new Date(sorted[sorted.length - 1].timestamp).getTime() -
        new Date(sorted[0].timestamp).getTime()) /
        60000
    );
  }

  const avgHourlyRate =
    durationMin > 0 ? (totalEarnings / durationMin) * 60 : 0;
  const hourlyBand: HourlyBand = getHourlyBand(avgHourlyRate);

  const allPhases = getAllPhases();
  const phasesTraversed: ShiftPhase[] = allPhases.filter((p) =>
    phasesSeenIds.has(p.id)
  );

  if (phasesTraversed.length === 0 && shiftStart) {
    const startDate = new Date(shiftStart.timestamp);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Warsaw",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(startDate);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value || "12");
    const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
    phasesTraversed.push(getCurrentPhase(h, m));
  }

  const sortedZones = Object.entries(zoneVisits).sort(
    (a, b) => b[1].earnings - a[1].earnings
  );
  const topZones = sortedZones.slice(0, 3).map(([zone]) => zone);
  const weakZones = sortedZones
    .filter(([, stats]) => stats.rides > 0 && stats.earnings / stats.rides < 15)
    .slice(0, 3)
    .map(([zone]) => zone);

  const keyMoments = identifyKeyMoments(sorted);
  const coachingNotes = generateCoachingNotes(sorted, totalIdleMin, longestIdleMin, weakZones);

  return {
    sessionId: shiftSessionId,
    totalEarnings,
    totalRides,
    avgHourlyRate: Math.round(avgHourlyRate * 100) / 100,
    hourlyBand,
    totalIdleMin,
    longestIdleMin,
    recommendationsIssued,
    recommendationsFollowed,
    phasesTraversed,
    topZones,
    weakZones,
    keyMoments,
    coachingNotes,
  };
}

export function identifyKeyMoments(events: ReplayEvent[]): ReplayEvent[] {
  const scored: { event: ReplayEvent; impact: number }[] = [];

  for (const event of events) {
    let impact = 0;
    const data = event.data || {};

    switch (event.eventType) {
      case "ride_completed": {
        const fare = typeof data.fare === "number" ? data.fare : 0;
        if (fare >= 40) impact = fare * 1.5;
        else if (fare >= 25) impact = fare;
        else impact = fare * 0.5;
        break;
      }
      case "idle_segment": {
        const duration = event.durationMin || 0;
        impact = duration * 3;
        break;
      }
      case "recommendation_ignored":
        impact = 15;
        break;
      case "recommendation_followed":
        impact = 10;
        break;
      case "trap_triggered":
        impact = 20;
        break;
      case "opportunity_detected":
        impact = 12;
        break;
      case "phase_transition":
        impact = 8;
        break;
    }

    if (event.earningsImpact) {
      impact += Math.abs(event.earningsImpact) * 2;
    }

    if (impact > 0) {
      scored.push({ event, impact });
    }
  }

  scored.sort((a, b) => b.impact - a.impact);
  return scored.slice(0, 5).map((s) => s.event);
}

function generateCoachingNotes(
  events: ReplayEvent[],
  totalIdleMin: number,
  longestIdleMin: number,
  weakZones: string[]
): string[] {
  const notes: string[] = [];

  const idleSegments = events.filter((e) => e.eventType === "idle_segment");
  const longIdles = idleSegments.filter((e) => (e.durationMin || 0) >= 10);

  for (const idle of longIdles.slice(0, 2)) {
    const duration = idle.durationMin || 0;
    const timestamp = new Date(idle.timestamp);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const timeStr = formatter.format(timestamp);

    const zone =
      typeof idle.data?.zone === "string" ? idle.data.zone : "current area";
    const microZone = MICRO_ZONES.find((z) => z.id === zone);

    if (microZone && microZone.oversupplyRisk === "high") {
      notes.push(
        `Idle segment at ${timeStr} lasted ${duration} min in oversupplied ${microZone.name}. Consider repositioning to a nearby zone with lower oversupply risk to reduce wait time.`
      );
    } else {
      notes.push(
        `Idle segment at ${timeStr} lasted ${duration} min. Repositioning after 7-8 minutes of idle time can often reduce wait time.`
      );
    }
  }

  if (totalIdleMin > 30) {
    const idlePercent =
      events.length > 0
        ? Math.round(
            (totalIdleMin /
              Math.max(
                1,
                (new Date(events[events.length - 1].timestamp).getTime() -
                  new Date(events[0].timestamp).getTime()) /
                  60000
              )) *
              100
          )
        : 0;
    notes.push(
      `Total idle time was ${totalIdleMin} min (approximately ${idlePercent}% of shift). Reducing idle time is one of the most effective ways to improve your effective rate.`
    );
  }

  const ignoredRecs = events.filter(
    (e) => e.eventType === "recommendation_ignored"
  );
  const followedRecs = events.filter(
    (e) => e.eventType === "recommendation_followed"
  );
  if (ignoredRecs.length > followedRecs.length && ignoredRecs.length >= 3) {
    notes.push(
      `You skipped ${ignoredRecs.length} out of ${ignoredRecs.length + followedRecs.length} reposition suggestions this shift. Consider trying the recommendations to see if they help reduce idle time.`
    );
  }

  if (weakZones.length > 0) {
    notes.push(
      `Zones with lower-than-average earnings per ride: ${weakZones.join(", ")}. Consider spending less time in these areas during future shifts.`
    );
  }

  const trapEvents = events.filter((e) => e.eventType === "trap_triggered");
  if (trapEvents.length >= 2) {
    notes.push(
      `${trapEvents.length} trap patterns were triggered during this shift. Review the trap alerts section to understand which patterns to watch for.`
    );
  }

  return notes;
}
