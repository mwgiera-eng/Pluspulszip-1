import { useEffect, useRef } from "react";
import { useGeolocation } from "./use-geolocation";

const INTERVAL_MS = 60_000;

export function useHeartbeat(enabled: boolean) {
  const { position } = useGeolocation(enabled);
  const positionRef = useRef(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (!enabled) return;

    const send = () => {
      if (document.visibilityState === "hidden") return;
      const pos = positionRef.current;
      fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(pos ? { lat: pos.lat, lng: pos.lng } : {}),
      }).catch(() => {});
    };

    send();
    const id = setInterval(send, INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled]);
}
