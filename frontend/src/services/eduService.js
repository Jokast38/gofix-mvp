import { api } from "@/lib/api";

const get = async (url, params) => (await api.get(url, { params })).data;
const post = async (url, body) => (await api.post(url, body)).data;

// EDU AI level tests. Answers stay on the server until an attempt is finished.
export const eduService = {
  catalog: () => get("/edu/catalog"),
  start: (test_key) => post("/edu/attempts", { test_key }),
  finish: (id, answers, token) => post(`/edu/attempts/${id}/finish`, { answers, token }),
  history: () => get("/edu/history"),
  attempt: (id) => get(`/edu/attempts/${id}`),
  // Back office
  items: (params) => get("/admin/edu/items", params),
  setItemStatus: (key, status) => api.patch(`/admin/edu/items/${encodeURIComponent(key)}`, { status }).then((r) => r.data),
  setTestStatus: (test_key, status) => post(`/admin/edu/tests/${encodeURIComponent(test_key)}/status`, { status }),
  import: (items, replace) => post("/admin/edu/import", { items, replace }),
};
