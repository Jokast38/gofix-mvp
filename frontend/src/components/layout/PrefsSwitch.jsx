import { Moon, Sun } from "lucide-react";
import { FLAGS } from "@/components/common/Flags";
import { LANGUAGES, useI18n } from "@/i18n";
import { useAuth } from "@/hooks/AuthProvider";
import { useTheme } from "@/hooks/ThemeProvider";
import { ui } from "@/lib/ui";
import { userService } from "@/services/authService";

// Language switch = one flag per language; the active language is highlighted. Logged-in users: the choice is also saved
// on the account, because e-mails, SMS and notifications are written on the server in that language.
export function LanguageFlags() {
  const { lang, setLang, t } = useI18n();
  const { user, setUser } = useAuth();
  const pick = (code) => {
    setLang(code);
    if (user && user.preferred_language !== code) userService.update({ preferred_language: code }).then(setUser).catch(() => {});
  };
  return (
    <div role="group" aria-label={t("prefs.language")} className="flex items-center rounded-full border border-border p-0.5" data-testid="language-switcher">
      {Object.keys(LANGUAGES).map((code) => {
        const Flag = FLAGS[code];
        const active = lang === code;
        return (
          <button key={code} type="button" onClick={() => pick(code)} aria-pressed={active} aria-label={LANGUAGES[code].label} lang={code}
            title={LANGUAGES[code].label} data-testid={`language-${code}`}
            className={`grid place-items-center h-10 w-10 rounded-full transition-[opacity,background-color] ${active ? "bg-secondary opacity-100" : "opacity-45 hover:opacity-80"}`}>
            <Flag className={`h-[18px] w-[27px] rounded-[3px] shadow-sm ${active ? "ring-2 ring-brand-electric ring-offset-1 ring-offset-background" : ""}`} />
          </button>
        );
      })}
    </div>
  );
}

// Phones: the theme toggle moves into the side menu (Header) (header too narrow); the language flags always stay visible.
export function PrefsSwitch() {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  return (
    <div className="flex items-center gap-1">
      <LanguageFlags />
      <button type="button" onClick={toggle} className={`${ui.btnGhost} hidden sm:inline-flex`}
        aria-label={theme === "dark" ? t("prefs.light") : t("prefs.dark")} data-testid="theme-toggle-button">
        {theme === "dark" ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
      </button>
    </div>
  );
}
