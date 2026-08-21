import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, Polygon, Polyline, PROVIDER_GOOGLE, type LatLng, type MapStyleElement, type Region } from "react-native-maps";
import { fetchRoadTraffic, fetchRouteGeometries } from "@/lib/api";
import {
  interpolateAlongGeometry,
  sanitizeHeatCells,
  sanitizeRoads,
  sanitizeRoutes,
  selectFocusRoute,
} from "@/lib/map-model";
import { heatColor, hexCoordinates } from "@/lib/map";
import type { DevicePosition, HeatCell } from "@/lib/types";

type Props = {
  cells: HeatCell[];
  position: DevicePosition | null;
  hoursAhead?: number;
  minutesAhead?: number;
  onTimeChange?: (hours: number, minutes: number) => void;
  heatError?: string | null;
};

type LayerId = "heat" | "traffic" | "routes";

type RoadOverlay = ReturnType<typeof sanitizeRoads>[number] & {
  coordinates: LatLng[];
};

const KRAKOW_REGION = {
  latitude: 50.0647,
  longitude: 19.945,
  latitudeDelta: 0.18,
  longitudeDelta: 0.22,
};

const TIME_OPTIONS = [
  { label: "Live", hours: 0, minutes: 0 },
  { label: "+30m", hours: 0, minutes: 30 },
  { label: "+1h", hours: 1, minutes: 0 },
  { label: "+3h", hours: 3, minutes: 0 },
  { label: "+6h", hours: 6, minutes: 0 },
  { label: "+12h", hours: 12, minutes: 0 },
] as const;

// High-contrast light tiles keep street geometry readable under colored overlays.
const HIGH_CONTRAST_MAP_STYLE: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: "#d6dde6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#243447" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f8fafc" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#77879a" }] },
  { featureType: "landscape.natural", elementType: "geometry.fill", stylers: [{ color: "#c8d5c7" }] },
  { featureType: "poi", elementType: "geometry.fill", stylers: [{ color: "#c2d0c5" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#8c99a8" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffe7a3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f5bf5a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#9b6718" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#aab6c4" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#79aed4" }] },
];

function coordinates(geometry: [number, number][]): LatLng[] {
  return geometry.map(([latitude, longitude]) => ({ latitude, longitude }));
}

function trafficColor(intensity: number) {
  if (intensity >= 0.72) return "#FF5470";
  if (intensity >= 0.42) return "#F59E0B";
  return "#10B981";
}

function routeStyle(role: string) {
  if (role === "drive_to_pickup") return { color: "#2563EB", width: 7, zIndex: 42 };
  if (role === "nearest_profitable") return { color: "#00A86B", width: 6, zIndex: 40 };
  return { color: "#7C3AED", width: 4, zIndex: 38 };
}

const TrafficSignals = memo(function TrafficSignals({ roads, testMode }: { roads: RoadOverlay[]; testMode: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (roads.length === 0) return;
    const interval = setInterval(() => setPhase((current) => (current + 0.045) % 1), 900);
    return () => clearInterval(interval);
  }, [roads.length]);

  const signals = useMemo(
    () => roads.slice(0, 24).flatMap((road, index) => {
      const center = interpolateAlongGeometry(road.geometry, (phase + index / 24) % 1);
      const color = trafficColor(road.intensity);
      // Native map marker snapshots do not track child updates. Remount only when
      // the traffic severity bucket changes so the dot cannot retain a stale color.
      return center ? [{ key: `${road.id}-${index}-${color}`, center, color }] : [];
    }),
    [phase, roads],
  );

  return signals.map((signal) => {
    const markerColor = testMode ? "#06B6D4" : signal.color;
    return (
      <Marker
        key={`${signal.key}-${markerColor}`}
        coordinate={signal.center}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        tappable={false}
        zIndex={28}
      >
        <View style={[styles.signalDot, { backgroundColor: markerColor }]} />
      </Marker>
    );
  });
});

export function MapExperience({
  cells,
  position,
  hoursAhead = 0,
  minutesAhead = 0,
  onTimeChange,
  heatError,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const fittedRouteKey = useRef("");
  const zoomTestPhase = useRef<"idle" | "zoom-in" | "zoom-out" | "passed">("idle");
  const [mapReady, setMapReady] = useState(false);
  const [zoomTestStage, setZoomTestStage] = useState<"waiting" | "initial" | "zoom-in" | "zoom-out" | "passed">("waiting");
  const [zoomTestPassed, setZoomTestPassed] = useState(false);
  const [roads, setRoads] = useState<ReturnType<typeof sanitizeRoads>>([]);
  const [routes, setRoutes] = useState<ReturnType<typeof sanitizeRoutes>>([]);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ heat: true, traffic: true, routes: true });
  const mapTestMode = process.env.EXPO_PUBLIC_MAP_TEST_MODE === "true";

  const heatCells = useMemo(() => sanitizeHeatCells(cells, 500), [cells]);
  const heatPolygons = useMemo(() => heatCells.map((cell) => {
    const color = heatColor(cell.score);
    return (
      <Polygon
        key={cell.id}
        coordinates={hexCoordinates(cell)}
        fillColor={mapTestMode ? "rgba(225,29,72,0.45)" : color.fill}
        strokeColor={mapTestMode ? "#E11D48" : color.stroke}
        strokeWidth={1}
        tappable={false}
        zIndex={5}
      />
    );
  }), [heatCells, mapTestMode]);

  const roadOverlays = useMemo<RoadOverlay[]>(
    () => roads.map((road) => ({ ...road, coordinates: coordinates(road.geometry) })),
    [roads],
  );
  const roadLines = useMemo(() => roadOverlays.map((road) => (
    <Polyline
      key={`road-${road.id}`}
      coordinates={road.coordinates}
      // CI uses one unique traffic color so zoom-frame pixel assertions cannot
      // accidentally count similarly colored heat or route polygons.
      strokeColor={mapTestMode ? "#F59E0B" : trafficColor(road.intensity)}
      strokeWidth={road.intensity >= 0.72 ? 4 : 3}
      lineCap="round"
      lineJoin="round"
      zIndex={18}
    />
  )), [mapTestMode, roadOverlays]);

  const routeLines = useMemo(() => routes.map((route) => {
    const appearance = routeStyle(route.role);
    return (
      <Polyline
        key={`route-${route.id}`}
        coordinates={coordinates(route.geometry)}
        strokeColor={mapTestMode ? "#7C3AED" : appearance.color}
        strokeWidth={appearance.width}
        lineCap="round"
        lineJoin="round"
        zIndex={appearance.zIndex}
      />
    );
  }), [mapTestMode, routes]);
  const focusRoute = useMemo(() => selectFocusRoute(routes), [routes]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const [trafficResult, routeResult] = await Promise.allSettled([
        fetchRoadTraffic(controller.signal),
        fetchRouteGeometries(position, controller.signal),
      ]);

      if (trafficResult.status === "fulfilled") {
        const nextRoads = sanitizeRoads(trafficResult.value.roads, 180);
        setRoads(nextRoads);
        setTrafficError(nextRoads.length ? null : "Brak prawidłowej geometrii ruchu");
      } else if (!(trafficResult.reason instanceof Error && trafficResult.reason.name === "AbortError")) {
        setTrafficError("Ruch drogowy jest chwilowo niedostępny");
      }

      if (routeResult.status === "fulfilled") {
        const nextRoutes = sanitizeRoutes(routeResult.value, 12);
        setRoutes(nextRoutes);
        setRouteError(nextRoutes.length ? null : "Brak prawidłowej geometrii tras");
      } else if (!(routeResult.reason instanceof Error && routeResult.reason.name === "AbortError")) {
        setRouteError("Trasy są chwilowo niedostępne");
      }
    };

    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [position?.lat, position?.lng]);

  useEffect(() => {
    if (!mapReady || routes.length === 0 || (mapTestMode && !zoomTestPassed)) return;
    if (!focusRoute) return;
    // Route IDs change when the recommendation changes. Live GPS updates must not
    // repeatedly steal the driver's zoom/pan by re-fitting the same route.
    const nextKey = focusRoute.id;
    if (nextKey === fittedRouteKey.current) return;
    fittedRouteKey.current = nextKey;
    const focusCoordinates = coordinates(focusRoute.geometry);
    if (position) focusCoordinates.unshift({ latitude: position.lat, longitude: position.lng });
    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates(focusCoordinates, {
        animated: true,
        edgePadding: { top: 150, right: 36, bottom: 150, left: 36 },
      });
    });
  }, [focusRoute, mapReady, mapTestMode, position, zoomTestPassed]);

  useEffect(() => {
    if (
      !mapReady ||
      !mapTestMode ||
      zoomTestStage !== "waiting" ||
      zoomTestPhase.current !== "idle" ||
      !position ||
      heatCells.length === 0 ||
      roads.length === 0 ||
      focusRoute?.role !== "drive_to_pickup"
    ) return;
    setZoomTestStage("initial");
  }, [focusRoute?.role, heatCells.length, mapReady, mapTestMode, position, roads.length, zoomTestStage]);

  useEffect(() => {
    if (!mapTestMode || zoomTestStage !== "initial") return;
    const timeout = setTimeout(() => {
      zoomTestPhase.current = "zoom-in";
      mapRef.current?.animateToRegion({
        ...KRAKOW_REGION,
        latitudeDelta: 0.025,
        longitudeDelta: 0.03,
      }, 700);
    }, 90_000);
    return () => clearTimeout(timeout);
  }, [mapTestMode, zoomTestStage]);

  useEffect(() => {
    if (!mapTestMode || zoomTestStage !== "zoom-in") return;
    const timeout = setTimeout(() => {
      zoomTestPhase.current = "zoom-out";
      mapRef.current?.animateToRegion(KRAKOW_REGION, 700);
    }, 90_000);
    return () => clearTimeout(timeout);
  }, [mapTestMode, zoomTestStage]);

  useEffect(() => {
    if (!mapTestMode || zoomTestStage !== "zoom-out") return;
    const timeout = setTimeout(() => {
      zoomTestPhase.current = "passed";
      setZoomTestPassed(true);
      setZoomTestStage("passed");
    }, 90_000);
    return () => clearTimeout(timeout);
  }, [mapTestMode, zoomTestStage]);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    if (!mapTestMode) return;
    if (zoomTestPhase.current === "zoom-in" && region.latitudeDelta < 0.06) {
      zoomTestPhase.current = "idle";
      setZoomTestStage("zoom-in");
      return;
    }
    if (zoomTestPhase.current === "zoom-out" && region.latitudeDelta > 0.12) {
      zoomTestPhase.current = "idle";
      setZoomTestStage("zoom-out");
    }
  }, [mapTestMode]);

  const toggleLayer = useCallback((layer: LayerId) => {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }, []);

  const errors = [heatError, trafficError, routeError].filter(Boolean).join(" · ");

  return (
    <View style={styles.shell} testID="native-demand-map">
      <MapView
        ref={mapRef}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        initialRegion={KRAKOW_REGION}
        customMapStyle={HIGH_CONTRAST_MAP_STYLE}
        mapType="standard"
        loadingEnabled
        loadingBackgroundColor="#E7EBF0"
        loadingIndicatorColor="#00A86B"
        showsUserLocation={Boolean(position)}
        showsMyLocationButton={Boolean(position)}
        showsCompass
        showsTraffic={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        minZoomLevel={9}
        maxZoomLevel={19}
        onMapLoaded={() => setMapReady(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
        accessibilityLabel="Natywna mapa popytu, ruchu i tras PlusPuls"
        testID="google-demand-map"
      >
        {layers.heat ? heatPolygons : null}
        {layers.traffic ? roadLines : null}
        {layers.traffic ? <TrafficSignals roads={roadOverlays} testMode={mapTestMode} /> : null}
        {layers.routes ? routeLines : null}

        {position ? (
          <Circle center={{ latitude: position.lat, longitude: position.lng }} radius={Math.max(15, Math.min(position.accuracy, 500))} fillColor="rgba(37,99,235,0.12)" strokeColor="rgba(37,99,235,0.65)" strokeWidth={2} zIndex={50} />
        ) : null}
      </MapView>

      <View style={styles.layerPanel} testID="map-layer-controls">
        {(["heat", "traffic", "routes"] as const).map((layer) => (
          <Pressable
            key={layer}
            accessibilityRole="switch"
            accessibilityState={{ checked: layers[layer] }}
            accessibilityLabel={layer === "heat" ? "Heatmapa" : layer === "traffic" ? "Ruch drogowy" : "Trasy"}
            onPress={() => toggleLayer(layer)}
            style={[styles.layerButton, layers[layer] && styles.layerButtonActive]}
            testID={`layer-${layer}`}
          >
            <Text style={[styles.layerText, layers[layer] && styles.layerTextActive]}>
              {layer === "heat" ? "Heat" : layer === "traffic" ? "Ruch" : "Trasy"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.timePanel} testID="map-time-controls">
        {TIME_OPTIONS.map((option) => {
          const selected = option.hours === hoursAhead && option.minutes === minutesAhead;
          return (
            <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onTimeChange?.(option.hours, option.minutes)} style={[styles.timeButton, selected && styles.timeButtonActive]}>
              <Text style={[styles.timeText, selected && styles.timeTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View pointerEvents="none" style={styles.statusPanel} testID="map-render-status">
        {!mapReady ? <ActivityIndicator size="small" color="#00A86B" /> : null}
        <Text style={styles.statusText}>
          {mapReady ? "Mapa gotowa" : "Ładowanie mapy"} · {heatCells.length} heat · {roads.length} dróg · {routes.length} tras{mapTestMode ? ` · map test ${zoomTestStage}${zoomTestPassed ? " · zoom test OK" : ""} · ${position ? "GPS active" : "GPS missing"} · ${focusRoute?.role ?? "no route"}` : ""}
        </Text>
        {errors ? <Text style={styles.errorText} numberOfLines={2}>{errors}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, overflow: "hidden", backgroundColor: "#E7EBF0" },
  layerPanel: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", gap: 7, padding: 7, borderRadius: 15, backgroundColor: "rgba(10,13,20,0.90)", borderWidth: 1, borderColor: "rgba(46,230,166,0.42)" },
  layerButton: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#172033" },
  layerButtonActive: { backgroundColor: "#0D5B49", borderWidth: 1, borderColor: "#2EE6A6" },
  layerText: { color: "#A7AEC4", fontSize: 12, fontWeight: "800" },
  layerTextActive: { color: "#FFFFFF" },
  timePanel: { position: "absolute", left: 12, right: 12, bottom: 72, flexDirection: "row", gap: 4, padding: 6, borderRadius: 14, backgroundColor: "rgba(10,13,20,0.90)" },
  timeButton: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  timeButtonActive: { backgroundColor: "#2EE6A6" },
  timeText: { color: "#A7AEC4", fontSize: 9, fontWeight: "800" },
  timeTextActive: { color: "#07110E" },
  statusPanel: { position: "absolute", left: 12, right: 12, bottom: 10, minHeight: 52, justifyContent: "center", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(10,13,20,0.90)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  statusText: { color: "#E9EDF7", fontSize: 10.5, fontWeight: "800" },
  errorText: { color: "#FBBF24", fontSize: 9.5, marginTop: 3 },
  signalDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)" },
});
