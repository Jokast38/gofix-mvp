import { Link, NavLink } from "react-router-dom";
import { MessageCircle, Shield, UserRound } from "lucide-react";
import { NotificationsBell } from "./NotificationsBell";
import { Logo } from "@/components/brand/Logo";
import { PrefsSwitch } from "./PrefsSwitch";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/AuthProvider";
import { useConfig } from "@/hooks/usePublic";
import { ui } from "@/lib/ui";

export function useNavItems() {
  const { flag } = useConfig();
  return [
    { to: "/search", key: "services" },
    { to: "/academy", key: "academy" },
    ...(flag("remote_courses") ? [{ to: "/academy?format=online", key: "remote" }] : []),
    { to: "/pricing", key: "pricing" },
    { to: "/pro/join", key: "becomePro" },
    { to: "/faq", key: "faq" },
  ];
}

export function Header() {
  const { t } = useI18n();
  const { user } = useAuth();
  const items = useNavItems();
  const isProvider = user && (user.roles.includes("professional") || user.roles.includes("teacher"));

  return (
    <header className="sticky top-0 z-40 gf-glass border-b border-border" data-testid="site-header">
      <div className={`${ui.container} flex h-16 items-center justify-between gap-3`}>
        <Link to="/" aria-label="GoFix" data-testid="header-logo-link"><Logo /></Link>
        <nav aria-label={t("nav.main")} className="hidden lg:flex items-center gap-1" data-testid="header-nav">
          {items.filter((i) => !(i.key === "becomePro" && isProvider)).map((i) => (
            <NavLink key={i.key} to={i.to} data-testid={`header-nav-${i.key}`}
              className="px-3 py-2 rounded-full text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              {t(`nav.${i.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <PrefsSwitch />
          {user ? (
            <>
              <Link to="/messages" className={`${ui.btnGhost} hidden sm:inline-flex`} aria-label={t("nav.messages")} data-testid="header-messages-link"><MessageCircle size={20} strokeWidth={1.5} /></Link>
              <NotificationsBell />
              {user.admin_role && (
                <Link to="/admin" className={`${ui.btnGhost} hidden sm:inline-flex`} data-testid="header-admin-link" aria-label={t("nav.admin")}>
                  <Shield size={20} strokeWidth={1.5} />
                </Link>
              )}
              {isProvider && <Link to="/dashboard" className={`${ui.btnGhost} hidden md:inline-flex text-sm`} data-testid="header-dashboard-link">{t("nav.dashboard")}</Link>}
              <Link to="/account" className={ui.btnOutline} data-testid="header-account-link">
                <UserRound size={18} strokeWidth={1.5} />
                <span className="hidden sm:inline max-w-[120px] truncate">{user.full_name}</span>
              </Link>
            </>
          ) : user === false ? (
            <>
              <Link to="/login" className={`${ui.btnOutline} hidden sm:inline-flex`} data-testid="header-login-link">{t("nav.login")}</Link>
              <Link to="/register" className={`${ui.btnPrimary} whitespace-nowrap px-4 sm:px-6 text-sm sm:text-base`} data-testid="header-register-link">{t("nav.register")}</Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
