import type {
  DriverInsight,
  InsightCategory,
  OutcomeFeedback,
} from "../shared/copilot";
import type {
  ShiftSession,
  CopilotRecommendationRecord,
  RecommendationOutcomeRecord,
} from "@shared/schema";

const MIN_SAMPLE_SIZE = 5;

const OUTCOME_DISCLAIMER =
  "This observation is based on correlation, not guaranteed causation. Many factors affect earnings beyond this system's visibility.";

export function generateInsights(
  userId: string,
  recentSessions: ShiftSession[],
  recommendations: CopilotRecommendationRecord[],
  outcomes: RecommendationOutcomeRecord[]
): DriverInsight[] {
  const insights: DriverInsight[] = [];
  let insightId = 1;

  if (recentSessions.length < MIN_SAMPLE_SIZE) {
    return insights;
  }

  const zoneInsight = analyzeZonePreferences(recentSessions, recommendations);
  if (zoneInsight) {
    insights.push({
      ...zoneInsight,
      id: insightId++,
      userId,
      createdAt: new Date().toISOString(),
      isNew: true,
    });
  }

  const idleInsight = analyzeIdlePatterns(recentSessions);
  if (idleInsight) {
    insights.push({
      ...idleInsight,
      id: insightId++,
      userId,
      createdAt: new Date().toISOString(),
      isNew: true,
    });
  }

  const repositionInsight = analyzeRepositionResponse(recommendations, outcomes);
  if (repositionInsight) {
    insights.push({
      ...repositionInsight,
      id: insightId++,
      userId,
      createdAt: new Date().toISOString(),
      isNew: true,
    });
  }

  const rideSelectionInsight = analyzeRideSelection(recentSessions);
  if (rideSelectionInsight) {
    insights.push({
      ...rideSelectionInsight,
      id: insightId++,
      userId,
      createdAt: new Date().toISOString(),
      isNew: true,
    });
  }

  const phaseInsight = analyzePhaseOptimization(recentSessions);
  if (phaseInsight) {
    insights.push({
      ...phaseInsight,
      id: insightId++,
      userId,
      createdAt: new Date().toISOString(),
      isNew: true,
    });
  }

  return insights;
}

function analyzeZonePreferences(
  sessions: ShiftSession[],
  recommendations: CopilotRecommendationRecord[]
): Omit<DriverInsight, "id" | "userId" | "createdAt" | "isNew"> | null {
  if (sessions.length < MIN_SAMPLE_SIZE) return null;

  const repositionRecs = recommendations.filter(
    (r) => r.action === "REPOSITION" || r.action === "RETURN_TO_CORE"
  );

  if (repositionRecs.length < MIN_SAMPLE_SIZE) return null;

  const targetCounts: Record<string, number> = {};
  for (const rec of repositionRecs) {
    const target = rec.targetName || "unknown";
    targetCounts[target] = (targetCounts[target] || 0) + 1;
  }

  const sorted = Object.entries(targetCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const topZone = sorted[0];

  return {
    category: "zone_preference" as InsightCategory,
    title: "Frequent reposition target identified",
    description: `You are frequently directed toward ${topZone[0]}. This zone appears ${topZone[1]} times in your recent recommendations, suggesting it may be a strong earning area for your shift patterns.`,
    evidence: `Based on ${repositionRecs.length} reposition recommendations across ${sessions.length} shifts.`,
    confidence: Math.min(85, 40 + topZone[1] * 5),
    suggestedAction: `Consider pre-positioning near ${topZone[0]} at the start of phases when it appears in recommendations.`,
  };
}

function analyzeIdlePatterns(
  sessions: ShiftSession[]
): Omit<DriverInsight, "id" | "userId" | "createdAt" | "isNew"> | null {
  if (sessions.length < MIN_SAMPLE_SIZE) return null;

  const completedSessions = sessions.filter((s) => !s.isActive);
  if (completedSessions.length < MIN_SAMPLE_SIZE) return null;

  const totalIdle = completedSessions.reduce(
    (sum, s) => sum + (s.totalIdleMinutes || 0),
    0
  );
  const avgIdle = totalIdle / completedSessions.length;

  if (avgIdle <= 15) return null;

  const recentHalf = completedSessions.slice(
    0,
    Math.ceil(completedSessions.length / 2)
  );
  const olderHalf = completedSessions.slice(
    Math.ceil(completedSessions.length / 2)
  );

  const recentAvgIdle =
    recentHalf.reduce((sum, s) => sum + (s.totalIdleMinutes || 0), 0) /
    recentHalf.length;
  const olderAvgIdle =
    olderHalf.length > 0
      ? olderHalf.reduce((sum, s) => sum + (s.totalIdleMinutes || 0), 0) /
        olderHalf.length
      : avgIdle;

  const trend = recentAvgIdle < olderAvgIdle ? "improving" : "stable";

  return {
    category: "idle_pattern" as InsightCategory,
    title: `Average idle time: ${Math.round(avgIdle)} min per shift`,
    description: `Your average idle time is ${Math.round(avgIdle)} minutes per shift. ${
      trend === "improving"
        ? "Your recent shifts show improvement."
        : "Consider repositioning earlier when idle exceeds 7-8 minutes."
    }`,
    evidence: `Based on ${completedSessions.length} completed shifts. Recent average: ${Math.round(recentAvgIdle)} min, earlier average: ${Math.round(olderAvgIdle)} min.`,
    confidence: Math.min(80, 50 + completedSessions.length * 2),
    suggestedAction:
      avgIdle > 25
        ? "Try repositioning after 7 minutes of idle time instead of waiting for a ride in your current zone."
        : "Continue monitoring idle patterns. Small improvements in idle time can meaningfully improve your effective rate.",
  };
}

function analyzeRepositionResponse(
  recommendations: CopilotRecommendationRecord[],
  outcomes: RecommendationOutcomeRecord[]
): Omit<DriverInsight, "id" | "userId" | "createdAt" | "isNew"> | null {
  if (outcomes.length < MIN_SAMPLE_SIZE) return null;

  const followed = outcomes.filter((o) => o.driverFollowed);
  const ignored = outcomes.filter((o) => !o.driverFollowed);

  if (followed.length < 3 || ignored.length < 3) return null;

  const followedPositive = followed.filter(
    (o) => o.outcomeQuality === "positive"
  ).length;
  const ignoredPositive = ignored.filter(
    (o) => o.outcomeQuality === "positive"
  ).length;

  const followedRate =
    followed.length > 0
      ? Math.round((followedPositive / followed.length) * 100)
      : 0;
  const ignoredRate =
    ignored.length > 0
      ? Math.round((ignoredPositive / ignored.length) * 100)
      : 0;

  return {
    category: "reposition_response" as InsightCategory,
    title: "Reposition recommendation response analysis",
    description: `When you followed reposition recommendations, ${followedRate}% had positive outcomes. When you did not follow them, ${ignoredRate}% had positive outcomes. ${
      followedRate > ignoredRate
        ? "Following recommendations appears correlated with better outcomes."
        : "Results were similar regardless of following recommendations."
    }`,
    evidence: `Based on ${outcomes.length} tracked outcomes (${followed.length} followed, ${ignored.length} not followed).`,
    confidence: Math.min(75, 40 + outcomes.length * 2),
    suggestedAction:
      followedRate > ignoredRate
        ? "Consider following reposition recommendations more consistently, especially during high-earning phases."
        : "Continue evaluating recommendations based on your local knowledge and conditions.",
  };
}

function analyzeRideSelection(
  sessions: ShiftSession[]
): Omit<DriverInsight, "id" | "userId" | "createdAt" | "isNew"> | null {
  const completedSessions = sessions.filter((s) => !s.isActive);
  if (completedSessions.length < MIN_SAMPLE_SIZE) return null;

  const sessionsWithRides = completedSessions.filter(
    (s) => s.totalRides > 0
  );
  if (sessionsWithRides.length < MIN_SAMPLE_SIZE) return null;

  const avgEarningsPerRide =
    sessionsWithRides.reduce(
      (sum, s) => sum + parseFloat(String(s.totalEarnings)) / s.totalRides,
      0
    ) / sessionsWithRides.length;

  if (avgEarningsPerRide < 12) {
    return {
      category: "ride_selection" as InsightCategory,
      title: "Average earnings per ride below target",
      description: `Your average earnings per ride is approximately ${avgEarningsPerRide.toFixed(1)} PLN. Consider being more selective about which rides to accept, especially short rides in oversupplied areas.`,
      evidence: `Based on ${sessionsWithRides.length} shifts with rides completed.`,
      confidence: Math.min(70, 45 + sessionsWithRides.length * 2),
      suggestedAction:
        "Use the ride scoring feature to evaluate ride offers. Aim to avoid consecutive low-scored rides.",
    };
  }

  return null;
}

function analyzePhaseOptimization(
  sessions: ShiftSession[]
): Omit<DriverInsight, "id" | "userId" | "createdAt" | "isNew"> | null {
  const completedSessions = sessions.filter(
    (s) => !s.isActive && s.endTime
  );
  if (completedSessions.length < MIN_SAMPLE_SIZE) return null;

  const sessionsWithEarnings = completedSessions.filter(
    (s) => parseFloat(String(s.totalEarnings)) > 0 && s.startTime
  );
  if (sessionsWithEarnings.length < MIN_SAMPLE_SIZE) return null;

  const hourCounts: Record<number, number> = {};
  for (const session of sessionsWithEarnings) {
    const startDate = new Date(session.startTime!);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Warsaw",
      hour: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(startDate);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "12");
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  const sorted = Object.entries(hourCounts).sort(
    (a, b) => parseInt(b[1].toString()) - parseInt(a[1].toString())
  );

  if (sorted.length === 0) return null;

  const preferredHour = parseInt(sorted[0][0]);
  const count = sorted[0][1];

  if (count < 3) return null;

  return {
    category: "phase_optimization" as InsightCategory,
    title: `Most common shift start: ${preferredHour}:00`,
    description: `You typically start shifts around ${preferredHour}:00. ${
      preferredHour >= 7 && preferredHour <= 9
        ? "This aligns well with morning rush demand."
        : preferredHour >= 16 && preferredHour <= 18
          ? "This aligns well with evening rush demand."
          : "Consider whether adjusting your start time could capture higher-demand phases."
    }`,
    evidence: `Based on ${sessionsWithEarnings.length} completed shifts. ${count} shifts started near this hour.`,
    confidence: Math.min(70, 40 + count * 5),
    suggestedAction:
      "Review which shift phases produce the highest effective rate for you and consider optimizing your start time accordingly.",
  };
}

export function generateOutcomeFeedback(
  userId: string,
  outcomes: RecommendationOutcomeRecord[]
): OutcomeFeedback[] {
  const feedback: OutcomeFeedback[] = [];

  if (outcomes.length < MIN_SAMPLE_SIZE) return feedback;

  const followed = outcomes.filter((o) => o.driverFollowed);
  const ignored = outcomes.filter((o) => !o.driverFollowed);

  if (followed.length >= MIN_SAMPLE_SIZE) {
    const followedPositive = followed.filter(
      (o) => o.outcomeQuality === "positive"
    ).length;
    const followedRate = Math.round(
      (followedPositive / followed.length) * 100
    );

    const followedEarnings = followed
      .filter((o) => o.earningsNext30Min !== null)
      .map((o) => parseFloat(String(o.earningsNext30Min)));
    const ignoredEarnings = ignored
      .filter((o) => o.earningsNext30Min !== null)
      .map((o) => parseFloat(String(o.earningsNext30Min)));

    const avgFollowed =
      followedEarnings.length > 0
        ? followedEarnings.reduce((s, v) => s + v, 0) / followedEarnings.length
        : 0;
    const avgIgnored =
      ignoredEarnings.length > 0
        ? ignoredEarnings.reduce((s, v) => s + v, 0) / ignoredEarnings.length
        : 0;

    const improvement =
      avgIgnored > 0
        ? Math.round(((avgFollowed - avgIgnored) / avgIgnored) * 100)
        : 0;

    feedback.push({
      message: `Following reposition recommendations was associated with positive outcomes in ${followedRate}% of cases over your recent shifts.`,
      metric: "reposition_response",
      improvement,
      sampleSize: followed.length,
      timeframe: followed.length > 20 ? "month" : "week",
      disclaimer: OUTCOME_DISCLAIMER,
    });
  }

  if (followed.length >= MIN_SAMPLE_SIZE && ignored.length >= MIN_SAMPLE_SIZE) {
    const followedIdle = followed
      .filter((o) => o.idleAfterMinutes !== null)
      .map((o) => o.idleAfterMinutes!);
    const ignoredIdle = ignored
      .filter((o) => o.idleAfterMinutes !== null)
      .map((o) => o.idleAfterMinutes!);

    if (followedIdle.length >= 3 && ignoredIdle.length >= 3) {
      const avgFollowedIdle =
        followedIdle.reduce((s, v) => s + v, 0) / followedIdle.length;
      const avgIgnoredIdle =
        ignoredIdle.reduce((s, v) => s + v, 0) / ignoredIdle.length;

      const idleImprovement =
        avgIgnoredIdle > 0
          ? Math.round(
              ((avgIgnoredIdle - avgFollowedIdle) / avgIgnoredIdle) * 100
            )
          : 0;

      if (Math.abs(idleImprovement) >= 5) {
        feedback.push({
          message: `When you followed recommendations, your subsequent idle time was ${
            idleImprovement > 0 ? "lower" : "higher"
          } by approximately ${Math.abs(idleImprovement)}% compared to when you did not follow them.`,
          metric: "idle_time",
          improvement: idleImprovement,
          sampleSize: followedIdle.length + ignoredIdle.length,
          timeframe: outcomes.length > 20 ? "month" : "week",
          disclaimer: OUTCOME_DISCLAIMER,
        });
      }
    }
  }

  return feedback;
}
