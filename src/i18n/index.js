import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, DevSettings, I18nManager, Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { prefs } from "@/api/storage";
import { session } from "@/api/client";
import frBase from "./shared/fr";
import arBase from "./shared/ar";
import frLots from "./shared/fr.lots";
import arLots from "./shared/ar.lots";
import frLots2 from "./shared/fr.lots2";
import arLots2 from "./shared/ar.lots2";
import { mobileAr, mobileFr } from "./mobile";

function deepMerge(base, extra) {
  const out = { ...base };
  Object.entries(extra).forEach(([k, v]) => {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" ? deepMerge(base[k], v) : v;
  });
  return out;
}

const DICTS = {
  fr: [frBase, frLots, frLots2, mobileFr].reduce(deepMerge),
  ar: [arBase, arLots, arLots2, mobileAr].reduce(deepMerge),
};
const KEY = "gofix_lang";
const I18nCtx = createContext(null);

const lookup = (dict, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);

async function applyDirection(lang) {
  const rtl = lang === "ar";
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.dir = rtl ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
    return false;
  }
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return true; // native layout direction changes after a reload
}

// Expo Go (the test app) cannot restart the JS app from code on iOS: the restarted runtime misses Expo's native
// modules ("Cannot find native module 'ExpoAsset'", "runtime not ready"). There, the user reloads by hand.
export const needsManualRestart = Constants.executionEnvironment === "storeClient";

// Native layout direction (RTL) only changes after a restart of the JS app.
// Store builds: expo-updates' reload (the supported way in release). Development builds: React Native's reload.
async function restartApp(lang) {
  if (needsManualRestart) {
    Alert.alert("GoFix", DICTS[lang].mobile.reloadExpoGo);
    return undefined;
  }
  await new Promise((resolve) => setTimeout(resolve, 400)); // let the saved language and the toast settle
  if (__DEV__) return DevSettings.reload();
  try {
    await Updates.reloadAsync();
  } catch {
    // Last resort: the texts are already translated, only the right-to-left layout waits for the next launch.
    const msg = DICTS[lang].mobile.restartManual;
    Alert.alert("GoFix", msg);
  }
  return undefined;
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState("fr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    prefs.get(KEY).then(async (saved) => {
      const l = DICTS[saved] ? saved : "fr";
      setLangState(l);
      session.setLang(l);
      await applyDirection(l);
      setReady(true);
    });
  }, []);

  const setLang = useCallback(async (l) => {
    if (!DICTS[l]) return;
    await prefs.set(KEY, l);
    setLangState(l);
    session.setLang(l);
    if (await applyDirection(l)) await restartApp(l);
  }, []);

  const t = useCallback((path, vars) => {
    let v = lookup(DICTS[lang], path);
    if (v === undefined) v = lookup(DICTS.fr, path);
    if (v === undefined) return path;
    if (typeof v === "string" && vars) return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
    return v;
  }, [lang]);

  const te = useCallback((code) => {
    const v = t(`errors.${code}`);
    return v === `errors.${code}` ? t("errors.generic") : v;
  }, [t]);

  const value = useMemo(() => ({ lang, setLang, t, te, rtl: lang === "ar", ready }), [lang, setLang, t, te, ready]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);

export function useLocalized() {
  const { lang } = useI18n();
  return useCallback((obj, field = "name") => obj?.[`${field}_${lang}`] || obj?.[`${field}_fr`] || "", [lang]);
}
