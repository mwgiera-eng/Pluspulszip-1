import type { HeatCell } from "./types";
import type { RoadSegment, RoadTrafficResponse, RouteGeometryData } from "./api";

export type CleanRoad = Omit<RoadSegment, "id"> & { id: string };

export const KRAKOW_BOUNDS: Readonly<{
  south: number;
  north: number;
  west: number;
  east: number;
}>;

export function isKrakowCoordinate(lat: unknown, lng: unknown): boolean;
export function sanitizeGeometry(value: unknown, limit?: number): [number, number][];
export function sanitizeHeatCells(value: unknown, limit?: number): HeatCell[];
export function sanitizeRoads(value: unknown, limit?: number): CleanRoad[];
export function sanitizeRoutes(value: unknown, limit?: number): RouteGeometryData[];
export function isHeatResponse(value: unknown): value is import("./types").HeatResponse;
export function isRoadTrafficResponse(value: unknown): value is RoadTrafficResponse;
export function isRouteGeometries(value: unknown): value is RouteGeometryData[];
export function selectFocusRoute(routes: RouteGeometryData[]): RouteGeometryData | null;
export function interpolateAlongGeometry(
  geometry: [number, number][],
  progress: number,
): { latitude: number; longitude: number } | null;
