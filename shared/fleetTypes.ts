export type SanitizedTrip = {
  tripId: string;
  pickupGeohash: string;
  dropoffGeohash: string;
  startEpoch: number;
  netIncome: number;
  distanceKm?: number;
  timeSlot: number;
  dayOfWeek: number;
};

export type FleetUploadPayload = {
  fleetId: string;
  anonymousDriverId: string;
  displayName: string;
  trips: SanitizedTrip[];
  payloadDigest: string;
};

export type DriverProfileDTO = {
  id: string;
  anonymousDriverId: string;
  displayName: string;
  isLeaderDriver: boolean;
  avgEarningsPerKm: number;
  percentileRank: number;
  totalTripsAnalyzed: number;
};

export type DriverPatternDTO = {
  zoneGeohash: string;
  timeSlot: number;
  dayOfWeek: number;
  avgEarningsPerKm: number;
  tripCount: number;
  leaderPercentage: number;
};

export type FleetGuidanceDTO = {
  type: "PATTERN_SUGGESTION" | "LEADER_ZONE_DETECTED" | "INEFFICIENT_ROUTE_ALERT";
  priority: "low" | "medium" | "high";
  title: string;
  body: string;
  zoneGeohash?: string;
  estimatedGainPct?: number;
};
