import { api } from "@/lib/api";

const get = async (url, params) => (await api.get(url, { params })).data;

export const publicService = {
  config: () => get("/config"),
  wilayas: () => get("/geo/wilayas"),
  locate: (lat, lng) => get("/geo/locate", { lat, lng }),
  communes: (code) => get(`/geo/wilayas/${code}/communes`),
  families: () => get("/taxonomy/families"),
  faq: (lang) => get("/faq", { lang }),
  cookieConsent: (choice, anonymous_id) => api.post("/consents/cookies", { choice, anonymous_id }),
  contact: (payload) => api.post("/contact", payload),
};

export const adminService = {
  stats: () => get("/admin/stats"),
  users: (params) => get("/admin/users", params),
  setUserStatus: (id, status, reason) => api.patch(`/admin/users/${id}/status`, { status, reason }),
  flags: () => get("/admin/feature-flags"),
  setFlag: (key, enabled) => api.put(`/admin/feature-flags/${key}`, { enabled }),
  settings: () => get("/admin/settings"),
  setSetting: (key, value) => api.put(`/admin/settings/${key}`, { value }),
  auditLogs: (params) => get("/admin/audit-logs", params),
  processingRegister: () => get("/admin/processing-register"),
  paymentConfig: () => get("/admin/payment-config"),
  setPaymentConfig: async (payload) => (await api.put("/admin/payment-config", payload)).data,
  testPaymentConfig: async () => (await api.post("/admin/payment-config/test")).data,
  emailConfig: () => get("/admin/email-config"),
  setEmailConfig: async (payload) => (await api.put("/admin/email-config", payload)).data,
  testEmailConfig: async (to) => (await api.post("/admin/email-config/test", { to })).data,
};
