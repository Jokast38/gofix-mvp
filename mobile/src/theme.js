import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { prefs } from "@/api/storage";

// GoFix charter tokens (same values as the web CSS variables). Dark "bleu nuit" is the default theme.
export const BRAND = {
  electric: "#00D1FF", blue: "#18A8E0", pink: "#FF3DBE", orange: "#FF9A00", orangeUi: "#F47C20", violet: "#8A2BFF", night: "#070911",
  gradient: ["#00D1FF", "#FF3DBE", "#FF9A00"], gradientStops: [0, 0.4, 1],
};

const DARK = {
  name: "dark", bg: "#070911", card: "#0F1525", cardAlt: "#161E30", border: "#1F2A3D", input: "#1B2438",
  text: "#F8FAFC", muted: "#A3AFC2", primary: BRAND.blue, onPrimary: "#070911", danger: "#E5484D", onDanger: "#FFFFFF", overlay: "rgba(0,0,0,0.6)",
};
const LIGHT = {
  name: "light", bg: "#F3F6FB", card: "#FFFFFF", cardAlt: "#EDF1F7", border: "#D7DEE8", input: "#C9D2DF",
  text: "#0F172A", muted: "#475569", primary: "#0E7AA6", onPrimary: "#FFFFFF", danger: "#C62828", onDanger: "#FFFFFF", overlay: "rgba(15,23,42,0.45)",
};

export const NEON = [BRAND.electric, BRAND.pink, BRAND.orange, BRAND.violet];
export const neonFor = (i) => NEON[i % NEON.length];
export const RADIUS = 14;
export const TAP = 48; // minimum touch target

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [choice, setChoice] = useState("dark");
  useEffect(() => { prefs.get("gofix_theme").then((v) => v && setChoice(v)); }, []);
  const value = useMemo(() => {
    const name = choice === "system" ? (system || "dark") : choice;
    return { c: name === "light" ? LIGHT : DARK, name, setTheme: (v) => { setChoice(v); prefs.set("gofix_theme", v); } };
  }, [choice, system]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// Alpha helper for hex colors: alpha("#00D1FF", 0.15)
export function alpha(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
