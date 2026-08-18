import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PageHeader } from "@/components/PageHeader";
import { FeatureGate } from "@/components/FeatureGate";
import { useDeviceLocation } from "@/hooks/use-device-location";
import { fetchNotificationPreferences, fetchZoneProfitHeat, saveNotificationPreferences, type NotificationPrefs } from "@/lib/api";
import { chooseDriverGuidance } from "@/lib/driver-guidance";
import { ensureNotificationPermission, notificationPermissionStatus, presentGuidance, readNativeGuidanceSettings, writeNativeGuidanceSettings, type NativeGuidanceSettings } from "@/lib/native-guidance";
import { theme } from "@/lib/theme";

const DEFAULT_PREFS: NotificationPrefs = {
  airportInfo: true,
  events: true,
  hotZones: true,
  relocate: true,
  bestEarnings: true,
  frequency: "hourly",
};

const TYPES = [
  { key: "airportInfo" as const, icon: "airplane-outline" as const, label: "Fale lotniskowe", detail: "Duże fale przylotów i odlotów z Balic" },
  { key: "events" as const, icon: "calendar-outline" as const, label: "Wydarzenia", detail: "Tauron Arena, ICE, EXPO i duże imprezy" },
  { key: "hotZones" as const, icon: "flame-outline" as const, label: "Hot zones", detail: "Strefy osiągające wysoki lub surge popyt" },
  { key: "relocate" as const, icon: "navigate-outline" as const, label: "Relokacja", detail: "Sugestie przejazdu do lepszej strefy" },
  { key: "bestEarnings" as const, icon: "cash-outline" as const, label: "Najlepsze okazje", detail: "Najwyższy priorytet potencjału zarobkowego" },
];

const FREQUENCIES = [
  { value: "realtime", label: "Real-time" },
  { value: "hourly", label: "Co godzinę" },
  { value: "daily", label: "Codziennie" },
  { value: "off", label: "Wyłączone" },
];

export default function NotificationsScreen() {
  return <FeatureGate premium><NotificationsContent /></FeatureGate>;
}

function NotificationsContent() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [native, setNative] = useState<NativeGuidanceSettings>({ notificationsEnabled: false, voiceEnabled: false });
  const [permission, setPermission] = useState<string>("undetermined");
  const { position } = useDeviceLocation();

  useEffect(() => {
    const controller = new AbortController();
    fetchNotificationPreferences(controller.signal)
      .then((next) => setPrefs(next))
      .catch(() => setMessage("Używane są ustawienia lokalne. Synchronizacja może wymagać zalogowanej sesji."))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void Promise.all([readNativeGuidanceSettings(), notificationPermissionStatus()]).then(([settings, status]) => {
      setNative(settings); setPermission(status);
    });
  }, []);

  const toggle = (key: keyof Omit<NotificationPrefs, "frequency">) => {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (native.notificationsEnabled) {
        const granted = await ensureNotificationPermission();
        if (!granted) throw new Error("Android nie przyznał zgody na powiadomienia.");
        setPermission("granted");
      }
      writeNativeGuidanceSettings(native);
      const next = await saveNotificationPreferences(prefs);
      setPrefs(next);
      setDirty(false);
      setMessage("Preferencje i tryb bez dotykania zostały zapisane.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Nie udało się zapisać preferencji.");
    } finally {
      setSaving(false);
    }
  };

  const testNative = async () => {
    setSaving(true); setMessage(null);
    try {
      if (native.notificationsEnabled && !(await ensureNotificationPermission())) throw new Error("Android nie przyznał zgody na powiadomienia.");
      writeNativeGuidanceSettings(native);
      const zones = await fetchZoneProfitHeat(0);
      const guidance = chooseDriverGuidance(zones.zones, position);
      if (!guidance) throw new Error("Brak aktualnej rekomendacji do odtworzenia.");
      await presentGuidance(guidance.instruction, native);
      setMessage("Test wysłany. Sprawdź dźwięk i panel powiadomień Androida.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Test nie powiódł się."); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="Powiadomienia" subtitle="Typy alertów i częstotliwość" />

        <View style={styles.transport}>
          <Ionicons name="notifications-outline" size={21} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.transportTitle}>Tryb bez dotykania</Text>
            <Text style={styles.transportText}>Lokalne alerty i polski głos działają w tej aplikacji. Zdalne alerty przy zamkniętej aplikacji będą wymagały poświadczeń FCM.</Text>
          </View>
        </View>

        <View style={styles.nativeCard}>
          <NativeToggle icon="notifications" label="Powiadomienia Android" detail={permission === "granted" ? "Zgoda systemowa aktywna" : "Android poprosi o zgodę przy zapisie"} value={native.notificationsEnabled} onChange={(value) => { setNative((current) => ({ ...current, notificationsEnabled: value })); setDirty(true); }} />
          <NativeToggle icon="volume-high" label="Asystent głosowy" detail="Krótka wskazówka po polsku po zmianie celu" value={native.voiceEnabled} onChange={(value) => { setNative((current) => ({ ...current, voiceEnabled: value })); setDirty(true); }} />
        </View>

        {loading ? <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} /> : null}

        <View style={styles.card}>
          {TYPES.map((item) => (
            <View key={item.key} style={styles.row}>
              <View style={styles.icon}><Ionicons name={item.icon} size={20} color={theme.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.label}</Text>
                <Text style={styles.rowDetail}>{item.detail}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: theme.surfaceRaised, true: "rgba(46,230,166,0.42)" }}
                thumbColor={prefs[item.key] ? theme.primary : theme.muted}
              />
            </View>
          ))}
        </View>

        <Text style={styles.section}>Częstotliwość</Text>
        <View style={styles.frequencyGrid}>
          {FREQUENCIES.map((frequency) => {
            const selected = prefs.frequency === frequency.value;
            return (
              <Pressable
                key={frequency.value}
                onPress={() => { setPrefs((current) => ({ ...current, frequency: frequency.value })); setDirty(true); }}
                style={[styles.frequency, selected && styles.frequencyActive]}
              >
                <Text style={[styles.frequencyText, selected && styles.frequencyTextActive]}>{frequency.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable onPress={() => void testNative()} disabled={saving || (!native.notificationsEnabled && !native.voiceEnabled)} style={[styles.test, (saving || (!native.notificationsEnabled && !native.voiceEnabled)) && styles.saveDisabled]}><Ionicons name="play" size={17} color={theme.primary} /><Text style={styles.testText}>Testuj teraz</Text></Pressable>

        <Pressable onPress={() => void save()} disabled={!dirty || saving} style={[styles.save, (!dirty || saving) && styles.saveDisabled]}>
          {saving ? <ActivityIndicator color={theme.background} /> : <Text style={styles.saveText}>Zapisz preferencje</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function NativeToggle({ icon, label, detail, value, onChange }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.nativeRow}><View style={styles.icon}><Ionicons name={icon} size={20} color={theme.primary} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.rowDetail}>{detail}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ false: theme.surfaceRaised, true: "rgba(46,230,166,0.42)" }} thumbColor={value ? theme.primary : theme.muted} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 38 },
  transport: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, backgroundColor: "rgba(46,230,166,0.07)", borderWidth: 1, borderColor: "rgba(46,230,166,0.18)" },
  transportTitle: { color: theme.text, fontSize: 12, fontWeight: "900" },
  transportText: { color: theme.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  nativeCard: { marginTop: 12, backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
  nativeRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  card: { marginTop: 14, backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: theme.surfaceRaised },
  rowTitle: { color: theme.text, fontSize: 12, fontWeight: "800" },
  rowDetail: { color: theme.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  section: { color: theme.text, fontSize: 17, fontWeight: "900", marginTop: 22, marginBottom: 9 },
  frequencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  frequency: { width: "48%", minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  frequencyActive: { borderColor: theme.primary, backgroundColor: "rgba(46,230,166,0.09)" },
  frequencyText: { color: theme.muted, fontSize: 10, fontWeight: "800" },
  frequencyTextActive: { color: theme.primary },
  message: { color: theme.muted, fontSize: 10, lineHeight: 14, textAlign: "center", marginTop: 15 },
  save: { minHeight: 50, marginTop: 15, borderRadius: 14, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" },
  saveDisabled: { opacity: 0.42 },
  saveText: { color: theme.background, fontSize: 12, fontWeight: "900" },
  test: { minHeight: 48, marginTop: 14, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  testText: { color: theme.primary, fontSize: 11, fontWeight: "900" },
});
