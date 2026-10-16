// Algeria = UTC+1 all year (no DST): formatting is done by hand so it never depends on the device's Intl/ICU data.
const OFFSET_MS = 3600 * 1000;
const pad = (n) => String(n).padStart(2, "0");
const algiers = (d) => new Date(new Date(d).getTime() + OFFSET_MS);

export const formatDA = (n) => (n == null ? null : `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} DA`);
export const formatDate = (d) => { if (!d) return ""; const x = algiers(d); return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`; };
export const formatTime = (d) => { if (!d) return ""; const x = algiers(d); return `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`; };
export const formatDateTime = (d) => (d ? `${formatDate(d)} ${formatTime(d)}` : "");
export const dayKey = (d) => { const x = algiers(d || Date.now()); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; };
export const daysAgo = (d) => Math.round((new Date(dayKey()) - new Date(dayKey(d))) / 86_400_000);

/** Build an ISO instant for "YYYY-MM-DD" + "HH:MM" in Algiers time. */
export const algiersISO = (ymd, hm) => new Date(new Date(`${ymd}T${hm}:00Z`).getTime() - OFFSET_MS).toISOString();
export const algiersDays = (n = 14) => Array.from({ length: n }, (_, i) => dayKey(Date.now() + i * 86_400_000));

const DZ_PHONE = /^(?:\+213|00213|0)([567]\d{8})$/;
export const cleanPhone = (v) => (v || "").replace(/[\s\-.()]/g, "");
export const isValidDzPhone = (v) => DZ_PHONE.test(cleanPhone(v));
// Wrapped in Unicode LTR isolates: in the Arabic (RTL) UI the digit groups would otherwise be displayed in reverse order.
export const ltr = (text) => (text ? `\u2066${text}\u2069` : "");
export const formatPhone = (e164) => {
  const m = DZ_PHONE.exec(cleanPhone(e164));
  return ltr(m ? `0${m[1]}`.replace(/(\d{2})(?=\d)/g, "$1 ").trim() : e164 || "");
};
export const isValidPassword = (v) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);
