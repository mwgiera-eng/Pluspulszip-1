import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, CircleMarker, Polyline, Tooltip, Polygon } from 'react-leaflet';
import { useMapData } from '@/hooks/use-map-data';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { Loader2, MapPin, Star, Clock, Flame, Radar, Navigation2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { GeoPosition } from '@/hooks/use-geolocation';
import { TrafficLayer } from './TrafficLayer';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const KRAKOW_COORDS: [number, number] = [50.0647, 19.9450];

const PURPLE_COLOR = '#2EE6A6'; // Best $ route — teal (money)
const GREEN_COLOR = '#91F7D7'; // alternative money routes — soft teal
const BLUE_COLOR = '#7DD3FC'; // drive-to-pickup — navigation blue

interface RouteGeometryData {
  id: string;
  fromShort: string;
  toShort: string;
  estimatedPricePLN: number;
  plnPerMin: number;
  distanceKm: number;
  durationMin: number;
  role: "nearest_profitable" | "top_route" | "drive_to_pickup";
  geometry: [number, number][];
  realDistanceKm: number;
  realDurationMin: number;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13, { duration: 1.5 });
  }, [center, map]);
  return null;
}

function DriverMarker({ position }: { position: GeoPosition }) {
  return (
    <>
      <Circle
        center={[position.lat, position.lng]}
        radius={position.accuracy}
        pathOptions={{
          color: '#2EE6A6',
          fillColor: '#2EE6A6',
          fillOpacity: 0.06,
          weight: 1,
          dashArray: '4 4',
        }}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={14}
        className="leaflet-driver-pulse"
        pathOptions={{
          color: '#2EE6A6',
          fillColor: '#2EE6A6',
          fillOpacity: 0.16,
          weight: 0,
        }}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={7}
        pathOptions={{
          color: '#07110e',
          fillColor: '#2EE6A6',
          fillOpacity: 1,
          weight: 3,
        }}
      >
        <Popup>
          <div className="p-2">
            <h3 className="font-bold" data-testid="text-driver-location">Your Location</h3>
            <p className="text-xs text-muted-foreground">Accuracy: {Math.round(position.accuracy)}m</p>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}

function DriveToPickupOverlay({ route }: { route: RouteGeometryData }) {
  const positions = route.geometry;
  if (positions.length < 2) return null;

  return (
    <span>
      <Polyline
        positions={positions}
        pathOptions={{
          color: BLUE_COLOR,
          weight: 7,
          opacity: 0.12,
        }}
      />
      <Polyline
        positions={positions}
        className="leaflet-route-glow"
        pathOptions={{
          color: BLUE_COLOR,
          weight: 3,
          opacity: 0.82,
          dashArray: '5 12',
          lineCap: 'round',
        }}
      />
      <CircleMarker
        center={positions[positions.length - 1]}
        radius={8}
        pathOptions={{
          color: BLUE_COLOR,
          fillColor: BLUE_COLOR,
          fillOpacity: 0.3,
          weight: 2,
        }}
      >
        <Popup>
          <div className="p-2 min-w-[130px]">
            <h3 className="font-bold text-sm" data-testid="text-drive-to-pickup">Drive to {route.toShort}</h3>
            <p className="text-xs text-gray-500 mt-1">Nearest profitable pickup</p>
            <p className="text-[10px] text-blue-500 mt-0.5">
              {route.realDistanceKm} km / ~{route.realDurationMin} min drive
            </p>
          </div>
        </Popup>
      </CircleMarker>
    </span>
  );
}

function RoadRouteOverlay({ routes }: { routes: RouteGeometryData[] }) {
  const driveToPickup = routes.find(r => r.role === "drive_to_pickup");
  const tripRoutes = routes.filter(r => r.role !== "drive_to_pickup");

  return (
    <>
      {driveToPickup && <DriveToPickupOverlay route={driveToPickup} />}
      {tripRoutes.map((route) => {
        const isPurple = route.role === "nearest_profitable";
        const color = isPurple ? PURPLE_COLOR : GREEN_COLOR;
        const positions = route.geometry;
        if (positions.length < 2) return null;

        const startPos = positions[0];
        const endPos = positions[positions.length - 1];

        return (
          <span key={route.id}>
            <Polyline
              positions={positions}
              pathOptions={{
                color: color,
                weight: isPurple ? 8 : 5,
                opacity: isPurple ? 0.16 : 0.1,
              }}
            />
            <Polyline
              positions={positions}
              className="leaflet-route-glow"
              pathOptions={{
                color: color,
                weight: isPurple ? 4 : 2.5,
                opacity: isPurple ? 0.86 : 0.48,
                dashArray: isPurple ? '10 12' : '4 14',
                lineCap: 'round',
              }}
            />

            <CircleMarker
              center={startPos}
              radius={isPurple ? 12 : 7}
              className="leaflet-route-pulse"
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 0,
              }}
              data-testid={`marker-route-start-${route.id}`}
            />
            <CircleMarker
              center={startPos}
              radius={isPurple ? 6 : 5}
              pathOptions={{
                color: '#06110e',
                fillColor: color,
                fillOpacity: 1,
                weight: 2.5,
              }}
            >
              <Popup>
                <div className="p-2 min-w-[140px]">
                  <h3 className="font-bold text-sm" data-testid={`text-route-pickup-${route.id}`}>{route.fromShort}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {isPurple ? 'Best dropoff pickup' : 'Pickup point'}
                  </p>
                  <p className="text-xs font-semibold mt-1" style={{ color }}>
                    {route.toShort} - {route.estimatedPricePLN.toFixed(0)} PLN
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {route.realDistanceKm} km / ~{route.realDurationMin} min / {route.plnPerMin.toFixed(1)} PLN/min
                  </p>
                </div>
              </Popup>
            </CircleMarker>

            <CircleMarker
              center={endPos}
              radius={isPurple ? 7 : 4}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: isPurple ? 0.9 : 0.7,
                weight: isPurple ? 2 : 1,
              }}
              data-testid={`marker-route-end-${route.id}`}
            >
              <Popup>
                <div className="p-2 min-w-[120px]">
                  <h3 className="font-bold text-sm" data-testid={`text-route-dropoff-${route.id}`}>{route.toShort}</h3>
                  <p className="text-xs text-gray-500">
                    {isPurple ? 'Most profitable dropoff' : 'Dropoff'}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-1">Market rate estimate</p>
                  <p className="text-[10px] font-semibold mt-0.5" style={{ color }}>
                    {route.estimatedPricePLN.toFixed(0)} PLN ({route.plnPerMin.toFixed(1)} PLN/min)
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          </span>
        );
      })}
    </>
  );
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

const TIME_OFFSETS = [
  { label: 'Live', hours: 0, minutes: 0 },
  { label: '+30m', hours: 0, minutes: 30 },
  { label: '+1h', hours: 1, minutes: 0 },
  { label: '+2h', hours: 2, minutes: 0 },
  { label: '+3h', hours: 3, minutes: 0 },
  { label: '+6h', hours: 6, minutes: 0 },
  { label: '+12h', hours: 12, minutes: 0 },
];

const MAP_LAYER_OPTIONS = [
  { id: 'heatmap', label: 'Heatmap', helper: 'hex demand' },
  { id: 'traffic', label: 'Signals', helper: 'live traffic' },
  { id: 'points', label: 'Points', helper: 'events & POIs' },
  { id: 'routes', label: 'Routes', helper: 'best trips' },
  { id: 'zones', label: 'Zones', helper: 'score labels' },
] as const;

type MapLayerId = typeof MAP_LAYER_OPTIONS[number]['id'];
type LayerState = Record<MapLayerId, boolean>;

const DEFAULT_VISIBLE_LAYERS: LayerState = {
  heatmap: true,
  traffic: true,
  points: false,
  routes: false,
  zones: false,
};

// Design system heat tiers: dormant → rising → hot (teal) → surge (coral)
function getHeatColor(score: number): string {
  if (score >= 85) return '#FF5470'; // surge — coral, single hex draws the eye
  if (score >= 50) return '#2EE6A6'; // hot — teal, clearly visible
  if (score >= 25) return '#2EE6A6'; // rising — teal at lower opacity
  return '#8B8FA8';                  // dormant — muted grey, barely visible on light map
}

function getHeatOpacity(score: number): number {
  if (score >= 85) return 0.3;
  if (score >= 50) return 0.28;
  if (score >= 25) return 0.16;
  return 0.12;
}

/** Convert a lat/lng center + radius in metres → 6 flat-top hexagon vertices */
function getHexagonPoints(
  centerLat: number,
  centerLng: number,
  radiusM: number,
): [number, number][] {
  const metersPerLat = 111_000;
  const metersPerLng = 111_000 * Math.cos((centerLat * Math.PI) / 180);
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i; // flat-top: first vertex points right
    const angleRad = (angleDeg * Math.PI) / 180;
    const lat = centerLat + (radiusM * Math.sin(angleRad)) / metersPerLat;
    const lng = centerLng + (radiusM * Math.cos(angleRad)) / metersPerLng;
    points.push([lat, lng]);
  }
  return points;
}

/** Approximate distance in metres between two lat/lng points */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const metersPerLat = 111_000;
  const metersPerLng = 111_000 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  const dy = (lat2 - lat1) * metersPerLat;
  const dx = (lng2 - lng1) * metersPerLng;
  return Math.sqrt(dx * dx + dy * dy);
}

function ProfitHeatLayer({ heatData }: { heatData: ZoneProfitHeatResponse }) {
  // Cap each hexagon so it never overlaps a neighbour: max radius = half the
  // distance to the nearest other zone centre (with a small margin).
  const zones = heatData.zones;
  const cappedRadius = (zone: ZoneProfitHeatData): number => {
    let maxR = zone.radius * 0.72;
    for (const other of zones) {
      if (other.zoneId === zone.zoneId) continue;
      const d = distanceMeters(zone.lat, zone.lng, other.lat, other.lng);
      maxR = Math.min(maxR, (d / 2) * 0.92);
    }
    return Math.max(Math.round(maxR), 150);
  };

  return (
    <>
      {zones.map((zone) => {
        const color = getHeatColor(zone.profitScore);
        const opacity = getHeatOpacity(zone.profitScore);
        const hexRadius = cappedRadius(zone);
        const hexPoints = getHexagonPoints(zone.lat, zone.lng, hexRadius);
        const isHot = zone.profitScore >= 70;

        return (
          <Polygon
            key={`heat-${zone.zoneId}`}
            positions={hexPoints}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: opacity,
              weight: 2.5,
              opacity: isHot ? 1 : 0.85,
            }}
          >
            <Tooltip
              permanent
              direction="center"
              className="heat-score-tooltip"
            >
              <span className="text-[10px] font-bold" style={{ color: zone.profitScore >= 30 ? '#fff' : '#e2e8f0' }}>
                {zone.profitScore}
              </span>
            </Tooltip>
            <Popup>
              <div className="p-2 min-w-[160px]">
                <h3 className="font-bold text-sm">{zone.zoneName}</h3>
                <div className="flex items-center gap-1 mt-1">
                  <Flame className="w-3 h-3" style={{ color }} />
                  <span className="text-xs font-semibold" style={{ color }}>
                    Profit Score: {zone.profitScore}/100
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1 capitalize">{zone.zoneType} zone</p>
                {zone.surgeMultiplier > 1 && (
                  <p className="text-[10px] text-violet-500 font-bold mt-0.5">{zone.surgeMultiplier}x surge</p>
                )}
                <p className="text-[10px] text-gray-400 mt-1 capitalize">{zone.demandLevel} demand</p>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}

interface HexHeatCell {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  score: number;
}

interface HexHeatResponse {
  generatedAt: string;
  radius: number;
  cells: HexHeatCell[];
}

// Granular grid: dense green gradient (concept style), red core for surge
function getHexGridColor(score: number): { color: string; opacity: number } {
  if (score >= 90) return { color: '#FF5470', opacity: 0.62 };  // true surge core
  if (score >= 75) return { color: '#2EE6A6', opacity: 0.56 };
  if (score >= 55) return { color: '#20DFA0', opacity: 0.46 };
  if (score >= 35) return { color: '#36F0B7', opacity: 0.32 };
  return { color: '#8B8FA8', opacity: 0.16 };
}

const HEX_GRID_MIN_ZOOM = 12;

function HexGridLayer({
  hoursAhead,
  minutesAhead,
  live,
}: {
  hoursAhead: number;
  minutesAhead: number;
  live: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map]);

  const visible = zoom >= HEX_GRID_MIN_ZOOM;

  // Fetch only while the grid is actually visible — below the zoom cutoff
  // phones would pay network + parse cost for cells that never render.
  const { data: hexHeat } = useQuery<HexHeatResponse>({
    queryKey: ['/api/hex-heat', hoursAhead, minutesAhead],
    queryFn: async () => {
      const res = await fetch(`/api/hex-heat?hoursAhead=${hoursAhead}&minutesAhead=${minutesAhead}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch hex heat');
      return res.json();
    },
    refetchInterval: live ? 60000 : undefined,
    placeholderData: (prev) => prev,
    enabled: visible,
  });

  const cells = hexHeat?.cells ?? [];

  // Merge same-color cells into ONE multi-polygon leaflet layer per color
  // bucket (5 layers total instead of 200-600) — massively cheaper to
  // render and to re-project while panning/zooming on low-end phones.
  const buckets = useMemo(() => {
    const byColor = new Map<string, { color: string; opacity: number; rings: [number, number][][] }>();
    for (const c of cells) {
      const { color, opacity } = getHexGridColor(c.score);
      const key = `${color}-${opacity}`;
      let bucket = byColor.get(key);
      if (!bucket) {
        bucket = { color, opacity, rings: [] };
        byColor.set(key, bucket);
      }
      bucket.rings.push(getHexagonPoints(c.lat, c.lng, c.radius));
    }
    return Array.from(byColor.entries());
  }, [cells]);

  if (!visible) return null;

  return (
    <>
      {buckets.map(([key, b]) => (
        <Polygon
          key={`hexbucket-${key}`}
          positions={b.rings}
          pathOptions={{
            color: b.color,
            fillColor: b.color,
            fillOpacity: b.opacity,
            weight: 1.2,
            opacity: Math.min(1, b.opacity + 0.22),
            interactive: false,
            className: "pluspuls-hex-grid",
          } as any}
        />
      ))}
    </>
  );
}

interface MapViewProps {
  driverPosition?: GeoPosition | null;
}

export function MapView({ driverPosition }: MapViewProps) {
  const { data, isLoading, error } = useMapData();
  const [routeGeometries, setRouteGeometries] = useState<RouteGeometryData[]>([]);
  const [selectedTimeIdx, setSelectedTimeIdx] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState<LayerState>(DEFAULT_VISIBLE_LAYERS);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  const toggleLayer = (layer: MapLayerId) => {
    setVisibleLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const selectedOffset = TIME_OFFSETS[selectedTimeIdx];
  const { data: heatData } = useQuery<ZoneProfitHeatResponse>({
    queryKey: ['/api/zone-profit-heat', selectedOffset.hours, selectedOffset.minutes],
    queryFn: async () => {
      const res = await fetch(`/api/zone-profit-heat?hoursAhead=${selectedOffset.hours}&minutesAhead=${selectedOffset.minutes}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch heat data');
      return res.json();
    },
    refetchInterval: selectedTimeIdx === 0 ? 60000 : undefined,
    placeholderData: (prev) => prev,
  });

  const fetchRoutes = () => {
    const params = new URLSearchParams();
    if (driverPosition) {
      params.set('lat', driverPosition.lat.toString());
      params.set('lng', driverPosition.lng.toString());
    }
    const url = `/api/route-geometries${params.toString() ? '?' + params.toString() : ''}`;

    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((newData: RouteGeometryData[]) => {
        if (newData.length > 0) {
          setRouteGeometries(newData);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchRoutes();

    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(fetchRoutes, 15 * 60 * 1000);

    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [driverPosition?.lat, driverPosition?.lng]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 rounded-xl border border-dashed border-border">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading navigation data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 rounded-xl border border-dashed border-border gap-3">
        <MapPin className="w-8 h-8 text-muted-foreground opacity-50" />
        <p className="text-destructive font-medium">Failed to load map data</p>
        <p className="text-xs text-muted-foreground">Retrying automatically...</p>
      </div>
    );
  }

  const getZoneColor = (level: string) => {
    switch (level) {
      case 'surge': return '#8b5cf6';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const hasPurple = routeGeometries.some(r => r.role === "nearest_profitable");
  const hasGreen = routeGeometries.some(r => r.role === "top_route");
  const hasDriveToPickup = routeGeometries.some(r => r.role === "drive_to_pickup");
  const activeLayerCount = Object.values(visibleLayers).filter(Boolean).length;

  return (
    <div className="pluspuls-map-shell w-full h-full rounded-xl overflow-hidden relative z-0">
      <MapContainer 
        center={KRAKOW_COORDS} 
        zoom={13} 
        preferCanvas={true}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapController center={KRAKOW_COORDS} />

        <div className="pluspuls-map-vignette" />

        {visibleLayers.heatmap && (
          <HexGridLayer
            hoursAhead={selectedOffset.hours}
            minutesAhead={selectedOffset.minutes}
            live={selectedTimeIdx === 0}
          />
        )}
        {visibleLayers.zones && heatData && <ProfitHeatLayer heatData={heatData} />}

        <TrafficLayer enabled={visibleLayers.traffic} />

        {visibleLayers.points && data.pois.map((poi) => (
          <Marker 
            key={poi.id} 
            position={[Number(poi.lat), Number(poi.lng)]}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold">{poi.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{poi.category}</p>
                <div className="mt-2 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-medium">{poi.popularityScore}/10 Popularity</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {visibleLayers.routes && routeGeometries.length > 0 && (
          <RoadRouteOverlay routes={routeGeometries} />
        )}

        {driverPosition && <DriverMarker position={driverPosition} />}
      </MapContainer>

      <div className="pluspuls-map-title absolute left-3 top-3 z-[900] hidden sm:flex items-center gap-2">
        <Navigation2 className="w-4 h-4 text-primary" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-bold">PlusPuls Live</p>
          <p className="text-xs text-foreground/80">Krakow demand, routes and traffic</p>
        </div>
      </div>

      <div className="absolute top-2 right-2 z-[1000] flex max-h-[calc(100%-1rem)] w-[min(280px,calc(100%-1rem))] max-w-[280px] flex-col gap-2 overflow-y-auto" data-testid="section-heat-controls">
        <div className="pluspuls-map-panel p-2.5" data-testid="section-layer-controls">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-[0.16em]">Map Layers</span>
            <span className="text-[9px] text-muted-foreground">{activeLayerCount}/5 on</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {MAP_LAYER_OPTIONS.map((layer) => {
              const enabled = visibleLayers[layer.id];
              return (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className={`text-left rounded-lg border px-2 py-1.5 transition-all ${
                    enabled
                      ? 'border-primary/50 bg-primary/15 text-foreground shadow-[0_0_14px_hsl(159_79%_54%_/_0.12)]'
                      : 'border-border/70 bg-[#101724]/70 text-muted-foreground hover:text-foreground hover:border-primary/30'
                  }`}
                  data-testid={`btn-layer-${layer.id}`}
                >
                  <span className="block text-[10px] font-bold">{enabled ? '● ' : '○ '}{layer.label}</span>
                  <span className="block text-[8px] opacity-70 leading-none mt-0.5">{layer.helper}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="pluspuls-map-panel p-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Radar className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-[0.16em]">Insight Radar</span>
            {heatData && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {heatData.targetTime} CET
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1" data-testid="heat-time-slider">
            {TIME_OFFSETS.map((offset, idx) => (
              <button
                key={offset.label}
                onClick={() => setSelectedTimeIdx(idx)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                  selectedTimeIdx === idx
                    ? 'bg-primary text-primary-foreground shadow-[0_0_16px_hsl(159_79%_54%_/_0.34)]'
                    : 'bg-[#101724]/80 text-muted-foreground hover:text-foreground hover:bg-primary/10'
                }`}
                data-testid={`btn-time-${offset.label.replace('+', 'plus-')}`}
              >
                {offset.label}
              </button>
            ))}
          </div>
          {heatData && (
            <p className="text-[9px] text-muted-foreground mt-1.5 leading-tight" data-testid="text-transition-narrative">
              {heatData.transitionNarrative}
            </p>
          )}
        </div>

        <div className="pluspuls-map-panel p-2" data-testid="section-map-legend">
          <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[9px] text-foreground/90">
            {visibleLayers.heatmap && (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ background: '#FF5470' }} />
                  <span>Surge</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ background: '#2EE6A6' }} />
                  <span>Hot hex</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ background: '#8B8FA8', opacity: 0.6 }} />
                  <span>Quiet</span>
                </div>
              </>
            )}
            {visibleLayers.traffic && (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#2EE6A6' }} />
                  <span>Flow</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#FFB547' }} />
                  <span>Heavy</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#FF5470' }} />
                  <span>Jam</span>
                </div>
              </>
            )}
            {visibleLayers.routes && hasPurple && (
              <div className="flex items-center gap-1" data-testid="legend-purple-route">
                <div className="w-2 h-2 rounded-full animate-pulse border border-white/50" style={{ background: "#2EE6A6" }} />
                <span>Best $</span>
              </div>
            )}
            {visibleLayers.routes && hasGreen && (
              <div className="flex items-center gap-1" data-testid="legend-green-routes">
                <div className="w-2 h-2 rounded-full animate-pulse border border-white/50" style={{ background: "#8B8FA8" }} />
                <span>Top 3</span>
              </div>
            )}
            {visibleLayers.routes && hasDriveToPickup && (
              <div className="flex items-center gap-1" data-testid="legend-drive-route">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse border border-white/50" />
                <span>Drive</span>
              </div>
            )}
            {visibleLayers.points && (
              <div className="flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 text-sky-300" />
                <span>POIs</span>
              </div>
            )}
            {activeLayerCount === 0 && <span className="text-muted-foreground">Base map only</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
