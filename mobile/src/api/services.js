// Mirrors frontend/src/services: the app uses exactly the same /api/v1 endpoints as the web.
import { Platform } from "react-native";
import { api, BASE, session } from "./client";

// Empty filters are not sent: the API expects them absent (e.g. "wilaya=" is not a number).
const clean = (params) => params && Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null));
const get = async (url, params) => (await api.get(url, { params: clean(params) })).data;
const post = async (url, body) => (await api.post(url, body)).data;
const patch = async (url, body) => (await api.patch(url, body)).data;

// Picked file (ImagePicker / DocumentPicker asset) -> multipart part. Web needs a real Blob.
async function appendFile(fd, asset, fallbackName) {
  const name = asset.fileName || asset.name || fallbackName;
  const type = asset.mimeType || (name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  if (Platform.OS === "web") {
    const blob = asset.file || (await (await fetch(asset.uri)).blob());
    fd.append("file", blob, name);
  } else {
    fd.append("file", { uri: asset.uri, name, type });
  }
}

async function upload(url, asset, fields = {}) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  await appendFile(fd, asset, "upload.jpg");
  return (await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" }, transformRequest: (d) => d })).data;
}

export const authService = {
  login: async (identifier, password) => { const d = await post("/auth/login", { identifier, password }); await session.set(d); return d.user; },
  register: async (body) => { const d = await post("/auth/register", body); await session.set(d); return d.user; },
  requestOtp: (phone) => post("/auth/otp/request", { phone, purpose: "login" }),
  verifyOtp: async (phone, code) => { const d = await post("/auth/otp/verify", { phone, code, purpose: "login" }); await session.set(d); return d.user; },
  forgot: (email) => post("/auth/password/forgot", { email }),
  me: () => get("/auth/me"),
  logout: async () => { try { await api.post("/auth/logout", { refresh_token: session.refresh }); } catch { /* offline */ } await session.clear(); },
};

export const publicService = {
  locate: (lat, lng) => get("/geo/locate", { lat, lng }),
  config: () => get("/config"),
  wilayas: () => get("/geo/wilayas"),
  communes: (code) => get(`/geo/wilayas/${code}/communes`),
  faq: (lang) => get("/faq", { lang }),
  contact: (body) => post("/contact", body),
};

export const promoService = {
  highlights: () => get("/highlights"),
  banners: (placement) => get("/promos", { placement }),
  countClick: (id) => api.post(`/promos/${id}/click`).catch(() => {}),
};

export const catalogService = {
  categories: (params) => get("/taxonomy/categories", params),
  families: () => get("/taxonomy/families"),
  roles: (family_key) => get("/taxonomy/roles", { family_key }),
  specialties: (category_key) => get("/taxonomy/specialties", { category_key }),
  subjects: () => get("/academy/subjects"),
  levels: () => get("/academy/levels"),
  pros: (params) => get("/catalog/professionals", params),
  pro: (id) => get(`/catalog/professionals/${id}`),
  teachers: (params) => get("/catalog/teachers", params),
  teacher: (id) => get(`/catalog/teachers/${id}`),
};

export const matchService = {
  recommend: (body) => post("/match/recommend", body),
  feedback: (match_result_id, profile_id, action) => post("/match/feedback", { match_result_id, profile_id, action }).catch(() => null),
  explanation: (id, profile_id) => get(`/match/explanations/${id}`, { profile_id }),
};

export const userService = {
  update: (body) => patch("/users/me", body),
  addRole: (role) => post("/users/me/roles", { role }),
  setMode: (mode) => api.put("/users/me/mode", { mode }).then((r) => r.data),
  exportData: () => get("/users/me/export"),
  deleteAccount: (password) => api.delete("/users/me", { data: { password } }),
  uploadPhoto: (asset) => upload("/users/me/photo", asset),
  deletePhoto: () => api.delete("/users/me/photo").then((r) => r.data),
  addPushToken: (token, platform) => post("/users/me/push-tokens", { token, platform }),
  removePushToken: (token) => post("/users/me/push-tokens/remove", { token }),
};

export const onboardingService = {
  status: () => get("/onboarding/status"),
  draft: (kind) => get("/onboarding/draft", { kind }),
  saveDraft: (kind, step, data) => api.put("/onboarding/draft", { kind, step, data }),
  submit: (kind) => post("/onboarding/submit", { kind }),
  uploadPhoto: (asset) => upload("/onboarding/photo", asset),
  uploadCover: (asset) => upload("/onboarding/cover", asset),
  uploadDocument: (docType, asset) => upload("/onboarding/documents", asset, { doc_type: docType }),
  requestCategory: (body) => post("/onboarding/category-requests", body),
};

export const providerService = {
  me: () => get("/provider/me"),
  patch: (body) => patch("/provider/profile", body),
  setLocation: (lat, lng) => api.put("/provider/location", { lat, lng }).then((r) => r.data),
  resetLocation: () => api.delete("/provider/location").then((r) => r.data),
  uploadMedia: (media, asset) => upload(`/provider/media/${media}`, asset),
  deleteMedia: (media) => api.delete(`/provider/media/${media}`),
  uploadDocument: (docType, asset) => upload("/provider/documents", asset, { doc_type: docType }),
  contest: (message) => post("/provider/trust/contest", { message }),
};

export const requestService = {
  // key: Idempotency-Key, so a double tap or a retry never creates the request twice.
  create: async (body, key) => (await api.post("/requests", body, key ? { headers: { "Idempotency-Key": key } } : undefined)).data,
  mine: () => get("/requests/mine"),
  inbox: () => get("/requests/inbox"),
  respond: (id, action, reply = "") => post(`/requests/${id}/respond`, { action, reply }),
  report: (body) => post("/reports", body),
};

export const jobService = {
  list: (params) => get("/jobs", params),
  get: (id) => get(`/jobs/${id}`),
  propose: (body) => post("/jobs", body),
  confirm: (id) => post(`/jobs/${id}/confirm`),
  cancel: (id, reason) => post(`/jobs/${id}/cancel`, { reason }),
  complete: (id) => post(`/jobs/${id}/complete`),
  dispute: (id, reason) => post(`/jobs/${id}/dispute`, { reason }),
  review: (id, body) => post(`/jobs/${id}/review`, body),
};

export const socialService = {
  favorites: () => get("/favorites"),
  addFavorite: (kind, profile_id) => post("/favorites", { kind, profile_id }),
  removeFavorite: (profile_id) => api.delete(`/favorites/${profile_id}`),
  conversations: () => get("/conversations"),
  conversation: (id) => get(`/conversations/${id}`),
  start: (kind, profile_id, body) => post("/conversations", { kind, profile_id, body }),
  send: (id, body) => post(`/conversations/${id}/messages`, { body }),
  notifications: () => get("/notifications"),
  readAll: () => post("/notifications/read-all"),
};

export const billingService = {
  plans: () => get("/billing/plans"),
  me: () => get("/billing/me"),
  order: (plan_key) => post("/billing/orders", { plan_key, platform: "mobile" }),
  confirm: (number) => post(`/billing/orders/${number}/confirm`),
  simulate: (gid, outcome) => post(`/billing/mock/${gid}/simulate`, { outcome }),
  mockOrder: (gid) => get(`/billing/mock/${gid}`),
  invoiceUrl: (number) => `${BASE}/billing/invoices/${number}/pdf`,
};

export const chatbotService = {
  ask: (message, lang) => post("/chatbot/ask", { message, lang }),
  entry: (id, lang) => get(`/chatbot/faq/${id}`, { lang }),
  handoff: (body) => post("/chatbot/handoff", body),
};

// EDU AI level tests: answers stay on the server until an attempt is finished.
export const eduService = {
  catalog: () => get("/edu/catalog"),
  start: (test_key) => post("/edu/attempts", { test_key }),
  finish: (id, answers, token) => post(`/edu/attempts/${id}/finish`, { answers, token }),
  history: () => get("/edu/history"),
  attempt: (id) => get(`/edu/attempts/${id}`),
};

// GOFIX PASSPORT: the pro's public page shared by QR code (the QR image comes from the server as a data URI).
export const passportService = {
  me: () => get("/me/passport"),
  update: (body) => patch("/me/passport", body),
  addSkill: (label) => post("/me/passport/skills", { label }),
  removeSkill: async (id) => (await api.delete(`/me/passport/skills/${id}`)).data,
  publish: (published) => post("/me/passport/publish", { published }),
  share: () => post("/me/passport/share"),
  revoke: () => post("/me/passport/share/revoke"),
  history: () => get("/me/passport/history"),
  view: (token) => get(`/passports/${token}`),
};

// GOFIX PRO AI (pro side). Nothing is sent to a client without an explicit "send" call.
export const proAiService = {
  leads: (status) => get("/pro/leads", { status }),
  lead: (id) => get(`/pro/leads/${id}`),
  patchLead: (id, body) => patch(`/pro/leads/${id}`, body),
  quotes: (params) => get("/pro/quotes", params),
  quote: (id) => get(`/pro/quotes/${id}`),
  createQuote: async (body, key) => (await api.post("/pro/quotes", body, { headers: { "Idempotency-Key": key } })).data,
  updateQuote: async (id, body) => (await api.put(`/pro/quotes/${id}`, body)).data,
  deleteQuote: (id) => api.delete(`/pro/quotes/${id}`),
  sendQuote: (id, message = "") => post(`/pro/quotes/${id}/send`, { message }),
  followups: () => get("/pro/followups"),
  scheduleFollowup: (body) => post("/pro/followups", body),
  cancelFollowup: (id) => api.delete(`/pro/followups/${id}`),
  sendFollowup: (body) => post("/pro/followups/send", body),
  appointments: (start, days) => get("/pro/appointments", { start, days }),
  createAppointment: (body) => post("/pro/appointments", body),
  dashboard: (period) => get("/pro/dashboard", { period }),
  draft: (body) => post("/pro/assistant/draft", body),
  settings: () => get("/pro/settings"),
  saveSettings: (body) => patch("/pro/settings", body),
  exportData: () => get("/pro/export"),
  deleteData: async () => (await api.delete("/pro/data")).data,
};

// A quote as received by the client.
export const quoteService = {
  view: (id) => get(`/quotes/${id}`),
  accept: (id) => post(`/quotes/${id}/accept`),
  reject: (id, reason = "") => post(`/quotes/${id}/reject`, { reason }),
  muteFollowups: (cid, muted) => post(`/conversations/${cid}/followups-mute`, { muted }),
};
