import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "./AuthProvider";
import { theme } from "@/lib/theme";

export function FeatureGate({ children, premium = false }: PropsWithChildren<{ premium?: boolean }>) {
  const { user, loading, error } = useAuth();

  if (loading) return <State icon="hourglass-outline" title="Sprawdzanie sesji"><ActivityIndicator color={theme.primary} /></State>;
  if (!user) return <State icon="lock-closed-outline" title="Zaloguj się" detail={error || "Ta funkcja korzysta z Twojego bezpiecznego konta PlusPuls."} action="Logowanie / rejestracja" onPress={() => router.push("/auth" as never)} />;
  if (user.status === "pending") return <State icon="time-outline" title="Konto oczekuje na zatwierdzenie" detail="Administrator musi zatwierdzić rejestrację przed włączeniem funkcji konta." action="Status konta" onPress={() => router.push("/pending" as never)} />;
  if (["rejected", "disabled", "suspended"].includes(user.status)) return <State icon="alert-circle-outline" title="Konto niedostępne" detail="Skontaktuj się z administratorem PlusPuls, aby wyjaśnić status konta." />;
  if (!user.accountType && user.role !== "admin") return <State icon="person-circle-outline" title="Dokończ konfigurację" detail="Wybierz profil kierowcy lub dostawcy floty." action="Wybierz profil" onPress={() => router.push("/account-type" as never)} />;
  if (premium && !user.isPremium) return <State icon="diamond-outline" title="Funkcja Premium" detail="Ta funkcja wymaga aktywnego okresu próbnego lub planu Premium." action="Zobacz status planu" onPress={() => router.push("/subscription" as never)} />;
  return children;
}

function State({ icon, title, detail, action, onPress, children }: PropsWithChildren<{ icon: keyof typeof Ionicons.glyphMap; title: string; detail?: string; action?: string; onPress?: () => void }>) {
  return <View style={styles.screen}><View style={styles.card}><View style={styles.icon}><Ionicons name={icon} size={30} color={theme.primary} /></View><Text accessibilityRole="header" style={styles.title}>{title}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}{children}{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}><Text style={styles.buttonText}>{action}</Text></Pressable> : null}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: theme.background },
  card: { alignItems: "center", gap: 12, padding: 24, borderRadius: 22, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  icon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "rgba(46,230,166,.08)" },
  title: { color: theme.text, textAlign: "center", fontSize: 19, fontWeight: "900" },
  detail: { maxWidth: 320, color: theme.muted, textAlign: "center", fontSize: 12, lineHeight: 18 },
  button: { minHeight: 48, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: theme.primary, marginTop: 4 },
  buttonText: { color: theme.background, fontSize: 12, fontWeight: "900" },
});
