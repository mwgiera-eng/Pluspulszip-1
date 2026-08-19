import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDeviceLocation } from "@/hooks/use-device-location";
import { fetchZoneProfitHeat, type ZoneProfitHeatResponse } from "@/lib/api";
import { chooseDriverGuidance } from "@/lib/driver-guidance";
import { presentGuidance, readNativeGuidanceSettings } from "@/lib/native-guidance";
import { theme } from "@/lib/theme";

export default function DashboardScreen() {
  const [zones, setZones] = useState<ZoneProfitHeatResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { position, status, request } = useDeviceLocation({ requestOnFocus: true });
  const announced = useRef<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try { setZones(await fetchZoneProfitHeat(0)); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Sygnał jest chwilowo niedostępny."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 60_000); return () => clearInterval(timer); }, []);
  const guidance = useMemo(() => chooseDriverGuidance(zones?.zones ?? [], position), [position, zones]);
  useEffect(() => {
    if (!guidance || status !== "active" || announced.current === String(guidance.target.zoneId)) return;
    announced.current = String(guidance.target.zoneId);
    void readNativeGuidanceSettings().then((settings) => presentGuidance(guidance.instruction, settings));
  }, [guidance, status]);

  return <SafeAreaView style={styles.screen}><View style={styles.content}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>PLUSPULS · KRAKÓW</Text><Text style={styles.title}>Następny ruch</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Odśwież wskazówkę" onPress={() => void refresh()} style={styles.refresh}>{loading ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="refresh" size={19} color={theme.primary} />}</Pressable></View>
    <Text style={styles.subtitle}>Jedna wskazówka oparta na Twojej pozycji i aktualnym potencjale stref.</Text>
    <LinearGradient colors={["#183629", theme.surface]} style={styles.signal}>
      <View style={styles.signalTop}><View style={styles.signalDot} /><Text style={styles.live}>{status === "active" ? "GPS · SYGNAŁ NA ŻYWO" : "WYMAGANA LOKALIZACJA"}</Text></View>
      {guidance ? <><Text style={styles.instruction}>{guidance.instruction}</Text><Text style={styles.detail}>{guidance.distanceKm !== null ? guidance.distanceKm.toFixed(1) + " km · " : ""}potencjał {guidance.target.profitScore}/100</Text><Text style={styles.reason}>{guidance.target.regimeDescription || zones?.transitionNarrative || "Aktualny popyt i dojazd zostały uwzględnione."}</Text></> : <Text style={styles.instruction}>{error || "Analizuję najkorzystniejszą strefę…"}</Text>}
    </LinearGradient>
    {status !== "active" ? <Pressable accessibilityRole="button" onPress={() => void request()} disabled={status === "requesting"} style={styles.primaryButton}>{status === "requesting" ? <ActivityIndicator color={theme.background} /> : <><Ionicons name="locate" size={20} color={theme.background} /><Text style={styles.primaryText}>Użyj mojej lokalizacji</Text></>}</Pressable> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push("/map" as never)} style={styles.mapButton}><Ionicons name="map-outline" size={20} color={theme.primary} /><Text style={styles.mapText}>Pokaż trasę na mapie</Text></Pressable>
    <View style={styles.safety}><Ionicons name="volume-high-outline" size={20} color={theme.primary} /><View style={{ flex: 1 }}><Text style={styles.safetyTitle}>Tryb bez dotykania</Text><Text style={styles.safetyText}>Włącz głos lub lokalne powiadomienia w ustawieniach alertów. Nowy kierunek zostanie podany bez obsługi ekranu.</Text></View></View>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background }, content: { flex: 1, padding: 20, justifyContent: "center" }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, eyebrow: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, title: { color: theme.text, fontSize: 31, fontWeight: "900", marginTop: 5 }, subtitle: { color: theme.muted, fontSize: 11, lineHeight: 16, marginTop: 6, marginBottom: 20 }, refresh: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  signal: { minHeight: 260, padding: 22, borderRadius: 22, borderWidth: 1, borderColor: "rgba(46,230,166,.32)", justifyContent: "center" }, signalTop: { flexDirection: "row", alignItems: "center", gap: 8 }, signalDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary }, live: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, instruction: { color: theme.text, fontSize: 25, lineHeight: 32, fontWeight: "900", marginTop: 18 }, detail: { color: theme.primarySoft, fontSize: 13, fontWeight: "800", marginTop: 10 }, reason: { color: theme.muted, fontSize: 10, lineHeight: 15, marginTop: 12 },
  primaryButton: { minHeight: 54, marginTop: 13, borderRadius: 15, backgroundColor: theme.primary, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, primaryText: { color: theme.background, fontSize: 12, fontWeight: "900" }, mapButton: { minHeight: 52, marginTop: 10, borderRadius: 15, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, mapText: { color: theme.primary, fontSize: 11, fontWeight: "900" }, safety: { flexDirection: "row", gap: 11, padding: 14, marginTop: 14, borderRadius: 16, backgroundColor: theme.surface }, safetyTitle: { color: theme.text, fontSize: 11, fontWeight: "900" }, safetyText: { color: theme.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
});
