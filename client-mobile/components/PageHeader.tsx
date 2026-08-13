import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Wróć">
        <Ionicons name="chevron-back" size={21} color={theme.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 18 },
  back: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  title: { color: theme.text, fontSize: 22, fontWeight: "900" },
  subtitle: { color: theme.muted, fontSize: 10, marginTop: 2 },
});
