import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { useI18n } from "@/i18n";
import { publicService } from "@/services/publicService";
import { ui } from "@/lib/ui";

const KEY = "gofix_cookie_consent";
const ANON = "gofix_anon_id";

function anonId() {
  let id = localStorage.getItem(ANON);
  if (!id) {
    id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);
    localStorage.setItem(ANON, id);
  }
  return id;
}

export function CookieBanner() {
  const { t } = useI18n();
  const [open, setOpen] = useState(() => !localStorage.getItem(KEY));

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener("gofix:cookies", reopen);
    return () => window.removeEventListener("gofix:cookies", reopen);
  }, []);

  const decide = (choice) => {
    localStorage.setItem(KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
    setOpen(false);
    publicService.cookieConsent(choice, anonId()).catch(() => {});
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-labelledby="cookie-title" data-testid="cookie-banner"
      className="fixed inset-x-3 bottom-[76px] md:bottom-4 md:inset-x-auto md:end-4 md:max-w-md z-50 gf-card p-4 gf-fade-up">
      <div className="flex gap-3">
        <Cookie size={22} strokeWidth={1.5} className="shrink-0 text-brand-electric" aria-hidden="true" />
        <div>
          <h2 id="cookie-title" className="text-base font-bold">{t("cookies.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("cookies.text")} <Link to="/legal/privacy" className="underline" data-testid="cookie-more-link">{t("cookies.more")}</Link>
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className={ui.btnOutline} onClick={() => decide("refused")} data-testid="cookie-reject-button">{t("cookies.refuse")}</button>
        <button type="button" className={ui.btnOutline} onClick={() => decide("accepted")} data-testid="cookie-accept-button">{t("cookies.accept")}</button>
      </div>
    </div>
  );
}
