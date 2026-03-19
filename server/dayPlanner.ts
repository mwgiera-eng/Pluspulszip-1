import type { Zone, Poi } from "@shared/schema";
import { getActiveEvents } from "./krakowEvents";

interface PolandTime {
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayName: string;
}

function getPolandTime(baseDate?: Date): PolandTime {
  const now = baseDate || new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "long",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "0";
  const hour = parseInt(get("hour"));
  const minute = parseInt(get("minute"));
  const weekdayName = get("weekday");
  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  return { hour, minute, dayOfWeek: dayMap[weekdayName] ?? 0, dayName: weekdayName };
}

interface HourBlock {
  hour: number;
  label: string;
  demandLevel: "low" | "medium" | "high" | "surge";
  bestZone: string;
  zoneType: string;
  earningsPotential: "$" | "$$" | "$$$" | "$$$$";
  flights: { type: string; label: string; count: string }[];
  events: { title: string; status: string; venue: string }[];
  platformTip: string;
  platformHighlight: "uber" | "bolt" | "any";
  proTip: string;
  regime: string;
}

interface DayPlanResponse {
  date: string;
  dayName: string;
  blocks: HourBlock[];
  summary: string;
  uberTip: string;
}

interface FlightWindowInfo {
  type: "departure" | "arrival";
  startHour: number;
  endHour: number;
  label: string;
  count: string;
  surgeBoost: number;
}

const FLIGHT_WINDOWS: FlightWindowInfo[] = [
  { type: "departure", startHour: 4, endHour: 6, label: "Pre-Dawn Departures", count: "3-5", surgeBoost: 1.9 },
  { type: "departure", startHour: 6, endHour: 8, label: "Morning Departure Rush", count: "8-15", surgeBoost: 1.7 },
  { type: "departure", startHour: 8, endHour: 11, label: "Late Morning Departures", count: "4-7", surgeBoost: 1.4 },
  { type: "departure", startHour: 11, endHour: 14, label: "Midday Departures", count: "3-6", surgeBoost: 1.3 },
  { type: "departure", startHour: 15, endHour: 18, label: "Afternoon Departure Wave", count: "6-10", surgeBoost: 1.5 },
  { type: "departure", startHour: 18, endHour: 20, label: "Evening Departures", count: "5-8", surgeBoost: 1.5 },
  { type: "departure", startHour: 20, endHour: 22, label: "Late Evening Departures", count: "2-4", surgeBoost: 1.3 },
  { type: "arrival", startHour: 7, endHour: 9, label: "First Morning Arrivals", count: "3-5", surgeBoost: 1.4 },
  { type: "arrival", startHour: 9, endHour: 12, label: "Morning Arrival Peak", count: "8-14", surgeBoost: 1.6 },
  { type: "arrival", startHour: 12, endHour: 15, label: "Midday Arrivals", count: "4-7", surgeBoost: 1.3 },
  { type: "arrival", startHour: 15, endHour: 18, label: "Afternoon Arrivals", count: "6-10", surgeBoost: 1.4 },
  { type: "arrival", startHour: 18, endHour: 21, label: "Evening Arrival Wave", count: "8-12", surgeBoost: 1.6 },
  { type: "arrival", startHour: 21, endHour: 24, label: "Late Night Arrivals", count: "4-6", surgeBoost: 1.5 },
  { type: "arrival", startHour: 0, endHour: 1, label: "Midnight Arrivals", count: "1-3", surgeBoost: 1.7 },
];

interface RegimeInfo {
  name: string;
  hours: [number, number];
  bestZoneType: string;
  bestZoneName: string;
  description: string;
  earningsPotential: "$" | "$$" | "$$$" | "$$$$";
}

const REGIMES: RegimeInfo[] = [
  { name: "early_morning", hours: [5, 7], bestZoneType: "airport", bestZoneName: "Airport (Balice)", description: "Early flights", earningsPotential: "$$$$" },
  { name: "morning_rush", hours: [7, 9], bestZoneType: "station", bestZoneName: "Main Station Area", description: "Morning commute", earningsPotential: "$$$" },
  { name: "late_morning", hours: [9, 12], bestZoneType: "tourism", bestZoneName: "Old Town / Kazimierz", description: "Tourist activity", earningsPotential: "$$" },
  { name: "lunch", hours: [12, 14], bestZoneType: "center", bestZoneName: "City Center", description: "Lunch rush", earningsPotential: "$$" },
  { name: "afternoon", hours: [14, 17], bestZoneType: "mall", bestZoneName: "Galeria Krakowska / Bonarka", description: "Shopping & departures", earningsPotential: "$$$" },
  { name: "evening_rush", hours: [17, 20], bestZoneType: "station", bestZoneName: "Station & Center", description: "Evening commute", earningsPotential: "$$$" },
  { name: "night_out", hours: [20, 23], bestZoneType: "nightlife", bestZoneName: "Kazimierz / Old Town", description: "Nightlife", earningsPotential: "$$$$" },
  { name: "late_night", hours: [23, 2], bestZoneType: "nightlife", bestZoneName: "Club District", description: "Club closings", earningsPotential: "$$$$" },
  { name: "deep_night", hours: [2, 5], bestZoneType: "airport", bestZoneName: "Airport Queue", description: "Very late/early", earningsPotential: "$" },
];

function getRegimeForHour(h: number): RegimeInfo {
  for (const r of REGIMES) {
    const [start, end] = r.hours;
    if (start < end) {
      if (h >= start && h < end) return r;
    } else {
      if (h >= start || h < end) return r;
    }
  }
  return REGIMES[REGIMES.length - 1];
}

function getFlightsForHour(h: number): { type: string; label: string; count: string }[] {
  return FLIGHT_WINDOWS
    .filter(fw => {
      if (fw.startHour < fw.endHour) return h >= fw.startHour && h < fw.endHour;
      return h >= fw.startHour || h < fw.endHour;
    })
    .map(fw => ({ type: fw.type, label: fw.label, count: fw.count }));
}

function getPlatformTip(h: number, regime: RegimeInfo, isWeekend: boolean, hasFlights: boolean): { tip: string; highlight: "uber" | "bolt" | "any" } {
  if (hasFlights && (regime.bestZoneType === "airport" || h >= 4 && h <= 8)) {
    return {
      tip: "Uber Reserve is often used for scheduled airport pickups — passengers plan rides in advance. Typically higher fare with a guaranteed trip.",
      highlight: "uber"
    };
  }

  if (h >= 20 || h < 4) {
    return {
      tip: "Late-night surge on both platforms. Bolt is often reported by drivers as faster for city dispatch in Kraków nightlife areas.",
      highlight: "bolt"
    };
  }

  if (h >= 7 && h <= 9) {
    return {
      tip: "Morning commute — use Uber's day planner to pre-schedule rides. Uber Reserve rides in this window typically pay more than on-demand.",
      highlight: "uber"
    };
  }

  if (h >= 14 && h <= 17 && isWeekend) {
    return {
      tip: "Weekend afternoon — Uber tends to have higher base fares for longer routes. Consider scheduling rides in advance.",
      highlight: "uber"
    };
  }

  if (h >= 12 && h <= 14) {
    return {
      tip: "Lunch hour — short trips dominate. Bolt is often reported by drivers as efficient for rapid city turnover.",
      highlight: "bolt"
    };
  }

  return {
    tip: "Both platforms active. Uber tends to work well for longer planned routes; Bolt for quick city rides. Keep both apps online.",
    highlight: "any"
  };
}

function getProTip(h: number, regime: RegimeInfo, isWeekend: boolean): string {
  const tips: Record<string, string[]> = {
    airport: [
      "Position near hotel districts 1.5h before flight windows for airport-bound passengers.",
      "Ul. Powiśle and Nowa Huta hotels are often overlooked — less competition for airport runs.",
    ],
    station: [
      "Main train station arrivals peak every 30 min — queue near Galeria Krakowska exit.",
      "IC/EIP trains from Warsaw arrive :00 and :30 — premium passengers with luggage.",
    ],
    tourism: [
      "Wawel Castle exit and Main Square perimeter are top pickup spots for tourists.",
      "Jewish Quarter (Kazimierz) generates steady demand from walking tour groups.",
    ],
    center: [
      "Business district around Rondo Mogilskie has consistent corporate ride demand.",
      "Check Galeria Krakowska — shoppers need rides, especially with large purchases.",
    ],
    nightlife: [
      "Kazimierz bars close at different times — stagger your positioning from Plac Nowy outward.",
      "ul. Szewska and ul. Floriańska: tourists leave clubs earlier than locals. Cover both.",
    ],
    mall: [
      "Bonarka City Center and Factory Outlet generate afternoon ride demand.",
      "IKEA Kraków on weekends — families need rides for large purchases.",
    ],
  };

  const zoneTips = tips[regime.bestZoneType] || tips.center;
  return zoneTips[h % zoneTips.length] || zoneTips[0];
}

export function generateDayPlan(zones: Zone[], pois: Poi[], tomorrow: boolean = false): DayPlanResponse {
  const now = new Date();
  const targetDate = tomorrow ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : now;
  const pt = getPolandTime(targetDate);
  const isWeekend = pt.dayOfWeek === 0 || pt.dayOfWeek === 6;

  const activeEvents = getActiveEvents();

  const blocks: HourBlock[] = [];

  for (let h = 0; h < 24; h++) {
    const regime = getRegimeForHour(h);
    const flights = getFlightsForHour(h);
    const hasFlights = flights.length > 0;

    const hourEvents = activeEvents
      .filter(e => {
        const eventDate = new Date(e.event.startDate);
        const eventHour = eventDate.getHours();
        const endEstimate = (e.event as any).estimatedEndDate ? new Date((e.event as any).estimatedEndDate).getHours() : eventHour + 3;
        return h >= eventHour - 1 && h <= endEstimate;
      })
      .map(e => ({
        title: e.event.title,
        status: e.status,
        venue: e.event.venueName || "Unknown venue",
      }));

    const { tip: platformTip, highlight: platformHighlight } = getPlatformTip(h, regime, isWeekend, hasFlights);
    const proTip = getProTip(h, regime, isWeekend);

    let demandLevel: "low" | "medium" | "high" | "surge" = "medium";
    const earningsStr = regime.earningsPotential;
    if (earningsStr === "$$$$") demandLevel = "surge";
    else if (earningsStr === "$$$") demandLevel = "high";
    else if (earningsStr === "$$") demandLevel = "medium";
    else demandLevel = "low";

    if (hasFlights) {
      const maxBoost = Math.max(...FLIGHT_WINDOWS.filter(fw => {
        if (fw.startHour < fw.endHour) return h >= fw.startHour && h < fw.endHour;
        return h >= fw.startHour || h < fw.endHour;
      }).map(fw => fw.surgeBoost));
      if (maxBoost >= 1.6) demandLevel = "surge";
      else if (maxBoost >= 1.4 && demandLevel !== "surge") demandLevel = "high";
    }

    if (hourEvents.length > 0 && demandLevel !== "surge") {
      demandLevel = demandLevel === "low" ? "medium" : demandLevel === "medium" ? "high" : "surge";
    }

    blocks.push({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00 - ${String((h + 1) % 24).padStart(2, "0")}:00`,
      demandLevel,
      bestZone: regime.bestZoneName,
      zoneType: regime.bestZoneType,
      earningsPotential: regime.earningsPotential,
      flights,
      events: hourEvents,
      platformTip,
      platformHighlight,
      proTip,
      regime: regime.name,
    });
  }

  const highDemandHours = blocks.filter(b => b.demandLevel === "surge" || b.demandLevel === "high");
  const bestHours = highDemandHours.slice(0, 5).map(b => b.label.split(" - ")[0]).join(", ");

  const summary = `${pt.dayName}${isWeekend ? " (weekend)" : ""}: Best earning windows at ${bestHours || "various times"}. ${highDemandHours.length} high-demand hours today.`;

  const uberTip = isWeekend
    ? "Weekend strategy: Uber Reserve is often used for scheduled airport runs during early morning and evening peaks. Plan your shift around the 05:00–08:00 and 17:00–20:00 windows for more predictable earnings."
    : "Weekday strategy: Uber Reserve tends to work well for morning commute (07:00–09:00) and airport departures. Setting availability in Uber's app for scheduled pickups can provide more predictable income per trip.";

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return {
    date: dateFormatter.format(targetDate),
    dayName: pt.dayName,
    blocks,
    summary,
    uberTip,
  };
}
