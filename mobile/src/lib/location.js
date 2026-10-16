// Optional: the user's position is only used, on request, to suggest their wilaya. It is never stored by GoFix:
// the API returns the nearest wilaya and forgets the coordinates.
import * as Location from "expo-location";
import { errorCode } from "@/api/client";
import { publicService } from "@/api/services";

/** Returns { wilaya } ({ code, name_fr, name_ar, distance_km }) or { error: "denied" | "unavailable" | "outside_algeria" | ... }. */
export async function detectWilaya() {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { error: "location_denied" };
    const pos = (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }))
      || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return { wilaya: await publicService.locate(pos.coords.latitude, pos.coords.longitude) };
  } catch (err) {
    return { error: err?.response ? errorCode(err) : "location_unavailable" };
  }
}
