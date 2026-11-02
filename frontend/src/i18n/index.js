import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import frBase from "./fr";
import arBase from "./ar";
import enBase from "./en";
import frLots from "./fr.lots";
import arLots from "./ar.lots";
import enLots from "./en.lots";
import frLots2 from "./fr.lots2";
import arLots2 from "./ar.lots2";
import enLots2 from "./en.lots2";
import frLegal from "./fr.legal";
import arLegal from "./ar.legal";
import enLegal from "./en.legal";

function deepMerge(base, extra) {
  const out = { ...base };
  Object.entries(extra).forEach(([k, v]) => {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" ? deepMerge(base[k], v) : v;
  });
  return out;
}

const fr = [frLots, frLots2, frLegal].reduce(deepMerge, frBase);
const ar = [arLots, arLots2, arLegal].reduce(deepMerge, arBase);
const en = [enLots, enLots2, enLegal].reduce(deepMerge, enBase);

// Add "tz" here later: { dict, dir, label, short, locale }.
export const LANGUAGES = {
  fr: { dict: fr, dir: "ltr", label: "Français", short: "FR", locale: "fr-FR" },
  ar: { dict: ar, dir: "rtl", label: "العربية", short: "ع", locale: "ar-DZ" },
  en: { dict: en, dir: "ltr", label: "English", short: "EN", locale: "en-GB" },
};
const DEFAULT_LANG = "fr";
const KEY = "gofix_lang";

const I18nContext = createContext(null);

function lookup(dict, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(KEY);
    return LANGUAGES[saved] ? saved : DEFAULT_LANG;
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGUAGES[lang].dir;
    localStorage.setItem(KEY, lang);
  }, [lang]);

  const setLang = useCallback((l) => LANGUAGES[l] && setLangState(l), []);

  const t = useCallback(
    (path, vars) => {
      let v = lookup(LANGUAGES[lang].dict, path);
      if (v === undefined) v = lookup(LANGUAGES[DEFAULT_LANG].dict, path);
      if (v === undefined) return path;
      if (typeof v === "string" && vars) {
        return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
      }
      return v;
    },
    [lang],
  );

  const te = useCallback(
    (code) => {
      const v = t(`errors.${code}`);
      return v === `errors.${code}` ? t("errors.generic") : v;
    },
    [t],
  );

  // Description of a feature flag or setting: written in French by the server, translated in the "adminDesc" dictionary.
  const td = useCallback((item) => lookup(LANGUAGES[lang].dict, `adminDesc.${item.key}`) ?? item.description, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, te, td, dir: LANGUAGES[lang].dir }), [lang, setLang, t, te, td]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

// Pick the localized field of an API object: { name_fr, name_ar } -> name in current lang.
export function useLocalized() {
  const { lang } = useI18n();
  return useCallback((obj, field = "name") => obj?.[`${field}_${lang}`] || obj?.[`${field}_fr`] || "", [lang]);
}
