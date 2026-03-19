import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface NotificationPrefs {
  airportInfo: boolean;
  events: boolean;
  hotZones: boolean;
  relocate: boolean;
  bestEarnings: boolean;
  frequency: string;
}

interface Recommendation {
  id: number;
  action: string;
  reason: string;
  targetZoneId: number | null;
  zoneId: number | null;
  priority: number;
  validFrom: string;
  validUntil: string;
}

const AIRPORT_ZONE_ID = 4;

function classifyRecommendation(rec: Recommendation): (keyof Omit<NotificationPrefs, "frequency">)[] {
  const cats: (keyof Omit<NotificationPrefs, "frequency">)[] = [];
  const r = rec.reason.toUpperCase();

  if (
    r.includes("ARRIVAL WAVE") ||
    r.includes("DEPARTURE SURGE") ||
    r.includes("DEPARTURES") ||
    rec.targetZoneId === AIRPORT_ZONE_ID ||
    rec.zoneId === AIRPORT_ZONE_ID
  ) {
    cats.push("airportInfo");
  }

  if (
    r.includes("TAURON") ||
    r.includes("ICE KRAK") ||
    r.includes("EXPO") ||
    r.includes("CONCERT") ||
    r.includes("EVENT") ||
    r.includes("ARENA")
  ) {
    cats.push("events");
  }

  if (rec.action === "TAKE") {
    cats.push("hotZones");
  }

  if (rec.action === "MOVE") {
    cats.push("relocate");
  }

  if (rec.priority >= 8) {
    cats.push("bestEarnings");
  }

  return cats;
}

function shouldFireByFrequency(
  frequency: string,
  lastFiredAt: number | null
): boolean {
  if (frequency === "off") return false;
  if (frequency === "realtime") return true;
  if (lastFiredAt === null) return true;

  const elapsed = Date.now() - lastFiredAt;
  if (frequency === "hourly") return elapsed >= 60 * 60 * 1000;
  if (frequency === "daily") return elapsed >= 24 * 60 * 60 * 1000;
  return true;
}

function notificationPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return (window as any).Notification.permission as NotificationPermission;
}

function fireNotification(rec: Recommendation) {
  if (notificationPermission() !== "granted") return;

  const title =
    rec.action === "MOVE"
      ? "Move to a better zone"
      : rec.action === "TAKE"
      ? "High demand nearby"
      : "ShiftOptima Alert";

  const body = rec.reason.replace(/\[.*?\]\s*/g, "").slice(0, 120);

  try {
    const NotificationCtor = (window as any).Notification as typeof Notification;
    const n = new NotificationCtor(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      tag: `rec-${rec.id}`,
      requireInteraction: false,
    });

    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Notification API not available
  }
}

export function usePushNotifications() {
  const { user } = useAuth();
  const isApproved = !!(user && user.status === "approved");

  const seenIds = useRef<Set<number>>(new Set());
  const lastFiredAt = useRef<number | null>(null);
  const initialized = useRef(false);

  const { data: prefs } = useQuery<NotificationPrefs>({
    queryKey: ["/api/notification-preferences"],
    enabled: isApproved,
    staleTime: 60_000,
  });

  const { data: recommendations } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
    enabled: isApproved,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const processRecommendations = useCallback(() => {
    if (!recommendations || !prefs) return;
    if (notificationPermission() !== "granted") return;
    if (prefs.frequency === "off") return;

    const canFire = shouldFireByFrequency(prefs.frequency, lastFiredAt.current);
    if (!canFire) return;

    const now = Date.now();
    let fired = false;

    for (const rec of recommendations) {
      if (seenIds.current.has(rec.id)) continue;
      seenIds.current.add(rec.id);

      if (!initialized.current) continue;

      const cats = classifyRecommendation(rec);
      const enabled = cats.some((c) => prefs[c] === true);
      if (!enabled) continue;

      fireNotification(rec);
      fired = true;
      break;
    }

    if (fired) {
      lastFiredAt.current = now;
    }

    initialized.current = true;
  }, [recommendations, prefs]);

  useEffect(() => {
    processRecommendations();
  }, [processRecommendations]);
}
