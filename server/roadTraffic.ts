/**
 * Road traffic simulation for Krakow.
 *
 * Fetches real road geometries (motorway/trunk/primary/secondary) from
 * OpenStreetMap's Overpass API once, caches them in memory, and attaches a
 * simulated traffic intensity to each road segment based on time of day and
 * a stable per-road variation.
 */

interface RoadSegment {
  id: number;
  name: string;
  highway: string;
  geometry: [number, number][]; // [lat, lng]
  intensity: number; // 0..1 current simulated traffic level
}

// Central Krakow bounding box (south, west, north, east)
const BBOX = "49.99,19.79,50.11,20.08";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const QUERY = `
[out:json][timeout:30];
way["highway"~"^(motorway|trunk|primary|secondary)$"](${BBOX});
out geom;
`;



const USE_EXTERNAL_ROADS = process.env.ENABLE_EXTERNAL_SIGNALS !== "false";

const FALLBACK_ROADS: Omit<RoadSegment, "intensity">[] = [
  {
    id: -101,
    name: "A4 / Airport corridor",
    highway: "motorway",
    geometry: [
      [50.083, 19.79],
      [50.079, 19.82],
      [50.072, 19.86],
      [50.065, 19.9],
      [50.063, 19.945],
    ],
  },
  {
    id: -102,
    name: "Opolska",
    highway: "primary",
    geometry: [
      [50.085, 19.89],
      [50.09, 19.93],
      [50.092, 19.975],
      [50.09, 20.03],
    ],
  },
  {
    id: -103,
    name: "Aleje Trzech Wieszczow",
    highway: "primary",
    geometry: [
      [50.075, 19.91],
      [50.067, 19.923],
      [50.058, 19.931],
      [50.048, 19.936],
    ],
  },
  {
    id: -104,
    name: "Lubicz / Mogilska",
    highway: "primary",
    geometry: [
      [50.0656, 19.9472],
      [50.067, 19.966],
      [50.07, 19.995],
      [50.072, 20.025],
    ],
  },
  {
    id: -105,
    name: "Nowohucka",
    highway: "primary",
    geometry: [
      [50.052, 19.97],
      [50.055, 19.995],
      [50.06, 20.025],
      [50.064, 20.06],
    ],
  },
  {
    id: -106,
    name: "Wielicka",
    highway: "primary",
    geometry: [
      [50.046, 19.956],
      [50.034, 19.97],
      [50.017, 19.985],
      [50.004, 20.005],
    ],
  },
  {
    id: -107,
    name: "Zakopianska",
    highway: "primary",
    geometry: [
      [50.044, 19.935],
      [50.026, 19.927],
      [50.006, 19.914],
    ],
  },
  {
    id: -108,
    name: "Konopnickiej",
    highway: "secondary",
    geometry: [
      [50.052, 19.925],
      [50.046, 19.932],
      [50.04, 19.94],
      [50.034, 19.948],
    ],
  },
  {
    id: -109,
    name: "Dietla",
    highway: "secondary",
    geometry: [
      [50.051, 19.925],
      [50.05, 19.944],
      [50.051, 19.964],
    ],
  },
  {
    id: -110,
    name: "Kotlarska / Grzegorzecka",
    highway: "secondary",
    geometry: [
      [50.052, 19.945],
      [50.05, 19.96],
      [50.052, 19.98],
    ],
  },
  {
    id: -111,
    name: "Powstania Warszawskiego",
    highway: "secondary",
    geometry: [
      [50.068, 19.947],
      [50.058, 19.958],
      [50.05, 19.968],
    ],
  },
  {
    id: -112,
    name: "Balicka / Bronowice",
    highway: "secondary",
    geometry: [
      [50.081, 19.79],
      [50.083, 19.84],
      [50.081, 19.885],
      [50.077, 19.91],
    ],
  },
];

function useFallbackRoads(reason: string): Omit<RoadSegment, "intensity">[] {
  lastFetchError = reason;
  cachedRoads = FALLBACK_ROADS;
  console.warn(`[roadTraffic] Using bundled Krakow road geometry fallback: ${reason}`);
  return cachedRoads;
}

let cachedRoads: Omit<RoadSegment, "intensity">[] | null = null;
let fetchPromise: Promise<Omit<RoadSegment, "intensity">[]> | null = null;
let lastFetchError: string | null = null;

async function fetchRoads(): Promise<Omit<RoadSegment, "intensity">[]> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "PlusPuls/1.0 (driver traffic visualization)",
    },
    body: `data=${encodeURIComponent(QUERY)}`,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Overpass responded ${res.status}`);
  const json: any = await res.json();

  const roads: Omit<RoadSegment, "intensity">[] = [];
  for (const el of json.elements ?? []) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    roads.push({
      id: el.id,
      name: el.tags?.name ?? el.tags?.ref ?? "",
      highway: el.tags?.highway ?? "road",
      geometry: el.geometry.map((g: any) => [g.lat, g.lon] as [number, number]),
    });
  }
  return roads;
}

async function getRoads(): Promise<Omit<RoadSegment, "intensity">[]> {
  if (cachedRoads) return cachedRoads;

  if (!USE_EXTERNAL_ROADS) {
    return useFallbackRoads("ENABLE_EXTERNAL_SIGNALS is false");
  }

  if (!fetchPromise) {
    fetchPromise = fetchRoads()
      .then((roads) => {
        if (roads.length < 6) {
          return useFallbackRoads(`Overpass returned only ${roads.length} usable roads`);
        }
        cachedRoads = roads;
        lastFetchError = null;
        console.log(`[roadTraffic] Cached ${roads.length} road segments from OSM`);
        return roads;
      })
      .catch((err) => {
        fetchPromise = null; // allow retry after a service restart
        return useFallbackRoads(String(err));
      });
  }
  return fetchPromise;
}

/** Deterministic pseudo-random 0..1 from a road id */
function hash01(id: number): number {
  let h = id | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295;
}

/** Base traffic level 0..1 for a given hour in Krakow (CET), weekday-aware */
function hourCurve(hour: number, dow?: number): number {
  const isWeekend = dow === 0 || dow === 6;
  const isFriSat = dow === 5 || dow === 6;
  if (isWeekend) {
    // late start, afternoon shopping/leisure peak, evening social peak
    const midday = 0.55 * Math.exp(-Math.pow(hour - 14, 2) / 14);
    const evening = 0.7 * Math.exp(-Math.pow(hour - 19, 2) / 10);
    const nightlife = isFriSat ? 0.35 * Math.exp(-Math.pow(hour - 23, 2) / 4) : 0;
    const night = hour >= 2 && hour <= 6 ? 0.04 : 0.1;
    return Math.min(1, night + midday + evening + nightlife);
  }
  // weekday: morning peak ~8, evening peak ~17
  const morning = Math.exp(-Math.pow(hour - 8, 2) / 6);
  const evening = Math.exp(-Math.pow(hour - 17, 2) / 8);
  const day = 0.25 * Math.exp(-Math.pow(hour - 13, 2) / 30);
  const nightlife = isFriSat ? 0.3 * Math.exp(-Math.pow(hour - 22.5, 2) / 4) : 0;
  const night = hour >= 22 || hour <= 4 ? 0.05 : 0.12;
  return Math.min(1, night + day + nightlife + 0.85 * morning + 0.95 * evening);
}

function krakowNowParts(offsetMinutes = 0): { hour: number; dow: number } {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: (parseInt(get("hour"), 10) % 24) + parseInt(get("minute"), 10) / 60,
    dow: dowMap[get("weekday")] ?? 1,
  };
}

/** Base traffic level 0..1 at now + offsetMinutes (Krakow time, weekday-aware). */
export function trafficBaseLevel(offsetMinutes = 0): number {
  const { hour, dow } = krakowNowParts(offsetMinutes);
  return hourCurve(hour, dow);
}

const HIGHWAY_WEIGHT: Record<string, number> = {
  motorway: 1.0,
  trunk: 0.95,
  primary: 0.85,
  secondary: 0.65,
};

export async function getRoadTraffic(): Promise<{
  roads: RoadSegment[];
  generatedAt: string;
  hour: number;
  baseLevel: number;
}> {
  const roads = await getRoads();

  // Current hour in Krakow (DST-aware)
  const now = new Date();
  const krakowHour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      hour12: false,
    }).format(now),
    10,
  ) % 24;
  const dowStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", weekday: "short" }).format(now);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const base = hourCurve(krakowHour + now.getUTCMinutes() / 60, dowMap[dowStr] ?? 1);

  // Slow oscillation so intensities drift over minutes, not per-request noise
  const t = Math.floor(now.getTime() / 60000); // minutes epoch

  const withIntensity: RoadSegment[] = roads.map((r) => {
    const weight = HIGHWAY_WEIGHT[r.highway] ?? 0.5;
    const personality = 0.6 + 0.8 * hash01(r.id); // stable per-road factor
    const drift = 0.85 + 0.3 * Math.sin((t / 7 + hash01(r.id) * 6.28) % 6.28);
    const intensity = Math.max(0.03, Math.min(1, base * weight * personality * drift));
    return { ...r, intensity: Math.round(intensity * 100) / 100 };
  });

  return {
    roads: withIntensity,
    generatedAt: now.toISOString(),
    hour: krakowHour,
    baseLevel: Math.round(base * 100) / 100,
  };
}

export function getRoadTrafficStatus() {
  return {
    cached: !!cachedRoads,
    roadCount: cachedRoads?.length ?? 0,
    lastError: lastFetchError,
  };
}
