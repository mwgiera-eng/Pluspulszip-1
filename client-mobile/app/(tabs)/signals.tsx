import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

const SIGNALS = [
  { icon: "calendar-outline" as const, title: "Wydarzenia", detail: "Centrum i Kazimierz", score: "+18%", color: theme.primary },
  { icon: "airplane-outline" as const, title: "Lotnisko KRK", detail: "Przyloty w ciągu 90 min", score: "+12%", color: theme.blue },
  { icon: "cloud-outline" as const, title: "Pogoda", detail: "Lekki deszcz zwiększa popyt", score: "+9%", color: theme.warning },
];

export default function SignalsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PLUSPULS INTELLIGENCE</Text>
        <Text style={styles.title}>Sygnały dla Krakowa</Text>
        <Text style={styles.subtitle}>Krótka lista czynników, które zmieniają następny ruch.</Text>

        <LinearGradient colors={["#16251F", theme.surface]} style={styles.advice}>
          <View style={styles.pulse}>
            <View style={styles.pulseCore} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.adviceLabel}>STRATEGIC ADVICE</Text>
            <Text style={styles.adviceText}>Obecna lokalizacja ma dobry historyczny popyt.</Text>
          </View>
        </LinearGradient>

        {SIGNALS.map((signal) => (
          <View key={signal.title} style={styles.signal}>
            <View style={[styles.icon, { borderColor: signal.color }]}>
              <Ionicons name={signal.icon} size={22} color={signal.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.signalTitle}>{signal.title}</Text>
              <Text style={styles.signalDetail}>{signal.detail}</Text>
            </View>
            <Text style={[styles.signalScore, { color: signal.color }]}>{signal.score}</Text>
          </View>
        ))}

        <View style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
          <Text style={styles.noticeText}>Lokalizacja pozostaje na urządzeniu. Do API wysyłane są tylko wybrane horyzonty prognozy.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: { color: theme.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: theme.text, fontSize: 30, fontWeight: "900", marginTop: 7 },
  subtitle: { color: theme.muted, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 22 },
  advice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.45)",
    marginBottom: 20,
  },
  pulse: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(46,230,166,0.12)", alignItems: "center", justifyContent: "center" },
  pulseCore: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.primary, shadowColor: theme.primary, shadowOpacity: 1, shadowRadius: 12 },
  adviceLabel: { color: theme.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  adviceText: { color: theme.text, fontSize: 17, lineHeight: 23, fontWeight: "700", marginTop: 5 },
  signal: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: theme.surfaceRaised },
  signalTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  signalDetail: { color: theme.muted, fontSize: 11, marginTop: 4 },
  signalScore: { fontSize: 17, fontWeight: "900" },
  notice: { flexDirection: "row", gap: 10, marginTop: 20, padding: 14, borderRadius: 15, backgroundColor: "rgba(46,230,166,0.07)" },
  noticeText: { flex: 1, color: theme.muted, fontSize: 11, lineHeight: 16 },
});
