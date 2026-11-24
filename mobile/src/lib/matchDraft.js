// AI MATCH draft, shared by the guided flow (/match) and the entry points that pre-fill it (VOICE, later VISION).
// It lives for the app session only (it survives going to the login screen and back).
export const EMPTY_DRAFT = { category_key: "", description: "", when: "week", wilaya_code: "", commune: "", radius_km: 10, gps: null, selected: [], names: {} };

let draft = { ...EMPTY_DRAFT, step: "service" };

export const matchDraft = {
  get: () => draft,
  set: (next) => { draft = next; return draft; },
  reset: () => { draft = { ...EMPTY_DRAFT, step: "service" }; return draft; },
};
