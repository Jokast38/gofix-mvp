import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
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

const LANGS = [{ code: "fr", label: "Français", Flag: FlagFR }, { code: "ar", label: "العربية", Flag: FlagDZ }];

/** Language switch with the French and Algerian flags; `labels` shows the language name under each flag. */
export function LanguageFlags({ labels = false, compact = false, onBeforeChange }) {
  const { c } = useTheme();
  const { lang, setLang, t } = useI18n();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("prefs.language")} style={{ flexDirection: "row", gap: compact ? 4 : 10 }}>
      {LANGS.map(({ code, label, Flag }) => {
        const active = lang === code;
        return (
          <Pressable key={code} onPress={() => { if (!active) { onBeforeChange?.(code); setLang(code); } }} accessibilityRole="radio"
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
