// Optional: the browser position is only used, on request, to suggest the user's wilaya (never stored by GoFix).
import { publicService } from "@/services/publicService";
import { errorCode } from "@/lib/format";

/** Returns { wilaya } ({ code, name_fr, name_ar, distance_km }) or { error: code }. */
export function detectWilaya() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: "location_unavailable" });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          resolve({ wilaya: await publicService.locate(coords.latitude, coords.longitude) });
        } catch (err) {
          resolve({ error: errorCode(err) });
        }
      },
      (err) => resolve({ error: err.code === 1 ? "location_denied" : "location_unavailable" }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60_000 },
    );
    return undefined;
  });
}
