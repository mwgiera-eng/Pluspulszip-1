import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeatureGate } from "@/components/FeatureGate";
import { useAuth } from "@/components/AuthProvider";
import { createFleet, extractFleetPatterns, fetchFleetGuidance, fetchFleetLeaderboard, fetchMyFleet, uploadFleetTrips, type Fleet, type FleetProfile } from "@/lib/api";
import { digestTrips, getAnonymousDriverId, sanitizeFleetCsv, type FleetSanitizationResult } from "@/lib/fleet-csv-sanitizer";
import { presentGuidance, readNativeGuidanceSettings } from "@/lib/native-guidance";
import { theme } from "@/lib/theme";

const BATCH_SIZE = 1_500;

export default function FleetScreen() {
  return <FeatureGate premium><FleetContent /></FeatureGate>;
}

function FleetContent() {
  const { user } = useAuth();
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [profiles, setProfiles] = useState<FleetProfile[]>([]);
  const [driverName, setDriverName] = useState("Kierowca A");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audit, setAudit] = useState<FleetSanitizationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const provider = user?.role === "admin" || user?.accountType === "provider";
  const refresh = useCallback(async () => {
    const current = await fetchMyFleet();
    setFleet(current);
    setProfiles(current ? await fetchFleetLeaderboard(current.id) : []);
    return current;
  }, []);
  useEffect(() => { if (provider) void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Nie udało się pobrać floty.")); }, [provider, refresh]);

  if (!provider) return <SafeAreaView style={styles.screen}><View style={styles.center}><Ionicons name="people-outline" size={34} color={theme.primary} /><Text style={styles.centerTitle}>Panel właściciela floty</Text><Text style={styles.centerText}>Ta funkcja jest dostępna dla zatwierdzonego konta dostawcy floty lub administratora.</Text></View></SafeAreaView>;

  const ensureFleet = async () => fleet ?? createFleet(user?.companyName?.trim() || "Moja flota");
  const importFleet = async () => {
    setBusy(true); setMessage(null); setProgress(0);
    let cachedSource: File | null = null;
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/csv", "text/tab-separated-values"], copyToCacheDirectory: true, multiple: false });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      if (!asset) throw new Error("Nie wybrano pliku.");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Android potrzebuje zgody na lokalizację, aby lokalnie zamienić adresy na anonimowe strefy.");
      cachedSource = new File(asset.uri);
      const sanitized = await sanitizeFleetCsv(await cachedSource.text(), asset.size ?? cachedSource.size, (done, total) => setProgress(total ? Math.round(done / total * 100) : 0));
      const currentFleet = await ensureFleet();
      setFleet(currentFleet); setAudit(sanitized);
      const anonymousDriverId = await getAnonymousDriverId(driverName);
      const anonymousDisplayName = `Kierowca ${anonymousDriverId.slice(0, 6).toUpperCase()}`;
      let processed = 0, profileId = "";
      for (let offset = 0; offset < sanitized.trips.length; offset += BATCH_SIZE) {
        const trips = sanitized.trips.slice(offset, offset + BATCH_SIZE);
        const response = await uploadFleetTrips({ fleetId: currentFleet.id, anonymousDriverId, displayName: anonymousDisplayName, trips, payloadDigest: await digestTrips(trips) });
        processed += response.processed; profileId = response.profileId;
      }
      const extracted = await extractFleetPatterns(currentFleet.id);
      await refresh();
      setMessage(`Przyjęto ${processed} przejazdów. Odświeżono ${extracted.count} wzorców najlepszych kierowców.`);
      if (profileId) {
        const guidance = (await fetchFleetGuidance(currentFleet.id, profileId))[0];
        if (guidance) await presentGuidance(`${guidance.title}. ${guidance.body}`, await readNativeGuidanceSettings());
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import floty nie powiódł się."); }
    finally { try { if (cachedSource?.exists) cachedSource.delete(); } catch { /* Picker cache cleanup is best effort. */ } setBusy(false); setProgress(0); }
  };

  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>FLEET COPILOT</Text><Text style={styles.title}>Wzorce floty</Text><Text style={styles.subtitle}>Anonimowe wzorce najlepszych kierowców skracają naukę nowych osób bez wysyłania surowego CSV.</Text>
    <View style={styles.privacy}><Ionicons name="shield-checkmark-outline" size={24} color={theme.primary} /><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Prywatność przed wysłaniem</Text><Text style={styles.cardText}>Telefon usuwa osoby, firmy, podatki i dokładne adresy. Systemowy geokoder Androida zamienia adresy na strefy; PlusPuls otrzymuje tylko losowe ID, geohashe, czas, dystans i PLN/km.</Text></View></View>
    <Text style={styles.label}>Lokalna etykieta kierowcy (nie jest wysyłana)</Text><TextInput accessibilityLabel="Lokalna etykieta kierowcy" value={driverName} onChangeText={setDriverName} maxLength={100} autoCapitalize="words" style={styles.input} placeholder="np. Kierowca A" placeholderTextColor={theme.muted} />
    <Pressable accessibilityRole="button" disabled={busy || !driverName.trim()} onPress={() => void importFleet()} style={[styles.button, (busy || !driverName.trim()) && styles.disabled]}>{busy ? <><ActivityIndicator color={theme.background} /><Text style={styles.buttonText}>Analiza lokalna {progress}%</Text></> : <><Ionicons name="document-lock-outline" size={20} color={theme.background} /><Text style={styles.buttonText}>Importuj historię floty</Text></>}</Pressable>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {audit ? <View style={styles.audit}><Text style={styles.cardTitle}>Raport sanitizacji</Text><Text style={styles.cardText}>Przyjęte: {audit.acceptedRows} · odrzucone: {audit.rejectedRows} · razem: {audit.totalRows}</Text><Text style={styles.cardText}>Usunięto: {audit.removedFields.join(", ")}.</Text>{audit.errors[0] ? <Text style={styles.warning}>Pierwszy błąd: wiersz {audit.errors[0].rowNumber} — {audit.errors[0].message}</Text> : null}</View> : null}
    <View style={styles.sectionRow}><Text style={styles.section}>Ranking wzorców</Text><Text style={styles.fleetName}>{fleet?.name ?? "Flota nieutworzona"}</Text></View>
    <View style={styles.list}>{profiles.length ? profiles.map((profile, index) => <View key={profile.id} style={styles.row}><Text style={styles.rank}>{index + 1}</Text><View style={{ flex: 1 }}><Text style={styles.name}>{profile.displayName}</Text><Text style={styles.meta}>{profile.totalTripsAnalyzed} kursów · percentyl {profile.percentileRank}</Text></View><View><Text style={styles.score}>{profile.avgEarningsPerKm.toFixed(2)}</Text><Text style={styles.unit}>PLN/km</Text></View>{profile.isLeaderDriver ? <Ionicons name="ribbon" size={18} color={theme.warning} /> : null}</View>) : <Text style={styles.empty}>Zaimportuj zweryfikowaną historię, aby wyznaczyć liderów i wzorce.</Text>}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background }, content: { padding: 18, paddingBottom: 42 }, eyebrow: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, title: { color: theme.text, fontSize: 30, fontWeight: "900", marginTop: 5 }, subtitle: { color: theme.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  privacy: { flexDirection: "row", gap: 11, marginTop: 17, padding: 14, borderRadius: 18, backgroundColor: "rgba(46,230,166,.07)", borderWidth: 1, borderColor: "rgba(46,230,166,.24)" }, cardTitle: { color: theme.text, fontSize: 11.5, fontWeight: "900" }, cardText: { color: theme.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 }, label: { color: theme.text, fontSize: 10, fontWeight: "800", marginTop: 16, marginBottom: 6 }, input: { minHeight: 50, paddingHorizontal: 14, color: theme.text, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14 },
  button: { minHeight: 52, marginTop: 10, borderRadius: 14, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, buttonText: { color: theme.background, fontSize: 11, fontWeight: "900" }, disabled: { opacity: .5 }, message: { color: theme.primarySoft, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 10 }, audit: { padding: 13, marginTop: 10, borderRadius: 15, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, warning: { color: theme.warning, fontSize: 9, lineHeight: 13, marginTop: 5 },
  sectionRow: { marginTop: 22, marginBottom: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }, section: { color: theme.text, fontSize: 17, fontWeight: "900" }, fleetName: { color: theme.muted, fontSize: 9, flexShrink: 1 }, list: { borderRadius: 18, overflow: "hidden", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, row: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, rank: { width: 18, color: theme.primary, fontWeight: "900" }, name: { color: theme.text, fontSize: 11.5, fontWeight: "800" }, meta: { color: theme.muted, fontSize: 9, marginTop: 3 }, score: { color: theme.primary, fontSize: 16, fontWeight: "900", textAlign: "right" }, unit: { color: theme.muted, fontSize: 7.5, textAlign: "right" }, empty: { color: theme.muted, padding: 18, textAlign: "center", fontSize: 10, lineHeight: 15 },
  center: { margin: 22, padding: 24, borderRadius: 22, backgroundColor: theme.surface, alignItems: "center", gap: 10 }, centerTitle: { color: theme.text, fontSize: 18, fontWeight: "900" }, centerText: { color: theme.muted, textAlign: "center", fontSize: 11, lineHeight: 17 },
});
