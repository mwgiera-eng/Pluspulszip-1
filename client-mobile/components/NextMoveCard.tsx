import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

type Props = {
  score: number;
  onRefresh: () => void;
};

export function NextMoveCard({ score, onRefresh }: Props) {
  return (
    <LinearGradient
      colors={["rgba(18,22,34,0.97)", "rgba(10,13,20,0.96)"]}
      style={styles.card}
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>NEXT MOVE</Text>
          <Text style={styles.title}>Jedź w stronę centrum</Text>
        </View>
        <Text style={styles.score}>{score}%</Text>
      </View>
      <View style={styles.track}>
        <LinearGradient
          colors={[theme.primary, theme.primarySoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progress, { width: `${Math.max(12, score)}%` }]}
        />
      </View>
      <View style={styles.chips}>
        <Text style={styles.chip}>Wydarzenia</Text>
        <Text style={styles.chip}>Pogoda</Text>
        <Text style={styles.chip}>Niska podaż</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.button}>
        <Ionicons name="refresh" size={17} color={theme.background} />
        <Text style={styles.buttonText}>Odśwież sygnały</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.30)",
    padding: 16,
    shadowColor: theme.primary,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  eyebrow: { color: theme.primary, fontSize: 13, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: theme.text, fontSize: 17, fontWeight: "800", marginTop: 4 },
  score: { color: theme.warning, fontSize: 28, lineHeight: 31, fontWeight: "900" },
  track: { height: 7, backgroundColor: theme.surfaceRaised, borderRadius: 8, marginTop: 14, overflow: "hidden" },
  progress: { height: "100%", borderRadius: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  chip: {
    color: theme.text,
    backgroundColor: theme.surfaceRaised,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "700",
  },
  button: {
    marginTop: 13,
    borderRadius: 14,
    backgroundColor: theme.primary,
    minHeight: 44,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: theme.background, fontSize: 14, fontWeight: "900" },
});
