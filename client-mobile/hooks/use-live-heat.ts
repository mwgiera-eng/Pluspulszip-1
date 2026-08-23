import { useCallback, useEffect, useState } from "react";
import { fetchHeat } from "@/lib/api";
import type { HeatResponse } from "@/lib/types";

export function useLiveHeat(hoursAhead: number, minutesAhead = 0) {
  const [data, setData] = useState<HeatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const next = await fetchHeat(hoursAhead, minutesAhead, signal);
      setData(next);
      setError(null);
    } catch (reason) {
      if (signal?.aborted || (reason instanceof Error && reason.name === "AbortError")) return;
      setError(reason instanceof Error ? reason.message : "Map data is unavailable");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [hoursAhead, minutesAhead]);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    const poll = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        await refresh(controller.signal);
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 30_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refresh]);

  return { data, error, loading, refresh: () => refresh() };
}
