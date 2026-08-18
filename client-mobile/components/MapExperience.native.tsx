import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import {
  fetchRoadTraffic,
  fetchRouteGeometries,
  fetchZoneProfitHeat,
  type RoadSegment,
  type RouteGeometryData,
} from "@/lib/api";
import type { DevicePosition, HeatCell } from "@/lib/types";
import { LIVE_DEMAND_MAP_HTML } from "./live-map-html";

type Props = {
  cells: HeatCell[];
  position: DevicePosition | null;
  hoursAhead?: number;
  minutesAhead?: number;
  onTimeChange?: (hours: number, minutes: number) => void;
  heatError?: string | null;
};

const ALLOWED_TIMES = new Set(["0:0", "0:30", "1:0", "2:0", "3:0", "6:0", "12:0"]);
const validNumber = (value: unknown, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};
const text = (value: unknown) => String(value ?? "").slice(0, 120);

function cleanGeometry(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).flatMap((point) => {
    if (!Array.isArray(point)) return [];
    const lat = validNumber(point[0], 49, 51);
    const lng = validNumber(point[1], 18, 22);
    return lat === null || lng === null ? [] : ([[lat, lng]] as [number, number][]);
  });
}

function cleanRoads(roads: RoadSegment[]) {
  return roads.slice(0, 180).flatMap((road) => {
    const geometry = cleanGeometry(road.geometry, 180);
    if (geometry.length < 2) return [];
    return [{ id: validNumber(road.id, -1_000_000_000, 1_000_000_000) ?? 0, highway: text(road.highway), intensity: validNumber(road.intensity, 0, 1) ?? 0, geometry }];
  });
}

function cleanRoutes(routes: RouteGeometryData[]) {
  return routes.slice(0, 12).flatMap((route) => {
    const geometry = cleanGeometry(route.geometry, 240);
    if (geometry.length < 2) return [];
    return [{ id: text(route.id), fromShort: text(route.fromShort), toShort: text(route.toShort), estimatedPricePLN: validNumber(route.estimatedPricePLN, 0, 100_000) ?? 0, role: text(route.role), geometry }];
  });
}

export function MapExperience({ cells, position, hoursAhead = 0, minutesAhead = 0, onTimeChange, heatError }: Props) {
  const webView = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [roads, setRoads] = useState<RoadSegment[]>([]);
  const [routes, setRoutes] = useState<RouteGeometryData[]>([]);
  const [baseLevel, setBaseLevel] = useState(0);
  const [narrative, setNarrative] = useState("");
  const [targetTime, setTargetTime] = useState("LIVE");
  const [sourceError, setSourceError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const [traffic, routeData] = await Promise.allSettled([
        fetchRoadTraffic(controller.signal), fetchRouteGeometries(position, controller.signal),
      ]);
      if (traffic.status === "fulfilled") { setRoads(traffic.value.roads); setBaseLevel(traffic.value.baseLevel); }
      if (routeData.status === "fulfilled") setRoutes(routeData.value);
      setSourceError(traffic.status === "rejected" ? "Sygnały drogowe są chwilowo niedostępne" : null);
    };
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [position?.lat, position?.lng]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchZoneProfitHeat(hoursAhead, minutesAhead, controller.signal)
      .then((data) => { setNarrative(data.transitionNarrative); setTargetTime(data.targetTime); })
      .catch((reason: unknown) => {
        if (!(reason instanceof Error && reason.name === "AbortError")) setSourceError("Prognoza jest chwilowo niedostępna");
      });
    return () => controller.abort();
  }, [hoursAhead, minutesAhead]);

  const payload = useMemo(() => ({
    cells: cells.slice(0, 700).flatMap((cell) => {
      const lat = validNumber(cell.lat, 49, 51);
      const lng = validNumber(cell.lng, 18, 22);
      return lat === null || lng === null ? [] : [{ id: text(cell.id), lat, lng, radius: validNumber(cell.radius, 20, 5000) ?? 300, score: validNumber(cell.score, 0, 100) ?? 0 }];
    }),
    roads: cleanRoads(roads), routes: cleanRoutes(routes),
    position: position ? { lat: validNumber(position.lat, 49, 51), lng: validNumber(position.lng, 18, 22), accuracy: validNumber(position.accuracy, 1, 5000) ?? 100 } : null,
    baseLevel: validNumber(baseLevel, 0, 1) ?? 0,
    narrative: text(narrative), targetTime: text(targetTime), error: text(heatError || sourceError),
  }), [baseLevel, cells, heatError, narrative, position, roads, routes, sourceError, targetTime]);

  const sendPayload = useCallback(() => {
    if (ready) webView.current?.postMessage(JSON.stringify({ type: "map-data", payload }));
  }, [payload, ready]);
  useEffect(() => { sendPayload(); }, [sendPayload]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message: unknown = JSON.parse(event.nativeEvent.data);
      if (!message || typeof message !== "object") return;
      const value = message as { type?: unknown; hours?: unknown; minutes?: unknown };
      if (value.type === "ready") { setReady(true); return; }
      if (value.type !== "time") return;
      const hours = Number(value.hours);
      const minutes = Number(value.minutes);
      if (ALLOWED_TIMES.has(`${hours}:${minutes}`)) onTimeChange?.(hours, minutes);
    } catch { /* Ignore malformed page messages. */ }
  }, [onTimeChange]);

  const allowNavigation = useCallback((request: WebViewNavigation) => {
    if (request.url === "about:blank") return true;
    try {
      return new URL(request.url).origin === "https://pluspuls.local";
    } catch {
      return false;
    }
  }, []);

  return (
    <View style={styles.shell}>
      <WebView
        ref={webView}
        source={{ html: LIVE_DEMAND_MAP_HTML, baseUrl: "https://pluspuls.local" }}
        originWhitelist={["https://pluspuls.local", "about:blank"]}
        onMessage={onMessage}
        onLoadEnd={() => setReady(true)}
        onShouldStartLoadWithRequest={allowNavigation}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        overScrollMode="never"
        accessibilityLabel="Live PlusPuls demand and traffic map"
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({ shell: { flex: 1, backgroundColor: "#070a10" }, webView: { flex: 1, backgroundColor: "#070a10" } });
