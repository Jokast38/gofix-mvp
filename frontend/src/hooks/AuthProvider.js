import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "@/services/authService";

const AuthContext = createContext(null);

// user: null = checking, false = anonymous, object = authenticated
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!authService.hasSession()) {
      setUser(false);
      return;
    }
    authService.me().then(setUser).catch(() => setUser(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(false);
    window.addEventListener("gofix:logout", onLogout);
    return () => window.removeEventListener("gofix:logout", onLogout);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const u = await authService.login(identifier, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (payload) => {
    const u = await authService.register(payload);
    setUser(u);
    return u;
  }, []);

  const loginWithOtp = useCallback(async (phone, code) => {
    const u = await authService.verifyOtp(phone, code);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(false);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, login, register, loginWithOtp, logout }),
    [user, login, register, loginWithOtp, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
