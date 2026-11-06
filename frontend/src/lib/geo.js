// Optional: the browser position is only used on request — to suggest the user's wilaya, or to sort a search from the
// nearest — and is never stored by GoFix.
import { publicService } from "@/services/publicService";
import { errorCode } from "@/lib/format";

/** Returns { lat, lng } or { error: "location_denied" | "location_unavailable" }. `precise` keeps ~10 m (provider's base point),
 * otherwise the position is rounded to ~1 km before it leaves the browser. */
export function getPosition({ precise = false } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: "location_unavailable" });
    const digits = precise ? 4 : 2;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: Number(coords.latitude.toFixed(digits)), lng: Number(coords.longitude.toFixed(digits)) }),
      (err) => resolve({ error: err.code === 1 ? "location_denied" : "location_unavailable" }),
      { enableHighAccuracy: precise, timeout: 15000, maximumAge: precise ? 0 : 10 * 60_000 },
    );
    return undefined;
  });
}

/** Returns { wilaya } ({ code, name_fr, name_ar, distance_km }) or { error: code }. */
export async function detectWilaya() {
  const pos = await getPosition();
  if (pos.error) return pos;
  try {
    return { wilaya: await publicService.locate(pos.lat, pos.lng) };
  } catch (err) {
    return { error: errorCode(err) };
  }
}
