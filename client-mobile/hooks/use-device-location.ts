import { useEffect, useState } from "react";
import * as Location from "expo-location";
import type { DevicePosition } from "@/lib/types";

type LocationState = "requesting" | "active" | "denied" | "unavailable";

export function useDeviceLocation() {
  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [status, setStatus] = useState<LocationState>("requesting");

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let mounted = true;

    async function start() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          setStatus("denied");
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 50,
            timeInterval: 15_000,
          },
          (location) => {
            if (!mounted) return;
            setPosition({
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              accuracy: location.coords.accuracy ?? 100,
            });
            setStatus("active");
          },
        );
      } catch {
        if (mounted) setStatus("unavailable");
      }
    }

    void start();
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return { position, status };
}
