import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

// GET /api/recommendations
export function useRecommendations() {
  return useQuery({
    queryKey: [api.recommendations.list.path],
    queryFn: async () => {
      const res = await fetch(api.recommendations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch recommendations');
      return api.recommendations.list.responses[200].parse(await res.json());
    },
    refetchInterval: 30000,
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

// POST /api/recommendations/generate
export function useGenerateRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.recommendations.generate.path, {
        method: api.recommendations.generate.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to generate recommendations');
      return api.recommendations.generate.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.recommendations.list.path] }),
  });
}
