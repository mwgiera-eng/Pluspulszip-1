import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Plane, CalendarDays, Flame, Clock, ExternalLink, Loader2, ChevronRight, TrendingUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SiUber } from "react-icons/si";

interface HourBlock {
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
}

interface DayPlanResponse {
  date: string;
  dayName: string;
  blocks: HourBlock[];
  summary: string;
  uberTip: string;
}

const DEMAND_COLORS: Record<string, string> = {
  surge: "bg-destructive/20 border-destructive/30 text-destructive",
  high: "bg-destructive/15 border-destructive/25 text-destructive",
  medium: "bg-amber-500/15 border-amber-500/25 text-amber-300",
  low: "bg-zinc-500/10 border-zinc-500/20 text-zinc-400",
};

const DEMAND_DOT: Record<string, string> = {
  surge: "bg-destructive",
  high: "bg-destructive",
  medium: "bg-amber-400",
  low: "bg-zinc-500",
};

export default function DayPlanner() {
  const [tomorrow, setTomorrow] = useState(false);
  const [expandedHour, setExpandedHour] = useState<number | null>(null);

  const { data: plan, isLoading } = useQuery<DayPlanResponse>({
    queryKey: ["/api/day-plan", tomorrow],
    queryFn: async () => {
      const res = await fetch(`/api/day-plan?tomorrow=${tomorrow}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load day plan");
      return res.json();
    },
  });

  const now = new Date();
  const currentHour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw", hour: "numeric", hour12: false,
  }).formatToParts(now).find(p => p.type === "hour");
  const polandHour = parseInt(currentHour?.value || "0");

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-3 md:p-6 max-w-4xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" data-testid="text-planner-title">Day Planner</h2>
              <p className="text-muted-foreground text-xs mt-0.5">
                {plan ? `${plan.dayName}, ${plan.date}` : "Plan your optimal driving shift"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={tomorrow ? "outline" : "default"}
                size="sm"
                onClick={() => setTomorrow(false)}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button
                variant={tomorrow ? "default" : "outline"}
                size="sm"
                onClick={() => setTomorrow(true)}
                data-testid="button-tomorrow"
              >
                Tomorrow
              </Button>
            </div>
          </div>

          {plan && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <SiUber className="w-5 h-5 text-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium mb-1">Uber Day Planning Tip</p>
                    <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-uber-tip">{plan.uberTip}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5 italic" data-testid="text-uber-disclaimer">Based on reported driver experience. Not affiliated with Uber Technologies Inc.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {plan && (
            <p className="text-sm text-muted-foreground" data-testid="text-plan-summary">{plan.summary}</p>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {plan?.blocks.map((block) => {
                const isNow = !tomorrow && block.hour === polandHour;
                const isPast = !tomorrow && block.hour < polandHour;
                const isExpanded = expandedHour === block.hour;
                const hasActivity = block.flights.length > 0 || block.events.length > 0;

                return (
                  <div key={block.hour} className={cn("transition-all", isPast && "opacity-40")} data-testid={`block-hour-${block.hour}`}>
                    <button
                      onClick={() => setExpandedHour(isExpanded ? null : block.hour)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                        isNow ? "ring-2 ring-primary border-primary/30 bg-primary/5" : "border-border/30 hover:border-border/60 bg-card/50",
                      )}
                      data-testid={`button-expand-${block.hour}`}
                    >
                      <div className="w-14 text-center shrink-0">
                        <span className={cn("text-sm font-mono font-bold", isNow && "text-primary")}>
                          {String(block.hour).padStart(2, "0")}:00
                        </span>
                      </div>

                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", DEMAND_DOT[block.demandLevel])} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{block.bestZone}</span>
                          {isNow && <Badge className="text-[10px] px-1.5 py-0 bg-primary">NOW</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{block.earningsPotential}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {block.flights.length > 0 && <Plane className="w-3.5 h-3.5 text-muted-foreground" />}
                        {block.events.length > 0 && <CalendarDays className="w-3.5 h-3.5 text-destructive" />}
                        {block.platformHighlight === "uber" && <SiUber className="w-3 h-3 text-foreground" />}
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-0", DEMAND_COLORS[block.demandLevel])}>
                          {block.demandLevel}
                        </Badge>
                        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-1 ml-[4.5rem] space-y-2 p-3 rounded-lg bg-card/80 border border-border/20 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-primary">Platform Recommendation</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{block.platformTip}</p>
                          </div>
                        </div>

                        {block.flights.length > 0 && (
                          <div className="flex items-start gap-2">
                            <Plane className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Flights</p>
                              {block.flights.map((f, i) => (
                                <p key={i} className="text-xs text-muted-foreground">{f.label} ({f.count} flights)</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {block.events.length > 0 && (
                          <div className="flex items-start gap-2">
                            <CalendarDays className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-destructive">Events</p>
                              {block.events.map((e, i) => (
                                <p key={i} className="text-xs text-muted-foreground">{e.title} at {e.venue} ({e.status})</p>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-2">
                          <Flame className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-amber-400">Pro Tip</p>
                            <p className="text-xs text-muted-foreground">{block.proTip}</p>
                          </div>
                        </div>

                        {block.platformHighlight === "uber" && (
                          <a
                            href="https://drivers.uber.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                            data-testid={`link-uber-${block.hour}`}
                          >
                            <SiUber className="w-3 h-3" />
                            Open Uber Driver Hub
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
