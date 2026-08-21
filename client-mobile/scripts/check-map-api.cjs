"use strict";

const assert = require("node:assert/strict");
const { isHeatResponse, isRoadTrafficResponse, isRouteGeometries } = require("../lib/map-model");

const configured = process.env.EXPO_PUBLIC_API_URL || "https://pluspulszip-1.onrender.com";
const baseUrl = new URL(configured);
if (baseUrl.protocol !== "https:") throw new Error("Map API smoke test requires HTTPS");

async function fetchJson(path) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(new URL(path, baseUrl), {
        headers: { Accept: "application/json", "User-Agent": "PlusPuls-Mobile-CI" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 5_000));
    }
  }
  throw lastError;
}

async function main() {
  const [heat, traffic, routes] = await Promise.all([
    fetchJson("/api/hex-heat?hoursAhead=0&minutesAhead=0"),
    fetchJson("/api/road-traffic"),
    fetchJson("/api/route-geometries?lat=50.0647&lng=19.945"),
  ]);

  assert.equal(isHeatResponse(heat), true, "hex heat payload is missing or malformed");
  assert.equal(isRoadTrafficResponse(traffic), true, "road traffic payload is missing or malformed");
  assert.equal(isRouteGeometries(routes), true, "route geometry payload is missing or malformed");
  assert.ok(heat.cells.length >= 20, `expected at least 20 heat cells, got ${heat.cells.length}`);
  assert.ok(traffic.roads.length >= 5, `expected at least 5 roads, got ${traffic.roads.length}`);
  assert.ok(routes.some((route) => route.role === "drive_to_pickup"), "GPS query did not return drive_to_pickup navigation");

  console.log(`Map API contract OK: ${heat.cells.length} heat cells, ${traffic.roads.length} roads, ${routes.length} routes.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
