import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

const ITEMS = [
  { icon: "pulse-outline" as const, title: "Sygnały", detail: "Lotnisko, wydarzenia, hot zones", route: "/signals" },
  { icon: "notifications-outline" as const, title: "Powiadomienia", detail: "Typy alertów i częstotliwość", route: "/notifications" },
  { icon: "settings-outline" as const, title: "Ustawienia", detail: "Prywatność, dane i zachowanie aplikacji", route: "/settings" },
  { icon: "diamond-outline" as const, title: "Premium", detail: "Status planu i funkcje premium", route: "/subscription" },
  { icon: "download-outline" as const, title: "Instalacja APK", detail: "Wersja, podpis i aktualizacje", route: "/download" },
] as const;

export default function MoreScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>PLUSPULS</Text>
        <Text style={styles.title}>Więcej</Text>
        <Text style={styles.subtitle}>Funkcje z wersji webowej przeniesione do aplikacji Android.</Text>

        <View style={styles.status}>
          <View style={styles.statusIcon}><Ionicons name="shield-checkmark-outline" size={23} color={theme.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>Live OpenStreetMap</Text>
            <Text style={styles.statusText}>Mapa CARTO/OSM pokazuje heatmapę, ruch drogowy i sygnały PlusPuls bez klucza Google Maps.</Text>
          </View>
        </View>

        <View style={styles.menu}>
          {ITEMS.map((item) => (
            <Pressable key={item.title} onPress={() => router.push(item.route as never)} style={styles.item}>
              <View style={styles.icon}><Ionicons name={item.icon} size={21} color={theme.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDetail}>{item.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={theme.blue} />
          <Text style={styles.noteText}>Panel administratora i import plików pozostają narzędziami webowymi. Funkcje kierowcy mają natywne odpowiedniki w Androidzie.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 36 },
  eyebrow: { color: theme.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: theme.text, fontSize: 30, fontWeight: "900", marginTop: 5 },
  subtitle: { color: theme.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  status: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 18, backgroundColor: "rgba(46,230,166,0.07)", borderWidth: 1, borderColor: "rgba(46,230,166,0.2)", marginTop: 18 },
  statusIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  statusTitle: { color: theme.text, fontSize: 12, fontWeight: "900" },
  statusText: { color: theme.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  menu: { backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, overflow: "hidden", marginTop: 16 },
  item: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  icon: { width: 39, height: 39, borderRadius: 12, backgroundColor: theme.surfaceRaised, alignItems: "center", justifyContent: "center" },
  itemTitle: { color: theme.text, fontSize: 12.5, fontWeight: "800" },
  itemDetail: { color: theme.muted, fontSize: 9.5, marginTop: 3 },
  note: { flexDirection: "row", gap: 8, marginTop: 16, padding: 13, borderRadius: 15, backgroundColor: "rgba(67,135,255,0.07)" },
  noteText: { flex: 1, color: theme.muted, fontSize: 10, lineHeight: 15 },
});
