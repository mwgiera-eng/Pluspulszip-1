const test = require("node:test");
const assert = require("node:assert/strict");
const {
  interpolateAlongGeometry,
  isHeatResponse,
  isRoadTrafficResponse,
  isRouteGeometries,
  sanitizeGeometry,
  sanitizeHeatCells,
  sanitizeRoads,
  sanitizeRoutes,
  selectFocusRoute,
} = require("../lib/map-model");

const road = {
  id: 7,
  name: "Aleja 29 Listopada",
  highway: "primary",
  intensity: 0.67,
  geometry: [[50.091, 19.952], [50.075, 19.947], [50.061, 19.938]],
};

const route = {
  id: "drive-to-pickup",
  fromShort: "You",
  toShort: "Kraków Airport",
  estimatedPricePLN: 0,
  role: "drive_to_pickup",
  geometry: [[50.0647, 19.945], [50.071, 19.91], [50.0777, 19.7848]],
};

test("heat cells remain geographic and malformed cells are rejected", () => {
  const input = [
    { id: "valid", lat: 50.0647, lng: 19.945, radius: 300, score: 88 },
    { id: "swapped", lat: 19.945, lng: 50.0647, radius: 300, score: 88 },
    { id: "bad-score", lat: 50.0647, lng: 19.945, radius: 300, score: 180 },
  ];
  assert.deepEqual(sanitizeHeatCells(input), [input[0]]);
  assert.equal(isHeatResponse({ generatedAt: new Date().toISOString(), radius: 300, cells: [input[0]] }), true);
  assert.equal(isHeatResponse({ generatedAt: new Date().toISOString(), radius: 300, cells: [] }), false);
});

test("road signals and routes keep server [lat,lng] geometry", () => {
  const roads = sanitizeRoads([road]);
  const routes = sanitizeRoutes([route]);
  assert.equal(roads.length, 1);
  assert.equal(routes.length, 1);
  assert.deepEqual(roads[0].geometry[0], [50.091, 19.952]);
  assert.deepEqual(routes[0].geometry.at(-1), [50.0777, 19.7848]);
  assert.equal(isRoadTrafficResponse({ roads: [road], generatedAt: new Date().toISOString(), hour: 12, baseLevel: 0.4 }), true);
  assert.equal(isRouteGeometries([route]), true);
});

test("GPS route is selected before generic profitable routes", () => {
  const top = { ...route, id: "top", role: "top_route" };
  const best = { ...route, id: "best", role: "nearest_profitable" };
  assert.equal(selectFocusRoute([top, best, route]).id, "drive-to-pickup");
});

test("traffic animation is interpolated on real road coordinates", () => {
  const point = interpolateAlongGeometry(road.geometry, 0.25);
  assert.deepEqual(point, { latitude: 50.083, longitude: 19.9495 });
});

test("geometry sampling preserves both endpoints and rejects screen coordinates", () => {
  const geometry = Array.from({ length: 50 }, (_, index) => [50 + index / 1000, 19.8 + index / 1000]);
  const sampled = sanitizeGeometry(geometry, 5);
  assert.equal(sampled.length, 5);
  assert.deepEqual(sampled[0], geometry[0]);
  assert.deepEqual(sampled.at(-1), geometry.at(-1));
  assert.deepEqual(sanitizeGeometry([[120, 300], [125, 305]]), []);
});

test("route validator rejects missing or unknown route roles", () => {
  assert.equal(isRouteGeometries([{ ...route, role: "screen_particle" }]), false);
  assert.equal(isRouteGeometries([]), false);
});
