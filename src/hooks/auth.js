import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { session } from "@/api/client";
import { authService, publicService } from "@/api/services";
import { unregisterPush } from "@/lib/push";

const AuthCtx = createContext(null);

// user: null = checking, false = anonymous, object = signed in
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    session.load().then(async (has) => {
      if (!has) return setUser(false);
      try { setUser(await authService.me()); } catch { setUser(false); }
    });
    return session.onLogout(() => { setUser(false); qc.clear(); });
  }, [qc]);

  const login = useCallback(async (id, pw) => { const u = await authService.login(id, pw); setUser(u); qc.clear(); return u; }, [qc]);
  const register = useCallback(async (body) => { const u = await authService.register(body); setUser(u); return u; }, []);
  const loginWithOtp = useCallback(async (phone, code) => { const u = await authService.verifyOtp(phone, code); setUser(u); qc.clear(); return u; }, [qc]);
  const logout = useCallback(async () => { await unregisterPush(); await authService.logout(); setUser(false); qc.clear(); }, [qc]);
  const refresh = useCallback(async () => setUser(await authService.me()), []);

  const value = useMemo(() => ({ user, setUser, login, register, loginWithOtp, logout, refresh }), [user, login, register, loginWithOtp, logout, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
export const isProvider = (u) => Boolean(u && (u.roles.includes("professional") || u.roles.includes("teacher")));

export function useConfig() {
  const { data } = useQuery({ queryKey: ["config"], queryFn: publicService.config, staleTime: 5 * 60_000 });
  const cfg = data || { flags: {}, settings: {} };
  return { ...cfg, flag: (k) => Boolean(cfg.flags?.[k]) };
}

export function useWilayas() {
  return useQuery({ queryKey: ["wilayas"], queryFn: publicService.wilayas, staleTime: Infinity });
}
