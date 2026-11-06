// Optional: the user's position is only used on request — to suggest their wilaya, or to sort a search from the
// nearest — and is never stored by GoFix (the API answers and forgets the coordinates).
import * as Location from "expo-location";
import { errorCode } from "@/api/client";
import { publicService } from "@/api/services";

/** Returns { lat, lng } or { error: "location_denied" | "location_unavailable" }. `precise` keeps ~10 m (provider's base point),
 * otherwise the position is rounded to ~1 km before it leaves the phone. */
export async function getPosition({ precise = false } = {}) {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { error: "location_denied" };
    const pos = precise
      ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      : (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const digits = precise ? 4 : 2;
    return { lat: Number(pos.coords.latitude.toFixed(digits)), lng: Number(pos.coords.longitude.toFixed(digits)) };
  } catch {
    return { error: "location_unavailable" };
  }
}

/** Returns { wilaya } ({ code, name_fr, name_ar, distance_km }) or { error: "location_denied" | "outside_algeria" | ... }. */
export async function detectWilaya() {
  const pos = await getPosition();
  if (pos.error) return pos;
  try {
    return { wilaya: await publicService.locate(pos.lat, pos.lng) };
  } catch (err) {
    return { error: err?.response ? errorCode(err) : "location_unavailable" };
  }
}
