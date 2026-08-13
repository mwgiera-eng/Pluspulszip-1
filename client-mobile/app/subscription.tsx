import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PageHeader } from "@/components/PageHeader";
import { productionApiUrl } from "@/lib/api";
import { theme } from "@/lib/theme";

const FEATURES = [
  "Day Planner z prognozą godzinową",
  "Statystyki zarobków i najlepsze strefy",
  "Alerty lotniskowe, wydarzenia i hot zones",
  "Zaawansowane rekomendacje relokacji",
];

export default function SubscriptionScreen() {
  const openWeb = () => void Linking.openURL(`${productionApiUrl()}/subscription`);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="PlusPuls Premium" subtitle="Plan i funkcje premium" />

        <LinearGradient colors={["#1B3A30", theme.surface]} style={styles.hero}>
          <View style={styles.crown}><Ionicons name="diamond-outline" size={30} color={theme.primary} /></View>
          <Text style={styles.plan}>Premium</Text>
          <View style={styles.priceRow}><Text style={styles.price}>9.99</Text><Text style={styles.currency}> PLN / miesiąc</Text></View>
          <Text style={styles.copy}>Pełny zestaw narzędzi dla kierowcy dostępny w tym samym koncie PlusPuls.</Text>
        </LinearGradient>

        <View style={styles.card}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.feature}>
              <View style={styles.check}><Ionicons name="checkmark" size={14} color={theme.background} /></View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={openWeb} style={styles.button}>
          <Text style={styles.buttonText}>Otwórz zarządzanie planem</Text>
          <Ionicons name="open-outline" size={18} color={theme.background} />
        </Pressable>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={theme.blue} />
          <Text style={styles.noteText}>Płatności i zmiany planu są obsługiwane przez istniejący bezpieczny przepływ webowy. Aplikacja Android nie przechowuje danych płatniczych.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 38 },
  hero: { alignItems: "center", padding: 22, borderRadius: 22, borderWidth: 1, borderColor: "rgba(46,230,166,0.28)" },
  crown: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(46,230,166,0.10)" },
  plan: { color: theme.text, fontSize: 23, fontWeight: "900", marginTop: 12 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  price: { color: theme.primary, fontSize: 31, fontWeight: "900" },
  currency: { color: theme.muted, fontSize: 11, fontWeight: "700" },
  copy: { color: theme.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 7, maxWidth: 280 },
  card: { marginTop: 14, backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, paddingVertical: 5 },
  feature: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, color: theme.text, fontSize: 11, fontWeight: "700" },
  button: { minHeight: 52, marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 15, backgroundColor: theme.primary },
  buttonText: { color: theme.background, fontSize: 12, fontWeight: "900" },
  note: { flexDirection: "row", gap: 8, padding: 13, borderRadius: 15, backgroundColor: "rgba(67,135,255,0.07)", marginTop: 14 },
  noteText: { flex: 1, color: theme.muted, fontSize: 10, lineHeight: 15 },
});
