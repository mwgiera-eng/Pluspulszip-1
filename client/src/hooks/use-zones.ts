import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertZone } from "@shared/schema";

// GET /api/zones
export function useZones() {
  return useQuery({
    queryKey: [api.zones.list.path],
    queryFn: async () => {
      const res = await fetch(api.zones.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch zones');
      return api.zones.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/zones/:id
export function useZone(id: number) {
  return useQuery({
    queryKey: [api.zones.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.zones.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch zone');
      return api.zones.get.responses[200].parse(await res.json());
    },
  });
}

// POST /api/zones
export function useCreateZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertZone) => {
      const res = await fetch(api.zones.create.path, {
        method: api.zones.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || 'Validation failed');
        }
        throw new Error('Failed to create zone');
      }
      return api.zones.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.zones.list.path] }),
  });
}

// PUT /api/zones/:id
export function useUpdateZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertZone>) => {
      const url = buildUrl(api.zones.update.path, { id });
      const res = await fetch(url, {
        method: api.zones.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to update zone');
      return api.zones.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.zones.list.path] }),
  });
}

// DELETE /api/zones/:id
export function useDeleteZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.zones.delete.path, { id });
      const res = await fetch(url, { method: api.zones.delete.method, credentials: "include" });
      if (!res.ok) throw new Error('Failed to delete zone');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.zones.list.path] }),
  });
}
