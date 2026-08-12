import { useMemo } from "react";
import MapView, { Circle, Marker, Polygon } from "react-native-maps";
import { StyleSheet, View } from "react-native";
import type { DevicePosition, HeatCell } from "@/lib/types";
import { heatColor, hexCoordinates } from "@/lib/map";
import { theme } from "@/lib/theme";

type Props = {
  cells: HeatCell[];
  position: DevicePosition | null;
};

export function MapExperience({ cells, position }: Props) {
  const visibleCells = useMemo(
    () => [...cells].sort((a, b) => b.score - a.score).slice(0, 180),
    [cells],
  );

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
  vignette: {
    position: "absolute",
    inset: 0,
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.28)",
  },
});
