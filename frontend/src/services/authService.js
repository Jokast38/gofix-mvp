import { api, tokenStore } from "@/lib/api";

export const authService = {
  async register(payload) {
    const { data } = await api.post("/auth/register", payload);
    tokenStore.set(data);
    return data.user;
  },
  async login(identifier, password) {
    const { data } = await api.post("/auth/login", { identifier, password });
    tokenStore.set(data);
    return data.user;
  },
  async requestOtp(phone) {
    return (await api.post("/auth/otp/request", { phone, purpose: "login" })).data;
  },
  async verifyOtp(phone, code) {
    const { data } = await api.post("/auth/otp/verify", { phone, code, purpose: "login" });
    tokenStore.set(data);
    return data.user;
  },
  async me() {
    return (await api.get("/auth/me")).data;
  },
  async logout() {
    const rt = tokenStore.refresh;
    tokenStore.clear();
    if (rt) await api.post("/auth/logout", { refresh_token: rt }).catch(() => {});
  },
  hasSession: () => Boolean(tokenStore.access || tokenStore.refresh),
};

export const userService = {
  update: async (patch) => (await api.patch("/users/me", patch)).data,
  addRole: async (role) => (await api.post("/users/me/roles", { role })).data,
  setMode: async (mode) => (await api.put("/users/me/mode", { mode })).data,
  exportData: async () => (await api.get("/users/me/export")).data,
  deleteAccount: async (password) => api.delete("/users/me", { data: { password } }),
  uploadPhoto: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post("/users/me/photo", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  deletePhoto: async () => (await api.delete("/users/me/photo")).data,
};
