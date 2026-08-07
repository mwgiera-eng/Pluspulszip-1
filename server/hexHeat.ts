/**
 * Granular hexagon heat grid for Kraków.
 *
 * Generates a fine flat-top hex grid over the city bbox and scores every
 * cell 0..100 from the time-varying zone profit heat (inverse-distance
 * weighted), the time-of-day traffic curve, and a stable per-cell
 * "personality" with slow minute drift — so the map genuinely changes
 * through the day instead of showing one static picture.
 */
import type { Zone, Poi } from "@shared/schema";
import { getZoneProfitHeat } from "./recommendationEngine";
import { trafficBaseLevel } from "./roadTraffic";

// Kraków bbox (same as road traffic)
const LAT_MIN = 49.98;
const LAT_MAX = 50.12;
const LNG_MIN = 19.72; // includes Kraków Airport (Balice)
const LNG_MAX = 20.09;

const M_PER_DEG_LAT = 111_000;

export interface HexCell {
  id: string;
  lat: number;
  lng: number;
  /** circumradius in metres (flat-top hexagon) */
  radius: number;
  /** 0..100 */
  score: number;
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Build flat-top hex grid centers covering the bbox. */
function buildGrid(radiusM: number): { lat: number; lng: number; id: string }[] {
  const midLat = (LAT_MIN + LAT_MAX) / 2;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);

  // flat-top hex tiling: horizontal step 1.5R, vertical step sqrt(3)R, odd cols offset by half
  const dx = (1.5 * radiusM) / mPerDegLng;
  const dy = (Math.sqrt(3) * radiusM) / M_PER_DEG_LAT;

  const cells: { lat: number; lng: number; id: string }[] = [];
  let col = 0;
  for (let lng = LNG_MIN; lng <= LNG_MAX; lng += dx, col++) {
    const offset = col % 2 === 1 ? dy / 2 : 0;
    let row = 0;
    for (let lat = LAT_MIN + offset; lat <= LAT_MAX; lat += dy, row++) {
      cells.push({ lat, lng, id: `${col}:${row}` });
    }
  }
  return cells;
}

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat1 * Math.PI) / 180);
  const dy = (lat2 - lat1) * M_PER_DEG_LAT;
  const dx = (lng2 - lng1) * mPerDegLng;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getHexHeat(
  allZones: Zone[],
  allPois: Poi[],
  hoursAhead = 0,
  minutesAhead = 0,
  radiusM = 350,
) {
  const zoneHeat = getZoneProfitHeat(allZones, allPois, hoursAhead, minutesAhead);
  const zones = zoneHeat.zones as Array<{
    lat: number; lng: number; radius: number; profitScore: number;
  }>;

  const traffic = trafficBaseLevel(hoursAhead * 60 + minutesAhead); // 0..1 at target time
  const tMin = Math.floor(Date.now() / 60000);
  const grid = buildGrid(radiusM);

  const cells: HexCell[] = [];
  for (const c of grid) {
    // Inverse-distance weighted zone influence (time-varying via zone scores)
    let wSum = 0;
    let sSum = 0;
    for (const z of zones) {
      const d = distM(c.lat, c.lng, z.lat, z.lng);
      const reach = Math.max(z.radius * 2.2, 1200);
      if (d > reach) continue;
      const w = 1 / (1 + Math.pow(d / (reach * 0.45), 2));
      wSum += w;
      sSum += w * z.profitScore;
    }
    if (wSum < 0.02) continue; // far from any demand — no cell rendered

    const zoneScore = sSum / wSum; // 0..100
    const personality = 0.85 + 0.3 * hash01(c.id);
    const drift = 0.9 + 0.2 * Math.sin((tMin / 9 + hash01(c.id) * 6.28) % 6.28);
    const trafficBoost = 0.75 + 0.5 * traffic;

    const score = Math.max(0, Math.min(100, zoneScore * 0.82 * personality * drift * trafficBoost));
    if (score < 6) continue;
    cells.push({ id: c.id, lat: c.lat, lng: c.lng, radius: radiusM, score: Math.round(score) });
  }

  return {
    generatedAt: new Date().toISOString(),
    forecastLabel: (zoneHeat as any).forecastLabel ?? null,
    radius: radiusM,
    cells,
  };
}
