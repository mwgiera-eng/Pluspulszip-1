import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PageHeader } from "@/components/PageHeader";
import { productionApiUrl } from "@/lib/api";
import { theme } from "@/lib/theme";

export default function SettingsScreen() {
  const mapsEnabled = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_MAPS === "true";
  const api = productionApiUrl();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="Ustawienia" subtitle="Prywatność i konfiguracja Android" />

        <Text style={styles.section}>Połączenie</Text>
        <View style={styles.card}>
          <Row icon="cloud-outline" title="PlusPuls API" detail={api} value="HTTPS" />
          <Row icon="map-outline" title="Google Maps" detail="Natywny provider mapy" value={mapsEnabled ? "ON" : "OFF"} valueColor={mapsEnabled ? theme.primary : theme.warning} />
          <Row icon="pulse-outline" title="Traffic Pulse" detail="Ruch drogowy i heatmapa bez Google Maps" value="LIVE" valueColor={theme.primary} />
        </View>

        <Text style={styles.section}>Prywatność</Text>
        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark-outline" size={23} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>Lokalizacja urządzenia</Text>
            <Text style={styles.privacyText}>Pozycja GPS służy do centrowania i kontekstu kierowcy. Dane mapy i prognozy są pobierane przez szyfrowane HTTPS.</Text>
          </View>
        </View>

        <Pressable onPress={() => void Linking.openSettings()} style={styles.button}>
          <Ionicons name="phone-portrait-outline" size={19} color={theme.background} />
          <Text style={styles.buttonText}>Otwórz ustawienia aplikacji Android</Text>
        </Pressable>

        <Text style={styles.section}>Wersja</Text>
        <View style={styles.card}>
          <Row icon="cube-outline" title="PlusPuls Android" detail="Natywny klient Expo Router" value="1.0.0" />
          <Row icon="git-branch-outline" title="Kanał" detail="GitHub / android" value="preview" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, title, detail, value, valueColor = theme.muted }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}><Ionicons name={icon} size={19} color={theme.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail} numberOfLines={2}>{detail}</Text>
      </View>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 38 },
  section: { color: theme.text, fontSize: 17, fontWeight: "900", marginTop: 14, marginBottom: 9 },
  card: { backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  icon: { width: 37, height: 37, borderRadius: 12, backgroundColor: theme.surfaceRaised, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: theme.text, fontSize: 12, fontWeight: "800" },
  rowDetail: { color: theme.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  value: { fontSize: 9.5, fontWeight: "900", maxWidth: 66, textAlign: "right" },
  privacy: { flexDirection: "row", gap: 11, padding: 14, borderRadius: 17, backgroundColor: "rgba(46,230,166,0.07)", borderWidth: 1, borderColor: "rgba(46,230,166,0.18)" },
  privacyTitle: { color: theme.text, fontSize: 12, fontWeight: "900" },
  privacyText: { color: theme.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  button: { minHeight: 50, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, backgroundColor: theme.primary },
  buttonText: { color: theme.background, fontSize: 11, fontWeight: "900" },
});
