import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BadgePercent, CircleHelp, GraduationCap, LayoutDashboard, LogIn, Mail, Menu, MessageCircle, MonitorPlay, Moon, Rocket, Shield, Sun, UserRound, Wrench, X,
} from "lucide-react";
import { NotificationsBell } from "./NotificationsBell";
import { Logo } from "@/components/brand/Logo";
import { SocialLinks } from "@/components/promo/SocialLinks";
import { PrefsSwitch } from "./PrefsSwitch";
import { useTheme } from "@/hooks/ThemeProvider";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/AuthProvider";
import { useConfig } from "@/hooks/usePublic";
import { ui } from "@/lib/ui";

export function useNavItems() {
  const { flag } = useConfig();
  return [
    { to: "/search", key: "services", icon: Wrench },
    { to: "/academy", key: "academy", icon: GraduationCap },
    ...(flag("remote_courses") ? [{ to: "/academy?format=online", key: "remote", icon: MonitorPlay }] : []),
    { to: "/pricing", key: "pricing", icon: BadgePercent },
    { to: "/pro/join", key: "becomePro", icon: Rocket },
    { to: "/faq", key: "faq", icon: CircleHelp },
  ];
}

// "/academy" and "/academy?format=online" share a path: the query string decides which one is current.
function useIsActive() {
  const { pathname, search } = useLocation();
  return (to) => {
    const [path, query] = to.split("?");
    if (query) return pathname === path && search.includes(query);
    if (path === "/academy") return pathname === path && !search.includes("format=online");
    return pathname === path || pathname.startsWith(`${path}/`);
  };
}

/** Side menu (below 1280 px): every section, the account shortcuts, preferences and social networks. Slides from the end side (RTL aware). */
function MenuDrawer({ items, user, isProvider }) {
  const { t, lang } = useI18n();
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();
  const { pathname, search } = useLocation();
  useEffect(() => setOpen(false), [pathname, search]);
  const rtl = lang === "ar";
  const row = (active) => `flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors ${
    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`;
  const account = user ? [
    { to: "/messages", key: "messages", icon: MessageCircle },
    ...(isProvider ? [{ to: "/dashboard", key: "dashboard", icon: LayoutDashboard }] : []),
    ...(user.admin_role ? [{ to: "/admin", key: "admin", icon: Shield }] : []),
    { to: "/account", key: "account", icon: UserRound },
  ] : [];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button type="button" className={`${ui.btnGhost} xl:hidden`} aria-label={t("nav.menu")} data-testid="header-menu-button"><Menu size={22} strokeWidth={1.6} /></button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content dir={rtl ? "rtl" : "ltr"} data-testid="header-menu"
          className={`fixed inset-y-0 ${rtl ? "left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left" : "right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"}
            z-50 flex w-[86%] max-w-sm flex-col border-border bg-background shadow-2xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out`}>
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <DialogPrimitive.Title asChild><span><Logo /></span></DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{t("nav.main")}</DialogPrimitive.Description>
            <DialogPrimitive.Close className={ui.btnGhost} aria-label={t("nav.closeMenu")} data-testid="header-menu-close"><X size={22} /></DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("nav.explore")}</p>
            <nav aria-label={t("nav.main")}>
              <ul>
                {items.filter((i) => !(i.key === "becomePro" && isProvider)).map(({ to, key, icon: Icon }) => (
                  <li key={key}>
                    <Link to={to} className={row(isActive(to))} aria-current={isActive(to) ? "page" : undefined} data-testid={`menu-${key}`}>
                      <Icon size={20} strokeWidth={1.6} className={key === "becomePro" ? "text-brand-pink" : "text-brand-electric"} aria-hidden="true" />{t(`nav.${key}`)}
                    </Link>
                  </li>
                ))}
                <li><Link to="/contact" className={row(isActive("/contact"))} data-testid="menu-contact"><Mail size={20} strokeWidth={1.6} className="text-brand-electric" aria-hidden="true" />{t("nav.contact")}</Link></li>
              </ul>
            </nav>
            {user ? (
              <>
                <p className="mt-4 px-3 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("nav.mySpace")}</p>
                <ul>
                  {account.map(({ to, key, icon: Icon }) => (
                    <li key={key}>
                      <Link to={to} className={row(isActive(to))} data-testid={`menu-${key}`}>
                        <Icon size={20} strokeWidth={1.6} className="text-brand-orange" aria-hidden="true" />{t(`nav.${key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : user === false ? (
              <div className="mt-4 grid gap-2 px-1">
                <Link to="/register" className={ui.btnPrimary} data-testid="menu-register">{t("nav.register")}</Link>
                <Link to="/login" className={ui.btnOutline} data-testid="menu-login"><LogIn size={18} aria-hidden="true" />{t("nav.login")}</Link>
              </div>
            ) : null}
            <button type="button" onClick={toggleTheme} className={`${row(false)} mt-4 w-full sm:hidden`} data-testid="menu-theme">
              {theme === "dark" ? <Sun size={20} strokeWidth={1.6} className="text-brand-electric" aria-hidden="true" />
                : <Moon size={20} strokeWidth={1.6} className="text-brand-electric" aria-hidden="true" />}
              {t(theme === "dark" ? "prefs.light" : "prefs.dark")}
            </button>
          </div>
          <div className="border-t border-border p-4"><SocialLinks compact /></div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Header() {
  const { t } = useI18n();
  const { user } = useAuth();
  const items = useNavItems();
  const isActive = useIsActive();
  const isProvider = user && (user.roles.includes("professional") || user.roles.includes("teacher"));
  // Inline links (wide screens): "Devenir pro" and FAQ live in the menu / footer, the rest stays on one line.
  const inline = items.filter((i) => !["becomePro", "faq"].includes(i.key));

  return (
    <header className="sticky top-0 z-40 gf-glass border-b border-border" data-testid="site-header">
      <div className={`${ui.container} max-w-7xl flex h-16 items-center justify-between gap-3`}>
        <Link to="/" aria-label="GoFix" className="shrink-0" data-testid="header-logo-link"><Logo /></Link>
        <nav aria-label={t("nav.main")} className="hidden xl:flex items-center gap-1" data-testid="header-nav">
          {inline.map((i) => {
            const active = isActive(i.to);
            return (
              <Link key={i.key} to={i.to} aria-current={active ? "page" : undefined} data-testid={`header-nav-${i.key}`}
                className={`relative whitespace-nowrap px-3 py-2 rounded-full text-sm font-semibold transition-colors ${
                  active ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"}`}>
                {t(`nav.${i.key}`)}
                {active && <span aria-hidden="true" className="absolute inset-x-4 -bottom-[13px] h-0.5 rounded-full gf-gradient-bg" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          {!isProvider && (
            <Link to="/pro/join" className="hidden xl:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full gf-gradient-border px-4 py-2 text-sm font-bold hover:brightness-110"
              data-testid="header-become-pro"><Rocket size={16} className="text-brand-pink" aria-hidden="true" />{t("nav.becomePro")}</Link>
          )}
          <PrefsSwitch />
          {user ? (
            <>
              <Link to="/messages" className={`${ui.btnGhost} hidden sm:inline-flex`} aria-label={t("nav.messages")} data-testid="header-messages-link"><MessageCircle size={20} strokeWidth={1.5} /></Link>
              <NotificationsBell />
              {user.admin_role && (
                <Link to="/admin" className={`${ui.btnGhost} hidden sm:inline-flex`} data-testid="header-admin-link" aria-label={t("nav.admin")} title={t("nav.admin")}>
                  <Shield size={20} strokeWidth={1.5} />
                </Link>
              )}
              {isProvider && <Link to="/dashboard" className={`${ui.btnGhost} hidden xl:inline-flex whitespace-nowrap text-sm`} data-testid="header-dashboard-link">{t("nav.dashboard")}</Link>}
              <Link to="/account" className={`${ui.btnOutline} hidden md:inline-flex px-3 sm:px-4`} aria-label={t("nav.account")} data-testid="header-account-link">
                <UserRound size={18} strokeWidth={1.5} />
                <span className="hidden xl:inline max-w-[110px] truncate">{user.full_name.split(" ")[0]}</span>
              </Link>
            </>
          ) : user === false ? (
            <>
              <Link to="/login" className={`${ui.btnOutline} hidden md:inline-flex whitespace-nowrap`} data-testid="header-login-link">{t("nav.login")}</Link>
              <Link to="/register" className={`${ui.btnPrimary} hidden sm:inline-flex whitespace-nowrap px-4 sm:px-6 text-sm sm:text-base`} data-testid="header-register-link">{t("nav.register")}</Link>
            </>
          ) : null}
          <MenuDrawer items={items} user={user} isProvider={isProvider} />
        </div>
      </div>
    </header>
  );
}
