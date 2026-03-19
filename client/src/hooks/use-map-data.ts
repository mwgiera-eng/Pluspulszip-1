import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

// GET /api/map-data
export function useMapData() {
  return useQuery({
    queryKey: [api.map.data.path],
    queryFn: async () => {
      const res = await fetch(api.map.data.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch map data');
      return api.map.data.responses[200].parse(await res.json());
    },
    refetchInterval: 30000,
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
