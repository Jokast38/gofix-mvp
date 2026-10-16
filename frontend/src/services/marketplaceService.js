import { api } from "@/lib/api";

const get = async (url, params) => (await api.get(url, { params })).data;
const post = async (url, body) => (await api.post(url, body)).data;
const upload = (url, file, fields = {}) => {
  const fd = new FormData();
  fd.append("file", file);
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
};

export const marketplaceService = {
  categories: (params) => get("/taxonomy/categories", params),
  families: () => get("/taxonomy/families"),
  roles: (family_key) => get("/taxonomy/roles", { family_key }),
  specialties: (category_key) => get("/taxonomy/specialties", { category_key }),
  subjects: () => get("/academy/subjects"),
  levels: () => get("/academy/levels"),
  communes: (code) => get(`/geo/wilayas/${code}/communes`),
  pros: (params) => get("/catalog/professionals", params),
  pro: (id) => get(`/catalog/professionals/${id}`),
  teachers: (params) => get("/catalog/teachers", params),
  teacher: (id) => get(`/catalog/teachers/${id}`),
};

export const onboardingService = {
  status: () => get("/onboarding/status"),
  draft: (kind) => get("/onboarding/draft", { kind }),
  saveDraft: (kind, step, data) => api.put("/onboarding/draft", { kind, step, data }),
  deleteDraft: (kind) => api.delete("/onboarding/draft", { params: { kind } }),
  submit: (kind) => api.post("/onboarding/submit", { kind }),
  uploadPhoto: (file) => upload("/onboarding/photo", file),
  uploadCover: (file) => upload("/onboarding/cover", file),
  uploadDocument: (docType, file) => upload("/onboarding/documents", file, { doc_type: docType }),
  requestCategory: (body) => post("/onboarding/category-requests", body),
};

export const providerService = {
  me: () => get("/provider/me"),
  patch: (body) => api.patch("/provider/profile", body).then((r) => r.data),
  uploadMedia: (media, file) => upload(`/provider/media/${media}`, file).then((r) => r.data),
  deleteMedia: (media) => api.delete(`/provider/media/${media}`),
  uploadDocument: (docType, file) => upload("/provider/documents", file, { doc_type: docType }).then((r) => r.data),
  contest: (body) => post("/provider/trust/contest", body),
};

export const requestService = {
  create: (body) => post("/requests", body),
  mine: () => get("/requests/mine"),
  inbox: () => get("/requests/inbox"),
  respond: (id, action, reply = "") => post(`/requests/${id}/respond`, { action, reply }),
  close: (id) => post(`/requests/${id}/close`),
  review: (body) => post("/reviews", body),
  report: (body) => post("/reports", body),
};

export const socialService = {
  favorites: () => get("/favorites"),
  addFavorite: (kind, profile_id) => post("/favorites", { kind, profile_id }),
  removeFavorite: (profile_id) => api.delete(`/favorites/${profile_id}`),
  conversations: () => get("/conversations"),
  conversation: (id) => get(`/conversations/${id}`),
  start: (kind, profile_id, body) => post("/conversations", { kind, profile_id, body }),
  send: (id, body) => post(`/conversations/${id}/messages`, { body }),
  unread: () => get("/conversations/unread-count"),
  notifications: () => get("/notifications"),
  readAll: () => post("/notifications/read-all"),
};

export const billingService = {
  plans: (audience) => get("/billing/plans", { audience }),
  me: () => get("/billing/me"),
  order: (plan_key) => post("/billing/orders", { plan_key }),
  confirm: (number) => post(`/billing/orders/${number}/confirm`),
  mockOrder: (gid) => get(`/billing/mock/${gid}`),
  simulate: (gid, outcome) => post(`/billing/mock/${gid}/simulate`, { outcome }),
  invoicePdf: async (number) => (await api.get(`/billing/invoices/${number}/pdf`, { responseType: "blob" })).data,
};

export const chatbotService = {
  ask: (message, lang) => post("/chatbot/ask", { message, lang }),
  entry: (id, lang) => get(`/chatbot/faq/${id}`, { lang }),
  handoff: (body) => post("/chatbot/handoff", body),
};

export const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
export const fileUrl = (key) => (key ? `${BACKEND}/api/v1/files/public/${key}` : null);

export const adminTaxonomyService = {
  list: (kind) => get(`/admin/taxonomy/${kind}`),
  create: (kind, body) => api.post(`/admin/taxonomy/${kind}`, body),
  patch: (kind, key, body) => api.patch(`/admin/taxonomy/${kind}/${key}`, body),
  remove: (kind, key) => api.delete(`/admin/taxonomy/${kind}/${key}`),
  profiles: (params) => get("/admin/profiles", params),
  verify: (kind, id, status, reason) => api.patch(`/admin/profiles/${kind}/${id}/verification`, { status, reason }),
};

export const adminOpsService = {
  dashboard: () => get("/admin/dashboard"),
  faq: () => get("/admin/faq"),
  createFaq: (body) => post("/admin/faq", body),
  patchFaq: (id, body) => api.patch(`/admin/faq/${id}`, body),
  deleteFaq: (id) => api.delete(`/admin/faq/${id}`),
  unanswered: () => get("/admin/chatbot/unanswered"),
  plans: () => get("/admin/plans"),
  patchPlan: (key, body) => api.patch(`/admin/plans/${key}`, body),
  putMatrix: (plan, body) => api.put(`/admin/unlock-matrix/${plan}`, body),
  reports: (status) => get("/admin/reports", { status }),
  decideReport: (id, body) => api.patch(`/admin/reports/${id}`, body),
  tickets: (status) => get("/admin/tickets", { status }),
  patchTicket: (id, body) => api.patch(`/admin/tickets/${id}`, body),
  contests: (status) => get("/admin/trust/contests", { status }),
  decideContest: (id, body) => api.patch(`/admin/trust/contests/${id}`, body),
  categoryRequests: (status) => get("/admin/category-requests", { status }),
  decideCategory: (id, body) => api.patch(`/admin/category-requests/${id}`, body),
  documentBlob: async (kind, pid, idx) => (await api.get(`/admin/profiles/${kind}/${pid}/documents/${idx}`, { responseType: "blob" })).data,
  decideDocument: (kind, pid, idx, body) => api.patch(`/admin/profiles/${kind}/${pid}/documents/${idx}`, body),
  payments: (params) => get("/admin/payments", params),
};

// Save a Blob as a file (invoices, admin documents).
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const matchService = {
  parse: (text, kind) => post("/match/parse", { text, kind }),
  recommend: (body) => post("/match/recommend", body),
  feedback: (match_result_id, profile_id, action) => post("/match/feedback", { match_result_id, profile_id, action }).catch(() => null),
  explanation: (id, profile_id) => get(`/match/explanations/${id}`, { profile_id }),
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

export const trustService = {
  profile: (kind, id) => get(`/trust/profiles/${kind}/${id}`),
  adminRecompute: (kind, id, reason) => post(`/trust/recompute/${kind}/${id}`, { reason }),
  adminEvent: (kind, id, body) => post(`/trust/events/${kind}/${id}`, body),
};

export const adminDisputeService = {
  list: (status) => get("/admin/disputes", { status }),
  resolve: (id, resolution, note) => api.patch(`/admin/disputes/${id}`, { resolution, note }),
  matchResults: () => get("/admin/match-results"),
};
