// Mobile push notifications: explained to the user first (PushPrompt), then the system permission, then the device
// token is sent to the API, which pushes the same alerts as the in-app notifications (new message, appointment...).
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { userService } from "@/api/services";
import { secure } from "@/api/storage";

const TOKEN_KEY = "gofix_push_token";
const ASKED_KEY = "gofix_push_asked";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Push needs a real phone (not the web preview, not a simulator). */
export const pushSupported = () => Platform.OS !== "web" && Device.isDevice;

export async function pushStatus() {
  if (!pushSupported()) return "unsupported";
  return (await Notifications.getPermissionsAsync()).status; // "granted" | "denied" | "undetermined"
}

export const wasAsked = async () => Boolean(await secure.get(ASKED_KEY));
export const markAsked = () => secure.set(ASKED_KEY, "1");

async function registerToken() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "GoFix", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 120, 200] });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await userService.addPushToken(token, Platform.OS);
  await secure.set(TOKEN_KEY, token);
  return token;
}

/** Asks the system permission (after our own explanation) and registers this device. */
export async function enablePush() {
  if (!pushSupported()) return { status: "unsupported" };
  await markAsked();
  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && canAskAgain) ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return { status, canAskAgain };
  try {
    return { status, token: await registerToken() };
  } catch (err) {
    // Expo Go cannot receive remote pushes on Android, and a production build needs the EAS project id:
    // permission is kept, the token will be registered by a real build.
    return { status, error: String(err?.message || err) };
  }
}

/** Silent refresh at sign-in when the permission was already granted (reinstall, new account on the same phone). */
export async function syncPushToken() {
  if ((await pushStatus()) !== "granted") return;
  try { await registerToken(); } catch { /* see enablePush */ }
}

/** Sign-out: this phone stops receiving the previous account's notifications. */
export async function unregisterPush() {
  const token = await secure.get(TOKEN_KEY);
  if (!token) return;
  try { await userService.removePushToken(token); } catch { /* offline: the server drops dead tokens itself */ }
  await secure.del(TOKEN_KEY);
}

export const openSystemSettings = () => Linking.openSettings();

/** Server links are web paths: map the few that differ in the app. */
export function appRoute(link) {
  if (!link || typeof link !== "string" || !link.startsWith("/")) return "/notifications";
  if (link.startsWith("/account/billing")) return "/billing";
  if (link.startsWith("/admin")) return "/notifications";
  return link;
}

export { Notifications };
