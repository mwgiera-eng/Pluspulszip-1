import { useCallback, useEffect, useState } from "react";
import { fetchHeat } from "@/lib/api";
import type { HeatResponse } from "@/lib/types";

export function useLiveHeat(hoursAhead: number) {
  const [data, setData] = useState<HeatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading((current) => !data && current);
    try {
      const next = await fetchHeat(hoursAhead, signal);
      setData(next);
      setError(null);
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Map data is unavailable");
    } finally {
      setLoading(false);
    }
  }, [data, hoursAhead]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = setInterval(() => void refresh(), 60_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refresh]);

  return { data, error, loading, refresh: () => refresh() };
}
