import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertPoi } from "@shared/schema";

// GET /api/pois
export function usePois() {
  return useQuery({
    queryKey: [api.pois.list.path],
    queryFn: async () => {
      const res = await fetch(api.pois.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch POIs');
      return api.pois.list.responses[200].parse(await res.json());
    },
  });
}

// POST /api/pois
export function useCreatePoi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPoi) => {
      const res = await fetch(api.pois.create.path, {
        method: api.pois.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to create POI');
      return api.pois.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.pois.list.path] }),
  });
}
