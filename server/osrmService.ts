const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

interface RouteGeometryRequest {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

export interface RouteGeometry {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

const geometryCache = new Map<string, { data: RouteGeometry; timestamp: number }>();
const CACHE_TTL = 3600000;

function getCacheKey(req: RouteGeometryRequest): string {
  return `${req.fromLat.toFixed(4)},${req.fromLng.toFixed(4)}-${req.toLat.toFixed(4)},${req.toLng.toFixed(4)}`;
}

export async function fetchRouteGeometry(req: RouteGeometryRequest): Promise<RouteGeometry | null> {
  const cacheKey = getCacheKey(req);
  const cached = geometryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = `${OSRM_BASE}/${req.fromLng},${req.fromLat};${req.toLng},${req.toLat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const coords: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]]
    );

    const result: RouteGeometry = {
      coordinates: coords,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };

    geometryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    return null;
  }
}

export async function fetchMultipleRouteGeometries(
  routes: RouteGeometryRequest[]
): Promise<(RouteGeometry | null)[]> {
  return Promise.all(routes.map(fetchRouteGeometry));
}
