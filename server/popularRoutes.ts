import { getActiveEvents, getEventVenueKeys } from "./krakowEvents";

interface RouteLocation {
  key: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  type: "airport" | "station" | "center" | "mall" | "nightlife" | "event" | "tourism" | "residential" | "parking" | "theater";
  peakTimes: TimeRelevance[];
}

type TimeRelevance =
  | "early_morning"
  | "morning_commute"
  | "midday"
  | "afternoon"
  | "evening_commute"
  | "evening"
  | "night";

const LOCATIONS: RouteLocation[] = [
  { key: "airport", name: "Krakow John Paul II Airport (KRK)", shortName: "Airport (KRK)", lat: 50.0725, lng: 19.80583, type: "airport", peakTimes: ["early_morning", "morning_commute", "evening_commute", "evening"] },
  { key: "mainSquare", name: "Main Square", shortName: "Main Square", lat: 50.0614, lng: 19.9366, type: "center", peakTimes: ["midday", "afternoon", "evening"] },
  { key: "mainStation", name: "Krakow Main Station", shortName: "Main Station", lat: 50.06561, lng: 19.94719, type: "station", peakTimes: ["early_morning", "morning_commute", "afternoon", "evening_commute"] },
  { key: "mainStationParking", name: "Parking nad Dworcem Glownym PKP Krakow", shortName: "Dworzec PKP", lat: 50.0656, lng: 19.9472, type: "parking", peakTimes: ["early_morning", "morning_commute", "afternoon", "evening_commute"] },
  { key: "galeriaBonarka", name: "Galeria Bonarka", shortName: "G. Bonarka", lat: 50.0283, lng: 19.9536, type: "mall", peakTimes: ["midday", "afternoon", "evening_commute"] },
  { key: "galeriaKazimierz", name: "Galeria Kazimierz", shortName: "G. Kazimierz", lat: 50.0480, lng: 19.9560, type: "mall", peakTimes: ["midday", "afternoon", "evening"] },
  { key: "galeriaSerenada", name: "Centrum Serenada", shortName: "C. Serenada", lat: 50.0817, lng: 19.9936, type: "mall", peakTimes: ["midday", "afternoon"] },
  { key: "ikea", name: "IKEA", shortName: "IKEA", lat: 50.0128, lng: 19.9164, type: "mall", peakTimes: ["midday", "afternoon"] },
  { key: "factoryKrakow", name: "Factory Krakow", shortName: "Factory", lat: 50.0140, lng: 20.0150, type: "mall", peakTimes: ["midday", "afternoon"] },
  { key: "tauronArena", name: "Tauron Arena Krakow", shortName: "Tauron Arena", lat: 50.0675, lng: 19.9917, type: "event", peakTimes: ["evening", "night"] },
  { key: "halaForum", name: "Hala Forum", shortName: "Hala Forum", lat: 50.0188, lng: 19.9630, type: "event", peakTimes: ["evening", "night"] },
  { key: "baliceOrangeParking", name: "Lotnisko Balice, Orange Parking", shortName: "Balice Parking", lat: 50.0740, lng: 19.7920, type: "airport", peakTimes: ["early_morning", "morning_commute", "evening_commute"] },
  { key: "teatrBagatela", name: "Teatr Bagatela 03", shortName: "Teatr Bagatela", lat: 50.0630, lng: 19.9350, type: "theater", peakTimes: ["evening", "night"] },
];

export { LOCATIONS };

const SAME_AREA_KEYS = new Set([
  "mainStation|mainStationParking",
  "mainStationParking|mainStation",
  "airport|baliceOrangeParking",
  "baliceOrangeParking|airport",
  "mainSquare|teatrBagatela",
  "teatrBagatela|mainSquare",
]);

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateRouteFare(distanceKm: number): number {
  const baseFare = 5.0;
  const perKm = 2.5;
  const minimum = 8.0;
  const raw = baseFare + distanceKm * perKm;
  return Math.max(minimum, Math.round(raw * 100) / 100);
}

function estimateDuration(distanceKm: number): number {
  const avgSpeedKmh = 25;
  return Math.max(5, Math.round((distanceKm / avgSpeedKmh) * 60));
}

interface GeneratedRoute {
  from: RouteLocation;
  to: RouteLocation;
  distanceKm: number;
  durationMin: number;
  pricePLN: number;
  plnPerMin: number;
}

function generateAllRoutes(): GeneratedRoute[] {
  const routes: GeneratedRoute[] = [];

  for (const from of LOCATIONS) {
    for (const to of LOCATIONS) {
      if (from.key === to.key) continue;
      if (SAME_AREA_KEYS.has(`${from.key}|${to.key}`)) continue;

      const distKm = Math.round(haversineKm(from.lat, from.lng, to.lat, to.lng) * 1.35 * 10) / 10;
      if (distKm < 1.5) continue;

      const durMin = estimateDuration(distKm);
      const pricePLN = estimateRouteFare(distKm);
      const plnPerMin = Math.round((pricePLN / Math.max(durMin, 1)) * 100) / 100;

      routes.push({ from, to, distanceKm: distKm, durationMin: durMin, pricePLN, plnPerMin });
    }
  }

  return routes;
}

function getTimeRelevance(hour: number): TimeRelevance {
  if (hour >= 4 && hour < 7) return "early_morning";
  if (hour >= 7 && hour < 10) return "morning_commute";
  if (hour >= 10 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening_commute";
  if (hour >= 20 && hour < 23) return "evening";
  return "night";
}

function getTimeLabel(relevance: TimeRelevance): string {
  const labels: Record<TimeRelevance, string> = {
    early_morning: "Early Morning",
    morning_commute: "Morning Commute",
    midday: "Midday",
    afternoon: "Afternoon",
    evening_commute: "Evening Rush",
    evening: "Evening",
    night: "Night",
  };
  return labels[relevance];
}

export interface PopularRouteResponse {
  id: string;
  from: string;
  fromShort: string;
  to: string;
  toShort: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  distanceKm: number;
  durationMin: number;
  estimatedPricePLN: number;
  plnPerMin: number;
  passengers: string;
  timeLabel: string;
  relevanceScore: number;
  uberDeepLink: string;
  distToPickupKm: number | null;
  eventSurgeTip: string | null;
}

export function getPopularRoutes(opts?: {
  hour?: number;
  lat?: number;
  lng?: number;
}): PopularRouteResponse[] {
  const polandHour = opts?.hour ?? getCurrentPolandHour();
  const currentRelevance = getTimeRelevance(polandHour);
  const driverLat = opts?.lat;
  const driverLng = opts?.lng;

  const allRoutes = generateAllRoutes();

  const activeEventVenues = getEventVenueKeys();
  const activeEvents = getActiveEvents();

  const scored = allRoutes.map(route => {
    let score = 0;

    score += Math.min(route.plnPerMin * 15, 45);

    const isEventVenueFrom = route.from.type === "event" || route.from.type === "theater";
    const isEventVenueTo = route.to.type === "event" || route.to.type === "theater";

    if (isEventVenueFrom && !activeEventVenues.has(route.from.key)) {
      score -= 25;
    }
    if (isEventVenueTo && !activeEventVenues.has(route.to.key)) {
      score -= 15;
    }

    if (isEventVenueFrom && activeEventVenues.has(route.from.key)) {
      score += 40;
    }
    if (isEventVenueTo && activeEventVenues.has(route.to.key)) {
      score += 20;
    }

    const fromRelevant = route.from.peakTimes.includes(currentRelevance);
    const toRelevant = route.to.peakTimes.includes(currentRelevance);

    if (fromRelevant && toRelevant) {
      score += 20;
    } else if (fromRelevant) {
      score += 12;
    } else if (toRelevant) {
      score += 8;
    }

    if (route.distanceKm >= 10) {
      score += 12;
    } else if (route.distanceKm >= 6) {
      score += 8;
    } else if (route.distanceKm >= 3) {
      score += 4;
    }

    let distToPickup: number | null = null;
    if (driverLat !== undefined && driverLng !== undefined) {
      distToPickup = Math.round(haversineKm(driverLat, driverLng, route.from.lat, route.from.lng) * 10) / 10;
      if (distToPickup < 1) {
        score += 20;
      } else if (distToPickup < 3) {
        score += 12;
      } else if (distToPickup < 6) {
        score += 5;
      }
    }

    const isAirportRoute = route.from.type === "airport" || route.to.type === "airport";
    if (isAirportRoute) {
      if (currentRelevance === "early_morning" || currentRelevance === "morning_commute") {
        score += 20;
      } else if (currentRelevance === "evening_commute" || currentRelevance === "evening") {
        score += 15;
      } else if (currentRelevance === "night") {
        score += 10;
      }
    }

    const isNightlifeRoute = route.from.type === "nightlife" || route.to.type === "nightlife";
    if (isNightlifeRoute && (currentRelevance === "evening" || currentRelevance === "night")) {
      score += 15;
    }

    if (currentRelevance === "night") {
      if (route.from.type === "mall" || route.to.type === "mall") {
        score -= 20;
      }
      if (route.from.type === "tourism" || route.to.type === "tourism") {
        score -= 15;
      }
    }

    if (currentRelevance === "early_morning") {
      if (route.from.type === "residential") score += 10;
      if (route.to.type === "airport" || route.to.type === "station") score += 10;
    }

    const isShoppingRoute = route.from.type === "mall" || route.to.type === "mall";
    if (isShoppingRoute && (currentRelevance === "midday" || currentRelevance === "afternoon")) {
      score += 8;
    }

    let eventSurgeTip: string | null = null;
    for (const eventInfo of activeEvents) {
      if (eventInfo.event.venueKey === route.from.key || eventInfo.event.venueKey === route.to.key) {
        eventSurgeTip = eventInfo.surgeTip;
        break;
      }
    }

    return {
      id: `${route.from.key}-${route.to.key}`,
      from: route.from.name,
      fromShort: route.from.shortName,
      to: route.to.name,
      toShort: route.to.shortName,
      fromLat: route.from.lat,
      fromLng: route.from.lng,
      toLat: route.to.lat,
      toLng: route.to.lng,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      estimatedPricePLN: route.pricePLN,
      plnPerMin: Math.round(route.plnPerMin * 100) / 100,
      passengers: "1-4",
      timeLabel: getTimeLabel(currentRelevance),
      relevanceScore: Math.round(score),
      uberDeepLink: `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${route.from.lat}&pickup[longitude]=${route.from.lng}&dropoff[latitude]=${route.to.lat}&dropoff[longitude]=${route.to.lng}`,
      distToPickupKm: distToPickup,
      eventSurgeTip,
    };
  });

  scored.sort((a, b) => {
    const scoreDiff = b.relevanceScore - a.relevanceScore;
    if (Math.abs(scoreDiff) < 5) {
      return b.plnPerMin - a.plnPerMin;
    }
    return scoreDiff;
  });

  const seen = new Set<string>();
  const deduped: PopularRouteResponse[] = [];
  let airportCount = 0;
  const MAX_AIRPORT_ROUTES = 1;

  for (const r of scored) {
    const parts = r.id.split("-");
    const reverseId = parts.length >= 2 ? `${parts.slice(Math.ceil(parts.length / 2)).join("-")}-${parts.slice(0, Math.ceil(parts.length / 2)).join("-")}` : r.id;
    if (seen.has(reverseId) && deduped.length >= 4) continue;

    const isAirportRoute = r.id.includes("airport") || r.id.includes("balice");
    if (isAirportRoute && airportCount >= MAX_AIRPORT_ROUTES) continue;

    seen.add(r.id);
    deduped.push(r);
    if (isAirportRoute) airportCount++;
    if (deduped.length >= 8) break;
  }

  return deduped;
}

function getCurrentPolandHour(): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    hour: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hourPart = parts.find(p => p.type === "hour");
  return parseInt(hourPart?.value || "12");
}
