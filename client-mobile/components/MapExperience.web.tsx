import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { DevicePosition, HeatCell } from "@/lib/types";
import { heatColor } from "@/lib/map";

type Props = {
  cells: HeatCell[];
  position: DevicePosition | null;
};

const BOUNDS = { north: 50.12, south: 49.98, west: 19.72, east: 20.09 };

function placement(lat: number, lng: number) {
  return {
    left: `${((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100}%` as `${number}%`,
    top: `${((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100}%` as `${number}%`,
  };
}

export function MapExperience({ cells, position }: Props) {
  const visibleCells = useMemo(
    () => [...cells].sort((a, b) => b.score - a.score).slice(0, 120),
    [cells],
  );
  const center = position ?? { lat: 50.0647, lng: 19.945, accuracy: 100 };
  const source =
    "https://www.openstreetmap.org/export/embed.html?bbox=19.72%2C49.98%2C20.09%2C50.12&layer=mapnik";

  return (
    <View style={styles.shell}>
      <iframe
        title="Kraków demand map"
        src={source}
        loading="eager"
        referrerPolicy="no-referrer"
        tabIndex={-1}
        style={styles.frame as React.CSSProperties}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {visibleCells.map((cell) => {
          const color = heatColor(cell.score);
          return (
            <View
              key={cell.id}
              style={[
                styles.hex,
                placement(cell.lat, cell.lng),
                {
                  backgroundColor: color.web,
                  boxShadow: cell.score >= 75 ? `0 0 14px ${color.stroke}` : undefined,
                } as never,
              ]}
            />
          );
        })}
        <View style={[styles.locationPulse, placement(center.lat, center.lng)]} />
        <View style={[styles.locationCore, placement(center.lat, center.lng)]} />
      </View>
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
  frame: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: 0,
    filter: "saturate(.72) contrast(1.04)",
    pointerEvents: "none",
  } as never,
  hex: {
    position: "absolute",
    width: 26,
    height: 30,
    marginLeft: -13,
    marginTop: -15,
    opacity: 0.8,
    clipPath: "polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0 50%)",
  } as never,
  locationPulse: {
    position: "absolute",
    width: 42,
    height: 42,
    marginLeft: -21,
    marginTop: -21,
    borderRadius: 21,
    backgroundColor: "rgba(46,230,166,0.18)",
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.75)",
  },
  locationCore: {
    position: "absolute",
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    backgroundColor: "#2EE6A6",
    borderWidth: 2,
    borderColor: "#07110E",
  },
  vignette: {
    position: "absolute",
    inset: 0,
    borderWidth: 1,
    borderColor: "rgba(46,230,166,0.28)",
    backgroundColor: "rgba(10,13,20,0.08)",
  },
});
