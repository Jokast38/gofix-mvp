import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

// Tokens: Keychain / Keystore on devices (SecureStore). The web build (used for previews/tests only) falls back to localStorage.
export const secure = {
  get: (k) => (isWeb ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  set: (k, v) => (isWeb ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  del: (k) => (isWeb ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

// Non-sensitive preferences and drafts.
export const prefs = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  del: (k) => AsyncStorage.removeItem(k),
  getJSON: async (k) => {
    try { return JSON.parse((await AsyncStorage.getItem(k)) || "null"); } catch { return null; }
  },
  setJSON: (k, v) => AsyncStorage.setItem(k, JSON.stringify(v)),
};
