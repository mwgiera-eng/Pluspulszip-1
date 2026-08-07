import { useEarningsStats } from "@/hooks/use-earnings";
import { useRecommendations } from "@/hooks/use-recommendations";
import { useAuth } from "@/hooks/use-auth";
import { useZones } from "@/hooks/use-zones";
import { useQuery } from "@tanstack/react-query";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Sidebar } from "@/components/Sidebar";
import { StatsCard } from "@/components/StatsCard";
import { RecommendationCard } from "@/components/RecommendationCard";
import { MapView } from "@/components/MapView";
import { PopularRoutes } from "@/components/PopularRoutes";
import { Wallet, TrendingUp, MapPin, Clock, PlaneLanding, PlaneTakeoff, Navigation, Crosshair, Plane, ArrowUpRight, Flame } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, AlertTriangle } from "lucide-react";

interface ScrapedFlight {
  time: string;
  destination: string;
  airportCode: string;
  flightNumber: string;
  airlineCode: string;
  airlineName: string;
  status: string;
  type: "arrival" | "departure";
}

interface AirportFlightsResponse {
  arrivals: ScrapedFlight[];
  departures: ScrapedFlight[];
  arrivalsSource: "live" | "static";
  departuresSource: "live" | "static";
}

interface StrategicAdvice {
  summary: string;
  currentZone: { name: string; type: string; demandLevel: string } | null;
  nearestHighDemandZone: { name: string; distanceKm: number; direction: string; type: string } | null;
  distanceToAirport: number | null;
  tip: string;
}

interface ZoneProfitHeatData {
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
}

interface ZoneProfitHeatResponse {
  zones: ZoneProfitHeatData[];
  transitionNarrative: string;
  targetTime: string;
  regime: string;
}

const HEAT_TIME_OFFSETS = [
  { label: 'Live', hours: 0, minutes: 0 },
  { label: '+30m', hours: 0, minutes: 30 },
  { label: '+1h', hours: 1, minutes: 0 },
  { label: '+2h', hours: 2, minutes: 0 },
  { label: '+3h', hours: 3, minutes: 0 },
];

function getHeatColor(score: number): string {
  if (score >= 85) return '#ffffff';
  if (score >= 70) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 30) return '#eab308';
  if (score >= 15) return '#22d3ee';
  return '#3b82f6';
}

function ZoneProfitHeatSection() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const offset = HEAT_TIME_OFFSETS[selectedIdx];

  const { data: heatData } = useQuery<ZoneProfitHeatResponse>({
    queryKey: ['/api/zone-profit-heat', offset.hours, offset.minutes],
    queryFn: async () => {
      const res = await fetch(`/api/zone-profit-heat?hoursAhead=${offset.hours}&minutesAhead=${offset.minutes}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: selectedIdx === 0 ? 60000 : undefined,
    placeholderData: (prev) => prev,
  });

  const topZones = heatData?.zones.slice(0, 5) || [];

  return (
    <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden" data-testid="section-profit-heat">
      <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="font-semibold text-sm">Zone Profit Heat</h3>
        </div>
        <div className="flex items-center gap-2">
          {heatData && (
            <span className="text-[10px] text-muted-foreground">{heatData.targetTime} CET</span>
          )}
          <div className="flex gap-0.5" data-testid="dashboard-heat-slider">
            {HEAT_TIME_OFFSETS.map((o, idx) => (
              <button
                key={o.label}
                onClick={() => setSelectedIdx(idx)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                  selectedIdx === idx
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
                data-testid={`btn-dash-heat-${o.label.replace('+', 'plus-')}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {heatData && (
        <div className="px-3 py-1.5 bg-orange-500/5 border-b border-orange-500/10">
          <p className="text-[11px] text-orange-300/80 flex items-center gap-1.5" data-testid="text-heat-narrative">
            <Clock className="w-3 h-3 shrink-0" />
            {heatData.transitionNarrative}
          </p>
        </div>
      )}

      <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {topZones.map((zone, i) => {
          const color = getHeatColor(zone.profitScore);
          return (
            <div
              key={zone.zoneId}
              className={cn(
                "rounded-lg border p-2.5 flex flex-col gap-1",
                zone.profitScore >= 70 && "border-red-500/30 bg-red-500/5",
                zone.profitScore >= 50 && zone.profitScore < 70 && "border-orange-500/30 bg-orange-500/5",
                zone.profitScore < 50 && "border-border/50 bg-muted/20"
              )}
              data-testid={`card-heat-zone-${zone.zoneId}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-xs truncate">{zone.zoneName}</span>
                <span className="text-base font-bold shrink-0" style={{ color }}>
                  {zone.profitScore}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="capitalize">{zone.zoneType}</span>
                {zone.surgeMultiplier > 1 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-violet-500/10 text-violet-400">
                    {zone.surgeMultiplier}x
                  </Badge>
                )}
              </div>
              <div className="w-full bg-muted/30 rounded-full h-1 mt-0.5">
                <div
                  className="h-1 rounded-full transition-all duration-500"
                  style={{ width: `${zone.profitScore}%`, background: color }}
                />
              </div>
              {i === 0 && (
                <span className="text-[9px] text-orange-400 font-semibold">Hottest zone</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStatusColor(status: string): { text: string; bg: string; border: string } {
  const s = status.toLowerCase();
  if (s.includes('landed') || s.includes('arrived')) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  if (s.includes('boarding') || s.includes('last call')) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  if (s.includes('gate closed') || s.includes('departed') || s.includes('took off')) return { text: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border/50' };
  if (s.includes('delayed') || s.includes('cancelled') || s.includes('diverted')) return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
  if (s.includes('check-in') || s.includes('expected')) return { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' };
  return { text: 'text-muted-foreground', bg: 'bg-muted/20', border: 'border-border/50' };
}

function RealFlightRow({ f, i }: { f: ScrapedFlight; i: number }) {
  const colors = getStatusColor(f.status);
  return (
    <tr
      className={cn("border-b border-border/30 last:border-0 transition-colors hover:bg-muted/20")}
      data-testid={`row-flight-${f.type}-${i}`}
    >
      <td className="py-2 px-2 font-mono text-sm font-semibold whitespace-nowrap" data-testid={`text-flight-time-${i}`}>
        {f.time}
      </td>
      <td className="py-2 px-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-tight truncate max-w-[180px]" data-testid={`text-flight-dest-${i}`}>
            {f.destination}
          </span>
          {f.airportCode && (
            <span className="text-[10px] text-muted-foreground">{f.airportCode}</span>
          )}
        </div>
      </td>
      <td className="py-2 px-2">
        <div className="flex flex-col">
          <span className="text-xs font-mono font-medium" data-testid={`text-flight-number-${i}`}>{f.flightNumber}</span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{f.airlineName}</span>
        </div>
      </td>
      <td className="py-2 px-2">
        <Badge
          variant="secondary"
          className={cn("text-[10px] font-semibold px-1.5 py-0.5 whitespace-nowrap", colors.bg, colors.text)}
          data-testid={`badge-flight-status-${i}`}
        >
          {f.status}
        </Badge>
      </td>
    </tr>
  );
}

function FlightsSection() {
  const [activeTab, setActiveTab] = useState<"arrivals" | "departures">("departures");

  const { data: flightData } = useQuery<AirportFlightsResponse>({
    queryKey: ["/api/airport-flights"],
    refetchInterval: 60000,
    placeholderData: (prev) => prev,
  });

  const flights = activeTab === "arrivals" ? flightData?.arrivals : flightData?.departures;
  const arrCount = flightData?.arrivals?.length || 0;
  const depCount = flightData?.departures?.length || 0;
  const activeSource = activeTab === "arrivals" ? flightData?.arrivalsSource : flightData?.departuresSource;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden" data-testid="section-flights">
      <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-sky-400" />
          <h3 className="font-semibold text-sm">Flights — Balice Airport (KRK)</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {activeSource === "static" ? (
            <>
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              Typical schedule — live data unavailable
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live flight data
            </>
          )}
        </div>
      </div>

      <div className="flex border-b border-border" data-testid="flights-tabs">
        <button
          onClick={() => setActiveTab("arrivals")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all border-b-2",
            activeTab === "arrivals"
              ? "border-sky-500 text-sky-400 bg-sky-500/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          data-testid="tab-arrivals"
        >
          <PlaneLanding className="w-4 h-4" />
          Arrivals
          {arrCount > 0 && (
            <span className="text-[10px] font-bold text-muted-foreground">{arrCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("departures")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all border-b-2",
            activeTab === "departures"
              ? "border-orange-500 text-orange-400 bg-orange-500/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
          )}
          data-testid="tab-departures"
        >
          <PlaneTakeoff className="w-4 h-4" />
          Departures
          {depCount > 0 && (
            <span className="text-[10px] font-bold text-muted-foreground">{depCount}</span>
          )}
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {flights && flights.length > 0 ? (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 px-2 font-medium">Time</th>
                <th className="py-2 px-2 font-medium">{activeTab === "arrivals" ? "From" : "To"}</th>
                <th className="py-2 px-2 font-medium">Flight</th>
                <th className="py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f, i) => (
                <RealFlightRow key={`${f.flightNumber}-${i}`} f={f} i={i} />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Plane className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Loading flights from Krakow Airport...</p>
          </div>
        )}
      </div>
    </div>
  );
}

const OUTAGE_DISMISS_KEY = "outage-notice-dismissed-2026-03";

function OutageNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(OUTAGE_DISMISS_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(OUTAGE_DISMISS_KEY, "1"); } catch {}
    setVisible(false);
  };

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2 duration-300" data-testid="banner-outage-notice">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      <span className="text-amber-200 text-xs">Sorry for the recent hiccup — pricing data was briefly unavailable. Everything is back on track now.</span>
      <button onClick={dismiss} className="ml-auto shrink-0 text-amber-400/60 hover:text-amber-200 transition-colors" aria-label="Dismiss outage notice" data-testid="button-dismiss-outage">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Dashboard({ isPublic = false, publicBanner }: { isPublic?: boolean; publicBanner?: React.ReactNode }) {
  const { user } = useAuth();
  const { data: stats } = useEarningsStats(!isPublic && !!user);
  const { data: recommendations, isLoading: loadingRecs, error: recsError } = useRecommendations();
  const { data: zonesData } = useZones();
  const { position, status: geoStatus, error: geoError, requestPermission } = useGeolocation(!isPublic);

  const { data: advice } = useQuery<StrategicAdvice>({
    queryKey: ["/api/strategic-advice", position?.lat, position?.lng],
    queryFn: async () => {
      if (!position) throw new Error("No position");
      const res = await fetch(`/api/strategic-advice?lat=${position.lat}&lng=${position.lng}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!position,
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const sortedRecs = recommendations?.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const topRec = sortedRecs?.[0];
  const getZoneName = (zoneId: number | null) => {
    if (!zoneId || !zonesData) return null;
    return zonesData.find(z => z.id === zoneId)?.name;
  };

  const getDemandColor = (level: string) => {
    switch (level) {
      case "surge": return "text-violet-400";
      case "high": return "text-red-400";
      case "medium": return "text-amber-400";
      default: return "text-emerald-400";
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden flex-col">
      {isPublic && publicBanner}
      <div className="flex flex-1 overflow-hidden">
      {!isPublic && <Sidebar />}
      
      <main className="flex-1 overflow-auto">
        <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-3 md:space-y-5">
          {!isPublic && <OutageNotice />}
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg md:text-2xl font-bold tracking-tight">Driver Command Center</h2>
              <p className="text-muted-foreground text-xs mt-0.5">Real-time optimization for Krakow</p>
            </div>
            {topRec && (
              <div className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full flex items-center gap-2" data-testid="badge-live-recommendation">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-semibold text-primary text-xs">
                  {topRec.action === 'MOVE' 
                    ? `Move to ${getZoneName(topRec.targetZoneId) || 'High Demand Area'}` 
                    : topRec.action === 'TAKE' 
                    ? `Surge at ${getZoneName(topRec.zoneId) || 'Nearby Zone'}`
                    : 'Hold Current Position'}
                </span>
              </div>
            )}
          </div>

          {isPublic && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4" data-testid="banner-public-cta">
              <div>
                <p className="font-semibold text-sm text-primary">Odblokuj pełny dostęp</p>
                <p className="text-xs text-muted-foreground mt-0.5">Zaloguj się, aby korzystać z porad AI, śledzenia zarobków, planera dnia i więcej.</p>
              </div>
              <a href="/login" className="shrink-0 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors" data-testid="button-public-cta">
                Sprawdź sam!
              </a>
            </div>
          )}

          {!isPublic && <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden" data-testid="section-strategic-advice">
            <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Strategic Advice</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {geoStatus === "active" && (
                  <>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span>GPS Active</span>
                  </>
                )}
                {geoStatus === "requesting" && (
                  <>
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    <span>Acquiring...</span>
                  </>
                )}
                {(geoStatus === "denied" || geoStatus === "unavailable" || geoStatus === "error") && (
                  <>
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <span>GPS Off</span>
                  </>
                )}
                {geoStatus === "idle" && (
                  <>
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                    <span>GPS Off</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-3">
              {geoStatus === "denied" || geoStatus === "unavailable" ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
                    <Navigation className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-xs">Enable GPS for position-based tips</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={requestPermission} data-testid="button-enable-gps">
                    Enable
                  </Button>
                </div>
              ) : geoStatus === "requesting" || geoStatus === "idle" ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shrink-0 animate-pulse">
                    <Crosshair className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">Acquiring your position...</p>
                </div>
              ) : advice ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shrink-0">
                      <Navigation className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight" data-testid="text-strategic-summary">{advice.summary}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5" data-testid="text-strategic-tip">{advice.tip}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap pl-11">
                    {advice.currentZone && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className={cn("font-semibold", getDemandColor(advice.currentZone.demandLevel))}>
                          {advice.currentZone.name}
                        </span>
                      </div>
                    )}
                    {advice.nearestHighDemandZone && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                        <span className="font-semibold text-foreground">
                          {advice.nearestHighDemandZone.name} ({advice.nearestHighDemandZone.distanceKm}km)
                        </span>
                      </div>
                    )}
                    {advice.distanceToAirport !== null && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <Plane className="w-3 h-3 text-muted-foreground" />
                        <span className="font-semibold text-foreground">Balice {advice.distanceToAirport}km</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : position ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shrink-0 animate-pulse">
                    <Navigation className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">Analyzing your position...</p>
                </div>
              ) : null}
            </div>
          </div>}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <StatsCard
              title="Total Earnings"
              value={isPublic ? "— PLN" : (stats ? `${stats.totalEarnings} PLN` : "...")}
              icon={Wallet}
              trend="up"
              trendValue="12%"
              variant="green"
            />
            <StatsCard
              title="Avg. Trip"
              value={isPublic ? "— PLN" : (stats ? `${stats.averagePerTrip.toFixed(2)} PLN` : "...")}
              icon={TrendingUp}
              trend="neutral"
              trendValue="0%"
              variant="green"
            />
            <StatsCard
              title="Trips Completed"
              value={isPublic ? "—" : (stats ? stats.totalTrips : "...")}
              icon={MapPin}
              description="This month"
              variant="purple"
            />
            <StatsCard
              title="Active Hours"
              value={isPublic ? "—" : "34.5h"}
              icon={Clock}
              description="Online time"
              variant="amber"
            />
          </div>

          <ZoneProfitHeatSection />

          <PopularRoutes driverPosition={position} />

          <FlightsSection />

          {!isPublic && (
            <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden flex flex-col">
              <div className="p-3 border-b border-border bg-muted/30">
                <h3 className="font-semibold text-sm">Strategic Actions</h3>
              </div>
              <div className="p-2.5 space-y-2">
                {loadingRecs ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Analysing market data...</div>
                ) : recsError ? (
                  <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-1">
                    <Clock className="w-6 h-6 mb-1 opacity-50" />
                    <p className="text-sm">Loading recommendations...</p>
                  </div>
                ) : sortedRecs && sortedRecs.length > 0 ? (
                  sortedRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} />
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground flex flex-col items-center">
                    <Clock className="w-6 h-6 mb-1 opacity-50" />
                    <p className="text-sm">No immediate actions required.</p>
                    <p className="text-xs opacity-50">Stay in your current zone.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden flex flex-col h-[350px] lg:h-[450px]">
            <div className="p-3 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-semibold text-sm">Live Demand Map</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Live
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              <MapView driverPosition={position} />
            </div>
          </div>

        </div>
      </main>
      </div>
    </div>
  );
}
