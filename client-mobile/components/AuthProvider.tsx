import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  fetchCurrentUser,
  loginWithPassword,
  logoutCurrentUser,
  registerWithPassword,
  sendHeartbeat,
  type AuthUser,
  type RegisterInput,
} from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchCurrentUser();
      setUser(next);
      setError(null);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się sprawdzić sesji.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!user || !["approved", "active"].includes(user.status)) return;
    const beat = () => { void sendHeartbeat().catch(() => undefined); };
    beat();
    const timer = setInterval(beat, 60_000);
    return () => clearInterval(timer);
  }, [user?.id, user?.status]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginWithPassword(email, password);
    setUser(result.user);
    setError(null);
    return result.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerWithPassword(input);
    setUser(result.user);
    setError(null);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutCurrentUser(); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading, error, refresh, login, register, logout }), [error, loading, login, logout, refresh, register, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
