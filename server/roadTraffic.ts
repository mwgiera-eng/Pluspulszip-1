/**
 * Road traffic simulation for Krakow.
 *
 * Prefers the same OSRM route geometries used by the navigation engine, so
 * animated traffic dots follow real routed roads. OSM/Overpass and bundled
 * corridors remain as backups, with simulated intensity based on time of day
 * and stable per-road variation.
 */

import { fetchMultipleRouteGeometries } from "./osrmService";
import { getPopularRoutes, LOCATIONS } from "./popularRoutes";

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
way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${BBOX});
out geom;
`;



const USE_EXTERNAL_ROADS = process.env.ENABLE_ROAD_TRAFFIC !== "false";
type RoadTrafficSource = "navigation" | "osm" | "fallback";
const ROAD_LIMIT = 750;
const NAVIGATION_ROUTE_LIMIT = 16;
const MIN_NAVIGATION_ROADS = 5;

interface NavigationRoadPair {
  id: number;
  name: string;
  highway: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

const ROAD_PRIORITY: Record<string, number> = {
  motorway: 5,
  trunk: 4,
  primary: 3,
  secondary: 2,
  tertiary: 1,
};
const MAX_POINTS_BY_HIGHWAY: Record<string, number> = {
  motorway: 56,
  trunk: 50,
  primary: 44,
  secondary: 34,
  tertiary: 24,
};

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
  {
    id: -113,
    name: "Pilotow / Bora-Komorowskiego",
    highway: "tertiary",
    geometry: [
      [50.074, 19.96],
      [50.08, 19.985],
      [50.088, 20.015],
    ],
  },
  {
    id: -114,
    name: "Pawia / Warszawska",
    highway: "tertiary",
    geometry: [
      [50.073, 19.944],
      [50.067, 19.947],
      [50.061, 19.951],
    ],
  },
  {
    id: -115,
    name: "Westerplatte / Starowislna",
    highway: "tertiary",
    geometry: [
      [50.064, 19.94],
      [50.057, 19.944],
      [50.049, 19.949],
    ],
  },
  {
    id: -116,
    name: "Karmelicka / Krolewska",
    highway: "tertiary",
    geometry: [
      [50.064, 19.932],
      [50.071, 19.918],
      [50.077, 19.9],
    ],
  },
  {
    id: -117,
    name: "Monte Cassino",
    highway: "secondary",
    geometry: [
      [50.049, 19.927],
      [50.044, 19.92],
      [50.038, 19.913],
    ],
  },
  {
    id: -118,
    name: "Kapelanka / Tyniecka",
    highway: "secondary",
    geometry: [
      [50.048, 19.916],
      [50.035, 19.91],
      [50.018, 19.895],
    ],
  },
  {
    id: -119,
    name: "Wadowicka / Kalwaryjska",
    highway: "secondary",
    geometry: [
      [50.036, 19.935],
      [50.039, 19.948],
      [50.045, 19.955],
    ],
  },
  {
    id: -120,
    name: "Biezanowska",
    highway: "tertiary",
    geometry: [
      [50.026, 19.972],
      [50.014, 19.987],
      [50.003, 20.001],
    ],
  },
  {
    id: -121,
    name: "Stella-Sawickiego",
    highway: "secondary",
    geometry: [
      [50.08, 20.0],
      [50.077, 20.025],
      [50.073, 20.05],
    ],
  },
  {
    id: -122,
    name: "Igołomska",
    highway: "secondary",
    geometry: [
      [50.071, 20.035],
      [50.073, 20.065],
      [50.077, 20.09],
    ],
  },
  {
    id: -123,
    name: "Kamienna / Pradnicka",
    highway: "tertiary",
    geometry: [
      [50.073, 19.938],
      [50.084, 19.94],
      [50.096, 19.943],
    ],
  },
  {
    id: -124,
    name: "Meissnera / Lema",
    highway: "tertiary",
    geometry: [
      [50.067, 19.982],
      [50.067, 20.003],
      [50.069, 20.018],
    ],
  },
];

function useFallbackRoads(reason: string): Omit<RoadSegment, "intensity">[] {
  lastFetchError = reason;
  roadSource = "fallback";
  cachedAt = new Date().toISOString();
  cachedRoads = FALLBACK_ROADS;
  console.warn(`[roadTraffic] Using bundled Krakow road geometry fallback: ${reason}`);
  return cachedRoads;
}

let cachedRoads: Omit<RoadSegment, "intensity">[] | null = null;
let fetchPromise: Promise<Omit<RoadSegment, "intensity">[]> | null = null;
let lastFetchError: string | null = null;
let roadSource: RoadTrafficSource | null = null;
let cachedAt: string | null = null;

function simplifyGeometry(geometry: [number, number][], highway: string): [number, number][] {
  const maxPoints = MAX_POINTS_BY_HIGHWAY[highway] ?? 24;
  if (geometry.length <= maxPoints) return geometry;

  const simplified: [number, number][] = [];
  const step = Math.ceil(geometry.length / maxPoints);
  for (let i = 0; i < geometry.length; i += step) {
    simplified.push(geometry[i]);
  }
  const last = geometry[geometry.length - 1];
  if (simplified[simplified.length - 1] !== last) simplified.push(last);
  return simplified;
}

function collectNavigationRoadPairs(): NavigationRoadPair[] {
  const pairs: NavigationRoadPair[] = [];
  const seen = new Set<string>();
  let nextId = -2_000;

  const addPair = (
    name: string,
    highway: string,
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ) => {
    if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) return;

    // Treat both directions as one corridor; OSRM returns the real road-following polyline.
    const endpoints = [
      `${fromLat.toFixed(4)},${fromLng.toFixed(4)}`,
      `${toLat.toFixed(4)},${toLng.toFixed(4)}`,
    ].sort();
    const key = endpoints.join("|");
    if (seen.has(key)) return;

    seen.add(key);
    pairs.push({
      id: nextId--,
      name,
      highway,
      fromLat,
      fromLng,
      toLat,
      toLng,
    });
  };

  const highwayForDistance = (distanceKm: number) => {
    if (distanceKm >= 10) return "primary";
    if (distanceKm >= 4) return "secondary";
    return "tertiary";
  };

  for (const route of getPopularRoutes().slice(0, 10)) {
    addPair(
      `${route.fromShort} -> ${route.toShort}`,
      highwayForDistance(route.distanceKm),
      route.fromLat,
      route.fromLng,
      route.toLat,
      route.toLng,
    );
  }

  const byKey = new Map(LOCATIONS.map((location) => [location.key, location]));

  const addLocationPair = (fromKey: string, toKey: string, highway: string) => {
    const from = byKey.get(fromKey);
    const to = byKey.get(toKey);
    if (!from || !to) return;
    addPair(
      `${from.shortName} -> ${to.shortName}`,
      highway,
      from.lat,
      from.lng,
      to.lat,
      to.lng,
    );
  };

  [
    ["airport", "mainStation", "primary"],
    ["airport", "mainSquare", "primary"],
    ["baliceOrangeParking", "mainStation", "primary"],
    ["airport", "galeriaKazimierz", "primary"],
    ["mainStation", "tauronArena", "secondary"],
    ["mainStation", "galeriaSerenada", "secondary"],
    ["mainSquare", "galeriaBonarka", "secondary"],
    ["mainSquare", "tauronArena", "secondary"],
    ["mainSquare", "ikea", "secondary"],
    ["mainSquare", "galeriaKazimierz", "tertiary"],
    ["galeriaBonarka", "factoryKrakow", "primary"],
    ["galeriaKazimierz", "galeriaSerenada", "secondary"],
    ["halaForum", "mainStation", "secondary"],
    ["teatrBagatela", "airport", "primary"],
  ].forEach(([fromKey, toKey, highway]) => addLocationPair(fromKey, toKey, highway));

  return pairs.slice(0, NAVIGATION_ROUTE_LIMIT);
}

async function fetchNavigationRoads(): Promise<Omit<RoadSegment, "intensity">[]> {
  const pairs = collectNavigationRoadPairs();
  const geometries = await fetchMultipleRouteGeometries(
    pairs.map(({ fromLat, fromLng, toLat, toLng }) => ({ fromLat, fromLng, toLat, toLng })),
  );

  return geometries.flatMap((geometry, index) => {
    if (!geometry || geometry.coordinates.length < 2) return [];
    const pair = pairs[index];
    return [{
      id: pair.id,
      name: pair.name,
      highway: pair.highway,
      geometry: simplifyGeometry(geometry.coordinates, pair.highway),
    }];
  });
}

function cacheRoads(
  roads: Omit<RoadSegment, "intensity">[],
  source: Exclude<RoadTrafficSource, "fallback">,
  note: string | null = null,
): Omit<RoadSegment, "intensity">[] {
  cachedRoads = roads;
  roadSource = source;
  cachedAt = new Date().toISOString();
  lastFetchError = note;
  console.log(`[roadTraffic] Cached ${roads.length} road segments from ${source}`);
  return cachedRoads;
}

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
  return roads
    .sort((a, b) => {
      const priority = (ROAD_PRIORITY[b.highway] ?? 0) - (ROAD_PRIORITY[a.highway] ?? 0);
      if (priority !== 0) return priority;
      return b.geometry.length - a.geometry.length;
    })
    .slice(0, ROAD_LIMIT)
    .map((road) => ({
      ...road,
      geometry: simplifyGeometry(road.geometry, road.highway),
    }));
}

async function getRoads(): Promise<Omit<RoadSegment, "intensity">[]> {
  if (cachedRoads) return cachedRoads;

  if (!USE_EXTERNAL_ROADS) {
    return useFallbackRoads("ENABLE_ROAD_TRAFFIC is false");
  }

  if (!fetchPromise) {
    fetchPromise = (async () => {
      let navigationNote: string | null = null;

      try {
        const navigationRoads = await fetchNavigationRoads();
        if (navigationRoads.length >= MIN_NAVIGATION_ROADS) {
          return cacheRoads(navigationRoads, "navigation");
        }
        navigationNote = `OSRM navigation returned only ${navigationRoads.length} usable routes`;
      } catch (err) {
        navigationNote = `OSRM navigation failed: ${String(err)}`;
      }

      try {
        const roads = await fetchRoads();
        if (roads.length < 6) {
          const note = [navigationNote, `Overpass returned only ${roads.length} usable roads`]
            .filter(Boolean)
            .join("; ");
          return useFallbackRoads(note);
        }
        return cacheRoads(roads, "osm", navigationNote);
      } catch (err) {
        fetchPromise = null; // allow retry after a service restart
        const note = [navigationNote, String(err)].filter(Boolean).join("; ");
        return useFallbackRoads(note);
      }
    })();
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
  tertiary: 0.45,
};

export async function getRoadTraffic(): Promise<{
  roads: RoadSegment[];
  generatedAt: string;
  hour: number;
  baseLevel: number;
  source: RoadTrafficSource | null;
  roadCount: number;
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
    source: roadSource,
    roadCount: withIntensity.length,
  };
}

export function getRoadTrafficStatus() {
  return {
    cached: !!cachedRoads,
    roadCount: cachedRoads?.length ?? 0,
    source: roadSource,
    cachedAt,
    lastError: lastFetchError,
  };
}
