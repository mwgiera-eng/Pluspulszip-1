import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, CircleMarker, Polyline, Tooltip, Polygon } from 'react-leaflet';
import { useMapData } from '@/hooks/use-map-data';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { Loader2, MapPin, Star, Clock, Flame } from 'lucide-react';
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

const PURPLE_COLOR = '#a855f7';
const GREEN_COLOR = '#10b981';
const BLUE_COLOR = '#3b82f6';

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
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
          weight: 1,
          dashArray: '4 4',
        }}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={14}
        className="leaflet-driver-pulse"
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          weight: 0,
        }}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={7}
        pathOptions={{
          color: '#ffffff',
          fillColor: '#3b82f6',
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
          weight: 5,
          opacity: 0.12,
        }}
      />
      <Polyline
        positions={positions}
        className="leaflet-route-glow"
        pathOptions={{
          color: BLUE_COLOR,
          weight: 3,
          opacity: 0.7,
          dashArray: '6 10',
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
                weight: isPurple ? 5 : 4,
                opacity: 0.15,
              }}
            />
            <Polyline
              positions={positions}
              className="leaflet-route-glow"
              pathOptions={{
                color: color,
                weight: isPurple ? 4 : 3,
                opacity: isPurple ? 0.8 : 0.6,
                dashArray: isPurple ? '12 8' : '8 12',
                lineCap: 'round',
              }}
            />

            <CircleMarker
              center={startPos}
              radius={isPurple ? 10 : 8}
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
                color: '#ffffff',
                fillColor: color,
                fillOpacity: 1,
                weight: 2,
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
              radius={isPurple ? 6 : 4}
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

function getHeatColor(score: number): string {
  if (score >= 85) return '#4ade80'; // bright lime-green — hottest
  if (score >= 70) return '#22c55e'; // green
  if (score >= 50) return '#f97316'; // orange
  if (score >= 30) return '#ef4444'; // red
  if (score >= 15) return '#818cf8'; // indigo
  return '#3b82f6';                  // cold blue
}

function getHeatOpacity(score: number): number {
  return 0.25 + (score / 100) * 0.5;
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
      {/* Glow layer first (underneath): soft halo filling gaps between hexes */}
      {zones.filter(z => z.profitScore >= 30).map((zone) => {
        const color = getHeatColor(zone.profitScore);
        const r = cappedRadius(zone);
        return (
          <Polygon
            key={`glow-${zone.zoneId}`}
            positions={getHexagonPoints(zone.lat, zone.lng, Math.round(r * 1.45))}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.06 + (zone.profitScore / 100) * 0.12,
              weight: 0,
              opacity: 0,
            }}
            interactive={false}
          />
        );
      })}

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

interface MapViewProps {
  driverPosition?: GeoPosition | null;
}

export function MapView({ driverPosition }: MapViewProps) {
  const { data, isLoading, error } = useMapData();
  const [routeGeometries, setRouteGeometries] = useState<RouteGeometryData[]>([]);
  const [selectedTimeIdx, setSelectedTimeIdx] = useState(0);
  const [showTraffic, setShowTraffic] = useState(true);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-border relative z-0">
      <MapContainer 
        center={KRAKOW_COORDS} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <MapController center={KRAKOW_COORDS} />

        {heatData && <ProfitHeatLayer heatData={heatData} />}

        <TrafficLayer enabled={showTraffic} />

        {data.pois.map((poi) => (
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

        {routeGeometries.length > 0 && (
          <RoadRouteOverlay routes={routeGeometries} />
        )}

        {driverPosition && <DriverMarker position={driverPosition} />}
      </MapContainer>

      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-2 max-w-[260px]" data-testid="section-heat-controls">
        <div className="bg-card/90 backdrop-blur-sm rounded-lg border border-border/50 shadow-lg p-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[11px] font-semibold text-foreground">Profit Heat</span>
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
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  selectedTimeIdx === idx
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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
          <button
            onClick={() => setShowTraffic(v => !v)}
            className={`mt-1.5 w-full px-2 py-1 rounded text-[10px] font-medium transition-all ${
              showTraffic
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
            data-testid="btn-toggle-traffic"
          >
            {showTraffic ? '● Ruch drogowy: ON' : '○ Ruch drogowy: OFF'}
          </button>
        </div>

        <div className="bg-card/90 backdrop-blur-sm rounded-lg border border-border/50 shadow-lg p-1.5">
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: '#4ade80', boxShadow: '0 0 4px #4ade8088' }} />
              <span>Hot 85+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-green-500" />
              <span>70+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-orange-500" />
              <span>50+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-red-500" />
              <span>30+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-indigo-400" />
              <span>15+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-blue-500" />
              <span>Cold</span>
            </div>
            {hasPurple && (
              <div className="flex items-center gap-1" data-testid="legend-purple-route">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse border border-white/50" />
                <span>Best $</span>
              </div>
            )}
            {hasGreen && (
              <div className="flex items-center gap-1" data-testid="legend-green-routes">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-white/50" />
                <span>Top 3</span>
              </div>
            )}
            {hasDriveToPickup && (
              <div className="flex items-center gap-1" data-testid="legend-drive-route">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse border border-white/50" />
                <span>Drive</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
