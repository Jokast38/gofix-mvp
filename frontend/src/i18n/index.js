import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import frBase from "./fr";
import arBase from "./ar";
import frLots from "./fr.lots";
import arLots from "./ar.lots";
import frLots2 from "./fr.lots2";
import arLots2 from "./ar.lots2";
import frLegal from "./fr.legal";
import arLegal from "./ar.legal";

function deepMerge(base, extra) {
  const out = { ...base };
  Object.entries(extra).forEach(([k, v]) => {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" ? deepMerge(base[k], v) : v;
  });
  return out;
}

const fr = [frLots, frLots2, frLegal].reduce(deepMerge, frBase);
const ar = [arLots, arLots2, arLegal].reduce(deepMerge, arBase);

// Add "en" / "tz" here later: { dict, dir, label }.
export const LANGUAGES = {
  fr: { dict: fr, dir: "ltr", label: "Français", short: "FR" },
  ar: { dict: ar, dir: "rtl", label: "العربية", short: "ع" },
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

  const value = useMemo(() => ({ lang, setLang, t, te, dir: LANGUAGES[lang].dir }), [lang, setLang, t, te]);
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
