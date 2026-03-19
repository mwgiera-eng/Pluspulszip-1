import type { Zone, Poi, InsertRecommendation } from "@shared/schema";

interface PolandTime {
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayName: string;
  date: Date;
  dayOfMonth: number;
  timeStr: string;
}

function getPolandTime(baseDate?: Date): PolandTime {
  const now = baseDate || new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "0";

  const hour = parseInt(get("hour"));
  const minute = parseInt(get("minute"));
  const dayOfMonth = parseInt(get("day"));

  const weekdayName = get("weekday");
  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const dayOfWeek = dayMap[weekdayName] ?? now.getDay();
  const dayName = weekdayName;

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");

  return { hour, minute, dayOfWeek, dayName, date: now, dayOfMonth, timeStr: `${hh}:${mm}` };
}

function getPolandDayName(baseDate: Date, offsetMinutes: number): string {
  const future = new Date(baseDate.getTime() + offsetMinutes * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    weekday: "long",
  });
  return formatter.format(future);
}


interface TimeRegime {
  name: string;
  hours: [number, number];
  zoneWeights: Record<string, number>;
  description: string;
}

const TIME_REGIMES: TimeRegime[] = [
  {
    name: "early_morning",
    hours: [5, 7],
    zoneWeights: { airport: 1.8, station: 1.5, residential: 1.3, center: 0.6, nightlife: 0.3, event: 0.5, mall: 0.4, tourism: 0.4 },
    description: "Early flights and commuters heading to stations"
  },
  {
    name: "morning_rush",
    hours: [7, 9],
    zoneWeights: { airport: 1.5, station: 1.8, residential: 1.6, center: 1.2, nightlife: 0.2, event: 0.6, mall: 0.5, tourism: 0.5 },
    description: "Morning commute rush hour"
  },
  {
    name: "late_morning",
    hours: [9, 12],
    zoneWeights: { airport: 1.3, station: 1.0, residential: 0.7, center: 1.4, nightlife: 0.3, event: 0.8, mall: 1.2, tourism: 1.6 },
    description: "Tourist activity picks up, business meetings"
  },
  {
    name: "lunch",
    hours: [12, 14],
    zoneWeights: { airport: 1.0, station: 1.0, residential: 0.5, center: 1.5, nightlife: 0.8, event: 1.0, mall: 1.4, tourism: 1.5 },
    description: "Lunch rush, tourist movements, shopping"
  },
  {
    name: "afternoon",
    hours: [14, 17],
    zoneWeights: { airport: 1.4, station: 1.0, residential: 0.6, center: 1.2, nightlife: 0.4, event: 1.2, mall: 1.5, tourism: 1.4 },
    description: "Shopping peak, tourist sites, airport departures"
  },
  {
    name: "evening_rush",
    hours: [17, 20],
    zoneWeights: { airport: 1.6, station: 1.7, residential: 1.0, center: 1.3, nightlife: 0.8, event: 1.5, mall: 1.3, tourism: 1.0 },
    description: "Evening commute, event arrivals, dining out"
  },
  {
    name: "night_out",
    hours: [20, 23],
    zoneWeights: { airport: 1.2, station: 0.8, residential: 0.5, center: 1.4, nightlife: 1.8, event: 1.6, mall: 0.3, tourism: 0.8 },
    description: "Nightlife warming up, events ending, restaurants"
  },
  {
    name: "late_night",
    hours: [23, 2],
    zoneWeights: { airport: 1.0, station: 0.4, residential: 0.8, center: 1.0, nightlife: 1.9, event: 0.8, mall: 0.1, tourism: 0.3 },
    description: "Club closings, late flights, surge pricing"
  },
  {
    name: "deep_night",
    hours: [2, 5],
    zoneWeights: { airport: 1.4, station: 0.3, residential: 0.6, center: 0.4, nightlife: 1.2, event: 0.2, mall: 0.1, tourism: 0.2 },
    description: "Very late pickups, airport early arrivals"
  },
];

const WEEKEND_MODIFIERS: Record<string, number> = {
  airport: 1.1,
  station: 0.8,
  residential: 0.7,
  center: 1.3,
  nightlife: 1.5,
  event: 1.4,
  mall: 1.3,
  tourism: 1.4,
};

interface FlightWindow {
  type: "departure" | "arrival";
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  surgeBoost: number;
  label: string;
  description: string;
  priority: number;
  instruction: string;
  flightCount: string;
  airlines: string;
  dayMultiplier?: Partial<Record<number, number>>;
}

const BALICE_FLIGHT_WINDOWS: FlightWindow[] = [
  // ── DEPARTURES ──
  // Based on Krakow Airport (KRK) actual schedule patterns.
  // Passengers need pickup 1.5-2h before departure. First flights ~05:30-06:00.
  {
    type: "departure",
    startHour: 4, startMinute: 0,
    endHour: 5, endMinute: 30,
    surgeBoost: 1.9,
    label: "Pre-Dawn Departure Pickups",
    description: "Passengers heading to first Ryanair/Wizz flights (05:30-06:30 departures). Highest-value airport runs — few drivers online.",
    priority: 9,
    flightCount: "3-5 flights",
    airlines: "Ryanair, Wizz Air",
    instruction: "Position near Old Town hotels and Kazimierz by 04:00. Passengers need 05:30-06:30 flights — premium fares, minimal competition.",
    dayMultiplier: { 0: 0.7, 6: 0.8 },
  },
  {
    type: "departure",
    startHour: 5, startMinute: 30,
    endHour: 8, endMinute: 0,
    surgeBoost: 1.7,
    label: "Morning Departure Rush",
    description: "Peak morning departures. Ryanair, Wizz Air, LOT, easyJet flights to London, Dublin, Berlin, Munich, Warsaw. Heaviest departure period.",
    priority: 9,
    flightCount: "8-15 flights",
    airlines: "Ryanair, Wizz Air, LOT, Lufthansa, easyJet",
    instruction: "Set destination filter to Airport. Cover hotel districts: Stare Miasto, Kazimierz, Podgórze. Highest departure volume of the day.",
    dayMultiplier: { 0: 0.6, 6: 0.7 },
  },
  {
    type: "departure",
    startHour: 8, startMinute: 0,
    endHour: 10, endMinute: 30,
    surgeBoost: 1.4,
    label: "Late Morning Departures",
    description: "LOT connections to Warsaw, Lufthansa to Frankfurt/Munich, business flights. Steady demand from business hotels.",
    priority: 7,
    flightCount: "4-7 flights",
    airlines: "LOT, Lufthansa, KLM, Swiss",
    instruction: "Check business hotel areas: Rondo Mogilskie, ul. Pawia near train station. Business travelers with luggage.",
    dayMultiplier: { 0: 0.5, 6: 0.6 },
  },
  {
    type: "departure",
    startHour: 11, startMinute: 0,
    endHour: 14, endMinute: 0,
    surgeBoost: 1.3,
    label: "Midday Departures",
    description: "Moderate departure volume. Mix of low-cost and scheduled carriers. Tourists checking out of hotels.",
    priority: 6,
    flightCount: "3-6 flights",
    airlines: "Ryanair, Wizz Air, LOT",
    instruction: "Cruise near Galeria Krakowska and main hotels. Tourist checkout time — look for passengers with luggage.",
    dayMultiplier: { 0: 0.7, 6: 0.8 },
  },
  {
    type: "departure",
    startHour: 14, startMinute: 30,
    endHour: 17, endMinute: 30,
    surgeBoost: 1.5,
    label: "Afternoon Departure Wave",
    description: "Second major departure peak. Ryanair/Wizz afternoon batch, weekend getaways, business returns to London, Dublin, Oslo.",
    priority: 8,
    flightCount: "6-10 flights",
    airlines: "Ryanair, Wizz Air, Norwegian, easyJet",
    instruction: "Set destination to Airport. Cover center and Galeria Krakowska area. Passengers heading to 16:00-19:00 flights.",
    dayMultiplier: { 5: 1.3, 0: 0.7 },
  },
  {
    type: "departure",
    startHour: 17, startMinute: 30,
    endHour: 20, endMinute: 0,
    surgeBoost: 1.5,
    label: "Evening Departure Rush",
    description: "Evening flight batch. Passengers heading to Balice after work. LOT evening Warsaw, Ryanair to UK/Ireland.",
    priority: 8,
    flightCount: "5-8 flights",
    airlines: "LOT, Ryanair, Wizz Air, Lufthansa",
    instruction: "Cover center and residential areas south of the river. After-work travelers heading to 19:00-21:30 flights.",
    dayMultiplier: { 5: 1.2, 0: 0.6 },
  },
  {
    type: "departure",
    startHour: 20, startMinute: 0,
    endHour: 22, endMinute: 0,
    surgeBoost: 1.3,
    label: "Late Evening Departures",
    description: "Final departures of the day. Last Ryanair/Wizz flights. Fewer passengers but longer rides from city center.",
    priority: 6,
    flightCount: "2-4 flights",
    airlines: "Ryanair, Wizz Air",
    instruction: "Accept airport-bound rides from anywhere. Last flights of the day — passengers may be rushing.",
    dayMultiplier: { 0: 0.5, 6: 0.7 },
  },

  // ── ARRIVALS ──
  // Based on typical KRK inbound schedule. Arrivals lag departures by transit time.
  {
    type: "arrival",
    startHour: 6, startMinute: 30,
    endHour: 8, endMinute: 30,
    surgeBoost: 1.4,
    label: "First Morning Arrivals",
    description: "Earliest inbound flights from hub airports. LOT from Warsaw, Lufthansa from Munich/Frankfurt. Business travelers.",
    priority: 7,
    flightCount: "2-4 flights",
    airlines: "LOT, Lufthansa, KLM",
    instruction: "Head to Balice Arrivals by 06:30. Early business passengers — expect rides to hotels and conference venues.",
    dayMultiplier: { 0: 0.4, 6: 0.5 },
  },
  {
    type: "arrival",
    startHour: 8, startMinute: 30,
    endHour: 12, endMinute: 0,
    surgeBoost: 1.6,
    label: "Morning Arrival Peak",
    description: "Heaviest morning arrival window. Ryanair from London/Dublin, Wizz from various cities, LOT connections. Tourists and business mix.",
    priority: 8,
    flightCount: "8-14 flights",
    airlines: "Ryanair, Wizz Air, LOT, easyJet, Norwegian",
    instruction: "Queue at Balice Arrivals pickup lane. Peak inbound volume — passengers need rides to Old Town hotels, hostels, and Airbnbs.",
    dayMultiplier: { 0: 0.6, 5: 1.1, 6: 0.8 },
  },
  {
    type: "arrival",
    startHour: 12, startMinute: 0,
    endHour: 14, endMinute: 30,
    surgeBoost: 1.2,
    label: "Midday Arrivals",
    description: "Moderate arrival volume. Mix of connections and direct flights. Tourists arriving for afternoon sightseeing.",
    priority: 6,
    flightCount: "3-5 flights",
    airlines: "Ryanair, LOT, Swiss",
    instruction: "Wait at Arrivals or accept city rides. Moderate flow — expect tourists wanting rides to Old Town and Kazimierz.",
    dayMultiplier: { 0: 0.7 },
  },
  {
    type: "arrival",
    startHour: 14, startMinute: 30,
    endHour: 17, endMinute: 30,
    surgeBoost: 1.4,
    label: "Afternoon Arrival Wave",
    description: "Afternoon arrivals building up. Return flights from hubs, Ryanair afternoon batch landing. Weekend visitors arriving.",
    priority: 7,
    flightCount: "5-8 flights",
    airlines: "Ryanair, Wizz Air, LOT, Lufthansa",
    instruction: "Queue at Balice Arrivals hall. Tourists and weekend visitors — expect longer rides to Old Town, Kazimierz, and Podgórze.",
    dayMultiplier: { 5: 1.3, 4: 1.1 },
  },
  {
    type: "arrival",
    startHour: 17, startMinute: 30,
    endHour: 20, endMinute: 0,
    surgeBoost: 1.6,
    label: "Evening Arrival Rush",
    description: "Major evening arrival peak. Ryanair/Wizz evening batch, business returns. High demand for rides to city center.",
    priority: 8,
    flightCount: "7-12 flights",
    airlines: "Ryanair, Wizz Air, LOT, easyJet, Norwegian",
    instruction: "Position at Balice Arrivals. High volume inbound — accept all rides. Most passengers heading to center or hotels.",
    dayMultiplier: { 5: 1.2, 4: 1.1, 0: 0.7 },
  },
  {
    type: "arrival",
    startHour: 20, startMinute: 0,
    endHour: 23, endMinute: 0,
    surgeBoost: 1.7,
    label: "Late Evening Arrivals",
    description: "Late arrivals including delayed flights. Fewer drivers available — surge pricing active. Last major arrival window.",
    priority: 9,
    flightCount: "4-7 flights",
    airlines: "Ryanair, Wizz Air, LOT",
    instruction: "Wait at Balice Arrivals. Premium fares — fewer drivers at this hour. Passengers heading to hotels and Airbnbs across the city.",
    dayMultiplier: { 0: 0.6, 6: 0.8 },
  },
  {
    type: "arrival",
    startHour: 23, startMinute: 0,
    endHour: 1, endMinute: 0,
    surgeBoost: 1.5,
    label: "Late Night Arrivals",
    description: "Final and delayed flights. Very few flights (1-3) but also very few drivers. Per-ride value is high.",
    priority: 7,
    flightCount: "1-3 flights",
    airlines: "Ryanair, Wizz Air (delayed)",
    instruction: "Wait at Balice Arrivals if within 5km. Few rides but premium pricing — long rides to city center likely.",
    dayMultiplier: { 0: 0.5, 1: 0.5, 2: 0.5, 3: 0.5, 6: 0.7 },
  },
];

interface NextDayDeparture {
  windowLabel: string;
  departureHour: number;
  departureMinute: number;
  prepareByHour: number;
  description: string;
  instruction: string;
}

const NEXT_DAY_DEPARTURES: NextDayDeparture[] = [
  {
    windowLabel: "Pre-Dawn Departure Pickups",
    departureHour: 4,
    departureMinute: 0,
    prepareByHour: 20,
    description: "Tomorrow's first passenger pickups start ~04:00 for 05:30-06:30 flights. Ryanair/Wizz early batch. Passengers from Old Town and Kazimierz hotels.",
    instruction: "Rest early tonight. Set alarm for 03:30 and position near Old Town hotels before 04:00. Premium fares, minimal competition.",
  },
  {
    windowLabel: "Morning Departure Rush",
    departureHour: 5,
    departureMinute: 30,
    prepareByHour: 22,
    description: "Tomorrow's peak departure window starts at 05:30. 8-15 flights departing 06:00-09:30. Highest volume of the day.",
    instruction: "Start your shift by 05:00 near hotel districts. Heaviest departure period — Ryanair, Wizz, LOT, easyJet all departing.",
  },
];

function getDayAdjustedSurge(window: FlightWindow, dayOfWeek: number): number {
  if (!window.dayMultiplier) return window.surgeBoost;
  const mult = window.dayMultiplier[dayOfWeek];
  if (mult === undefined) return window.surgeBoost;
  const adjusted = 1 + (window.surgeBoost - 1) * mult;
  return Math.round(adjusted * 10) / 10;
}

function getDayAdjustedPriority(window: FlightWindow, dayOfWeek: number): number {
  if (!window.dayMultiplier) return window.priority;
  const mult = window.dayMultiplier[dayOfWeek];
  if (mult === undefined) return window.priority;
  if (mult < 0.6) return Math.max(3, window.priority - 2);
  if (mult < 0.8) return Math.max(4, window.priority - 1);
  if (mult > 1.1) return Math.min(10, window.priority + 1);
  return window.priority;
}

function getFlightVolumeNote(window: FlightWindow, dayOfWeek: number): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mult = window.dayMultiplier?.[dayOfWeek];
  if (mult !== undefined && mult < 0.6) return ` (reduced ${dayNames[dayOfWeek]} schedule)`;
  if (mult !== undefined && mult < 0.8) return ` (lighter ${dayNames[dayOfWeek]} traffic)`;
  if (mult !== undefined && mult > 1.1) return ` (busy ${dayNames[dayOfWeek]})`;
  return "";
}

function isInFlightWindow(hour: number, minute: number, window: FlightWindow): boolean {
  const current = hour * 60 + minute;
  const start = window.startHour * 60 + window.startMinute;
  const end = window.endHour * 60 + window.endMinute;

  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

function minutesUntilWindow(hour: number, minute: number, window: FlightWindow): number {
  const current = hour * 60 + minute;
  const start = window.startHour * 60 + window.startMinute;

  if (start > current) {
    return start - current;
  }
  return (24 * 60 - current) + start;
}

function getActiveFlightWindows(hour: number, minute: number): FlightWindow[] {
  return BALICE_FLIGHT_WINDOWS.filter(w => isInFlightWindow(hour, minute, w));
}

function getUpcomingFlightWindows(hour: number, minute: number, maxMinutes: number = 150): { window: FlightWindow; minutesAway: number }[] {
  return BALICE_FLIGHT_WINDOWS
    .filter(w => !isInFlightWindow(hour, minute, w))
    .map(w => ({ window: w, minutesAway: minutesUntilWindow(hour, minute, w) }))
    .filter(w => w.minutesAway <= maxMinutes)
    .sort((a, b) => a.minutesAway - b.minutesAway);
}

function getCurrentTimeRegime(hour: number): TimeRegime {
  for (const regime of TIME_REGIMES) {
    const [start, end] = regime.hours;
    if (start < end) {
      if (hour >= start && hour < end) return regime;
    } else {
      if (hour >= start || hour < end) return regime;
    }
  }
  return TIME_REGIMES[0];
}

function getNextTimeRegime(hour: number): TimeRegime {
  const current = getCurrentTimeRegime(hour);
  const idx = TIME_REGIMES.indexOf(current);
  return TIME_REGIMES[(idx + 1) % TIME_REGIMES.length];
}

function isPoiActive(poi: Poi, hour: number): boolean {
  if (!poi.openingTime || !poi.closingTime) return true;
  const openHour = parseInt(poi.openingTime.split(":")[0]);
  const closeHour = parseInt(poi.closingTime.split(":")[0]);
  if (openHour < closeHour) {
    return hour >= openHour && hour < closeHour;
  }
  return hour >= openHour || hour < closeHour;
}

function getPreTransitionBoost(zone: Zone, hour: number, minute: number): number {
  const currentMinutes = hour * 60 + minute;
  const currentRegime = getCurrentTimeRegime(hour);
  const currentRegimeEnd = currentRegime.hours[1] * 60;

  let minutesUntilNext: number;
  if (currentRegimeEnd > currentMinutes) {
    minutesUntilNext = currentRegimeEnd - currentMinutes;
  } else if (currentRegimeEnd <= currentRegime.hours[0] * 60) {
    minutesUntilNext = (24 * 60 - currentMinutes) + currentRegimeEnd;
  } else {
    minutesUntilNext = currentRegimeEnd - currentMinutes;
  }

  if (minutesUntilNext > 30 || minutesUntilNext <= 0) return 1.0;

  const nextRegimeStartHour = currentRegime.hours[1] % 24;
  const nextRegime = getCurrentTimeRegime(nextRegimeStartHour);

  if (nextRegime.name === currentRegime.name) return 1.0;

  const nextWeight = nextRegime.zoneWeights[zone.type] || 0.5;
  const currentWeight = currentRegime.zoneWeights[zone.type] || 0.5;

  if (nextWeight <= currentWeight) return 1.0;

  const rampFactor = 1 - (minutesUntilNext / 30);
  const boost = 1 + (nextWeight - currentWeight) * rampFactor * 0.5;
  return Math.min(boost, 1.4);
}

function getFlightDepartureBoost(zone: Zone, hour: number, minute: number, dayOfWeek: number): number {
  if (zone.type !== 'center' && zone.type !== 'tourism' && zone.type !== 'nightlife' && zone.type !== 'mall') return 1.0;

  const upcomingDepartures = BALICE_FLIGHT_WINDOWS
    .filter(w => w.type === "departure" && !isInFlightWindow(hour, minute, w))
    .map(w => ({ window: w, minutesAway: minutesUntilWindow(hour, minute, w) }))
    .filter(w => w.minutesAway <= 120 && w.minutesAway >= 30);

  if (upcomingDepartures.length === 0) return 1.0;

  const bestWindow = upcomingDepartures[0];
  const adjSurge = getDayAdjustedSurge(bestWindow.window, dayOfWeek);
  const proximityFactor = 1 - (bestWindow.minutesAway - 30) / 90;
  return 1 + (adjSurge - 1) * proximityFactor * 0.3;
}

function calculateZoneScore(zone: Zone, regime: TimeRegime, isWeekend: boolean, activePoisNearby: number, hour?: number, minute?: number, dayOfWeek?: number): number {
  const typeWeight = regime.zoneWeights[zone.type] || 0.5;
  const demandMultiplier = zone.demandLevel === 'surge' ? 2.0 :
                           zone.demandLevel === 'high' ? 1.5 :
                           zone.demandLevel === 'medium' ? 1.0 : 0.5;
  const surgeBonus = Number(zone.surgeMultiplier) || 1.0;
  const weekendMod = isWeekend ? (WEEKEND_MODIFIERS[zone.type] || 1.0) : 1.0;
  const poiBonus = 1 + (activePoisNearby * 0.15);

  const preTransitionBoost = (hour !== undefined && minute !== undefined) ? getPreTransitionBoost(zone, hour, minute) : 1.0;
  const flightBoost = (hour !== undefined && minute !== undefined && dayOfWeek !== undefined) ? getFlightDepartureBoost(zone, hour, minute, dayOfWeek) : 1.0;

  return typeWeight * demandMultiplier * surgeBonus * weekendMod * poiBonus * preTransitionBoost * flightBoost;
}

function distanceBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findAirportZone(zones: Zone[]): Zone | undefined {
  return zones.find(z => z.type === 'airport');
}

function formatTimeRange(startH: number, startM: number, endH: number, endM: number): string {
  const sh = String(startH).padStart(2, "0");
  const sm = String(startM).padStart(2, "0");
  const eh = String(endH).padStart(2, "0");
  const em = String(endM).padStart(2, "0");
  return `${sh}:${sm}-${eh}:${em}`;
}

function getDayForWindow(now: Date, windowStartHour: number, currentHour: number): string {
  if (windowStartHour < currentHour && (currentHour - windowStartHour) > 12) {
    return getPolandDayName(now, 24 * 60);
  }
  return getPolandTime(now).dayName;
}

export interface FlightWindowResult {
  label: string;
  timeRange: string;
  day: string;
  surge: number;
  status: string;
  minutesInfo: number;
  flightCount: string;
  airlines: string;
  type: "arrival" | "departure";
  description: string;
  instruction: string;
}

function buildFlightWindowResults(filterType?: "arrival" | "departure"): FlightWindowResult[] {
  const pl = getPolandTime();
  const { hour, minute, dayName, date: now, dayOfWeek } = pl;

  const windows = filterType
    ? BALICE_FLIGHT_WINDOWS.filter(w => w.type === filterType)
    : BALICE_FLIGHT_WINDOWS;
  const result: FlightWindowResult[] = [];

  for (const w of windows) {
    const active = isInFlightWindow(hour, minute, w);
    const sh = String(w.startHour).padStart(2, "0");
    const sm = String(w.startMinute).padStart(2, "0");
    const eh = String(w.endHour).padStart(2, "0");
    const em = String(w.endMinute).padStart(2, "0");
    const timeRange = `${sh}:${sm} - ${eh}:${em}`;
    const adjustedSurge = getDayAdjustedSurge(w, dayOfWeek);
    const volumeNote = getFlightVolumeNote(w, dayOfWeek);

    if (active) {
      const windowEnd = w.endHour * 60 + w.endMinute;
      const current = hour * 60 + minute;
      let minsLeft = windowEnd > current ? windowEnd - current : (24 * 60 - current) + windowEnd;
      result.push({ label: w.label + volumeNote, timeRange, day: dayName, surge: adjustedSurge, status: "ACTIVE NOW", minutesInfo: minsLeft, flightCount: w.flightCount, airlines: w.airlines, type: w.type, description: w.description, instruction: w.instruction });
    } else {
      const minsAway = minutesUntilWindow(hour, minute, w);
      let statusDay = dayName;
      if (minsAway > 12 * 60) {
        statusDay = getPolandDayName(now, 24 * 60);
      }
      result.push({ label: w.label + volumeNote, timeRange, day: statusDay, surge: adjustedSurge, status: minsAway <= 90 ? "UPCOMING" : "SCHEDULED", minutesInfo: minsAway, flightCount: w.flightCount, airlines: w.airlines, type: w.type, description: w.description, instruction: w.instruction });
    }
  }

  result.sort((a, b) => {
    if (a.status === "ACTIVE NOW" && b.status !== "ACTIVE NOW") return -1;
    if (b.status === "ACTIVE NOW" && a.status !== "ACTIVE NOW") return 1;
    if (a.status === "UPCOMING" && b.status === "SCHEDULED") return -1;
    if (b.status === "UPCOMING" && a.status === "SCHEDULED") return 1;
    return a.minutesInfo - b.minutesInfo;
  });

  return result;
}

export function getArrivalsWindowEstimate(): { windows: FlightWindowResult[] } {
  return { windows: buildFlightWindowResults("arrival") };
}

export function getAllFlightWindows(): { arrivals: FlightWindowResult[]; departures: FlightWindowResult[] } {
  return {
    arrivals: buildFlightWindowResults("arrival"),
    departures: buildFlightWindowResults("departure"),
  };
}

export function generateRecommendations(zones: Zone[], pois: Poi[]): InsertRecommendation[] {
  const pl = getPolandTime();
  const now = pl.date;
  const hour = pl.hour;
  const minute = pl.minute;
  const dayOfWeek = pl.dayOfWeek;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isFriday = dayOfWeek === 5;
  const timeStr = pl.timeStr;

  const regime = getCurrentTimeRegime(hour);
  const nextRegime = getNextTimeRegime(hour);

  const activePois = pois.filter(p => isPoiActive(p, hour));

  const scoredZones = zones.map(zone => {
    const nearbyActivePois = activePois.filter(p =>
      distanceBetween(Number(zone.lat), Number(zone.lng), Number(p.lat), Number(p.lng)) < (zone.radius + 500)
    ).length;

    const score = calculateZoneScore(zone, regime, isWeekend || isFriday, nearbyActivePois, hour, minute, dayOfWeek);
    return { zone, score, nearbyActivePois };
  });

  scoredZones.sort((a, b) => b.score - a.score);

  const recs: InsertRecommendation[] = [];
  const validUntil = new Date(now.getTime() + 30 * 60 * 1000);
  const airportZone = findAirportZone(zones);

  const activeWindows = getActiveFlightWindows(hour, minute);
  const upcomingWindows = getUpcomingFlightWindows(hour, minute);

  if (airportZone) {
    for (const window of activeWindows) {
      const adjSurge = getDayAdjustedSurge(window, dayOfWeek);
      const adjPriority = getDayAdjustedPriority(window, dayOfWeek);
      const volNote = getFlightVolumeNote(window, dayOfWeek);

      if (window.type === "departure") {
        const windowEnd = window.endHour * 60 + window.endMinute;
        const current = hour * 60 + minute;
        let minsLeft: number;
        if (windowEnd > current) {
          minsLeft = windowEnd - current;
        } else {
          minsLeft = (24 * 60 - current) + windowEnd;
        }
        const windowDay = getDayForWindow(now, window.startHour, hour);
        const ts = formatTimeRange(window.startHour, window.startMinute, window.endHour, window.endMinute);
        const tip = window.instruction;

        recs.push({
          zoneId: null,
          action: "MOVE",
          reason: `[DEPARTURE SURGE] ${window.label}${volNote} | ${ts} | ${windowDay} | ${adjSurge}x | ${window.flightCount} | ACTIVE NOW ~${minsLeft}min | ${tip}`,
          targetZoneId: airportZone.id,
          validFrom: now,
          validUntil: new Date(now.getTime() + minsLeft * 60 * 1000),
          priority: adjPriority,
        });
      }

      if (window.type === "arrival") {
        const windowEnd = window.endHour * 60 + window.endMinute;
        const current = hour * 60 + minute;
        let minsLeft = windowEnd > current ? windowEnd - current : (24 * 60 - current) + windowEnd;
        const windowDay = getDayForWindow(now, window.startHour, hour);
        const ts = formatTimeRange(window.startHour, window.startMinute, window.endHour, window.endMinute);
        const arrTip = window.instruction;

        recs.push({
          zoneId: airportZone.id,
          action: "TAKE",
          reason: `[ARRIVAL WAVE] ${window.label}${volNote} | ${ts} | ${windowDay} | ${adjSurge}x | ${window.flightCount} | ACTIVE NOW ~${minsLeft}min | ${arrTip}`,
          targetZoneId: null,
          validFrom: now,
          validUntil,
          priority: adjPriority,
        });
      }
    }

    for (const { window, minutesAway } of upcomingWindows) {
      const adjSurge = getDayAdjustedSurge(window, dayOfWeek);
      const adjPriority = getDayAdjustedPriority(window, dayOfWeek);
      const volNote = getFlightVolumeNote(window, dayOfWeek);

      if (window.type === "departure" && minutesAway <= 120) {
        const upcomingDay = getPolandDayName(now, minutesAway);
        const ts = formatTimeRange(window.startHour, window.startMinute, window.endHour, window.endMinute);
        const tip = window.instruction;
        let urgency: string;
        let action: "MOVE" | "WAIT" = "MOVE";
        let priorityBoost = 0;
        if (minutesAway <= 30) {
          urgency = "IMMINENT";
          priorityBoost = 1;
        } else if (minutesAway <= 60) {
          urgency = "PREPARE NOW";
        } else {
          urgency = "PLAN AHEAD";
          action = minutesAway > 90 ? "WAIT" : "MOVE";
          priorityBoost = -1;
        }
        const positionTip = minutesAway > 60
          ? "Position near hotel districts (Stare Miasto, Kazimierz). Passengers will start ordering rides to airport soon."
          : tip;
        recs.push({
          zoneId: null,
          action,
          reason: `[UPCOMING DEPARTURES - ${urgency}] ${window.label}${volNote} | ${ts} | ${upcomingDay} | ${adjSurge}x | ${window.flightCount} | STARTS IN ~${minutesAway}min | ${positionTip}`,
          targetZoneId: airportZone.id,
          validFrom: now,
          validUntil: new Date(now.getTime() + minutesAway * 60 * 1000),
          priority: Math.max(5, adjPriority - 1 + priorityBoost),
        });
      }

      if (window.type === "arrival" && minutesAway <= 75) {
        const upcomingDay = getPolandDayName(now, minutesAway);
        const ts = formatTimeRange(window.startHour, window.startMinute, window.endHour, window.endMinute);
        const arrTip = window.instruction;
        let urgency: string;
        let priorityBoost = 0;
        if (minutesAway <= 20) {
          urgency = "IMMINENT";
          priorityBoost = 1;
        } else if (minutesAway <= 45) {
          urgency = "HEAD TO AIRPORT";
        } else {
          urgency = "PLAN AHEAD";
          priorityBoost = -1;
        }
        const travelTip = minutesAway > 45
          ? "Start heading toward Balice now — drive time from center is ~25-35 min."
          : arrTip;
        recs.push({
          zoneId: null,
          action: "MOVE",
          reason: `[INCOMING ARRIVALS - ${urgency}] ${window.label}${volNote} | ${ts} | ${upcomingDay} | ${adjSurge}x | ${window.flightCount} | STARTS IN ~${minutesAway}min | ${travelTip}`,
          targetZoneId: airportZone.id,
          validFrom: now,
          validUntil: new Date(now.getTime() + minutesAway * 60 * 1000),
          priority: Math.max(5, adjPriority - 1 + priorityBoost),
        });
      }
    }

    for (const nextDay of NEXT_DAY_DEPARTURES) {
      if (hour >= nextDay.prepareByHour && hour <= 23) {
        const hoursUntil = (24 - hour) + nextDay.departureHour;
        const tomorrowDay = getPolandDayName(now, 24 * 60);
        const dh = String(nextDay.departureHour).padStart(2, "0");
        const dm = String(nextDay.departureMinute).padStart(2, "0");
        const tomorrowDayOfWeek = (dayOfWeek + 1) % 7;
        const matchingWindow = BALICE_FLIGHT_WINDOWS.find(w =>
          w.type === "departure" && w.startHour === nextDay.departureHour && w.startMinute === nextDay.departureMinute
        );
        const surgeValue = matchingWindow ? getDayAdjustedSurge(matchingWindow, tomorrowDayOfWeek) : 1.5;
        const tomorrowVolNote = matchingWindow ? getFlightVolumeNote(matchingWindow, tomorrowDayOfWeek) : "";
        recs.push({
          zoneId: null,
          action: "WAIT",
          reason: `[TOMORROW] ${nextDay.windowLabel}${tomorrowVolNote} | ${dh}:${dm} | ${tomorrowDay} | ${surgeValue}x | IN ~${hoursUntil}h | ${nextDay.instruction}`,
          targetZoneId: airportZone.id,
          validFrom: now,
          validUntil: new Date(now.getTime() + 4 * 60 * 60 * 1000),
          priority: 5,
        });
      }
    }
  }

  const hasAirportRec = recs.length > 0;

  const topZone = scoredZones[0];
  if (topZone && topZone.score > 1.5 && !(hasAirportRec && topZone.zone.type === 'airport')) {
    recs.push({
      zoneId: null,
      action: "MOVE",
      reason: buildMoveReason(topZone.zone, regime, topZone.score, topZone.nearbyActivePois, isWeekend, hour, timeStr),
      targetZoneId: topZone.zone.id,
      validFrom: now,
      validUntil,
      priority: Math.min(10, Math.round(topZone.score * 3)),
    });
  }

  const secondZone = scoredZones[1];
  if (secondZone && secondZone.score > 1.2 && !(hasAirportRec && secondZone.zone.type === 'airport')) {
    recs.push({
      zoneId: null,
      action: "MOVE",
      reason: buildMoveReason(secondZone.zone, regime, secondZone.score, secondZone.nearbyActivePois, isWeekend, hour, timeStr),
      targetZoneId: secondZone.zone.id,
      validFrom: now,
      validUntil,
      priority: Math.min(8, Math.round(secondZone.score * 2.5)),
    });
  }

  if (!hasAirportRec) {
    const waitCandidates = scoredZones.filter(s => s.score >= 0.8 && s.score <= 1.5);
    if (waitCandidates.length > 0) {
      const bestWait = waitCandidates[0];
      recs.push({
        zoneId: bestWait.zone.id,
        action: "WAIT",
        reason: buildWaitReason(bestWait.zone, regime, nextRegime, hour, minute, timeStr),
        targetZoneId: null,
        validFrom: now,
        validUntil,
        priority: Math.min(6, Math.round(bestWait.score * 2)),
      });
    }
  }

  const takeCandidates = scoredZones.filter(s =>
    Number(s.zone.surgeMultiplier) >= 1.3 && s.score > 1.0 && s.zone.type !== 'airport'
  );
  if (takeCandidates.length > 0) {
    const surgeZone = takeCandidates[0];
    const surgeTip = getZoneTip(surgeZone.zone.type, hour);
    const surgeBase = `${surgeZone.zone.surgeMultiplier}x surge at ${surgeZone.zone.name} (${timeStr}). Accept every ride for max earnings.`;
    recs.push({
      zoneId: surgeZone.zone.id,
      action: "TAKE",
      reason: surgeTip ? `${surgeBase} ${surgeTip}` : surgeBase,
      targetZoneId: null,
      validFrom: now,
      validUntil,
      priority: Math.min(9, Math.round(Number(surgeZone.zone.surgeMultiplier) * 4)),
    });
  }

  if (hour >= 17 && hour < 20 && !isWeekend) {
    const stationZones = scoredZones.filter(s => s.zone.type === 'station');
    if (stationZones.length > 0 && !recs.some(r => r.targetZoneId === stationZones[0].zone.id)) {
      const stationTip = getZoneTip('station', hour);
      recs.push({
        zoneId: null,
        action: "MOVE",
        reason: `Evening rush hour at ${stationZones[0].zone.name} (${timeStr}). Commuters arriving by train. ${stationTip}`,
        targetZoneId: stationZones[0].zone.id,
        validFrom: now,
        validUntil: new Date(now.getTime() + 60 * 60 * 1000),
        priority: 7,
      });
    }
  }

  if ((isFriday && hour >= 21) || (isWeekend && hour >= 20) || (hour >= 23 || hour < 3)) {
    const nightlifeZones = scoredZones.filter(s => s.zone.type === 'nightlife');
    if (nightlifeZones.length > 0 && !recs.some(r => r.targetZoneId === nightlifeZones[0].zone.id)) {
      const nightTip = getZoneTip('nightlife', hour);
      const nightLabel = isFriday ? 'Friday' : isWeekend ? 'Weekend' : 'Late';
      recs.push({
        zoneId: null,
        action: "MOVE",
        reason: `${nightLabel} night surge at ${nightlifeZones[0].zone.name} (${timeStr}). Bars and clubs are busy. ${nightTip}`,
        targetZoneId: nightlifeZones[0].zone.id,
        validFrom: now,
        validUntil: new Date(now.getTime() + 90 * 60 * 1000),
        priority: 8,
      });
    }
  }

  if (isWeekend && hour >= 10 && hour < 17) {
    const tourismZones = scoredZones.filter(s => s.zone.type === 'tourism');
    if (tourismZones.length > 0 && !recs.some(r => r.targetZoneId === tourismZones[0].zone.id)) {
      const tourTip = getZoneTip('tourism', hour);
      recs.push({
        zoneId: null,
        action: "MOVE",
        reason: `Weekend tourism peak at ${tourismZones[0].zone.name} (${timeStr}). Visitors heading to attractions. ${tourTip}`,
        targetZoneId: tourismZones[0].zone.id,
        validFrom: now,
        validUntil: new Date(now.getTime() + 120 * 60 * 1000),
        priority: 6,
      });
    }
  }

  const closingPois = pois.filter(p => {
    if (!p.closingTime) return false;
    const closeHour = parseInt(p.closingTime.split(":")[0]);
    const closeMinute = parseInt(p.closingTime.split(":")[1] || "0");
    const closeTotal = closeHour * 60 + closeMinute;
    const currentTotal = hour * 60 + minute;
    const diff = closeTotal - currentTotal;
    return diff > 0 && diff <= 30;
  });

  for (const poi of closingPois) {
    const closeHour = parseInt(poi.closingTime!.split(":")[0]);
    const closeMinute = parseInt(poi.closingTime!.split(":")[1] || "0");
    const minutesLeft = (closeHour * 60 + closeMinute) - (hour * 60 + minute);
    const nearbyZone = scoredZones.find(s =>
      distanceBetween(Number(s.zone.lat), Number(s.zone.lng), Number(poi.lat), Number(poi.lng)) < (s.zone.radius + 300)
    );
    if (nearbyZone && !recs.some(r => r.targetZoneId === nearbyZone.zone.id && r.reason?.includes("closing"))) {
      recs.push({
        zoneId: null,
        action: "MOVE",
        reason: `${poi.name} closing in ~${minutesLeft}min (${poi.closingTime}). Visitors will need rides. Position near exits of ${nearbyZone.zone.name}.`,
        targetZoneId: nearbyZone.zone.id,
        validFrom: now,
        validUntil: new Date(now.getTime() + (minutesLeft + 15) * 60 * 1000),
        priority: Math.min(7, 5 + Math.round((poi.popularityScore || 5) / 4)),
      });
    }
  }

  recs.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const seen = new Set<string>();
  const deduped = recs.filter(r => {
    const reason = r.reason || '';
    let key: string;
    const tagMatch = reason.match(/^\[([A-Z\s]+)\]/);
    if (tagMatch) {
      key = `${tagMatch[1]}-${r.action}-${r.targetZoneId || r.zoneId}`;
    } else {
      key = `${r.action}-${r.targetZoneId || r.zoneId}`;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const airportRecs = deduped.filter(r => (r.reason || '').match(/^\[/));
  const otherRecs = deduped.filter(r => !(r.reason || '').match(/^\[/));
  const maxAirport = 3;
  const limited = [...airportRecs.slice(0, maxAirport), ...otherRecs];
  limited.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return limited.slice(0, 7);
}

export interface StrategicAdvice {
  summary: string;
  currentZone: { name: string; type: string; demandLevel: string } | null;
  nearestHighDemandZone: { name: string; distanceKm: number; direction: string; type: string } | null;
  distanceToAirport: number | null;
  tip: string;
}

function getCardinalDirection(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  const angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "north";
  if (angle >= 22.5 && angle < 67.5) return "northeast";
  if (angle >= 67.5 && angle < 112.5) return "east";
  if (angle >= 112.5 && angle < 157.5) return "southeast";
  if (angle >= 157.5 || angle < -157.5) return "south";
  if (angle >= -157.5 && angle < -112.5) return "southwest";
  if (angle >= -112.5 && angle < -67.5) return "west";
  return "northwest";
}

export function generateLocationAwareAdvice(
  driverLat: number,
  driverLng: number,
  zones: Zone[],
  pois: Poi[]
): StrategicAdvice {
  const pl = getPolandTime();
  const hour = pl.hour;
  const minute = pl.minute;
  const dayOfWeek = pl.dayOfWeek;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isFriday = dayOfWeek === 5;
  const regime = getCurrentTimeRegime(hour);

  const activePois = pois.filter(p => isPoiActive(p, hour));

  let currentZone: Zone | null = null;
  const zoneDistances = zones.map(zone => {
    const dist = distanceBetween(driverLat, driverLng, Number(zone.lat), Number(zone.lng));
    if (dist <= zone.radius) {
      if (!currentZone || zone.radius < (currentZone.radius || Infinity)) {
        currentZone = zone;
      }
    }
    return { zone, distance: dist };
  });

  const scoredZones = zones.map(zone => {
    const nearbyActivePois = activePois.filter(p =>
      distanceBetween(Number(zone.lat), Number(zone.lng), Number(p.lat), Number(p.lng)) < (zone.radius + 500)
    ).length;
    const score = calculateZoneScore(zone, regime, isWeekend || isFriday, nearbyActivePois, hour, minute, dayOfWeek);
    return { zone, score, nearbyActivePois };
  });
  scoredZones.sort((a, b) => b.score - a.score);

  const airportZone = findAirportZone(zones);
  const airportDist = airportZone
    ? distanceBetween(driverLat, driverLng, Number(airportZone.lat), Number(airportZone.lng))
    : null;

  const bestZone = scoredZones[0];
  const bestZoneDist = bestZone
    ? distanceBetween(driverLat, driverLng, Number(bestZone.zone.lat), Number(bestZone.zone.lng))
    : null;

  const activeWindows = getActiveFlightWindows(hour, minute);
  const upcomingWindows = getUpcomingFlightWindows(hour, minute);

  let summary: string;
  let tip: string;

  if (currentZone) {
    const cz = currentZone as Zone;
    const czScore = scoredZones.find(s => s.zone.id === cz.id);
    const czTip = getZoneTip(cz.type, hour);

    if (czScore && czScore.score > 1.5) {
      summary = `You're in ${cz.name} — high demand zone. Stay here and accept rides.`;
      tip = czTip || "Current location has strong demand. Keep accepting rides.";
    } else if (czScore && czScore.score > 1.0) {
      summary = `You're in ${cz.name} — moderate demand. Rides available.`;
      if (bestZone && bestZone.zone.id !== cz.id && bestZoneDist) {
        const dir = getCardinalDirection(driverLat, driverLng, Number(bestZone.zone.lat), Number(bestZone.zone.lng));
        tip = `Consider heading ${dir} to ${bestZone.zone.name} (${(bestZoneDist / 1000).toFixed(1)}km) for higher demand.`;
      } else {
        tip = czTip || "Accept rides while waiting for demand to pick up.";
      }
    } else {
      summary = `You're in ${cz.name} — low demand right now.`;
      if (bestZone && bestZoneDist) {
        const dir = getCardinalDirection(driverLat, driverLng, Number(bestZone.zone.lat), Number(bestZone.zone.lng));
        tip = `Move ${dir} to ${bestZone.zone.name} (${(bestZoneDist / 1000).toFixed(1)}km) for better earnings.`;
      } else {
        tip = "Consider relocating to a busier area.";
      }
    }
  } else {
    const nearest = zoneDistances.sort((a, b) => a.distance - b.distance)[0];
    if (nearest) {
      const dir = getCardinalDirection(driverLat, driverLng, Number(nearest.zone.lat), Number(nearest.zone.lng));
      summary = `You're outside any demand zone. Nearest: ${nearest.zone.name} (${(nearest.distance / 1000).toFixed(1)}km ${dir}).`;
      tip = `Head ${dir} toward ${nearest.zone.name} to start receiving rides.`;
    } else {
      summary = "Unable to determine your zone. Check GPS signal.";
      tip = "Head toward the city center for best coverage.";
    }
  }

  if (airportZone && airportDist !== null) {
    const airportDistKm = airportDist / 1000;
    const estimatedDriveMin = Math.round(airportDistKm * 2.5 + 5);

    const activeArrivals = activeWindows.filter(w => w.type === "arrival");
    const activeDepartures = activeWindows.filter(w => w.type === "departure");
    const upcomingArrivals = upcomingWindows.filter(w => w.window.type === "arrival");
    const upcomingDepartures = upcomingWindows.filter(w => w.window.type === "departure");

    if (activeArrivals.length > 0 && airportDistKm < 8) {
      const bestArr = activeArrivals[0];
      const adjSurge = getDayAdjustedSurge(bestArr, dayOfWeek);
      tip = `Flights landing NOW at Balice (${airportDistKm.toFixed(1)}km, ~${estimatedDriveMin}min drive). ${adjSurge}x surge. Head to Arrivals for pickups. ${bestArr.flightCount} expected.`;
    } else if (activeArrivals.length > 0 && airportDistKm >= 8) {
      const bestArr = activeArrivals[0];
      const adjSurge = getDayAdjustedSurge(bestArr, dayOfWeek);
      tip = `Arrivals active at Balice but you're ${airportDistKm.toFixed(1)}km away (~${estimatedDriveMin}min). ${adjSurge}x surge — worth the drive if demand is low here.`;
    } else if (activeDepartures.length > 0 && airportDistKm > 5) {
      const bestDep = activeDepartures[0];
      const adjSurge = getDayAdjustedSurge(bestDep, dayOfWeek);
      tip = `Departure surge active (${adjSurge}x). Passengers heading to Balice from hotels — accept airport-bound rides from your area.`;
    } else if (activeDepartures.length > 0 && airportDistKm <= 5) {
      tip = `You're near Balice during departure surge. Queue at Arrivals pickup if flights are also landing, or accept city-bound rides.`;
    } else if (upcomingDepartures.length > 0 && upcomingDepartures[0].minutesAway <= 120) {
      const dep = upcomingDepartures[0];
      const adjSurge = getDayAdjustedSurge(dep.window, dayOfWeek);
      const passengerLeaveTime = dep.minutesAway;
      if (passengerLeaveTime <= 60) {
        tip = `Departure surge in ~${passengerLeaveTime}min (${adjSurge}x, ${dep.window.flightCount}). Passengers ordering rides NOW — position near hotels.`;
      } else {
        tip = `Departures in ~${passengerLeaveTime}min (${adjSurge}x, ${dep.window.flightCount}). Move to hotel districts soon — passengers will start booking rides ~2h before flights.`;
      }
    } else if (upcomingArrivals.length > 0 && upcomingArrivals[0].minutesAway <= 75) {
      const arr = upcomingArrivals[0];
      const adjSurge = getDayAdjustedSurge(arr.window, dayOfWeek);
      const canMakeIt = estimatedDriveMin < arr.minutesAway;
      if (canMakeIt) {
        tip = `Arrivals in ~${arr.minutesAway}min (${adjSurge}x, ${arr.window.flightCount}). You're ${airportDistKm.toFixed(1)}km from Balice (~${estimatedDriveMin}min drive) — head there now to be first in queue.`;
      } else {
        tip = `Arrivals in ~${arr.minutesAway}min but you're ${airportDistKm.toFixed(1)}km away (~${estimatedDriveMin}min drive). Too far to arrive on time — stay in your area.`;
      }
    }
  }

  const nearestHigh = scoredZones
    .filter(s => s.score > 1.2 && (!currentZone || s.zone.id !== (currentZone as Zone).id))
    .map(s => ({
      ...s,
      dist: distanceBetween(driverLat, driverLng, Number(s.zone.lat), Number(s.zone.lng)),
    }))
    .sort((a, b) => a.dist - b.dist)[0];

  return {
    summary,
    currentZone: currentZone
      ? { name: (currentZone as Zone).name, type: (currentZone as Zone).type, demandLevel: (currentZone as Zone).demandLevel || "medium" }
      : null,
    nearestHighDemandZone: nearestHigh
      ? {
          name: nearestHigh.zone.name,
          distanceKm: parseFloat((nearestHigh.dist / 1000).toFixed(1)),
          direction: getCardinalDirection(driverLat, driverLng, Number(nearestHigh.zone.lat), Number(nearestHigh.zone.lng)),
          type: nearestHigh.zone.type,
        }
      : null,
    distanceToAirport: airportDist !== null ? parseFloat((airportDist / 1000).toFixed(1)) : null,
    tip,
  };
}

const ZONE_TIPS: Record<string, string[]> = {
  airport: [
    "Queue at Arrivals pickup lane for best fare.",
    "Check flight board for delays before committing to wait.",
  ],
  center: [
    "Cruise along Florianska and near Rynek for tourist pickups.",
    "Position near hotel entrances on Grodzka or Szewska.",
  ],
  nightlife: [
    "Park near Plac Nowy or Szeroka for bar and club exits.",
    "Stay close to Kazimierz main strip — riders cluster here.",
  ],
  station: [
    "Wait near the main exit of Kraków Główny for arriving passengers.",
    "Cover both the train station and the adjacent bus terminal.",
  ],
  residential: [
    "Circle through residential streets — commuters order from home.",
    "Stay mobile, pickups are scattered across the neighborhood.",
  ],
  mall: [
    "Position near the main entrance and parking exits.",
    "Peak after 17:00 when shoppers leave — good short rides.",
  ],
  event: [
    "Arrive 15 min before event ends for surge pricing on exits.",
    "Cover all venue exits — riders spread across multiple doors.",
  ],
  tourism: [
    "Wait near main attraction entrances for tourist pickups.",
    "Tourists often want rides to restaurants or hotels — expect medium fares.",
  ],
};

function getZoneTip(zoneType: string, hour: number): string {
  const tips = ZONE_TIPS[zoneType];
  if (!tips || tips.length === 0) return "";
  const idx = hour % tips.length;
  return tips[idx];
}

function buildMoveReason(zone: Zone, regime: TimeRegime, score: number, nearbyPois: number, isWeekend: boolean, hour: number, timeStr: string): string {
  const tip = getZoneTip(zone.type, hour);
  const base = (() => {
    if (Number(zone.surgeMultiplier) > 1.2) {
      return `${zone.surgeMultiplier}x surge active at ${zone.name} (${timeStr}).`;
    }
    if (isWeekend && nearbyPois > 0) {
      return `Weekend demand at ${zone.name}, ${nearbyPois} attraction${nearbyPois > 1 ? 's' : ''} active (${timeStr}).`;
    }
    if (nearbyPois > 0) {
      return `High demand near ${zone.name}, ${nearbyPois} attraction${nearbyPois > 1 ? 's' : ''} nearby (${timeStr}).`;
    }
    if (isWeekend) {
      return `Weekend demand peak at ${zone.name} (${timeStr}).`;
    }
    return `High demand at ${zone.name} now (${timeStr}).`;
  })();
  return tip ? `${base} ${tip}` : base;
}

function buildWaitReason(zone: Zone, regime: TimeRegime, nextRegime: TimeRegime, hour: number, minute: number, timeStr: string): string {
  const nextRegimeStart = nextRegime.hours[0];
  let minutesUntilNext: number;
  if (nextRegimeStart > hour) {
    minutesUntilNext = (nextRegimeStart - hour) * 60 - minute;
  } else {
    minutesUntilNext = (24 - hour + nextRegimeStart) * 60 - minute;
  }

  const tip = getZoneTip(zone.type, hour);
  if (minutesUntilNext < 45) {
    const base = `Demand picks up in ~${minutesUntilNext}min (${nextRegime.description}). Hold near ${zone.name}.`;
    return tip ? `${base} ${tip}` : base;
  }

  const base = `Moderate demand — accept rides while waiting (${timeStr}). Stay near ${zone.name}.`;
  return tip ? `${base} ${tip}` : base;
}

export interface ZoneProfitHeatData {
  zoneId: number;
  zoneName: string;
  zoneType: string;
  lat: number;
  lng: number;
  radius: number;
  profitScore: number;
  demandLevel: string;
  surgeMultiplier: number;
  regime: string;
  regimeDescription: string;
}

export interface ZoneProfitHeatResponse {
  zones: ZoneProfitHeatData[];
  transitionNarrative: string;
  targetTime: string;
  regime: string;
}

export function getZoneProfitHeat(
  zones: Zone[],
  pois: Poi[],
  hoursAhead: number = 0,
  minutesAhead: number = 0
): ZoneProfitHeatResponse {
  const now = new Date();
  const futureMs = now.getTime() + (hoursAhead * 3600000) + (minutesAhead * 60000);
  const futureDate = new Date(futureMs);
  const pl = getPolandTime(futureDate);
  const { hour, minute, dayOfWeek } = pl;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

  const regime = getCurrentTimeRegime(hour);
  const nextRegime = getNextTimeRegime(hour);

  if (zones.length === 0) {
    return {
      zones: [],
      transitionNarrative: 'No zones configured',
      targetTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      regime: regime.name,
    };
  }

  const rawScores: { zone: Zone; score: number }[] = zones.map(zone => {
    const activePoisNearby = pois.filter(poi => {
      if (!isPoiActive(poi, hour)) return false;
      const d = distanceBetween(Number(zone.lat), Number(zone.lng), Number(poi.lat), Number(poi.lng));
      return d <= (zone.radius + 500);
    }).length;
    const score = calculateZoneScore(zone, regime, isWeekend, activePoisNearby, hour, minute, dayOfWeek);
    return { zone, score };
  });

  const maxScore = Math.max(...rawScores.map(r => r.score), 0.01);
  const minScore = Math.min(...rawScores.map(r => r.score));
  const range = maxScore - minScore || 1;

  const heatZones: ZoneProfitHeatData[] = rawScores.map(({ zone, score }) => ({
    zoneId: zone.id,
    zoneName: zone.name,
    zoneType: zone.type,
    lat: Number(zone.lat),
    lng: Number(zone.lng),
    radius: zone.radius,
    profitScore: Math.round(((score - minScore) / range) * 100),
    demandLevel: zone.demandLevel || 'medium',
    surgeMultiplier: Number(zone.surgeMultiplier) || 1.0,
    regime: regime.name,
    regimeDescription: regime.description,
  }));

  heatZones.sort((a, b) => b.profitScore - a.profitScore);

  let transitionNarrative = regime.description;
  const regimeEnd = regime.hours[1];
  const currentMinutes = hour * 60 + minute;
  const endMinutes = regimeEnd * 60;
  let minutesUntilNext: number;
  if (endMinutes > currentMinutes) {
    minutesUntilNext = endMinutes - currentMinutes;
  } else if (endMinutes <= regime.hours[0] * 60) {
    minutesUntilNext = (24 * 60 - currentMinutes) + endMinutes;
  } else {
    minutesUntilNext = endMinutes - currentMinutes;
  }

  if (minutesUntilNext <= 45 && nextRegime.name !== regime.name) {
    const risingZones = zones.filter(z => {
      const nextW = nextRegime.zoneWeights[z.type] || 0.5;
      const currW = regime.zoneWeights[z.type] || 0.5;
      return nextW > currW;
    }).map(z => z.name).slice(0, 3);

    transitionNarrative = `${regime.description}. In ~${minutesUntilNext}min: ${nextRegime.description}`;
    if (risingZones.length > 0) {
      transitionNarrative += ` — ${risingZones.join(', ')} heating up`;
    }
  }

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  return {
    zones: heatZones,
    transitionNarrative,
    targetTime: `${hh}:${mm}`,
    regime: regime.name,
  };
}
