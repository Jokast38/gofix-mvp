const TZ = "Africa/Algiers";
const numberFmt = new Intl.NumberFormat("fr-FR");
const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const formatTime = (d) => (d ? timeFmt.format(new Date(d)) : "");
// "YYYY-MM-DD" in Algiers time, to group messages by day.
export const dayKey = (d) => dayKeyFmt.format(d ? new Date(d) : new Date());
// 0 = today, 1 = yesterday, … (Algiers calendar days)
export const daysAgo = (d) => Math.round((new Date(dayKey()) - new Date(dayKey(d))) / 86_400_000);

export const formatDA =(n) => (n == null ? null : `${numberFmt.format(n).replace(/\u202f/g, " ")} DA`);
export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : "");
export const formatDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : "");

const DZ_PHONE = /^(?:\+213|00213|0)([567]\d{8})$/;
export const cleanPhone = (v) => (v || "").replace(/[\s\-.()]/g, "");
export const isValidDzPhone = (v) => DZ_PHONE.test(cleanPhone(v));
export const formatPhone = (e164) => {
  const m = DZ_PHONE.exec(cleanPhone(e164));
  if (!m) return e164 || "";
  const d = `0${m[1]}`;
  return d.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
};

export const isValidPassword = (v) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);

export function errorCode(err) {
  if (!err?.response) return "network";
  const d = err.response.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const msg = d.map((e) => `${(e?.loc || []).join(".")} ${e?.msg || ""}`).join(" ");
    const known = ["phone_invalid", "password_weak"].find((k) => msg.includes(k));
    if (known) return known;
    if (msg.includes("email")) return "email_invalid";
    return "validation";
  }
  return "generic";
}
