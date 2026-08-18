import type { DevicePosition } from "./types";
import type { ZoneProfitHeatData } from "./api";

export type DriverGuidance = {
  target: ZoneProfitHeatData;
  distanceKm: number | null;
  direction: string | null;
  instruction: string;
};

const toRadians = (value: number) => value * Math.PI / 180;

function distanceKm(from: DevicePosition, to: ZoneProfitHeatData) {
  const radius = 6371;
  const lat = toRadians(to.lat - from.lat);
  const lng = toRadians(to.lng - from.lng);
  const a = Math.sin(lat / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(from: DevicePosition, to: ZoneProfitHeatData) {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat)
    - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function directionLabel(value: number) {
  const labels = ["północ", "północny wschód", "wschód", "południowy wschód", "południe", "południowy zachód", "zachód", "północny zachód"];
  return labels[Math.round(value / 45) % labels.length]!;
}

export function chooseDriverGuidance(zones: ZoneProfitHeatData[], position: DevicePosition | null): DriverGuidance | null {
  const valid = zones.filter((zone) => Number.isFinite(zone.lat) && Number.isFinite(zone.lng) && Number.isFinite(zone.profitScore));
  if (!valid.length) return null;

  const target = position
    ? [...valid].sort((left, right) => {
        const leftUtility = left.profitScore - Math.min(35, distanceKm(position, left) * 2.5);
        const rightUtility = right.profitScore - Math.min(35, distanceKm(position, right) * 2.5);
        return rightUtility - leftUtility;
      })[0]!
    : [...valid].sort((left, right) => right.profitScore - left.profitScore)[0]!;

  if (!position) {
    return {
      target,
      distanceKm: null,
      direction: null,
      instruction: `Włącz lokalizację, aby wyznaczyć kierunek do strefy ${target.zoneName}.`,
    };
  }

  const distance = distanceKm(position, target);
  const direction = directionLabel(bearing(position, target));
  return {
    target,
    distanceKm: distance,
    direction,
    instruction: `Jedź na ${direction} w stronę ${target.zoneName}.`,
  };
}
