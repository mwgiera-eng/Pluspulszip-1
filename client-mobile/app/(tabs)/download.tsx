import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

function secureApkUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_ANDROID_APK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function DownloadScreen() {
  const apkUrl = secureApkUrl();
  const version = process.env.EXPO_PUBLIC_RELEASE_VERSION || "1.2.3";
  const checksum = process.env.EXPO_PUBLIC_ANDROID_APK_SHA256?.trim();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logo}>
          <Ionicons name="pulse" size={34} color={theme.primary} />
        </View>
        <Text style={styles.title}>Zainstaluj PlusPuls</Text>
        <Text style={styles.subtitle}>
          Oficjalna, podpisana wersja Android bez Google Play. Pakiet: pl.pluspuls.app
        </Text>

        <LinearGradient colors={["#183226", theme.surface]} style={styles.release}>
          <View>
            <Text style={styles.releaseLabel}>SIGNED ANDROID APK</Text>
            <Text style={styles.releaseVersion}>Wersja {version}</Text>
          </View>
          <Ionicons name="shield-checkmark" size={32} color={theme.primary} />
        </LinearGradient>

        <Pressable
          accessibilityRole="link"
          disabled={!apkUrl}
          onPress={() => apkUrl && void Linking.openURL(apkUrl)}
          style={[styles.download, !apkUrl && styles.downloadDisabled]}
        >
          <Ionicons name="download" size={21} color={theme.background} />
          <Text style={styles.downloadText}>{apkUrl ? "Pobierz APK" : "APK czeka na pierwszy build EAS"}</Text>
        </Pressable>

        {checksum ? (
          <View style={styles.checksum}>
            <Text style={styles.stepTitle}>SHA-256</Text>
            <Text selectable style={styles.checksumText}>{checksum}</Text>
          </View>
        ) : null}

        <Text style={styles.section}>Instalacja</Text>
        {[
          "Pobierz APK wyłącznie z tej strony.",
          "Android może poprosić o zgodę na instalację z przeglądarki.",
          "Potwierdź nazwę pakietu pl.pluspuls.app i zainstaluj.",
          "Kolejne wersje muszą być podpisane tym samym kluczem.",
        ].map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        {Platform.OS === "web" ? (
          <View style={styles.pwa}>
            <Ionicons name="phone-portrait-outline" size={22} color={theme.blue} />
            <Text style={styles.pwaText}>Nie chcesz instalować APK? Otwórz menu przeglądarki i wybierz „Dodaj do ekranu głównego”, aby używać wersji PWA.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 22, paddingBottom: 46, alignItems: "stretch" },
  logo: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: "rgba(46,230,166,0.38)" },
  title: { color: theme.text, fontSize: 30, fontWeight: "900", marginTop: 20 },
  subtitle: { color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  release: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 20, padding: 18, marginTop: 24, borderWidth: 1, borderColor: "rgba(46,230,166,0.32)" },
  releaseLabel: { color: theme.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  releaseVersion: { color: theme.text, fontSize: 18, fontWeight: "800", marginTop: 5 },
  download: { minHeight: 54, marginTop: 14, borderRadius: 16, backgroundColor: theme.primary, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center" },
  downloadDisabled: { opacity: 0.45 },
  downloadText: { color: theme.background, fontSize: 15, fontWeight: "900" },
  checksum: { backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginTop: 12 },
  checksumText: { color: theme.muted, fontSize: 10, marginTop: 6 },
  section: { color: theme.text, fontSize: 19, fontWeight: "900", marginTop: 28, marginBottom: 12 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.surfaceRaised, alignItems: "center", justifyContent: "center" },
  stepNumberText: { color: theme.primary, fontSize: 12, fontWeight: "900" },
  stepTitle: { color: theme.text, fontSize: 12, fontWeight: "800" },
  stepText: { flex: 1, color: theme.muted, fontSize: 13, lineHeight: 18 },
  pwa: { flexDirection: "row", gap: 11, padding: 15, borderRadius: 16, backgroundColor: "rgba(67,135,255,0.10)", marginTop: 16 },
  pwaText: { flex: 1, color: theme.muted, fontSize: 12, lineHeight: 18 },
});
