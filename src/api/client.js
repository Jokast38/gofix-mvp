import axios from "axios";
import Constants from "expo-constants";
import { secure } from "./storage";

// Same REST API as the web (/api/v1). Configure per environment:
//   EXPO_PUBLIC_API_URL=https://gofix.dz   (or http://<LAN IP of the server> in development)
export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || "http://localhost").replace(/\/$/, "");
export const BASE = `${API_ORIGIN}/api/v1`;
const AT = "gofix_at";
const RT = "gofix_rt";

let accessToken = null;
let refreshToken = null;
let currentLang = "fr";
const listeners = new Set();

export const session = {
  async load() {
    accessToken = await secure.get(AT);
    refreshToken = await secure.get(RT);
    return Boolean(accessToken);
  },
  async set({ access_token, refresh_token }) {
    accessToken = access_token;
    refreshToken = refresh_token;
    await secure.set(AT, access_token);
    await secure.set(RT, refresh_token);
  },
  async clear() {
    accessToken = refreshToken = null;
    await secure.del(AT);
    await secure.del(RT);
  },
  get access() { return accessToken; },
  get refresh() { return refreshToken; },
  onLogout(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  setLang(l) { currentLang = l; },
};

export const api = axios.create({ baseURL: BASE, timeout: 20000 });

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  cfg.headers["Accept-Language"] = currentLang;
  return cfg;
});

let refreshing = null;
const NO_REFRESH = /\/auth\/(login|register|refresh|logout|otp)/;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    if (error.response?.status === 401 && orig && !orig._retry && refreshToken && !NO_REFRESH.test(orig.url)) {
      orig._retry = true;
      try {
        refreshing = refreshing || axios.post(`${BASE}/auth/refresh`, { refresh_token: refreshToken }).then((r) => session.set(r.data)).finally(() => { refreshing = null; });
        await refreshing;
        orig.headers.Authorization = `Bearer ${accessToken}`;
        return api(orig);
      } catch {
        await session.clear();
        listeners.forEach((fn) => fn());
      }
    }
    return Promise.reject(error);
  },
);

export const fileUrl = (key) => (key ? `${BASE}/files/public/${key}` : null);

export function errorCode(err) {
  if (!err?.response) return "network";
  const d = err.response.data?.detail;
  if (typeof d === "string") return d;
  if (d && typeof d === "object" && d.code) return d.code;
  if (Array.isArray(d)) {
    const msg = d.map((e) => `${(e?.loc || []).join(".")} ${e?.msg || ""}`).join(" ");
    const known = ["phone_invalid", "password_weak"].find((k) => msg.includes(k));
    if (known) return known;
    if (msg.includes("email")) return "email_invalid";
    return "validation";
  }
  return "generic";
}
