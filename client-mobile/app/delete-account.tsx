import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/components/AuthProvider";
import { deleteCurrentAccount } from "@/lib/api";
import { theme } from "@/lib/theme";

export default function DeleteAccountScreen() {
  const { user, loading, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (!password || confirmation !== "USUŃ") return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCurrentAccount(password);
      await logout().catch(() => undefined);
      router.replace("/auth" as never);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się usunąć konta.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.screen}><ActivityIndicator color={theme.primary} /></SafeAreaView>;
  if (!user) return <SafeAreaView style={styles.screen}><View style={styles.card}><Ionicons name="lock-closed-outline" size={32} color={theme.primary} /><Text style={styles.title}>Zaloguj się</Text><Text style={styles.copy}>Usunięcie konta wymaga aktywnej sesji i potwierdzenia hasłem.</Text><Pressable onPress={() => router.replace("/auth" as never)} style={styles.primary}><Text style={styles.primaryText}>Przejdź do logowania</Text></Pressable></View></SafeAreaView>;
  if (user.role === "admin") return <SafeAreaView style={styles.screen}><View style={styles.card}><Ionicons name="shield-outline" size={32} color={theme.warning} /><Text style={styles.title}>Konto administratora</Text><Text style={styles.copy}>Najpierw wykonaj kontrolowany transfer własności i dostępu administracyjnego.</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.screen}><View style={styles.card}><View style={styles.icon}><Ionicons name="trash-outline" size={31} color={theme.danger} /></View><Text accessibilityRole="header" style={styles.title}>Usuń konto na zawsze</Text><Text style={styles.copy}>Zostaną usunięte profil, sesje, przejazdy, zarobki, preferencje, aktywność i rekordy płatności PlusPuls. Operacji nie można cofnąć.</Text><TextInput accessibilityLabel="Hasło do potwierdzenia" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} maxLength={128} placeholder="Hasło" placeholderTextColor={theme.muted} style={styles.input} /><TextInput accessibilityLabel="Wpisz USUŃ" autoCapitalize="characters" value={confirmation} onChangeText={setConfirmation} maxLength={4} placeholder="Wpisz USUŃ" placeholderTextColor={theme.muted} style={styles.input} />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={deleting || !password || confirmation !== "USUŃ"} onPress={() => void remove()} style={[styles.danger, (deleting || !password || confirmation !== "USUŃ") && { opacity: .4 }]}>{deleting ? <ActivityIndicator color={theme.text} /> : <Text style={styles.dangerText}>Usuń konto</Text>}</Pressable><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>Anuluj</Text></Pressable></View></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: theme.background }, card: { alignItems: "center", gap: 12, padding: 24, borderRadius: 22, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }, icon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "rgba(255,82,113,.08)" }, title: { color: theme.text, fontSize: 21, fontWeight: "900", textAlign: "center" }, copy: { color: theme.muted, fontSize: 11, lineHeight: 17, textAlign: "center" }, input: { alignSelf: "stretch", minHeight: 49, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceRaised }, error: { alignSelf: "stretch", color: theme.danger, fontSize: 10.5 }, primary: { alignSelf: "stretch", minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: theme.primary }, primaryText: { color: theme.background, fontSize: 11, fontWeight: "900" }, danger: { alignSelf: "stretch", minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: theme.danger }, dangerText: { color: theme.text, fontSize: 11, fontWeight: "900" }, secondary: { minHeight: 44, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }, secondaryText: { color: theme.muted, fontSize: 11, fontWeight: "800" } });
