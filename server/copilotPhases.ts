import type { ShiftPhase } from "../shared/copilot";

const SHIFT_PHASES: ShiftPhase[] = [
  {
    id: "early_morning",
    name: "early_morning",
    displayName: "Early Morning",
    timeRange: [5, 7],
    description: "Airport runs and early commuters. Low competition, steady airport demand.",
    demandPattern: "Sparse but predictable airport and train station pickups",
    optimalZoneTypes: ["airport", "train_station", "hotel_district"],
    color: "#6366f1",
    earningsPotentialLabel: "moderate",
  },
  {
    id: "morning_rush",
    name: "morning_rush",
    displayName: "Morning Rush",
    timeRange: [7, 10],
    description: "Commuter peak. High demand from residential to business districts.",
    demandPattern: "Strong directional flow from suburbs to center",
    optimalZoneTypes: ["residential", "business_district", "train_station"],
    color: "#f59e0b",
    earningsPotentialLabel: "high",
  },
  {
    id: "midday",
    name: "midday",
    displayName: "Midday",
    timeRange: [10, 13],
    description: "Tourist activity and business meetings. Moderate, spread demand.",
    demandPattern: "Distributed across tourist and business zones",
    optimalZoneTypes: ["tourist", "business_district", "shopping"],
    color: "#10b981",
    earningsPotentialLabel: "moderate",
  },
  {
    id: "afternoon",
    name: "afternoon",
    displayName: "Afternoon",
    timeRange: [13, 16],
    description: "Post-lunch lull transitioning to pre-rush. Tourist movement continues.",
    demandPattern: "Moderate with gradual build toward evening",
    optimalZoneTypes: ["tourist", "shopping", "university"],
    color: "#3b82f6",
    earningsPotentialLabel: "low",
  },
  {
    id: "evening_rush",
    name: "evening_rush",
    displayName: "Evening Rush",
    timeRange: [16, 19],
    description: "Return commute peak. High demand from business to residential.",
    demandPattern: "Strong reverse flow from center to suburbs",
    optimalZoneTypes: ["business_district", "shopping", "train_station"],
    color: "#ef4444",
    earningsPotentialLabel: "high",
  },
  {
    id: "evening",
    name: "evening",
    displayName: "Evening",
    timeRange: [19, 22],
    description: "Dining and entertainment. Events drive demand spikes.",
    demandPattern: "Event-driven with restaurant and entertainment clusters",
    optimalZoneTypes: ["entertainment", "restaurant", "event_venue"],
    color: "#8b5cf6",
    earningsPotentialLabel: "high",
  },
  {
    id: "late_night",
    name: "late_night",
    displayName: "Late Night",
    timeRange: [22, 1],
    description: "Club and bar exits. High per-ride value but longer idle between rides.",
    demandPattern: "Concentrated around nightlife with suburban dropoffs",
    optimalZoneTypes: ["nightlife", "old_town", "club_district"],
    color: "#ec4899",
    earningsPotentialLabel: "high",
  },
  {
    id: "overnight",
    name: "overnight",
    displayName: "Overnight",
    timeRange: [1, 5],
    description: "Minimal demand. Airport early flights and last nightlife stragglers.",
    demandPattern: "Sparse, airport-oriented toward 4am",
    optimalZoneTypes: ["airport_feeder", "nightlife"],
    color: "#64748b",
    earningsPotentialLabel: "low",
  },
];

export function getAllPhases(): ShiftPhase[] {
  return SHIFT_PHASES;
}

export function getCurrentPhase(hour: number, minute: number): ShiftPhase {
  const timeInMinutes = hour * 60 + minute;

  for (const phase of SHIFT_PHASES) {
    const [start, end] = phase.timeRange;

    if (start < end) {
      if (hour >= start && hour < end) {
        return phase;
      }
    } else {
      if (hour >= start || hour < end) {
        return phase;
      }
    }
  }

  return SHIFT_PHASES.find((p) => p.id === "overnight")!;
}

export function getNextPhase(currentPhase: ShiftPhase): ShiftPhase {
  const idx = SHIFT_PHASES.findIndex((p) => p.id === currentPhase.id);
  return SHIFT_PHASES[(idx + 1) % SHIFT_PHASES.length];
}

export function getMinutesRemainingInPhase(
  hour: number,
  minute: number,
  currentPhase: ShiftPhase
): number {
  const [_start, end] = currentPhase.timeRange;
  const currentMinutes = hour * 60 + minute;
  let endMinutes = end * 60;

  if (currentPhase.timeRange[0] > currentPhase.timeRange[1]) {
    if (hour >= currentPhase.timeRange[0]) {
      endMinutes = 24 * 60 + end * 60;
    }
  }

  let remaining = endMinutes - currentMinutes;
  if (remaining < 0) {
    remaining += 24 * 60;
  }

  return remaining;
}

export function getPhaseEarningsPotential(
  phase: ShiftPhase,
  dayOfWeek: number
): "high" | "moderate" | "low" {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

  if (isWeekend) {
    if (phase.id === "midday" || phase.id === "afternoon") {
      return "moderate";
    }
    if (phase.id === "late_night" || phase.id === "evening") {
      return "high";
    }
    if (phase.id === "overnight") {
      return "moderate";
    }
  }

  return phase.earningsPotentialLabel;
}
