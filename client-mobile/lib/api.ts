import { Platform } from "react-native";
import type { HeatResponse } from "./types";
import { isHeatResponse, isRoadTrafficResponse, isRouteGeometries } from "./map-model";

const DEFAULT_API_URL = "https://pluspulszip-1.onrender.com";
const TRUSTED_API_ORIGINS = new Set([DEFAULT_API_URL]);

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

export type MapPoi = {
  id?: number | string;
  name?: string;
  type?: string;
  category?: string;
  lat: number | string;
  lng: number | string;
};

export type MapDataResponse = { pois?: MapPoi[] };

export type RouteGeometryData = {
  id: string;
  fromShort: string;
  toShort: string;
  estimatedPricePLN: number;
  role: "nearest_profitable" | "top_route" | "drive_to_pickup";
  geometry: [number, number][];
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

export type EarningsUploadResult = {
  processed: number;
  failed: number;
  errors?: string[];
};

export type Fleet = { id: string; name: string; ownerUserId: string; createdAt: string };
export type FleetProfile = { id: string; anonymousDriverId: string; displayName: string; isLeaderDriver: boolean; avgEarningsPerKm: number; percentileRank: number; totalTripsAnalyzed: number };
export type FleetPattern = { zoneGeohash: string; timeSlot: number; dayOfWeek: number; avgEarningsPerKm: number; tripCount: number; leaderPercentage: number };
export type FleetGuidance = { type: "PATTERN_SUGGESTION" | "LEADER_ZONE_DETECTED" | "INEFFICIENT_ROUTE_ALERT"; priority: "low" | "medium" | "high"; title: string; body: string; zoneGeohash?: string; estimatedGainPct?: number };
export type FleetTrip = { tripId: string; pickupGeohash: string; dropoffGeohash: string; startEpoch: number; netIncome: number; distanceKm: number; timeSlot: number; dayOfWeek: number };

export type NotificationPrefs = {
  airportInfo: boolean;
  events: boolean;
  hotZones: boolean;
  relocate: boolean;
  bestEarnings: boolean;
  frequency: string;
};

export type SubscriptionInfo = {
  status: "trial" | "active" | "expired" | "cancelled";
  isPremium: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  subscriptionExpiresAt: string | null;
  subscriptionDaysLeft: number | null;
  price: number;
  currency: string;
};

export type AuthUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "user" | "admin" | string;
  status: "pending" | "approved" | "active" | "rejected" | "disabled" | "suspended" | string;
  accountType?: "driver" | "provider" | null;
  companyName?: string | null;
  phoneNumber?: string | null;
  isPremium?: boolean;
  subscriptionInfo?: SubscriptionInfo;
};

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted: true;
  privacyAccepted: true;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly issues?: { field?: string; message?: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function productionApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
  const url = new URL(configured);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new Error("PlusPuls API must use HTTPS");
  }
  if (!local && !TRUSTED_API_ORIGINS.has(url.origin)) {
    throw new Error("PlusPuls API origin is not trusted");
  }
  return url.origin;
}

function apiUrl(path: string): string {
  if (Platform.OS === "web" && path === "/api/hex-heat") return "/api/heat";
  return Platform.OS === "web" ? path : `${productionApiUrl()}${path}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as {
      message?: unknown;
      code?: unknown;
      issues?: { field?: string; message?: string }[];
    };
    const fallback = response.status === 401
      ? "Zaloguj się, aby kontynuować."
      : response.status === 403
        ? "To konto nie ma dostępu do tej funkcji."
        : `PlusPuls API request failed (${response.status}).`;
    throw new ApiError(
      typeof body.message === "string" ? body.message.slice(0, 240) : fallback,
      response.status,
      typeof body.code === "string" ? body.code.slice(0, 80) : undefined,
      Array.isArray(body.issues) ? body.issues.slice(0, 8) : undefined,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchHeat(hoursAhead: number, minutesAhead = 0, signal?: AbortSignal): Promise<HeatResponse> {
  const boundedHours = Math.max(0, Math.min(12, Math.round(hoursAhead)));
  const boundedMinutes = Math.max(0, Math.min(59, Math.round(minutesAhead)));
  const query = new URLSearchParams({ hoursAhead: String(boundedHours), minutesAhead: String(boundedMinutes) });
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

export async function fetchRoadTraffic(signal?: AbortSignal): Promise<RoadTrafficResponse> {
  const data: unknown = await apiFetch<unknown>("/api/road-traffic", { signal });
  if (!isRoadTrafficResponse(data)) throw new Error("Road traffic data has an unexpected format");
  return data;
}

export function fetchMapData(signal?: AbortSignal) {
  return apiFetch<MapDataResponse>("/api/map-data", { signal });
}

export async function fetchRouteGeometries(
  position?: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<RouteGeometryData[]> {
  const query = new URLSearchParams();
  if (position && Number.isFinite(position.lat) && Number.isFinite(position.lng)) {
    query.set("lat", String(position.lat));
    query.set("lng", String(position.lng));
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  const data: unknown = await apiFetch<unknown>(`/api/route-geometries${suffix}`, { signal });
  if (!isRouteGeometries(data)) throw new Error("Route geometry data has an unexpected format");
  return data;
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

export function uploadSanitizedEarningsCsv(uri: string) {
  const form = new FormData();
  form.append("file", {
    uri,
    name: "pluspuls-sanitized.csv",
    type: "text/csv",
  } as unknown as Blob);
  return apiFetch<EarningsUploadResult>("/api/earnings/upload", {
    method: "POST",
    body: form,
  });
}

export function fetchMyFleet(signal?: AbortSignal) {
  return apiFetch<Fleet | null>("/api/fleet/me", { signal });
}

export function createFleet(name: string) {
  return apiFetch<Fleet>("/api/fleet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
}

export function uploadFleetTrips(input: { fleetId: string; anonymousDriverId: string; displayName: string; trips: FleetTrip[]; payloadDigest: string }) {
  return apiFetch<{ profileId: string; processed: number; rejected: number }>("/api/fleet/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
}

export function extractFleetPatterns(fleetId: string) {
  return apiFetch<{ patterns: FleetPattern[]; count: number }>(`/api/fleet/${encodeURIComponent(fleetId)}/patterns/extract`, { method: "POST", headers: { "Content-Type": "application/json" } });
}

export function fetchFleetLeaderboard(fleetId: string, signal?: AbortSignal) {
  return apiFetch<FleetProfile[]>(`/api/fleet/${encodeURIComponent(fleetId)}/leaderboard`, { signal });
}

export function fetchFleetGuidance(fleetId: string, profileId: string, signal?: AbortSignal) {
  return apiFetch<FleetGuidance[]>(`/api/fleet/${encodeURIComponent(fleetId)}/profile/${encodeURIComponent(profileId)}/guidance`, { signal });
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

export async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>("/api/auth/user", { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function loginWithPassword(email: string, password: string) {
  return apiFetch<{ user: AuthUser }>("/api/login/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
}

export function registerWithPassword(input: RegisterInput) {
  return apiFetch<{ user: AuthUser }>("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, email: input.email.trim().toLowerCase() }),
  });
}

export function logoutCurrentUser() {
  return apiFetch<void>("/api/logout", { method: "POST", headers: { "Content-Type": "application/json" } });
}

export function deleteCurrentAccount(password: string) {
  return apiFetch<void>("/api/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, confirmation: "DELETE" }),
  });
}

export function updateAccountType(accountType: "driver" | "provider", companyName?: string) {
  return apiFetch<AuthUser>("/api/auth/account-type", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountType, companyName: companyName?.trim() || undefined }),
  });
}

export function sendHeartbeat(signal?: AbortSignal) {
  return apiFetch<void>("/api/heartbeat", { method: "POST", signal });
}

export function submitTrustReport(input: { kind: string; message: string; contactEmail?: string }) {
  return apiFetch<{ received: boolean; reference: string }>("/api/trust/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: input.kind.slice(0, 50),
      message: input.message.trim().slice(0, 4000),
      contactEmail: input.contactEmail?.trim().slice(0, 254) || undefined,
    }),
  });
}
