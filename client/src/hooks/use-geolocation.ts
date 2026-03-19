import { useState, useEffect, useCallback, useRef } from "react";

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export type GeoStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";

interface UseGeolocationResult {
  position: GeoPosition | null;
  status: GeoStatus;
  error: string | null;
  requestPermission: () => void;
}

export function useGeolocation(autoStart = true): UseGeolocationResult {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported by this browser");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setStatus("requesting");
    setError(null);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setStatus("active");
        setError(null);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus("denied");
            setError("Location permission denied. Enable it in browser settings.");
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus("unavailable");
            setError("Location unavailable. Check your GPS signal.");
            break;
          case err.TIMEOUT:
            setStatus("error");
            setError("Location request timed out. Retrying...");
            break;
          default:
            setStatus("error");
            setError("Could not determine location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );

    watchIdRef.current = id;
  }, []);

  const requestPermission = useCallback(() => {
    startTracking();
  }, [startTracking]);

  useEffect(() => {
    if (autoStart) {
      startTracking();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [autoStart, startTracking]);

  return { position, status, error, requestPermission };
}
