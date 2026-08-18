import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/components/AuthProvider";
import { theme } from "@/lib/theme";

export default function PendingScreen() {
  const { user, loading, refresh, logout } = useAuth();
  const check = async () => { const next = await refresh(); if (next && ["approved", "active"].includes(next.status)) router.replace(next.accountType || next.role === "admin" ? "/(tabs)" as never : "/account-type" as never); };
  return <SafeAreaView style={styles.screen}><View style={styles.card}><View style={styles.icon}><Ionicons name="time-outline" size={34} color={theme.warning} /></View><Text accessibilityRole="header" style={styles.title}>Konto oczekuje na zatwierdzenie</Text><Text style={styles.detail}>Rejestracja {user?.email ? `dla ${user.email} ` : ""}została przyjęta. Administrator włączy dostęp po weryfikacji.</Text><Pressable accessibilityRole="button" onPress={() => void check()} disabled={loading} style={styles.primary}>{loading ? <ActivityIndicator color={theme.background} /> : <Text style={styles.primaryText}>Sprawdź status</Text>}</Pressable><Pressable accessibilityRole="button" onPress={() => void logout().then(() => router.replace("/auth" as never))} style={styles.secondary}><Text style={styles.secondaryText}>Wyloguj</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/delete-account" as never)} style={styles.secondary}><Text style={[styles.secondaryText, { color: theme.danger }]}>Usuń konto</Text></Pressable></View></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: theme.background }, card: { alignItems: "center", padding: 24, borderRadius: 22, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, icon: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,181,71,.09)" }, title: { color: theme.text, fontSize: 20, lineHeight: 26, fontWeight: "900", textAlign: "center", marginTop: 18 }, detail: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 9 }, primary: { minHeight: 50, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: theme.primary, marginTop: 22 }, primaryText: { color: theme.background, fontSize: 12, fontWeight: "900" }, secondary: { minHeight: 48, alignSelf: "stretch", alignItems: "center", justifyContent: "center", marginTop: 7 }, secondaryText: { color: theme.muted, fontSize: 11, fontWeight: "800" } });
