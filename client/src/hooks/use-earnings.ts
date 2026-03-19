import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useEarnings(enabled = true) {
  return useQuery({
    queryKey: [api.earnings.list.path],
    queryFn: async () => {
      const res = await fetch(api.earnings.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch earnings');
      return api.earnings.list.responses[200].parse(await res.json());
    },
    enabled,
  });
}

export function useEarningsStats(enabled = true) {
  return useQuery({
    queryKey: [api.earnings.stats.path],
    queryFn: async () => {
      const res = await fetch(api.earnings.stats.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return api.earnings.stats.responses[200].parse(await res.json());
    },
    enabled,
  });
}

export function useUploadEarnings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(api.earnings.upload.path, {
        method: api.earnings.upload.method,
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || 'Upload failed');
        }
        throw new Error('Failed to upload CSV');
      }
      return api.earnings.upload.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.earnings.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.earnings.stats.path] });
    },
  });
}
