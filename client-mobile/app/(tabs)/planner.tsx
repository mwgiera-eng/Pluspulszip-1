import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeatureGate } from "@/components/FeatureGate";
import { fetchDayPlan, type DayPlanResponse, type HourBlock } from "@/lib/api";
import { readShiftSetup, writeShiftSetup, type ShiftSetup } from "@/lib/shift-setup";
import { theme } from "@/lib/theme";

const REGIONS = ["Centrum", "Północ", "Południe", "Wschód", "Zachód", "Lotnisko"];
const HOURS = [5, 7, 10, 14, 18, 22];
const demandColor = (level: HourBlock["demandLevel"]) => level === "surge" || level === "high" ? theme.danger : level === "medium" ? theme.warning : theme.muted;
const demandLabel = (level: HourBlock["demandLevel"]) => ({ low: "niski", medium: "średni", high: "wysoki", surge: "szczyt" }[level]);

export default function PlannerScreen() { return <FeatureGate premium><PlannerContent /></FeatureGate>; }

function PlannerContent() {
  const [tomorrow, setTomorrow] = useState(false);
  const [draftTomorrow, setDraftTomorrow] = useState(false);
  const [setup, setSetup] = useState<ShiftSetup | null>(null);
  const [draftRegion, setDraftRegion] = useState("Centrum");
  const [draftHour, setDraftHour] = useState(7);
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<DayPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { void readShiftSetup().then((value) => { setSetup(value); if (value) { setDraftRegion(value.region); setDraftHour(value.startHour); } setReady(true); }); }, []);
  useEffect(() => {
    if (!setup) return;
    const controller = new AbortController(); setLoading(true); setError(null);
    fetchDayPlan(tomorrow, controller.signal).then(setPlan).catch((reason: unknown) => { if (!(reason instanceof Error && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Plan dnia jest niedostępny"); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [setup, tomorrow]);

  const blocks = useMemo(() => {
    if (!plan || !setup) return [];
    return plan.blocks.filter((block) => ((block.hour - setup.startHour + 24) % 24) < 8);
  }, [plan, setup]);

  if (!ready) return <SafeAreaView style={styles.screen}><ActivityIndicator color={theme.primary} style={{ marginTop: 80 }} /></SafeAreaView>;
  if (!setup) return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>PIERWSZA ZMIANA</Text><Text style={styles.title}>Ustaw start</Text><Text style={styles.subtitle}>Plan potrzebuje miejsca i godziny rozpoczęcia. Możesz zmienić je później.</Text>
    <Text style={styles.section}>Skąd zaczynasz?</Text><View style={styles.choices}>{REGIONS.map((region) => <Choice key={region} label={region} active={draftRegion === region} onPress={() => setDraftRegion(region)} />)}</View>
    <Text style={styles.section}>O której?</Text><View style={styles.choices}>{HOURS.map((hour) => <Choice key={hour} label={String(hour).padStart(2, "0") + ":00"} active={draftHour === hour} onPress={() => setDraftHour(hour)} />)}</View>
    <Text style={styles.section}>Który dzień?</Text><View style={styles.choices}><Choice label="Dzisiaj" active={!draftTomorrow} onPress={() => setDraftTomorrow(false)} /><Choice label="Jutro" active={draftTomorrow} onPress={() => setDraftTomorrow(true)} /></View>
    <Pressable onPress={() => { const value = { region: draftRegion, startHour: draftHour }; writeShiftSetup(value); setTomorrow(draftTomorrow); setSetup(value); }} style={styles.save}><Text style={styles.saveText}>Zbuduj plan zmiany</Text></Pressable>
  </ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>DRIVER COPILOT</Text><Text style={styles.title}>Plan dnia</Text><Text style={styles.subtitle}>{setup.region} · start {String(setup.startHour).padStart(2, "0")}:00 · {plan?.dayName || "Kraków"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Zmień początek zmiany" onPress={() => setSetup(null)} style={styles.edit}><Ionicons name="options-outline" size={18} color={theme.primary} /></Pressable></View>
    <View style={styles.segmented}><Pressable onPress={() => setTomorrow(false)} style={[styles.segment, !tomorrow && styles.segmentActive]}><Text style={[styles.segmentText, !tomorrow && styles.segmentTextActive]}>Dzisiaj</Text></Pressable><Pressable onPress={() => setTomorrow(true)} style={[styles.segment, tomorrow && styles.segmentActive]}><Text style={[styles.segmentText, tomorrow && styles.segmentTextActive]}>Jutro</Text></Pressable></View>
    <View style={styles.tip}><Ionicons name="navigate-outline" size={20} color={theme.primary} /><View style={{ flex: 1 }}><Text style={styles.tipTitle}>Plan zmiany</Text><Text style={styles.tipText}>Osiem godzin od {String(setup.startHour).padStart(2, "0")}:00. Priorytet: popyt, zdarzenia i dojazd z regionu {setup.region.toLowerCase()}.</Text></View></View>
    {loading ? <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={styles.stateText}>Budowanie planu…</Text></View> : error ? <View style={styles.state}><Text style={styles.stateText}>{error}</Text></View> : <View style={styles.timeline}>{blocks.map((block) => { const open = expanded === block.hour, color = demandColor(block.demandLevel); return <View key={block.hour}><Pressable onPress={() => setExpanded(open ? null : block.hour)} style={styles.block}><Text style={styles.hour}>{String(block.hour).padStart(2, "0")}:00</Text><View style={[styles.dot, { backgroundColor: color }]} /><View style={{ flex: 1 }}><Text style={styles.zone} numberOfLines={1}>{block.bestZone}</Text><Text style={styles.potential}>{block.earningsPotential}</Text></View><Text style={[styles.level, { color }]}>{demandLabel(block.demandLevel)}</Text><Ionicons name={open ? "chevron-down" : "chevron-forward"} size={15} color={theme.muted} /></Pressable>{open ? <View style={styles.details}><Text style={styles.detailTitle}>Dlaczego teraz</Text><Text style={styles.detail}>{block.events.length ? `Wydarzenia: ${block.events.map((event) => event.title).join(", ")}.` : "Brak dużych wydarzeń w tej godzinie."}</Text><Text style={styles.detail}>{block.flights.length ? `Lotnisko: ${block.flights.map((flight) => `${flight.label} (${flight.count})`).join(", ")}.` : "Brak istotnej fali lotniczej."}</Text><Text style={[styles.detailTitle, { color: theme.warning }]}>Działanie</Text><Text style={styles.detail}>Przed rozpoczęciem kursu porównaj tę strefę z aktualnym sygnałem na mapie.</Text></View> : null}</View>; })}</View>}
  </ScrollView></SafeAreaView>;
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background }, content: { padding: 18, paddingBottom: 38 }, heading: { flexDirection: "row", justifyContent: "space-between" }, eyebrow: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, title: { color: theme.text, fontSize: 30, fontWeight: "900", marginTop: 5 }, subtitle: { color: theme.muted, fontSize: 11, lineHeight: 16, marginTop: 5 }, edit: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, section: { color: theme.text, fontSize: 16, fontWeight: "900", marginTop: 25, marginBottom: 10 }, choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { minWidth: "30%", flexGrow: 1, paddingHorizontal: 12, paddingVertical: 13, borderRadius: 13, alignItems: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, choiceActive: { borderColor: theme.primary, backgroundColor: "rgba(46,230,166,.1)" }, choiceText: { color: theme.muted, fontSize: 10, fontWeight: "800" }, choiceTextActive: { color: theme.primary }, save: { minHeight: 52, marginTop: 24, borderRadius: 14, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }, saveText: { color: theme.background, fontSize: 12, fontWeight: "900" }, segmented: { flexDirection: "row", padding: 4, backgroundColor: theme.surface, borderRadius: 14, marginTop: 16, borderWidth: 1, borderColor: theme.border }, segment: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10 }, segmentActive: { backgroundColor: theme.primary }, segmentText: { color: theme.muted, fontSize: 11, fontWeight: "900" }, segmentTextActive: { color: theme.background }, tip: { flexDirection: "row", gap: 10, marginTop: 13, backgroundColor: "rgba(46,230,166,.07)", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "rgba(46,230,166,.18)" }, tipTitle: { color: theme.text, fontSize: 12, fontWeight: "900" }, tipText: { color: theme.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, state: { alignItems: "center", paddingVertical: 48, gap: 10 }, stateText: { color: theme.muted, fontSize: 11, textAlign: "center" }, timeline: { gap: 7, marginTop: 14 }, block: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, borderRadius: 15, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, hour: { width: 45, color: theme.text, fontSize: 11, fontWeight: "900" }, dot: { width: 8, height: 8, borderRadius: 4 }, zone: { color: theme.text, fontSize: 12, fontWeight: "800" }, potential: { color: theme.muted, fontSize: 9.5, marginTop: 3 }, level: { fontSize: 8, fontWeight: "900", textTransform: "uppercase" }, details: { marginTop: 4, marginLeft: 55, padding: 12, borderRadius: 14, backgroundColor: theme.surfaceRaised, gap: 5 }, detailTitle: { color: theme.primary, fontSize: 9.5, fontWeight: "900", marginTop: 2 }, detail: { color: theme.muted, fontSize: 9.5, lineHeight: 14 },
});
