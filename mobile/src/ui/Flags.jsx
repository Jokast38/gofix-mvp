import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { userService } from "@/api/services";
import { useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { alpha, BRAND, useTheme } from "@/theme";
import { Txt } from "./index";

export function FlagFR({ width = 30, height = 20 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 3 2">
      <Path fill="#002654" d="M0 0h1v2H0z" />
      <Path fill="#fff" d="M1 0h1v2H1z" />
      <Path fill="#CE1126" d="M2 0h1v2H2z" />
    </Svg>
  );
}

export function FlagDZ({ width = 30, height = 20 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 900 600">
      <Path fill="#fff" d="M0 0h900v600H0z" />
      <Path fill="#006633" d="M0 0h450v600H0z" />
      <Path fill="#D21034" d="M579.904 225A150 150 0 1 0 579.904 375 120 120 0 1 1 579.904 225M585.676 300 450 255.916 533.853 371.329v-142.658L450 344.084z" />
    </Svg>
  );
}

export function FlagGB({ width = 30, height = 20 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 60 40">
      <Path fill="#012169" d="M0 0h60v40H0z" />
      <Path stroke="#fff" strokeWidth={8} d="M0 0l60 40M60 0L0 40" />
      <Path stroke="#C8102E" strokeWidth={3} d="M0 0l60 40M60 0L0 40" />
      <Path fill="#fff" d="M23 0h14v40H23zM0 13h60v14H0z" />
      <Path fill="#C8102E" d="M26 0h8v40h-8zM0 16h60v8H0z" />
    </Svg>
  );
}

const LANGS = [{ code: "fr", label: "Français", Flag: FlagFR }, { code: "ar", label: "العربية", Flag: FlagDZ }, { code: "en", label: "English", Flag: FlagGB }];

/** Language switch, one flag per language; `labels` shows the language name under each flag. Logged-in users: the choice is also
 * saved on the account, because e-mails, SMS and notifications are written on the server in that language. */
export function LanguageFlags({ labels = false, compact = false, onBeforeChange }) {
  const { c } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { user, setUser } = useAuth();
  const pick = (code) => {
    onBeforeChange?.(code);
    if (user && user.preferred_language !== code) userService.update({ preferred_language: code }).then(setUser).catch(() => {});
    setLang(code);
  };
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("prefs.language")} style={{ flexDirection: "row", gap: compact ? 4 : 10 }}>
      {LANGS.map(({ code, label, Flag }) => {
        const active = lang === code;
        return (
          <Pressable key={code} onPress={() => { if (!active) pick(code); }} accessibilityRole="radio"
            accessibilityState={{ checked: active }} accessibilityLabel={label} testID={`lang-${code}`}
            style={{ alignItems: "center", justifyContent: "center", gap: 4, minWidth: compact ? 44 : 56, minHeight: compact ? 44 : 48, paddingHorizontal: compact ? 6 : 10, paddingVertical: 6, borderRadius: compact ? 12 : 14,
              borderWidth: 2, borderColor: active ? BRAND.electric : c.border, backgroundColor: active ? alpha(BRAND.electric, 0.12) : "transparent", opacity: active ? 1 : 0.55 }}>
            <View style={{ borderRadius: 3, overflow: "hidden" }}>{compact ? <Flag width={26} height={17} /> : <Flag />}</View>
            {labels && <Txt variant="tiny" weight={700}>{label}</Txt>}
          </Pressable>
        );
      })}
    </View>
  );
}
