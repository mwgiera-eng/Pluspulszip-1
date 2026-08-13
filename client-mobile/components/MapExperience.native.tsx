import { useMemo } from "react";
import MapView, { Circle, Marker, Polygon } from "react-native-maps";
import { StyleSheet, Text, View } from "react-native";
import type { DevicePosition, HeatCell } from "@/lib/types";
import { heatColor, hexCoordinates } from "@/lib/map";
import { theme } from "@/lib/theme";

type Props = {
  cells: HeatCell[];
  position: DevicePosition | null;
};

const mapsEnabled = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_MAPS === "true";

export function MapExperience({ cells, position }: Props) {
  const visibleCells = useMemo(
    () => [...cells].sort((a, b) => b.score - a.score).slice(0, 180),
    [cells],
  );

  const fallbackBounds = useMemo(() => {
    if (!visibleCells.length) return null;

    return visibleCells.reduce(
      (bounds, cell) => ({
        minLat: Math.min(bounds.minLat, cell.lat),
        maxLat: Math.max(bounds.maxLat, cell.lat),
        minLng: Math.min(bounds.minLng, cell.lng),
        maxLng: Math.max(bounds.maxLng, cell.lng),
      }),
      {
        minLat: visibleCells[0]!.lat,
        maxLat: visibleCells[0]!.lat,
        minLng: visibleCells[0]!.lng,
        maxLng: visibleCells[0]!.lng,
      },
    );
  }, [visibleCells]);

  if (!mapsEnabled) {
    const latSpan = Math.max((fallbackBounds?.maxLat ?? 1) - (fallbackBounds?.minLat ?? 0), 0.0001);
    const lngSpan = Math.max((fallbackBounds?.maxLng ?? 1) - (fallbackBounds?.minLng ?? 0), 0.0001);

    return (
      <View style={[styles.shell, styles.fallbackShell]}>
        <View style={styles.fallbackHeader}>
          <Text style={styles.fallbackEyebrow}>KRAKÓW TRAFFIC PULSE</Text>
          <Text style={styles.fallbackTitle}>Live traffic active</Text>
          <Text style={styles.fallbackCopy}>
            Map tiles are temporarily disabled. Traffic intensity remains available without Google Maps.
          </Text>
        </View>

        <View style={styles.signalField}>
          {visibleCells.slice(0, 96).map((cell) => {
            const x = 4 + ((cell.lng - (fallbackBounds?.minLng ?? cell.lng)) / lngSpan) * 92;
            const y = 4 + (1 - (cell.lat - (fallbackBounds?.minLat ?? cell.lat)) / latSpan) * 92;
            const size = Math.max(5, Math.min(14, 5 + cell.score / 12));
            const color = heatColor(cell.score);

            return (
              <View
                key={cell.id}
                style={[
                  styles.signal,
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color.web,
                    borderColor: color.stroke,
                  },
                ]}
              />
            );
          })}
          <View pointerEvents="none" style={styles.gridOverlay} />
        </View>

        <View style={styles.fallbackFooter}>
          <Text style={styles.fallbackStatus}>{visibleCells.length} live traffic cells</Text>
          <Text style={styles.fallbackStatus}>{position ? "GPS active" : "Kraków center"}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: position?.lat ?? 50.0647,
          longitude: position?.lng ?? 19.945,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
        userInterfaceStyle="light"
        showsCompass={false}
        showsMyLocationButton
        showsUserLocation={Boolean(position)}
        toolbarEnabled={false}
      >
        {visibleCells.map((cell) => {
          const color = heatColor(cell.score);
          return (
            <Polygon
              key={cell.id}
              coordinates={hexCoordinates(cell)}
              fillColor={color.fill}
              strokeColor={color.stroke}
              strokeWidth={1}
            />
          );
        })}
        {position ? (
          <>
            <Circle
              center={{ latitude: position.lat, longitude: position.lng }}
              radius={Math.max(position.accuracy, 40)}
              fillColor="rgba(46,230,166,0.10)"
              strokeColor="rgba(46,230,166,0.64)"
              strokeWidth={1}
            />
            <Marker
              coordinate={{ latitude: position.lat, longitude: position.lng }}
              pinColor={theme.primary}
              title="Twoja lokalizacja"
            />
          </>
        ) : null}
      </MapView>
      <View pointerEvents="none" style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#E9EEF3",
  },
  fallbackShell: {
    backgroundColor: theme.background,
    padding: 16,
  },
  fallbackHeader: {
    zIndex: 2,
  },
  fallbackEyebrow: {
    color: theme.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  fallbackTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  fallbackCopy: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
    maxWidth: 360,
  },
  signalField: {
    flex: 1,
    minHeight: 210,
    marginTop: 14,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  signal: {
    position: "absolute",
    borderWidth: 1,
    transform: [{ translateX: -4 }, { translateY: -4 }],
  },
  gridOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.12)",
  },
  fallbackFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  fallbackStatus: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  vignette: {
    position: "absolute",
    inset: 0,
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.28)",
  },
});
