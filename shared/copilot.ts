export type DataSourceId =
  | "airport_flights"
  | "events"
  | "zone_heat"
  | "gps_location"
  | "weather"
  | "driver_history";

export interface DataSourceStatus {
  sourceId: DataSourceId;
  lastUpdated: string | null;
  isFresh: boolean;
  isAvailable: boolean;
  staleSinceMinutes: number | null;
  degradedReason: string | null;
  reliabilityWeight: number;
}

export type CopilotMode = "full_live" | "partial_live" | "heuristic_only";

export interface ShiftPhase {
  id: string;
  name: string;
  displayName: string;
  timeRange: [number, number];
  description: string;
  demandPattern: string;
  optimalZoneTypes: string[];
  color: string;
  earningsPotentialLabel: "high" | "moderate" | "low";
}

export interface MacroZone {
  id: string;
  name: string;
  description: string;
}

export interface MicroZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  macroZoneId: string;
  bestPhases: string[];
  weekdayDemandByHour: number[];
  weekendDemandByHour: number[];
  oversupplyRisk: "low" | "medium" | "high";
  likelyDirection: string;
  avgTripLengthKm: number;
  idleRiskMinutes: number;
  rainMultiplier: number;
  eventSensitivity: number;
  airportSensitivity: number;
  notes: string;
}

export type DemandLabel = "dead" | "low" | "moderate" | "busy" | "surge";

export interface MicroZoneDemand {
  microZoneId: string;
  name: string;
  currentDemand: number;
  demandLabel: DemandLabel;
  influencedBy: DataSourceId[];
}

export interface LoopWaypoint {
  name: string;
  lat: number;
  lng: number;
  instruction: string;
}

export interface LoopDefinition {
  id: string;
  name: string;
  waypoints: LoopWaypoint[];
  idealPhases: string[];
  description: string;
  whyItWorks: string;
  riskConditions: string;
  abandonWhen: string;
}

export interface LoopModification {
  reason: string;
  sourceId: DataSourceId;
  description: string;
}

export interface AdaptiveLoop {
  baseLoopId: string;
  baseLoopName: string;
  waypoints: LoopWaypoint[];
  modifications: LoopModification[];
  currentWaypointIndex: number;
  nextWaypoint: LoopWaypoint | null;
  distanceToNextM: number;
  selectedAt: string;
  lockedUntil: string;
}

export interface RideOffer {
  pickupLat: number;
  pickupLng: number;
  pickupName: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffName: string;
  estimatedFarePLN: number;
  estimatedDurationMin: number;
  estimatedDistanceKm: number;
}

export type ScoreDimensionId =
  | "immediate_revenue"
  | "time_efficiency"
  | "repositioning_value"
  | "demand_continuation"
  | "tip_probability"
  | "traffic_drag"
  | "dead_zone_risk"
  | "pickup_friction"
  | "shift_phase_match";

export interface ScoreDimension {
  id: ScoreDimensionId;
  name: string;
  value: number;
  min: number;
  max: number;
  explanation: string;
}

export type HourlyBand = "excellent" | "strong" | "acceptable" | "weak" | "poor";
export type RideScoreLabel = "strong_accept" | "accept" | "neutral" | "weak" | "reject";

export interface RideScoreResult {
  dimensions: ScoreDimension[];
  totalScore: number;
  label: RideScoreLabel;
  explanation: string;
  projectedHourlyRate: number;
  hourlyBand: HourlyBand;
  nextZoneBonus: number;
  loopAlignmentBonus: number;
  dataSources: DataSourceId[];
}

export type CopilotAction =
  | "HOLD"
  | "REPOSITION"
  | "SHIFT_TO_CORRIDOR"
  | "TAKE_OUTBOUND"
  | "RETURN_TO_CORE"
  | "PREP_AIRPORT"
  | "PREP_EVENT_EXIT"
  | "PREP_RAIN_SURGE";

export const ACTION_COOLDOWNS: Record<CopilotAction, number> = {
  HOLD: 8,
  REPOSITION: 5,
  SHIFT_TO_CORRIDOR: 5,
  TAKE_OUTBOUND: 6,
  RETURN_TO_CORE: 5,
  PREP_AIRPORT: 7,
  PREP_EVENT_EXIT: 4,
  PREP_RAIN_SURGE: 6,
};

export interface ConfidenceComposition {
  sourceFreshness: number;
  recommendationClarity: number;
  dataCompleteness: number;
  phaseCertainty: number;
  total: number;
}

export interface CopilotRecommendation {
  action: CopilotAction;
  reason: string;
  confidence: ConfidenceComposition;
  targetLat?: number;
  targetLng?: number;
  targetName?: string;
  dataSources: DataSourceStatus[];
  generatedAt: string;
  stableUntil: string;
}

export interface RecommendationOutcome {
  recommendationId: number;
  driverFollowed: boolean;
  idleAfterMinutes: number | null;
  earningsNext30Min: number | null;
  zoneAtDecision: string | null;
  outcomeQuality: "positive" | "neutral" | "negative";
}

export type TrapCategory = "geographic" | "behavioral" | "temporal";

export interface TrapDefinition {
  id: string;
  name: string;
  category: TrapCategory;
  lat?: number;
  lng?: number;
  whyAttractive: string;
  whyItHurts: string;
  whatToDoInstead: string;
  severity: "high" | "medium";
  relevantPhases: string[];
  triggerCondition: string;
}

export type OpportunityType =
  | "flight_arrivals"
  | "event_ending"
  | "phase_transition"
  | "demand_wave"
  | "rain_surge";

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  windowStart: string;
  windowEnd: string;
  targetLat?: number;
  targetLng?: number;
  targetName?: string;
  confidence: number;
  dataSources: DataSourceId[];
  dismissed: boolean;
}

export type ReplayEventType =
  | "shift_start"
  | "shift_end"
  | "ride_completed"
  | "recommendation_issued"
  | "recommendation_followed"
  | "recommendation_ignored"
  | "idle_segment"
  | "phase_transition"
  | "zone_change"
  | "opportunity_detected"
  | "trap_triggered";

export interface ReplayEvent {
  id: number;
  shiftSessionId: number;
  eventType: ReplayEventType;
  timestamp: string;
  lat?: number;
  lng?: number;
  data: Record<string, unknown>;
  durationMin?: number;
  earningsImpact?: number;
}

export interface ShiftReplaySummary {
  sessionId: number;
  totalEarnings: number;
  totalRides: number;
  avgHourlyRate: number;
  hourlyBand: HourlyBand;
  totalIdleMin: number;
  longestIdleMin: number;
  recommendationsIssued: number;
  recommendationsFollowed: number;
  phasesTraversed: ShiftPhase[];
  topZones: string[];
  weakZones: string[];
  keyMoments: ReplayEvent[];
  coachingNotes: string[];
}

export type InsightCategory =
  | "zone_preference"
  | "idle_pattern"
  | "loop_discipline"
  | "reposition_response"
  | "phase_optimization"
  | "ride_selection"
  | "habit_change";

export interface DriverInsight {
  id: number;
  userId: string;
  category: InsightCategory;
  title: string;
  description: string;
  evidence: string;
  confidence: number;
  suggestedAction: string;
  createdAt: string;
  isNew: boolean;
}

export interface OutcomeFeedback {
  message: string;
  metric: "effective_rate" | "idle_time" | "ride_chain" | "reposition_response";
  improvement: number;
  sampleSize: number;
  timeframe: "week" | "month";
  disclaimer: string;
}

export interface ShiftStats {
  earnings: number;
  durationMin: number;
  hourlyRate: number;
  idleMinutes: number;
  rideCount: number;
}

export interface CopilotState {
  mode: CopilotMode;
  currentPhase: ShiftPhase;
  driverLat: number | null;
  driverLng: number | null;
  activeLoop: AdaptiveLoop | null;
  recommendation: CopilotRecommendation;
  microZoneDemand: MicroZoneDemand[];
  nearbyTraps: TrapDefinition[];
  behavioralTraps: TrapDefinition[];
  shiftStats: ShiftStats | null;
  upcomingOpportunities: Opportunity[];
  dataSources: DataSourceStatus[];
  lastUpdatedAt: string;
  disclaimer: string;
}

export const COPILOT_DISCLAIMER =
  "Decision support only. Actual earnings depend on many external factors beyond this system's visibility.";

export function getHourlyBand(rate: number): HourlyBand {
  if (rate >= 110) return "excellent";
  if (rate >= 90) return "strong";
  if (rate >= 75) return "acceptable";
  if (rate >= 60) return "weak";
  return "poor";
}

export function getDemandLabel(demand: number): DemandLabel {
  if (demand >= 8) return "surge";
  if (demand >= 6) return "busy";
  if (demand >= 4) return "moderate";
  if (demand >= 2) return "low";
  return "dead";
}

export function getRideScoreLabel(score: number): RideScoreLabel {
  if (score >= 7) return "strong_accept";
  if (score >= 4) return "accept";
  if (score >= 1) return "neutral";
  if (score >= -2) return "weak";
  return "reject";
}

export function distanceBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
