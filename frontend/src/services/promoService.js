import { api } from "@/lib/api";
import { BACKEND } from "@/services/marketplaceService";

const get = async (url, params) => (await api.get(url, { params })).data;

export const promoService = {
  highlights: () => get("/highlights"),
  banners: (placement) => get("/promos", { placement }),
  // Internal links are opened by the app itself: the click is counted with a separate call (fire and forget).
  countClick: (id) => api.post(`/promos/${id}/click`).catch(() => {}),
  clickUrl: (banner) => `${BACKEND}${banner.click_url}`,
};

export const adminPromoService = {
  banners: () => get("/admin/banners"),
  create: async (body) => (await api.post("/admin/banners", body)).data,
  update: async (id, body) => (await api.put(`/admin/banners/${id}`, body)).data,
  remove: (id) => api.delete(`/admin/banners/${id}`),
  uploadImage: async (id, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post(`/admin/banners/${id}/image`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
};

/** YouTube video id from a watch / youtu.be / shorts / live link (null when not a YouTube link). */
export function youtubeId(url = "") {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const SOCIAL_KEYS = ["facebook", "instagram", "tiktok", "youtube", "linkedin", "x"];
