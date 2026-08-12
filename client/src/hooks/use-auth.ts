import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

export type SubscriptionInfo = {
  status: "trial" | "active" | "expired" | "cancelled";
  isPremium: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  subscriptionExpiresAt: string | null;
  subscriptionDaysLeft: number | null;
  price: number;
  currency: string;
};

export type AuthUser = User & {
  isPremium?: boolean;
  subscriptionInfo?: SubscriptionInfo;
};

async function fetchUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 2,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/login";
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isPremium: !!user?.isPremium,
    subscriptionInfo: user?.subscriptionInfo || null,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
