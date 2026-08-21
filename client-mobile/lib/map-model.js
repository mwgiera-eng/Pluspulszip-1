"use strict";

const KRAKOW_BOUNDS = Object.freeze({
  south: 49.85,
  north: 50.25,
  west: 19.55,
  east: 20.25,
});

const ROUTE_ROLES = new Set(["nearest_profitable", "top_route", "drive_to_pickup"]);

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function inRange(value, minimum, maximum) {
  const number = finiteNumber(value);
  return number !== null && number >= minimum && number <= maximum ? number : null;
}

function isKrakowCoordinate(lat, lng) {
  return (
    inRange(lat, KRAKOW_BOUNDS.south, KRAKOW_BOUNDS.north) !== null &&
    inRange(lng, KRAKOW_BOUNDS.west, KRAKOW_BOUNDS.east) !== null
  );
}

function sampleEvenly(values, limit) {
  if (!Array.isArray(values) || limit <= 0) return [];
  if (values.length <= limit) return values;
  if (limit === 1) return [values[0]];
  return Array.from({ length: limit }, (_, index) =>
    values[Math.round((index * (values.length - 1)) / (limit - 1))],
  );
}

function sanitizeGeometry(value, limit = 500) {
  if (!Array.isArray(value)) return [];
  const coordinates = [];
  for (const point of sampleEvenly(value, limit)) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lat = finiteNumber(point[0]);
    const lng = finiteNumber(point[1]);
    if (lat === null || lng === null || !isKrakowCoordinate(lat, lng)) continue;
    const previous = coordinates[coordinates.length - 1];
    if (previous && previous[0] === lat && previous[1] === lng) continue;
    coordinates.push([lat, lng]);
  }
  return coordinates;
}

function sanitizeHeatCells(value, limit = 500) {
  if (!Array.isArray(value)) return [];
  // The API grid is emitted in geographic scan order. Taking only the first
  // cells biases the visible heat layer toward one edge of Kraków; even
  // sampling preserves whole-city coverage while bounding native polygons.
  return sampleEvenly(value, limit).flatMap((cell, index) => {
    if (!cell || typeof cell !== "object") return [];
    const lat = finiteNumber(cell.lat);
    const lng = finiteNumber(cell.lng);
    if (lat === null || lng === null || !isKrakowCoordinate(lat, lng)) return [];
    const radius = inRange(cell.radius, 20, 5000);
    const score = inRange(cell.score, 0, 100);
    if (radius === null || score === null) return [];
    return [{
      id: String(cell.id ?? `heat-${index}`).slice(0, 120),
      lat,
      lng,
      radius,
      score,
    }];
  });
}

function sanitizeRoads(value, limit = 180) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).flatMap((road, index) => {
    if (!road || typeof road !== "object") return [];
    const geometry = sanitizeGeometry(road.geometry, 240);
    const intensity = inRange(road.intensity, 0, 1);
    if (geometry.length < 2 || intensity === null) return [];
    return [{
      id: String(road.id ?? `road-${index}`).slice(0, 120),
      name: String(road.name ?? "").slice(0, 120),
      highway: String(road.highway ?? "").slice(0, 80),
      intensity,
      geometry,
    }];
  });
}

function sanitizeRoutes(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).flatMap((route, index) => {
    if (!route || typeof route !== "object") return [];
    const geometry = sanitizeGeometry(route.geometry, 500);
    if (geometry.length < 2 || !ROUTE_ROLES.has(route.role)) return [];
    return [{
      id: String(route.id ?? `route-${index}`).slice(0, 120),
      fromShort: String(route.fromShort ?? "").slice(0, 120),
      toShort: String(route.toShort ?? "").slice(0, 120),
      estimatedPricePLN: inRange(route.estimatedPricePLN, 0, 100000) ?? 0,
      role: route.role,
      geometry,
    }];
  });
}

function isHeatResponse(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.generatedAt === "string" &&
    finiteNumber(value.radius) !== null &&
    Array.isArray(value.cells) &&
    value.cells.length > 0 &&
    sanitizeHeatCells(value.cells, value.cells.length).length === value.cells.length,
  );
}

function isRoadTrafficResponse(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray(value.roads) &&
    value.roads.length > 0 &&
    inRange(value.baseLevel, 0, 1) !== null &&
    sanitizeRoads(value.roads, value.roads.length).length === value.roads.length,
  );
}

function isRouteGeometries(value) {
  return Boolean(
    Array.isArray(value) &&
    value.length > 0 &&
    sanitizeRoutes(value, value.length).length === value.length,
  );
}

function selectFocusRoute(routes) {
  if (!Array.isArray(routes)) return null;
  return (
    routes.find((route) => route.role === "drive_to_pickup") ||
    routes.find((route) => route.role === "nearest_profitable") ||
    routes[0] ||
    null
  );
}

function interpolateAlongGeometry(geometry, progress) {
  if (!Array.isArray(geometry) || geometry.length === 0) return null;
  if (geometry.length === 1) return { latitude: geometry[0][0], longitude: geometry[0][1] };
  const bounded = Math.max(0, Math.min(0.999999, finiteNumber(progress) ?? 0));
  const scaled = bounded * (geometry.length - 1);
  const index = Math.floor(scaled);
  const fraction = scaled - index;
  const start = geometry[index];
  const end = geometry[Math.min(index + 1, geometry.length - 1)];
  return {
    latitude: start[0] + (end[0] - start[0]) * fraction,
    longitude: start[1] + (end[1] - start[1]) * fraction,
  };
}

module.exports = {
  KRAKOW_BOUNDS,
  interpolateAlongGeometry,
  isHeatResponse,
  isKrakowCoordinate,
  isRoadTrafficResponse,
  isRouteGeometries,
  sanitizeGeometry,
  sanitizeHeatCells,
  sanitizeRoads,
  sanitizeRoutes,
  selectFocusRoute,
};
