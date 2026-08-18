import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import type { DevicePosition } from "@/lib/types";

type LocationState = "idle" | "requesting" | "active" | "denied" | "unavailable";

export function useDeviceLocation() {
  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [status, setStatus] = useState<LocationState>("idle");
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const mounted = useRef(true);
  const focused = useRef(false);
  const watchGeneration = useRef(0);

  const stopWatching = useCallback(() => {
    watchGeneration.current += 1;
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  const startWatching = useCallback(async () => {
    const generation = watchGeneration.current + 1;
    watchGeneration.current = generation;
    subscription.current?.remove();
    subscription.current = null;
    try {
      const nextSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: 15_000,
        },
        (location) => {
          if (!mounted.current || !focused.current || generation !== watchGeneration.current) return;
          setPosition({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 100,
          });
          setStatus("active");
        },
      );

      if (!mounted.current || !focused.current || generation !== watchGeneration.current) {
        nextSubscription.remove();
        return;
      }
      subscription.current = nextSubscription;
    } catch {
      if (mounted.current && focused.current && generation === watchGeneration.current) {
        setStatus("unavailable");
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      focused.current = false;
      stopWatching();
    };
  }, [stopWatching]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      async function resumeIfAllowed() {
        const generation = watchGeneration.current;
        setStatus("requesting");
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (!mounted.current || !focused.current || generation !== watchGeneration.current) return;
          if (permission.status !== Location.PermissionStatus.GRANTED) {
            setStatus(
              permission.status === Location.PermissionStatus.DENIED ? "denied" : "idle",
            );
            return;
          }
          await startWatching();
        } catch {
          if (mounted.current && focused.current && generation === watchGeneration.current) {
            setStatus("unavailable");
          }
        }
      }
      void resumeIfAllowed();

      return () => {
        focused.current = false;
        stopWatching();
      };
    }, [startWatching, stopWatching]),
  );

  const request = useCallback(async () => {
    const generation = watchGeneration.current;
    setStatus("requesting");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted.current || !focused.current || generation !== watchGeneration.current) return;
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setStatus(permission.status === Location.PermissionStatus.DENIED ? "denied" : "idle");
        return;
      }
      await startWatching();
    } catch {
      if (mounted.current && focused.current && generation === watchGeneration.current) {
        setStatus("unavailable");
      }
    }
  }, [startWatching]);

  return { position, status, request };
}
