import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, type ComponentProps } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { ApiError } from "@/lib/api";
import { theme } from "@/lib/theme";

type Mode = "register" | "login";

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) return setError("Podaj adres e-mail i hasło.");
    if (mode === "register") {
      if (!firstName.trim() || !lastName.trim()) return setError("Podaj imię i nazwisko.");
      if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return setError("Hasło: minimum 10 znaków, mała i wielka litera oraz cyfra.");
      if (password !== confirmation) return setError("Hasła nie są identyczne.");
      if (!terms || !privacy) return setError("Zaakceptuj warunki i potwierdź informację o prywatności.");
    }

    setSubmitting(true);
    try {
      const user = mode === "login"
        ? await login(email, password)
        : await register({ firstName: firstName.trim(), lastName: lastName.trim(), email, password, termsAccepted: true, privacyAccepted: true });
      if (user.status === "pending") router.replace("/pending" as never);
      else if (!user.accountType && user.role !== "admin") router.replace("/account-type" as never);
      else router.replace("/(tabs)" as never);
    } catch (reason) {
      const issue = reason instanceof ApiError ? reason.issues?.[0]?.message : null;
      setError(issue || (reason instanceof Error ? reason.message : "Nie udało się kontynuować."));
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (next: Mode) => { setMode(next); setError(null); };

  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <PageHeader title={mode === "register" ? "Utwórz konto" : "Zaloguj się"} subtitle="Bezpieczna sesja PlusPuls" />
        <View style={styles.hero}><View style={styles.logo}><Text style={styles.logoText}>+</Text></View><View style={{ flex: 1 }}><Text style={styles.heroTitle}>Czytaj miasto zanim ruszy.</Text><Text style={styles.heroText}>Jedno konto do mapy, planera i sygnałów kierowcy.</Text></View></View>
        <View style={styles.segmented}><Segment label="Logowanie" active={mode === "login"} onPress={() => changeMode("login")} /><Segment label="Rejestracja" active={mode === "register"} onPress={() => changeMode("register")} /></View>
        <View style={styles.form}>
          {mode === "register" ? <View style={styles.nameRow}><Field label="Imię" value={firstName} onChangeText={setFirstName} autoComplete="given-name" /><Field label="Nazwisko" value={lastName} onChangeText={setLastName} autoComplete="family-name" /></View> : null}
          <Field label="Adres e-mail" value={email} onChangeText={setEmail} autoComplete="email" inputMode="email" autoCapitalize="none" />
          <Field label="Hasło" value={password} onChangeText={setPassword} autoComplete={mode === "register" ? "new-password" : "current-password"} secureTextEntry />
          {mode === "register" ? <><Text style={styles.hint}>Minimum 10 znaków, mała i wielka litera oraz cyfra.</Text><Field label="Powtórz hasło" value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" secureTextEntry /><Consent checked={terms} onPress={() => setTerms(!terms)} label="Akceptuję Warunki korzystania" onLink={() => router.push("/trust/terms" as never)} /><Consent checked={privacy} onPress={() => setPrivacy(!privacy)} label="Potwierdzam informację o prywatności" onLink={() => router.push("/trust/privacy" as never)} /></> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submit()} style={[styles.submit, submitting && { opacity: .6 }]}>{submitting ? <ActivityIndicator color={theme.background} /> : <Text style={styles.submitText}>{mode === "register" ? "Utwórz konto" : "Zaloguj się"}</Text>}</Pressable>
          <View style={styles.security}><Ionicons name="shield-checkmark-outline" size={17} color={theme.primary} /><Text style={styles.securityText}>Sesja chroniona bezpiecznym cookie HTTP-only. Hasło nie jest zapisywane w aplikacji.</Text></View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.segment, active && styles.segmentActive]}><Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text></Pressable>; }

type FieldProps = ComponentProps<typeof TextInput> & { label: string };
function Field({ label, ...props }: FieldProps) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor={theme.muted} selectionColor={theme.primary} maxLength={label.includes("Hasło") || label.includes("hasło") ? 128 : 254} style={styles.input} /></View>; }

function Consent({ checked, onPress, label, onLink }: { checked: boolean; onPress: () => void; label: string; onLink: () => void }) { return <View style={styles.consent}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={onPress} style={[styles.checkbox, checked && styles.checkboxActive]}>{checked ? <Ionicons name="checkmark" size={15} color={theme.background} /> : null}</Pressable><Pressable onPress={onLink} style={{ flex: 1 }}><Text style={styles.consentText}>{label}</Text></Pressable></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background }, content: { padding: 18, paddingBottom: 42 },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 19, backgroundColor: "rgba(46,230,166,.07)", borderWidth: 1, borderColor: "rgba(46,230,166,.2)" },
  logo: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary }, logoText: { color: theme.background, fontSize: 30, fontWeight: "900" },
  heroTitle: { color: theme.text, fontSize: 15, fontWeight: "900" }, heroText: { color: theme.muted, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  segmented: { flexDirection: "row", padding: 4, marginTop: 15, borderRadius: 15, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, segment: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11 }, segmentActive: { backgroundColor: theme.primary }, segmentText: { color: theme.muted, fontSize: 11, fontWeight: "900" }, segmentTextActive: { color: theme.background },
  form: { gap: 13, marginTop: 15, padding: 16, borderRadius: 19, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }, nameRow: { flexDirection: "row", gap: 10 }, field: { flex: 1, gap: 6 }, label: { color: theme.text, fontSize: 10.5, fontWeight: "800" }, input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceRaised, fontSize: 13 }, hint: { color: theme.muted, fontSize: 9.5, marginTop: -6 },
  consent: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }, checkbox: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceRaised }, checkboxActive: { backgroundColor: theme.primary, borderColor: theme.primary }, consentText: { color: theme.primarySoft, fontSize: 10.5, lineHeight: 15, textDecorationLine: "underline" },
  error: { color: theme.danger, fontSize: 10.5, lineHeight: 15 }, submit: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: theme.primary }, submitText: { color: theme.background, fontSize: 12, fontWeight: "900" },
  security: { flexDirection: "row", gap: 8, alignItems: "flex-start" }, securityText: { flex: 1, color: theme.muted, fontSize: 9.5, lineHeight: 14 },
});
