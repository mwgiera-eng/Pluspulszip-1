import { useState, useEffect } from "react";
import { ArrowRight, MapPin, Clock, Plane, PlaneTakeoff, PlaneLanding, Timer, Zap, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@shared/schema";

function getPolandTimeStr(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" });
}

interface RecommendationCardProps {
  rec: Recommendation;
  onApply?: () => void;
}

interface ParsedRec {
  category: "departure" | "arrival" | "upcoming_dep" | "upcoming_arr" | "tomorrow" | "zone";
  urgency?: string;
  title: string;
  timeRange?: string;
  day?: string;
  surge?: string;
  flightCount?: string;
  countdown?: string;
  countdownType?: "active" | "upcoming" | "planned";
  tip: string;
}

function classifyPart(p: string): "surge" | "flights" | "status" | "text" {
  if (/^\d+\.?\d*x$/.test(p)) return "surge";
  if (/\d+-\d+\s+flights?/i.test(p) || /flights?/i.test(p)) return "flights";
  if (/ACTIVE NOW|STARTS IN|IN\s+~/i.test(p)) return "status";
  return "text";
}

function parseCountdown(s: string): { countdown: string; countdownType: ParsedRec["countdownType"] } {
  if (s.includes("ACTIVE NOW")) {
    const m = s.match(/~(\d+)\s*min/);
    return { countdown: m ? `${m[1]} min left` : "Active now", countdownType: "active" };
  }
  if (s.includes("STARTS IN")) {
    const m = s.match(/~(\d+)\s*min/);
    return { countdown: m ? `In ${m[1]} min` : s.replace("STARTS IN", "").trim(), countdownType: "upcoming" };
  }
  const m = s.match(/~(\d+)\s*min/);
  return { countdown: m ? `${m[1]} min` : s, countdownType: "planned" };
}

function parseReason(reason: string, action: string): ParsedRec {
  const tagMatch = reason.match(/^\[([^\]]+)\]\s*/);
  if (tagMatch) {
    const fullTag = tagMatch[1];
    const rest = reason.slice(tagMatch[0].length);
    const parts = rest.split("|").map(s => s.trim());

    let category: ParsedRec["category"] = "zone";
    let urgency: string | undefined;

    const baseTags: Record<string, ParsedRec["category"]> = {
      "DEPARTURE SURGE": "departure",
      "ARRIVAL WAVE": "arrival",
      "UPCOMING DEPARTURES": "upcoming_dep",
      "INCOMING ARRIVALS": "upcoming_arr",
      "TOMORROW": "tomorrow",
    };

    const dashIdx = fullTag.indexOf(" - ");
    const baseTag = dashIdx >= 0 ? fullTag.slice(0, dashIdx).trim() : fullTag.trim();
    if (dashIdx >= 0) {
      urgency = fullTag.slice(dashIdx + 3).trim();
    }
    if (baseTags[baseTag]) {
      category = baseTags[baseTag];
    } else {
      for (const [key, cat] of Object.entries(baseTags)) {
        if (fullTag.startsWith(key)) {
          category = cat;
          const sub = fullTag.replace(key, "").replace(/^[\s-]+/, "").trim();
          if (sub) urgency = sub;
          break;
        }
      }
    }

    const title = parts[0] || "Airport Alert";
    let timeRange: string | undefined;
    let day: string | undefined;
    let surge: string | undefined;
    let flightCount: string | undefined;
    let countdown: string | undefined;
    let countdownType: ParsedRec["countdownType"] = "planned";
    const tipParts: string[] = [];

    if (parts.length >= 3 && /^\d{1,2}:\d{2}/.test(parts[1])) {
      timeRange = parts[1];
    }
    if (parts.length >= 3 && /day|mon|tue|wed|thu|fri|sat|sun/i.test(parts[2])) {
      day = parts[2];
    }

    for (let i = 3; i < parts.length; i++) {
      const p = parts[i];
      const type = classifyPart(p);
      if (type === "surge" && !surge) {
        surge = p;
      } else if (type === "flights" && !flightCount) {
        flightCount = p;
      } else if (type === "status" && !countdown) {
        const cd = parseCountdown(p);
        countdown = cd.countdown;
        countdownType = cd.countdownType;
      } else if (type === "text") {
        tipParts.push(p);
      }
    }

    const tip = tipParts.join(". ").trim();

    return { category, urgency, title, timeRange, day, surge, flightCount, countdown, countdownType, tip };
  }

  const surgeMatch = reason.match(/^(\d+\.?\d*)x\s+surge\s+(?:active\s+)?at\s+(.+?)\s+\(/);
  if (surgeMatch) {
    const zoneName = surgeMatch[2];
    const surgeVal = surgeMatch[1] + "x";
    const sentences = reason.split(/\.\s+/);
    const tip = sentences.length > 1 ? sentences.slice(1).join(". ") : "";
    return {
      category: "zone",
      title: zoneName,
      surge: surgeVal,
      countdownType: "active",
      countdown: "Active now",
      tip: tip,
    };
  }

  return {
    category: "zone",
    title: action === "MOVE" ? "Relocate" : action === "WAIT" ? "Hold Position" : "Accept Rides",
    tip: reason,
  };
}

const categoryConfig = {
  departure: {
    icon: PlaneTakeoff,
    label: "Departures",
    color: "orange",
    iconBg: "bg-orange-500/10 border-orange-500/20 text-orange-500",
    badgeBg: "bg-orange-500/15 text-orange-400",
    border: "border-orange-500/30",
    labelBg: "bg-orange-500 text-white",
  },
  arrival: {
    icon: PlaneLanding,
    label: "Arrivals",
    color: "sky",
    iconBg: "bg-sky-500/10 border-sky-500/20 text-sky-500",
    badgeBg: "bg-sky-500/15 text-sky-400",
    border: "border-sky-500/30",
    labelBg: "bg-sky-500 text-white",
  },
  upcoming_dep: {
    icon: PlaneTakeoff,
    label: "Departures",
    color: "violet",
    iconBg: "bg-violet-500/10 border-violet-500/20 text-violet-500",
    badgeBg: "bg-violet-500/15 text-violet-400",
    border: "border-violet-500/30",
    labelBg: "bg-violet-500 text-white",
  },
  upcoming_arr: {
    icon: PlaneLanding,
    label: "Arrivals",
    color: "sky",
    iconBg: "bg-sky-500/10 border-sky-500/20 text-sky-500",
    badgeBg: "bg-sky-500/15 text-sky-400",
    border: "border-sky-500/30",
    labelBg: "bg-sky-500 text-white",
  },
  tomorrow: {
    icon: Plane,
    label: "Tomorrow",
    color: "indigo",
    iconBg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
    badgeBg: "bg-indigo-500/15 text-indigo-400",
    border: "border-indigo-500/30",
    labelBg: "bg-indigo-500 text-white",
  },
  zone: {
    icon: Navigation,
    label: null,
    color: "primary",
    iconBg: "bg-primary/10 border-primary/20 text-primary",
    badgeBg: "bg-primary/15 text-primary",
    border: "border-border/50",
    labelBg: "bg-accent text-accent-foreground",
  },
};

const urgencyConfig: Record<string, { label: string; className: string }> = {
  "IMMINENT": { label: "Now", className: "bg-red-500/15 text-red-400" },
  "PREPARE NOW": { label: "Soon", className: "bg-amber-500/15 text-amber-400" },
  "PLAN AHEAD": { label: "Plan", className: "bg-blue-500/15 text-blue-400" },
  "HEAD TO AIRPORT": { label: "Go", className: "bg-emerald-500/15 text-emerald-400" },
};

export function RecommendationCard({ rec }: RecommendationCardProps) {
  const [polTime, setPolTime] = useState(getPolandTimeStr());
  useEffect(() => {
    const interval = setInterval(() => setPolTime(getPolandTimeStr()), 30000);
    return () => clearInterval(interval);
  }, []);

  const parsed = parseReason(rec.reason || "", rec.action || "");
  const config = categoryConfig[parsed.category];
  const IconComponent = config.icon;
  const isAirport = parsed.category !== "zone";
  const actionIcon = rec.action === "MOVE" ? ArrowRight : rec.action === "WAIT" ? Clock : MapPin;
  const ActionIcon = isAirport ? IconComponent : actionIcon;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        config.border,
        isAirport && parsed.countdownType === "active" && "bg-card",
        !isAirport && "bg-card"
      )}
      data-testid={`card-recommendation-${rec.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border shrink-0",
          config.iconBg
        )}>
          <ActionIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="space-y-0.5">
              <h4 className="font-semibold text-sm leading-tight" data-testid={`text-rec-title-${rec.id}`}>
                {parsed.title}
              </h4>
              {isAirport && (
                <p className="text-xs text-muted-foreground">{config.label}</p>
              )}
            </div>

            {parsed.countdown && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs font-bold shrink-0",
                  parsed.countdownType === "active" && "bg-emerald-500/15 text-emerald-400",
                  parsed.countdownType === "upcoming" && "bg-amber-500/15 text-amber-400",
                  parsed.countdownType === "planned" && "bg-blue-500/15 text-blue-400"
                )}
                data-testid={`badge-countdown-${rec.id}`}
              >
                <Timer className="w-3 h-3 mr-1" />
                {parsed.countdown}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {parsed.urgency && urgencyConfig[parsed.urgency] && (
              <Badge variant="secondary" className={cn("text-xs font-bold", urgencyConfig[parsed.urgency].className)}>
                {urgencyConfig[parsed.urgency].label}
              </Badge>
            )}
            {parsed.surge && (
              <Badge variant="secondary" className={cn("text-xs font-bold", config.badgeBg)}>
                <Zap className="w-3 h-3 mr-0.5" />
                {parsed.surge}
              </Badge>
            )}
            {parsed.flightCount && (
              <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                <Plane className="w-3 h-3 mr-0.5" />
                {parsed.flightCount}
              </Badge>
            )}
            {parsed.timeRange && (
              <span className="text-xs text-muted-foreground font-mono">{parsed.timeRange}</span>
            )}
            {parsed.day && (
              <span className="text-xs text-muted-foreground">{parsed.day}</span>
            )}
          </div>

          {parsed.tip && (
            <p className="text-xs text-muted-foreground leading-relaxed" data-testid={`text-rec-tip-${rec.id}`}>
              {parsed.tip}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          {rec.action && (
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                rec.action === "MOVE" && "bg-blue-500/10 text-blue-400",
                rec.action === "TAKE" && "bg-emerald-500/10 text-emerald-400",
                rec.action === "WAIT" && "bg-amber-500/10 text-amber-400"
              )}
            >
              {rec.action === "MOVE" ? "Relocate" : rec.action === "TAKE" ? "Accept rides" : "Wait here"}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{polTime} PL</span>
      </div>
    </div>
  );
}
