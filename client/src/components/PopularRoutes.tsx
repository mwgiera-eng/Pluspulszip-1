import { useQuery } from "@tanstack/react-query";
import { Route, Clock, ArrowRight, TrendingUp, ExternalLink, MapPin, Navigation, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GeoPosition } from "@/hooks/use-geolocation";

export interface PopularRouteData {
  id: string;
  from: string;
  fromShort: string;
  to: string;
  toShort: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  distanceKm: number;
  durationMin: number;
  estimatedPricePLN: number;
  plnPerMin: number;
  passengers: string;
  timeLabel: string;
  relevanceScore: number;
  uberDeepLink: string;
  distToPickupKm: number | null;
  eventSurgeTip: string | null;
}

interface PopularRoutesProps {
  driverPosition?: GeoPosition | null;
}

export function PopularRoutes({ driverPosition }: PopularRoutesProps) {
  const queryParams = driverPosition
    ? `?lat=${driverPosition.lat}&lng=${driverPosition.lng}`
    : "";

  const { data: routes, isLoading } = useQuery<PopularRouteData[]>({
    queryKey: ["/api/popular-routes", driverPosition?.lat, driverPosition?.lng],
    queryFn: async () => {
      const res = await fetch(`/api/popular-routes${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch routes");
      return res.json();
    },
    refetchInterval: 900000,
    placeholderData: (prev) => prev,
  });

  if (isLoading && !routes) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-none overflow-hidden" data-testid="section-popular-routes">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-2">
          <Route className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Popularne trasy</h3>
        </div>
        <div className="p-6 text-center text-muted-foreground">Loading route data...</div>
      </div>
    );
  }

  if (!routes || routes.length === 0) return null;

  const timeLabel = routes[0]?.timeLabel || "Now";
  const hasEvents = routes.some(r => r.eventSurgeTip);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-none overflow-hidden" data-testid="section-popular-routes">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Popularne trasy</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary font-bold">
            {timeLabel}
          </Badge>
          {hasEvents && (
            <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive font-bold" data-testid="badge-event-active">
              Wzrost popytu
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary font-bold" data-testid="badge-estimated-prices">
            Szacunkowe ceny
          </Badge>
          {driverPosition && (
            <Badge variant="secondary" className="text-xs bg-secondary/10 text-muted-foreground font-bold">
              W pobliżu
            </Badge>
          )}
        </div>
      </div>

      {hasEvents && (
        <div className="px-4 py-2 bg-destructive/5 border-b border-destructive/10">
          {routes.filter(r => r.eventSurgeTip).slice(0, 2).map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-destructive py-0.5" data-testid={`text-event-tip-${i}`}>
              <Zap className="w-3 h-3 shrink-0" />
              <span>{r.eventSurgeTip}</span>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </div>
  );
}

function RouteCard({ route }: { route: PopularRouteData }) {
  const isTop = route.plnPerMin >= 2.0 || route.relevanceScore >= 70;

  return (
    <div
      className={cn(
        "rounded-xl border p-2.5 flex flex-col gap-1.5 transition-colors",
        isTop
          ? "border-primary/30 bg-primary/5"
          : "border-border/50"
      )}
      data-testid={`card-route-${route.id}`}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <MapPin className="w-3 h-3 text-primary shrink-0" />
          <span className="font-semibold text-xs truncate" data-testid={`text-route-from-${route.id}`}>{route.fromShort}</span>
          {route.distToPickupKm !== null && route.distToPickupKm <= 3 && (
            <span className="text-[9px] text-muted-foreground shrink-0 flex items-center gap-0.5" data-testid={`text-route-nearby-${route.id}`}>
              <Navigation className="w-2.5 h-2.5" />
              {route.distToPickupKm}km
            </span>
          )}
        </div>
        <span className="font-bold text-sm shrink-0 text-primary" data-testid={`text-route-price-${route.id}`}>
          ~{route.estimatedPricePLN.toFixed(0)} PLN
        </span>
      </div>

      <div className="flex items-center gap-1 min-w-0">
        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground text-xs truncate" data-testid={`text-route-to-${route.id}`}>{route.toShort}</span>
      </div>

      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span data-testid={`text-route-distance-${route.id}`}>{route.distanceKm} km</span>
          <span className="flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {route.durationMin}'
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center text-[9px] text-primary font-bold" data-testid={`badge-plnmin-${route.id}`}>
            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
            {route.plnPerMin.toFixed(1)} PLN/min
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-0.5">
        <a
          href={route.uberDeepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-neutral-700/50 text-neutral-300 hover:bg-neutral-600/50 transition-colors"
          data-testid={`link-uber-${route.id}`}
        >
          Uber
          <ExternalLink className="w-2 h-2" />
        </a>
      </div>

      {route.eventSurgeTip && (
        <div className="flex items-center gap-1 text-[9px] text-destructive mt-0.5" data-testid={`text-route-event-${route.id}`}>
          <Zap className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">Wzrost popytu aktywny</span>
        </div>
      )}
    </div>
  );
}
