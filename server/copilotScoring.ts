import type {
  RideOffer,
  ScoreDimension,
  ScoreDimensionId,
  RideScoreResult,
  RideScoreLabel,
  HourlyBand,
  DataSourceId,
  ShiftPhase,
  AdaptiveLoop,
  MicroZone,
} from "../shared/copilot";
import {
  getHourlyBand,
  getRideScoreLabel,
  distanceBetween,
} from "../shared/copilot";
import { MICRO_ZONES, MACRO_ZONES } from "./copilotData";
import { getCurrentPhase } from "./copilotPhases";

interface TrafficDragInput {
  pickupMacroZone: string | null;
  dropoffMacroZone: string | null;
  hour: number;
  isWeekend: boolean;
  eventNearby: boolean;
}

export function estimateTrafficDrag(input: TrafficDragInput): number {
  const { pickupMacroZone, dropoffMacroZone, hour, isWeekend, eventNearby } = input;
  let drag = 0;

  const isMorningRush = hour >= 7 && hour < 10;
  const isEveningRush = hour >= 16 && hour < 19;
  const isRushHour = isMorningRush || isEveningRush;

  const centerZones = ["old_town", "kazimierz", "podgorze", "zablocie"];
  const pickupInCenter = pickupMacroZone !== null && centerZones.includes(pickupMacroZone);
  const dropoffInCenter = dropoffMacroZone !== null && centerZones.includes(dropoffMacroZone);
  const bothInCenter = pickupInCenter && dropoffInCenter;

  if (isRushHour && !isWeekend) {
    drag -= 1;
    if (bothInCenter) {
      drag -= 1;
    }
    if (isMorningRush && pickupMacroZone === "airport_zone") {
      drag -= 0.5;
    }
  }

  if (isRushHour && isWeekend) {
    if (bothInCenter) {
      drag -= 0.5;
    }
  }

  if (eventNearby) {
    drag -= 0.5;
    if (pickupInCenter || dropoffInCenter) {
      drag -= 0.5;
    }
  }

  if (!isRushHour && !eventNearby) {
    drag = 0;
  }

  return Math.max(-3, Math.min(0, drag));
}

function findNearestMicroZone(lat: number, lng: number): MicroZone | null {
  let nearest: MicroZone | null = null;
  let minDist = Infinity;
  for (const zone of MICRO_ZONES) {
    const dist = distanceBetween(lat, lng, zone.lat, zone.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = zone;
    }
  }
  return nearest;
}

function getMacroZoneId(lat: number, lng: number): string | null {
  const zone = findNearestMicroZone(lat, lng);
  return zone ? zone.macroZoneId : null;
}

function getDemandAtHour(zone: MicroZone, hour: number, isWeekend: boolean): number {
  const profile = isWeekend ? zone.weekendDemandByHour : zone.weekdayDemandByHour;
  return profile[hour] ?? 0;
}

interface ScoreContext {
  hour: number;
  isWeekend: boolean;
  driverLat: number;
  driverLng: number;
  currentPhase: string;
  eventNearby: boolean;
  activeLoop?: AdaptiveLoop | null;
}

function scoreImmediateRevenue(offer: RideOffer): ScoreDimension {
  const farePerKm = offer.estimatedFarePLN / Math.max(offer.estimatedDistanceKm, 0.5);
  let value: number;
  if (farePerKm >= 6) value = 2.5;
  else if (farePerKm >= 4.5) value = 2;
  else if (farePerKm >= 3) value = 1;
  else if (farePerKm >= 2) value = 0;
  else value = -0.5;

  if (offer.estimatedFarePLN >= 60) value = Math.min(3, value + 1);
  else if (offer.estimatedFarePLN >= 40) value = Math.min(3, value + 0.5);
  else if (offer.estimatedFarePLN < 15) value = Math.min(value, 0.5);
  else if (offer.estimatedFarePLN < 20) value = Math.min(value, 1.5);

  value = Math.max(0, Math.min(3, value));

  return {
    id: "immediate_revenue",
    name: "Immediate Revenue",
    value,
    min: 0,
    max: 3,
    explanation: `Fare of ${offer.estimatedFarePLN} PLN over ${offer.estimatedDistanceKm} km (${farePerKm.toFixed(1)} PLN/km)`,
  };
}

function scoreTimeEfficiency(offer: RideOffer, driverLat: number, driverLng: number): ScoreDimension {
  const pickupDistM = distanceBetween(driverLat, driverLng, offer.pickupLat, offer.pickupLng);
  const pickupDistKm = pickupDistM / 1000;
  const estimatedPickupMin = Math.max(1, pickupDistKm * 2.5);
  const totalTimeMin = estimatedPickupMin + offer.estimatedDurationMin;
  const hourlyRate = (offer.estimatedFarePLN / totalTimeMin) * 60;

  let value: number;
  if (hourlyRate >= 100) value = 2;
  else if (hourlyRate >= 80) value = 1;
  else if (hourlyRate >= 60) value = 0;
  else if (hourlyRate >= 45) value = -1;
  else value = -2;

  return {
    id: "time_efficiency",
    name: "Time Efficiency",
    value,
    min: -2,
    max: 2,
    explanation: `Projected ${hourlyRate.toFixed(0)} PLN/hr including ${estimatedPickupMin.toFixed(0)} min pickup`,
  };
}

function scoreRepositioningValue(offer: RideOffer, ctx: ScoreContext): ScoreDimension {
  const dropoffZone = findNearestMicroZone(offer.dropoffLat, offer.dropoffLng);
  const pickupZone = findNearestMicroZone(offer.pickupLat, offer.pickupLng);

  if (!dropoffZone || !pickupZone) {
    return {
      id: "repositioning_value",
      name: "Repositioning Value",
      value: 0,
      min: -2,
      max: 3,
      explanation: "Unable to determine zone positioning",
    };
  }

  const dropoffDemand = getDemandAtHour(dropoffZone, ctx.hour, ctx.isWeekend);
  const pickupDemand = getDemandAtHour(pickupZone, ctx.hour, ctx.isWeekend);
  const demandDelta = dropoffDemand - pickupDemand;

  let value: number;
  if (demandDelta >= 4) value = 3;
  else if (demandDelta >= 2) value = 2;
  else if (demandDelta >= 0) value = 1;
  else if (demandDelta >= -2) value = 0;
  else if (demandDelta >= -4) value = -1;
  else value = -2;

  const dropoffInBestPhase = dropoffZone.bestPhases.includes(ctx.currentPhase);
  if (dropoffInBestPhase) value = Math.min(3, value + 1);

  value = Math.max(-2, Math.min(3, value));

  return {
    id: "repositioning_value",
    name: "Repositioning Value",
    value,
    min: -2,
    max: 3,
    explanation: `Dropoff at ${dropoffZone.name} (demand ${dropoffDemand}/10) from ${pickupZone.name} (demand ${pickupDemand}/10)`,
  };
}

function scoreDemandContinuation(offer: RideOffer, ctx: ScoreContext): ScoreDimension {
  const dropoffZone = findNearestMicroZone(offer.dropoffLat, offer.dropoffLng);

  if (!dropoffZone) {
    return {
      id: "demand_continuation",
      name: "Demand Continuation",
      value: 0,
      min: -2,
      max: 2,
      explanation: "Unable to determine dropoff zone demand",
    };
  }

  const nextHour = (ctx.hour + 1) % 24;
  const currentDemand = getDemandAtHour(dropoffZone, ctx.hour, ctx.isWeekend);
  const nextDemand = getDemandAtHour(dropoffZone, nextHour, ctx.isWeekend);
  const avgFutureDemand = (currentDemand + nextDemand) / 2;

  let value: number;
  if (avgFutureDemand >= 7) value = 2;
  else if (avgFutureDemand >= 5) value = 1;
  else if (avgFutureDemand >= 3) value = 0;
  else if (avgFutureDemand >= 1) value = -1;
  else value = -2;

  if (dropoffZone.oversupplyRisk === "high") value = Math.max(-2, value - 1);

  return {
    id: "demand_continuation",
    name: "Demand Continuation",
    value,
    min: -2,
    max: 2,
    explanation: `Dropoff zone ${dropoffZone.name} has ${avgFutureDemand.toFixed(1)}/10 avg demand upcoming. Oversupply risk: ${dropoffZone.oversupplyRisk}`,
  };
}

function scoreTipProbability(offer: RideOffer, ctx: ScoreContext): ScoreDimension {
  const dropoffZone = findNearestMicroZone(offer.dropoffLat, offer.dropoffLng);
  const pickupZone = findNearestMicroZone(offer.pickupLat, offer.pickupLng);
  let value = 0;

  const isAirportRide =
    (pickupZone?.macroZoneId === "airport_zone") ||
    (dropoffZone?.macroZoneId === "airport_zone");

  const isHotelArea =
    (pickupZone?.id === "stare_miasto_north") ||
    (pickupZone?.id === "rynek_glowny");

  const isConferenceRide =
    (pickupZone?.id === "icekrakow") ||
    (dropoffZone?.id === "icekrakow");

  if (isAirportRide) value += 0.5;
  if (isHotelArea) value += 0.3;
  if (isConferenceRide) value += 0.5;
  if (offer.estimatedFarePLN >= 50) value += 0.2;
  if (dropoffZone?.macroZoneId === "zwierzyniec") value += 0.3;

  value = Math.max(0, Math.min(1, value));

  let explanation = "Standard tip probability";
  if (isAirportRide) explanation = "Airport rides tend to receive tips more frequently";
  else if (isConferenceRide) explanation = "Business travelers from conferences tip more often";
  else if (isHotelArea) explanation = "Hotel district pickups correlate with higher tip rates";

  return {
    id: "tip_probability",
    name: "Tip Probability",
    value,
    min: 0,
    max: 1,
    explanation,
  };
}

function scoreTrafficDrag(offer: RideOffer, ctx: ScoreContext): ScoreDimension {
  const pickupMacro = getMacroZoneId(offer.pickupLat, offer.pickupLng);
  const dropoffMacro = getMacroZoneId(offer.dropoffLat, offer.dropoffLng);

  const value = estimateTrafficDrag({
    pickupMacroZone: pickupMacro,
    dropoffMacroZone: dropoffMacro,
    hour: ctx.hour,
    isWeekend: ctx.isWeekend,
    eventNearby: ctx.eventNearby,
  });

  let explanation = "No significant traffic impact expected";
  if (value <= -2) explanation = "Heavy traffic expected. Significant time loss likely";
  else if (value <= -1) explanation = "Moderate traffic expected. Some time loss";
  else if (value < 0) explanation = "Light traffic impact expected";

  return {
    id: "traffic_drag",
    name: "Traffic Drag",
    value,
    min: -3,
    max: 0,
    explanation,
  };
}

function scoreDeadZoneRisk(offer: RideOffer, ctx: ScoreContext): ScoreDimension {
  const dropoffZone = findNearestMicroZone(offer.dropoffLat, offer.dropoffLng);

  if (!dropoffZone) {
    const distFromCenter = distanceBetween(offer.dropoffLat, offer.dropoffLng, 50.0614, 19.9372) / 1000;
    const value = distFromCenter > 15 ? -3 : distFromCenter > 10 ? -2 : -1;
    return {
      id: "dead_zone_risk",
      name: "Dead Zone Risk",
      value,
      min: -3,
      max: 0,
      explanation: `Dropoff is ${distFromCenter.toFixed(1)} km from city center with no known zone data`,
    };
  }

  const demand = getDemandAtHour(dropoffZone, ctx.hour, ctx.isWeekend);
  const idleRisk = dropoffZone.idleRiskMinutes;

  let value = 0;
  if (demand <= 1 && idleRisk >= 12) value = -3;
  else if (demand <= 2 && idleRisk >= 10) value = -2;
  else if (demand <= 3 && idleRisk >= 8) value = -1;
  else if (demand <= 2) value = -1;

  const distFromCenter = distanceBetween(dropoffZone.lat, dropoffZone.lng, 50.0614, 19.9372) / 1000;
  if (distFromCenter > 12 && demand <= 3) value = Math.max(-3, value - 1);

  value = Math.max(-3, Math.min(0, value));

  return {
    id: "dead_zone_risk",
    name: "Dead Zone Risk",
    value,
    min: -3,
    max: 0,
    explanation: `${dropoffZone.name}: demand ${demand}/10, idle risk ${idleRisk} min, ${distFromCenter.toFixed(1)} km from center`,
  };
}

function scorePickupFriction(offer: RideOffer, driverLat: number, driverLng: number): ScoreDimension {
  const pickupDistM = distanceBetween(driverLat, driverLng, offer.pickupLat, offer.pickupLng);
  const pickupDistKm = pickupDistM / 1000;

  let value = 0;
  if (pickupDistKm >= 5) value = -2;
  else if (pickupDistKm >= 3) value = -1.5;
  else if (pickupDistKm >= 2) value = -1;
  else if (pickupDistKm >= 1) value = -0.5;

  value = Math.max(-2, Math.min(0, value));

  return {
    id: "pickup_friction",
    name: "Pickup Friction",
    value,
    min: -2,
    max: 0,
    explanation: `Pickup is ${pickupDistKm.toFixed(1)} km away (${(pickupDistKm * 2.5).toFixed(0)} min estimated)`,
  };
}

function scoreShiftPhaseMatch(offer: RideOffer, ctx: ScoreContext): ScoreDimension {
  const dropoffZone = findNearestMicroZone(offer.dropoffLat, offer.dropoffLng);
  const pickupZone = findNearestMicroZone(offer.pickupLat, offer.pickupLng);

  const phase = getCurrentPhase(ctx.hour, 0);

  let value = 0;

  if (pickupZone && pickupZone.bestPhases.includes(ctx.currentPhase)) {
    value += 0.5;
  }
  if (dropoffZone && dropoffZone.bestPhases.includes(ctx.currentPhase)) {
    value += 1;
  }

  const phaseZoneTypes = phase.optimalZoneTypes;
  if (dropoffZone) {
    const macroZone = MACRO_ZONES.find((m) => m.id === dropoffZone.macroZoneId);
    if (macroZone) {
      const zoneNameLower = macroZone.name.toLowerCase();
      const matchesOptimal = phaseZoneTypes.some(
        (zt) => zoneNameLower.includes(zt) || dropoffZone.macroZoneId.includes(zt)
      );
      if (matchesOptimal) value += 0.5;
    }
  }

  if (ctx.currentPhase === "late_night" || ctx.currentPhase === "overnight") {
    if (dropoffZone && dropoffZone.macroZoneId !== "old_town" && dropoffZone.macroZoneId !== "kazimierz") {
      value -= 1;
    }
  }

  if (ctx.currentPhase === "morning_rush" || ctx.currentPhase === "evening_rush") {
    if (dropoffZone && dropoffZone.bestPhases.includes(ctx.currentPhase)) {
      value += 0.5;
    }
  }

  value = Math.max(-2, Math.min(2, value));

  return {
    id: "shift_phase_match",
    name: "Shift Phase Match",
    value,
    min: -2,
    max: 2,
    explanation: `${phase.displayName} phase favors ${phase.optimalZoneTypes.join(", ")} zones`,
  };
}

function calculateLoopAlignmentBonus(offer: RideOffer, activeLoop?: AdaptiveLoop | null): number {
  if (!activeLoop || !activeLoop.nextWaypoint) return 0;

  const dropoffToWaypoint = distanceBetween(
    offer.dropoffLat,
    offer.dropoffLng,
    activeLoop.nextWaypoint.lat,
    activeLoop.nextWaypoint.lng
  );

  if (dropoffToWaypoint < 500) return 1.5;
  if (dropoffToWaypoint < 1000) return 1.0;
  if (dropoffToWaypoint < 2000) return 0.5;
  return 0;
}

function calculateNextZoneBonus(offer: RideOffer, ctx: ScoreContext): number {
  const dropoffZone = findNearestMicroZone(offer.dropoffLat, offer.dropoffLng);
  if (!dropoffZone) return 0;

  const demand = getDemandAtHour(dropoffZone, ctx.hour, ctx.isWeekend);
  if (demand >= 8 && dropoffZone.oversupplyRisk !== "high") return 1.5;
  if (demand >= 6 && dropoffZone.oversupplyRisk !== "high") return 1.0;
  if (demand >= 5) return 0.5;
  return 0;
}

function generateExplanation(
  dimensions: ScoreDimension[],
  totalScore: number,
  label: RideScoreLabel,
  offer: RideOffer,
  loopBonus: number,
  nextZoneBonus: number
): string {
  const topPositive = dimensions
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);

  const topNegative = dimensions
    .filter((d) => d.value < 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 2);

  const parts: string[] = [];

  if (label === "strong_accept" || label === "accept") {
    parts.push(`This ${offer.estimatedDistanceKm} km ride scores well.`);
  } else if (label === "neutral") {
    parts.push(`This ${offer.estimatedDistanceKm} km ride has mixed signals.`);
  } else {
    parts.push(`This ${offer.estimatedDistanceKm} km ride has significant concerns.`);
  }

  for (const dim of topPositive) {
    parts.push(`Strength: ${dim.explanation}.`);
  }

  for (const dim of topNegative) {
    parts.push(`Concern: ${dim.explanation}.`);
  }

  if (loopBonus > 0) {
    parts.push(`Aligns with your active loop (+${loopBonus.toFixed(1)} bonus).`);
  }

  if (nextZoneBonus > 0) {
    parts.push(`Dropoff zone shows strong upcoming demand (+${nextZoneBonus.toFixed(1)} bonus).`);
  }

  return parts.join(" ");
}

export interface ScoreRideOptions {
  offer: RideOffer;
  hour: number;
  isWeekend: boolean;
  driverLat: number;
  driverLng: number;
  currentPhase: string;
  eventNearby: boolean;
  activeLoop?: AdaptiveLoop | null;
}

export function scoreRide(options: ScoreRideOptions): RideScoreResult {
  const { offer, hour, isWeekend, driverLat, driverLng, currentPhase, eventNearby, activeLoop } = options;

  const ctx: ScoreContext = {
    hour,
    isWeekend,
    driverLat,
    driverLng,
    currentPhase,
    eventNearby,
    activeLoop,
  };

  const dimensions: ScoreDimension[] = [
    scoreImmediateRevenue(offer),
    scoreTimeEfficiency(offer, driverLat, driverLng),
    scoreRepositioningValue(offer, ctx),
    scoreDemandContinuation(offer, ctx),
    scoreTipProbability(offer, ctx),
    scoreTrafficDrag(offer, ctx),
    scoreDeadZoneRisk(offer, ctx),
    scorePickupFriction(offer, driverLat, driverLng),
    scoreShiftPhaseMatch(offer, ctx),
  ];

  const rawScore = dimensions.reduce((sum, d) => sum + d.value, 0);
  const loopAlignmentBonus = calculateLoopAlignmentBonus(offer, activeLoop);
  const nextZoneBonus = calculateNextZoneBonus(offer, ctx);
  const totalScore = rawScore + loopAlignmentBonus + nextZoneBonus;

  const label = getRideScoreLabel(totalScore);

  const pickupDistM = distanceBetween(driverLat, driverLng, offer.pickupLat, offer.pickupLng);
  const pickupMin = Math.max(1, (pickupDistM / 1000) * 2.5);
  const totalTimeMin = pickupMin + offer.estimatedDurationMin;
  const projectedHourlyRate = (offer.estimatedFarePLN / totalTimeMin) * 60;
  const hourlyBand = getHourlyBand(projectedHourlyRate);

  const dataSources: DataSourceId[] = ["gps_location", "zone_heat"];
  if (eventNearby) dataSources.push("events");
  const pickupZone = findNearestMicroZone(offer.pickupLat, offer.pickupLng);
  const dropoffZone = findNearestMicroZone(offer.dropoffLat, offer.dropoffLng);
  if (
    pickupZone?.macroZoneId === "airport_zone" ||
    dropoffZone?.macroZoneId === "airport_zone"
  ) {
    dataSources.push("airport_flights");
  }

  const explanation = generateExplanation(
    dimensions,
    totalScore,
    label,
    offer,
    loopAlignmentBonus,
    nextZoneBonus
  );

  return {
    dimensions,
    totalScore: Math.round(totalScore * 10) / 10,
    label,
    explanation,
    projectedHourlyRate: Math.round(projectedHourlyRate * 10) / 10,
    hourlyBand,
    nextZoneBonus: Math.round(nextZoneBonus * 10) / 10,
    loopAlignmentBonus: Math.round(loopAlignmentBonus * 10) / 10,
    dataSources,
  };
}
