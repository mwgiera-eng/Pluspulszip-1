import type { HeatCell } from "./types";

export function heatColor(score: number) {
  if (score >= 90) {
    return { fill: "rgba(255,84,112,0.52)", stroke: "#FF5470", web: "rgba(255,84,112,0.72)" };
  }
  if (score >= 70) {
    return { fill: "rgba(46,230,166,0.48)", stroke: "#2EE6A6", web: "rgba(46,230,166,0.68)" };
  }
  if (score >= 45) {
    return { fill: "rgba(46,230,166,0.30)", stroke: "#20B983", web: "rgba(32,185,131,0.52)" };
  }
  return { fill: "rgba(100,116,139,0.22)", stroke: "#475569", web: "rgba(100,116,139,0.34)" };
}

export function hexCoordinates(cell: HeatCell) {
  const metersPerLat = 111_000;
  const metersPerLng = metersPerLat * Math.cos((cell.lat * Math.PI) / 180);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index) * Math.PI) / 180;
    return {
      latitude: cell.lat + (cell.radius * Math.sin(angle)) / metersPerLat,
      longitude: cell.lng + (cell.radius * Math.cos(angle)) / metersPerLng,
    };
  });
}
