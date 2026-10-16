import { BRAND } from "@/assets/brand";
import { useTheme } from "@/hooks/ThemeProvider";

const SIZES = { sm: "h-9", md: "h-11", lg: "h-28" };

// Single brand entry point. Official files go in src/assets/brand/ (see index.js there).
export function Logo({ size = "md", className = "" }) {
  const { theme } = useTheme();
  const src = theme === "light" ? BRAND.logoOnLight : BRAND.logoOnDark;
  return (
    <span className={`inline-flex items-center p-1.5 ${className}`} data-testid="brand-logo">
      <img src={src} alt={BRAND.name} className={`${SIZES[size]} w-auto select-none`} draggable="false" />
    </span>
  );
}
