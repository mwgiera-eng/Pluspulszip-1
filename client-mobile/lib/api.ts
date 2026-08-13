import { Platform } from "react-native";
import type { HeatResponse } from "./types";

const DEFAULT_API_URL = "https://pluspuls-api.onrender.com";

export type RoadSegment = {
  id: number;
  name: string;
  highway: string;
  geometry: [number, number][];
  intensity: number;
};

export type RoadTrafficResponse = {
  roads: RoadSegment[];
  generatedAt: string;
  hour: number;
  baseLevel: number;
};

export type ZoneProfitHeatData = {
  zoneId: number;
  zoneName: string;
  zoneType: string;
  lat: number;
  lng: number;
  radius: number;
  profitScore: number;
  demandLevel: string;
  surgeMultiplier: number;
  regime: string;
  regimeDescription: string;
};

export type ZoneProfitHeatResponse = {
  zones: ZoneProfitHeatData[];
  transitionNarrative: string;
  targetTime: string;
  regime: string;
};

export type ScrapedFlight = {
  time: string;
  destination: string;
  airportCode: string;
  flightNumber: string;
  airlineCode: string;
  airlineName: string;
  status: string;
  type: "arrival" | "departure";
};

export type AirportFlightsResponse = {
  arrivals: ScrapedFlight[];
  departures: ScrapedFlight[];
  arrivalsSource: "live" | "static";
  departuresSource: "live" | "static";
};

export type HourBlock = {
  hour: number;
  label: string;
  demandLevel: "low" | "medium" | "high" | "surge";
  bestZone: string;
  zoneType: string;
  earningsPotential: string;
  flights: { type: string; label: string; count: string }[];
  events: { title: string; status: string; venue: string }[];
  platformTip: string;
  platformHighlight: "uber" | "bolt" | "any";
  proTip: string;
  regime: string;
};

export type DayPlanResponse = {
  date: string;
  dayName: string;
  blocks: HourBlock[];
  summary: string;
  uberTip: string;
};

export type EarningsStats = {
  totalEarnings: number;
  totalTrips: number;
  averagePerTrip: number;
  topZones: { name: string; amount: number }[];
};

export type NotificationPrefs = {
  airportInfo: boolean;
  events: boolean;
  hotZones: boolean;
  relocate: boolean;
  bestEarnings: boolean;
  frequency: string;
};

export function productionApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
  const url = new URL(configured);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new Error("PlusPuls API must use HTTPS");
  }
  return url.origin;
}

function apiUrl(path: string): string {
  if (Platform.OS === "web" && path === "/api/hex-heat") return "/api/heat";
  return Platform.OS === "web" ? path : `${productionApiUrl()}${path}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const suffix = response.status === 401 || response.status === 403 ? " Sign in may be required." : "";
    throw new Error(`PlusPuls API request failed (${response.status}).${suffix}`);
  }
  return response.json() as Promise<T>;
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
  const response = await fetch(apiUrl(`/api/hex-heat?${query.toString()}`), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("Map data is temporarily unavailable");

  const data: unknown = await response.json();
  if (!isHeatResponse(data)) throw new Error("Map data has an unexpected format");
  return data;
}

export function fetchRoadTraffic(signal?: AbortSignal) {
  return apiFetch<RoadTrafficResponse>("/api/road-traffic", { signal });
}

export function fetchZoneProfitHeat(hoursAhead: number, minutesAhead = 0, signal?: AbortSignal) {
  const query = new URLSearchParams({
    hoursAhead: String(Math.max(0, Math.min(12, Math.round(hoursAhead)))),
    minutesAhead: String(Math.max(0, Math.min(59, Math.round(minutesAhead)))),
  });
  return apiFetch<ZoneProfitHeatResponse>(`/api/zone-profit-heat?${query.toString()}`, { signal });
}

export function fetchAirportFlights(signal?: AbortSignal) {
  return apiFetch<AirportFlightsResponse>("/api/airport-flights", { signal });
}

export function fetchDayPlan(tomorrow: boolean, signal?: AbortSignal) {
  return apiFetch<DayPlanResponse>(`/api/day-plan?tomorrow=${tomorrow ? "true" : "false"}`, { signal });
}

export function fetchEarningsStats(signal?: AbortSignal) {
  return apiFetch<EarningsStats>("/api/earnings/stats", { signal });
}

export function fetchNotificationPreferences(signal?: AbortSignal) {
  return apiFetch<NotificationPrefs>("/api/notification-preferences", { signal });
}

export function saveNotificationPreferences(data: NotificationPrefs) {
  return apiFetch<NotificationPrefs>("/api/notification-preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
