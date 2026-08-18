import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { FeatureGate } from "@/components/FeatureGate";
import { deleteCurrentAccount, productionApiUrl } from "@/lib/api";
import { theme } from "@/lib/theme";

export default function SettingsScreen() {
  return <FeatureGate><SettingsContent /></FeatureGate>;
}

function SettingsContent() {
  const api = productionApiUrl();
  const { user, loading, refresh, logout } = useAuth();
  const version = Constants.expoConfig?.version || "1.1.0";
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteAccount = async () => {
    if (deleteConfirmation !== "USUŃ" || !deletePassword) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCurrentAccount(deletePassword);
      await logout().catch(() => undefined);
      router.replace("/auth" as never);
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "Nie udało się usunąć konta.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageHeader title="Ustawienia" subtitle="Prywatność i konfiguracja Android" />

        <Text style={styles.section}>Konto</Text>
        <View style={styles.card}>
          <Row icon="person-outline" title={loading ? "Sprawdzanie sesji" : user ? `${user.firstName || "Konto"} ${user.lastName || ""}`.trim() : "Tryb publiczny"} detail={user?.email || "Zaloguj się, aby synchronizować plan, zarobki i alerty."} value={user?.status || "offline"} valueColor={user ? theme.primary : theme.muted} />
          {user?.subscriptionInfo ? <Row icon="diamond-outline" title="Plan" detail={user.subscriptionInfo.status === "trial" ? `${user.subscriptionInfo.trialDaysLeft ?? 0} dni okresu próbnego` : "Status subskrypcji PlusPuls"} value={user.subscriptionInfo.status} valueColor={user.isPremium ? theme.primary : theme.warning} /> : null}
        </View>
        <View style={styles.actions}>{user ? <><Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.actionGhost}><Text style={styles.actionGhostText}>Odśwież konto</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.actionGhost}><Text style={styles.actionGhostText}>Wyloguj</Text></Pressable></> : <Pressable accessibilityRole="button" onPress={() => router.push("/auth" as never)} style={styles.actionGhost}><Text style={styles.actionGhostText}>Logowanie / rejestracja</Text></Pressable>}</View>

        <Text style={styles.section}>Połączenie</Text>
        <View style={styles.card}>
          <Row icon="cloud-outline" title="PlusPuls API" detail={api} value="HTTPS" />
          <Row icon="map-outline" title="OpenStreetMap / CARTO" detail="Ciemne kafelki mapy bez klucza Google" value="LIVE" valueColor={theme.primary} />
          <Row icon="pulse-outline" title="Traffic Pulse" detail="Heatmapa i animowane sygnały drogowe z mapy PlusPuls" value="LIVE" valueColor={theme.primary} />
        </View>

        <Text style={styles.section}>Prywatność</Text>
        <View style={styles.privacy}>
          <Ionicons name="shield-checkmark-outline" size={23} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>Lokalizacja urządzenia</Text>
            <Text style={styles.privacyText}>PlusPuls pyta o lokalizację pierwszoplanową dopiero po użyciu przycisku na mapie. Nie żąda lokalizacji w tle. Pozycja może być przesłana przez HTTPS, aby obliczyć pobliskie trasy.</Text>
          </View>
        </View>

        <Pressable onPress={() => void Linking.openSettings()} style={styles.button}>
          <Ionicons name="phone-portrait-outline" size={19} color={theme.background} />
          <Text style={styles.buttonText}>Otwórz ustawienia aplikacji Android</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push("/trust/privacy" as never)} style={styles.privacyLink}><Ionicons name="document-text-outline" size={18} color={theme.primary} /><Text style={styles.privacyLinkText}>Prywatność, warunki i dostępność</Text></Pressable>

        <Text style={styles.section}>Wersja</Text>
        <View style={styles.card}>
          <Row icon="cube-outline" title="PlusPuls Android" detail="Natywny klient Expo Router" value={version} />
          <Row icon="git-branch-outline" title="Kanał" detail="GitHub / android" value={process.env.EXPO_PUBLIC_RELEASE_CHANNEL || "preview"} />
        </View>

        {user?.role !== "admin" ? <><Text style={styles.section}>Usunięcie konta</Text><View style={styles.danger}><Ionicons name="warning-outline" size={22} color={theme.danger} /><View style={{ flex: 1 }}><Text style={styles.dangerTitle}>Trwale usuń konto i dane</Text><Text style={styles.dangerText}>Operacja usuwa profil, przejazdy, zarobki, preferencje i dane aktywności. Nie można jej cofnąć.</Text></View></View>{showDelete ? <View style={styles.deleteForm}><TextInput accessibilityLabel="Hasło do potwierdzenia usunięcia konta" secureTextEntry autoComplete="current-password" value={deletePassword} onChangeText={setDeletePassword} maxLength={128} placeholder="Hasło" placeholderTextColor={theme.muted} style={styles.deleteInput} /><TextInput accessibilityLabel="Wpisz USUŃ" autoCapitalize="characters" value={deleteConfirmation} onChangeText={setDeleteConfirmation} maxLength={4} placeholder="Wpisz USUŃ" placeholderTextColor={theme.muted} style={styles.deleteInput} />{deleteError ? <Text accessibilityRole="alert" style={styles.deleteError}>{deleteError}</Text> : null}<Pressable accessibilityRole="button" disabled={deleting || !deletePassword || deleteConfirmation !== "USUŃ"} onPress={() => void deleteAccount()} style={[styles.deleteButton, (deleting || !deletePassword || deleteConfirmation !== "USUŃ") && { opacity: .4 }]}>{deleting ? <ActivityIndicator color={theme.text} /> : <Text style={styles.deleteButtonText}>Usuń konto na zawsze</Text>}</Pressable></View> : <Pressable accessibilityRole="button" onPress={() => setShowDelete(true)} style={styles.deleteReveal}><Text style={styles.deleteRevealText}>Pokaż opcję usunięcia konta</Text></Pressable>}</> : null}
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
  actions: { flexDirection: "row", gap: 8, marginTop: 9 }, actionGhost: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }, actionGhostText: { color: theme.primary, fontSize: 9.5, fontWeight: "900" },
  privacyLink: { minHeight: 48, marginTop: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 13, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }, privacyLinkText: { color: theme.primarySoft, fontSize: 10.5, fontWeight: "800" },
  danger: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,82,113,.35)", backgroundColor: "rgba(255,82,113,.06)" }, dangerTitle: { color: theme.text, fontSize: 12, fontWeight: "900" }, dangerText: { color: theme.muted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  deleteForm: { gap: 9, marginTop: 9 }, deleteInput: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: theme.border, color: theme.text, backgroundColor: theme.surface, fontSize: 12 }, deleteError: { color: theme.danger, fontSize: 10.5 }, deleteButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: theme.danger }, deleteButtonText: { color: theme.text, fontSize: 11, fontWeight: "900" }, deleteReveal: { minHeight: 46, marginTop: 8, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "rgba(255,82,113,.35)" }, deleteRevealText: { color: theme.danger, fontSize: 10.5, fontWeight: "900" },
});
