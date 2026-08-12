import { Platform } from "react-native";
import type { HeatResponse } from "./types";

const DEFAULT_API_URL = "https://pluspuls-app.onrender.com";

function productionApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
  const url = new URL(configured);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new Error("PlusPuls API must use HTTPS");
  }
  return url.origin;
}

function isHeatResponse(value: unknown): value is HeatResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HeatResponse>;
  return (
    typeof candidate.generatedAt === "string" &&
    typeof candidate.radius === "number" &&
    Array.isArray(candidate.cells) &&
    candidate.cells.every(
      (cell) =>
        cell &&
        typeof cell.id === "string" &&
        Number.isFinite(cell.lat) &&
        Number.isFinite(cell.lng) &&
        Number.isFinite(cell.radius) &&
        Number.isFinite(cell.score),
    )
  );
}

export async function fetchHeat(hoursAhead: number, signal?: AbortSignal): Promise<HeatResponse> {
  const boundedHours = Math.max(0, Math.min(12, Math.round(hoursAhead)));
  const query = new URLSearchParams({ hoursAhead: String(boundedHours), minutesAhead: "0" });
  const url =
    Platform.OS === "web"
      ? `/api/heat?${query.toString()}`
      : `${productionApiUrl()}/api/hex-heat?${query.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("Map data is temporarily unavailable");

  const data: unknown = await response.json();
  if (!isHeatResponse(data)) throw new Error("Map data has an unexpected format");
  return data;
}
