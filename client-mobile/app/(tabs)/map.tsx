import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapExperience } from "@/components/MapExperience";
import { useDeviceLocation } from "@/hooks/use-device-location";
import { useLiveHeat } from "@/hooks/use-live-heat";
import { theme } from "@/lib/theme";

export default function MapScreen() {
  const [time, setTime] = useState({ hours: 0, minutes: 0 });
  const { data, error, loading, refresh } = useLiveHeat(time.hours, time.minutes);
  const { position, status, request } = useDeviceLocation();

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.liveDot} />
        <View style={styles.titleGroup}>
          <Text style={styles.title}>Mapa popytu i tras</Text>
          <Text style={styles.meta}>{status === "active" ? "GPS aktywny" : "Siatka Krakowa"} · CARTO / OpenStreetMap</Text>
        </View>
        {status !== "active" ? <Pressable accessibilityRole="button" accessibilityLabel="Użyj mojej lokalizacji na mapie" onPress={() => void request()} disabled={status === "requesting"} style={styles.refresh}>
          {status === "requesting" ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="locate-outline" size={18} color={status === "denied" ? theme.warning : theme.primary} />}
        </Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Odśwież mapę" onPress={refresh} style={styles.refresh}>
          {loading ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="refresh" size={18} color={theme.primary} />}
        </Pressable>
      </View>
      <View style={styles.map}>
        <MapExperience
          cells={data?.cells ?? []}
          position={position}
          hoursAhead={time.hours}
          minutesAhead={time.minutes}
          onTimeChange={(hours, minutes) => setTime({ hours, minutes })}
          heatError={error}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  header: { height: 54, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary },
  titleGroup: { flex: 1 },
  title: { color: theme.text, fontSize: 13, fontWeight: "900" },
  meta: { color: theme.muted, fontSize: 8.5, marginTop: 2 },
  refresh: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border },
  map: { flex: 1 },
});
