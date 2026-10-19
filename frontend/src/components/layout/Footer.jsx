import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { SocialLinks } from "@/components/promo/SocialLinks";
import { useTour } from "@/components/tour/TourProvider";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

export function Footer() {
  const { t } = useI18n();
  const { user } = useAuth();
  const tour = useTour();
  const legal = [
    { to: "/legal/mentions", key: "mentions" }, { to: "/legal/cgu", key: "cgu" },
    { to: "/legal/cgv", key: "cgv" }, { to: "/legal/privacy", key: "privacy" },
  ];
  const help = [
    { to: "/faq", label: t("nav.faq"), id: "faq" }, { to: "/contact", label: t("nav.contact"), id: "contact" },
    { to: "/app", label: t("footer.app"), id: "app" },
  ];
  const linkCls = "inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground transition-colors";

  return (
    <footer className="border-t border-border mt-16 mb-16 md:mb-0" data-testid="site-footer">
      <div className={`${ui.container} py-10 grid gap-8 sm:grid-cols-3`}>
        <div>
          <Logo size="md" />
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">{t("footer.tagline")}</p>
          <SocialLinks className="mt-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold mb-2">{t("footer.helpTitle")}</h2>
          <ul>{help.map((l) => <li key={l.id}><Link className={linkCls} to={l.to} data-testid={`footer-link-${l.id}`}>{l.label}</Link></li>)}</ul>
        </div>
        <div>
          <h2 className="text-sm font-bold mb-2">{t("footer.legalTitle")}</h2>
          <ul>
            {legal.map((l) => <li key={l.key}><Link className={linkCls} to={l.to} data-testid={`footer-link-${l.key}`}>{t(`footer.${l.key}`)}</Link></li>)}
            <li>
              <button type="button" className={linkCls} data-testid="footer-tour" onClick={() => tour.start(user ? "navigation" : "welcome")}>{t("tour.footer")}</button>
            </li>
            <li>
              <button type="button" className={linkCls} data-testid="footer-manage-cookies"
                onClick={() => window.dispatchEvent(new Event("gofix:cookies"))}>{t("cookies.manage")}</button>
            </li>
          </ul>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground pb-6">© {new Date().getFullYear()} GoFix – Algérie. {t("footer.rights")}</p>
    </footer>
  );
}
