import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeatureGate } from "@/components/FeatureGate";
import { fetchEarningsStats, uploadSanitizedEarningsCsv, type EarningsStats } from "@/lib/api";
import { sanitizeEarningsCsv, type SanitizedCsvResult } from "@/lib/csv-sanitizer";
import { theme } from "@/lib/theme";

export default function EarningsScreen() {
  return <FeatureGate premium><EarningsContent /></FeatureGate>;
}

function EarningsContent() {
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [audit, setAudit] = useState<SanitizedCsvResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStats(await fetchEarningsStats()); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Statystyki są chwilowo niedostępne."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const importCsv = async () => {
    setImporting(true); setMessage(null);
    let sanitizedFile: File | null = null;
    let cachedSource: File | null = null;
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/csv"], copyToCacheDirectory: true, multiple: false });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      if (!asset) throw new Error("Nie wybrano pliku CSV.");
      if ((asset.size ?? 0) > 5 * 1024 * 1024) throw new Error("Plik CSV może mieć maksymalnie 5 MB.");
      cachedSource = new File(asset.uri);
      const result = sanitizeEarningsCsv(await cachedSource.text(), asset.size ?? cachedSource.size);
      sanitizedFile = new File(Paths.cache, `pluspuls-sanitized-${Date.now()}.csv`);
      sanitizedFile.create({ intermediates: true, overwrite: true });
      sanitizedFile.write(result.csv);
      const uploaded = await uploadSanitizedEarningsCsv(sanitizedFile.uri);
      setAudit(result);
      setMessage(`Zaimportowano ${uploaded.processed} wierszy. Surowy plik nie opuścił telefonu.`);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Import nie powiódł się.");
    } finally {
      try { if (sanitizedFile?.exists) sanitizedFile.delete(); } catch { /* Cache cleanup is best effort. */ }
      try { if (cachedSource?.exists) cachedSource.delete(); } catch { /* Picker cache cleanup is best effort. */ }
      setImporting(false);
    }
  };

  const max = Math.max(1, ...(stats?.topZones.map((zone) => zone.amount) ?? [1]));
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>WYNIKI</Text><Text style={styles.title}>Zarobki</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Odśwież statystyki" onPress={() => void load()} style={styles.refresh}><Ionicons name="refresh" size={18} color={theme.primary} /></Pressable></View>
    <View style={styles.privacyCard}><Ionicons name="shield-checkmark-outline" size={22} color={theme.primary} /><View style={{ flex: 1 }}><Text style={styles.privacyTitle}>Prywatny import na urządzeniu</Text><Text style={styles.privacyText}>PlusPuls usuwa dane pasażera, firmy, podatków i dokładne adresy przed połączeniem z serwerem.</Text></View></View>
    <Pressable accessibilityRole="button" onPress={() => void importCsv()} disabled={importing} style={[styles.importButton, importing && styles.disabled]}>{importing ? <ActivityIndicator color={theme.background} /> : <><Ionicons name="document-lock-outline" size={19} color={theme.background} /><Text style={styles.importText}>Wybierz i oczyść CSV</Text></>}</Pressable>
    {audit ? <View style={styles.audit}><Text style={styles.auditTitle}>Raport lokalnego czyszczenia</Text><Text style={styles.auditText}>Przyjęte: {audit.acceptedRows} · odrzucone: {audit.rejectedRows}</Text><Text style={styles.auditText}>Usunięto: {audit.removedFields.join(", ")}.</Text></View> : null}
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {loading && !stats ? <ActivityIndicator color={theme.primary} style={{ margin: 24 }} /> : null}
    <View style={styles.metrics}><Metric label="Łącznie" value={stats ? `${stats.totalEarnings.toFixed(0)} PLN` : "—"} /><Metric label="Przejazdy" value={stats ? String(stats.totalTrips) : "—"} /><Metric label="Śr./kurs" value={stats ? `${stats.averagePerTrip.toFixed(1)} PLN` : "—"} /></View>
    <Text style={styles.section}>Najlepsze strefy odbioru</Text><View style={styles.card}>{stats?.topZones.length ? stats.topZones.map((zone, index) => <View key={`${zone.name}-${index}`} style={styles.row}><Text style={styles.rank}>{index + 1}</Text><View style={{ flex: 1 }}><View style={styles.line}><Text style={styles.name}>{zone.name}</Text><Text style={styles.amount}>{zone.amount.toFixed(0)} PLN</Text></View><View style={styles.bar}><View style={[styles.fill, { width: `${Math.max(5, zone.amount / max * 100)}%` }]} /></View></View></View>) : <Text style={styles.empty}>Zaimportuj historię, aby zobaczyć zagregowane strefy.</Text>}</View>
    <View style={styles.limitCard}><Text style={styles.limitTitle}>Silnik szkolenia floty</Text><Text style={styles.limitText}>Rzeczywisty odbiór, cel, przebieg, pora i dochód netto z obsługiwanych eksportów zasilają anonimowe PLN/km i wzorce liderów. Użyj sekcji „Flota i wzorce”, aby przeprowadzić prywatny import.</Text></View>
  </ScrollView></SafeAreaView>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background }, content: { padding: 18, paddingBottom: 40 }, header: { flexDirection: "row", justifyContent: "space-between" }, eyebrow: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }, title: { color: theme.text, fontSize: 30, fontWeight: "900", marginTop: 4 }, refresh: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  privacyCard: { flexDirection: "row", gap: 11, padding: 14, borderRadius: 17, marginTop: 16, backgroundColor: "rgba(46,230,166,.07)", borderWidth: 1, borderColor: "rgba(46,230,166,.25)" }, privacyTitle: { color: theme.text, fontSize: 12, fontWeight: "900" }, privacyText: { color: theme.muted, fontSize: 9.5, lineHeight: 14, marginTop: 4 }, importButton: { minHeight: 50, marginTop: 10, borderRadius: 14, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, disabled: { opacity: .5 }, importText: { color: theme.background, fontSize: 11, fontWeight: "900" }, audit: { marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, auditTitle: { color: theme.primary, fontSize: 10, fontWeight: "900" }, auditText: { color: theme.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, message: { color: theme.muted, fontSize: 9.5, lineHeight: 14, marginTop: 10, textAlign: "center" },
  metrics: { flexDirection: "row", gap: 8, marginTop: 16 }, metric: { flex: 1, minHeight: 82, padding: 11, borderRadius: 15, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, justifyContent: "space-between" }, metricValue: { color: theme.text, fontSize: 15, fontWeight: "900" }, metricLabel: { color: theme.muted, fontSize: 9 }, section: { color: theme.text, fontSize: 17, fontWeight: "900", marginTop: 22, marginBottom: 8 }, card: { backgroundColor: theme.surface, borderRadius: 17, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }, row: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, rank: { width: 20, color: theme.primary, fontWeight: "900" }, line: { flexDirection: "row", justifyContent: "space-between" }, name: { color: theme.text, fontSize: 11, fontWeight: "800" }, amount: { color: theme.primary, fontSize: 10, fontWeight: "900" }, bar: { height: 4, backgroundColor: theme.surfaceRaised, borderRadius: 4, marginTop: 6, overflow: "hidden" }, fill: { height: 4, backgroundColor: theme.primary }, empty: { color: theme.muted, fontSize: 10, padding: 18, textAlign: "center" }, limitCard: { padding: 13, marginTop: 14, borderRadius: 15, backgroundColor: "rgba(255,181,71,.06)", borderWidth: 1, borderColor: "rgba(255,181,71,.22)" }, limitTitle: { color: theme.warning, fontSize: 10, fontWeight: "900" }, limitText: { color: theme.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
});
