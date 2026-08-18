import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import type { DevicePosition } from "@/lib/types";

type LocationState = "idle" | "requesting" | "active" | "denied" | "unavailable";

export function useDeviceLocation() {
  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [status, setStatus] = useState<LocationState>("idle");
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const mounted = useRef(true);

  const startWatching = useCallback(async () => {
    subscription.current?.remove();
    subscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50,
        timeInterval: 15_000,
      },
      (location) => {
        if (!mounted.current) return;
        setPosition({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy ?? 100,
        });
        setStatus("active");
      },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    async function resumeIfAllowed() {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!mounted.current || permission.status !== Location.PermissionStatus.GRANTED) return;
        setStatus("requesting");
        await startWatching();
      } catch {
        if (mounted.current) setStatus("unavailable");
      }
    }
    void resumeIfAllowed();
    return () => {
      mounted.current = false;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [startWatching]);

  const request = useCallback(async () => {
    setStatus("requesting");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setStatus("denied");
        return;
      }
      await startWatching();
    } catch {
      if (mounted.current) setStatus("unavailable");
    }
  }, [startWatching]);

  return { position, status, request };
}
