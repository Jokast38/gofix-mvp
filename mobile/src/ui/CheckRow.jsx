import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { BRAND, useTheme } from "@/theme";
import { Txt } from "./index";

/** Unchecked by default (explicit consent); whole row is the touch target. */
export function CheckRow({ checked, onChange, children, testID }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(checked) }} testID={testID}
      style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: 44, paddingVertical: 6 }}>
      <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: checked ? BRAND.electric : c.muted,
        backgroundColor: checked ? BRAND.electric : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {checked && <Check size={16} color={BRAND.night} strokeWidth={3} />}
      </View>
      <View style={{ flex: 1 }}>{typeof children === "string" ? <Txt variant="small">{children}</Txt> : children}</View>
    </Pressable>
  );
}
