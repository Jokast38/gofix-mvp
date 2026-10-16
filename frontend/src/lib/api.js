import axios from "axios";

// Empty = same origin (Nginx or the Render rewrite forwards /api to the backend).
const BASE = `${process.env.REACT_APP_BACKEND_URL || ""}/api/v1`;
const AT = "gofix_at";
const RT = "gofix_rt";

export const tokenStore = {
  get access() {
    return localStorage.getItem(AT);
  },
  get refresh() {
    return localStorage.getItem(RT);
  },
  set({ access_token, refresh_token }) {
    localStorage.setItem(AT, access_token);
    localStorage.setItem(RT, refresh_token);
  },
  clear() {
    localStorage.removeItem(AT);
    localStorage.removeItem(RT);
  },
};

export const api = axios.create({ baseURL: BASE, timeout: 20000 });

api.interceptors.request.use((cfg) => {
  const token = tokenStore.access;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  cfg.headers["Accept-Language"] = document.documentElement.lang || "fr";
  return cfg;
});

let refreshing = null;
const NO_REFRESH = /\/auth\/(login|register|refresh|logout|otp)/;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    if (error.response?.status === 401 && orig && !orig._retry && tokenStore.refresh && !NO_REFRESH.test(orig.url)) {
      orig._retry = true;
      try {
        refreshing =
          refreshing ||
          axios
            .post(`${BASE}/auth/refresh`, { refresh_token: tokenStore.refresh })
            .then((r) => tokenStore.set(r.data))
            .finally(() => {
              refreshing = null;
            });
        await refreshing;
        orig.headers.Authorization = `Bearer ${tokenStore.access}`;
        return api(orig);
      } catch {
        tokenStore.clear();
        window.dispatchEvent(new Event("gofix:logout"));
      }
    }
    return Promise.reject(error);
  },
);
