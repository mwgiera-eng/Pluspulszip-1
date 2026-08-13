import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PageHeader } from "@/components/PageHeader";
import { fetchNotificationPreferences, saveNotificationPreferences, type NotificationPrefs } from "@/lib/api";
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
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchNotificationPreferences(controller.signal)
      .then((next) => setPrefs(next))
      .catch(() => setMessage("Używane są ustawienia lokalne. Synchronizacja może wymagać zalogowanej sesji."))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const toggle = (key: keyof Omit<NotificationPrefs, "frequency">) => {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const next = await saveNotificationPreferences(prefs);
      setPrefs(next);
      setDirty(false);
      setMessage("Preferencje zapisane na serwerze PlusPuls.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Nie udało się zapisać preferencji.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="Powiadomienia" subtitle="Typy alertów i częstotliwość" />

        <View style={styles.transport}>
          <Ionicons name="notifications-outline" size={21} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.transportTitle}>Preferencje alertów</Text>
            <Text style={styles.transportText}>Ustawienia są zgodne z wersją webową. Natywne push delivery wymaga osobnej konfiguracji Expo Notifications i poświadczeń push.</Text>
          </View>
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

        <Pressable onPress={() => void save()} disabled={!dirty || saving} style={[styles.save, (!dirty || saving) && styles.saveDisabled]}>
          {saving ? <ActivityIndicator color={theme.background} /> : <Text style={styles.saveText}>Zapisz preferencje</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 38 },
  transport: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, backgroundColor: "rgba(46,230,166,0.07)", borderWidth: 1, borderColor: "rgba(46,230,166,0.18)" },
  transportTitle: { color: theme.text, fontSize: 12, fontWeight: "900" },
  transportText: { color: theme.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
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
});
