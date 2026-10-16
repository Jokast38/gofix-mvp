import { NavLink } from "react-router-dom";
import { Heart, House, MessageCircle, Plus, UserRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/AuthProvider";

export function BottomNav() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isProvider = user && (user.roles.includes("professional") || user.roles.includes("teacher"));
  const items = [
    { to: "/", key: "home", icon: House, end: true },
    { to: user ? "/messages" : "/login", key: "messages", icon: MessageCircle },
    { to: !user ? "/login" : isProvider ? "/dashboard" : "/requests?new=1", key: isProvider ? "dashboard" : "publish", icon: Plus, center: true },
    { to: user ? "/favorites" : "/login", key: "favorites", icon: Heart },
    { to: user ? "/account" : "/login", key: user ? "profile" : "login", icon: UserRound },
  ];
  return (
    <nav aria-label={t("nav.main")} data-testid="bottom-nav-mobile"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 gf-glass border-t border-border pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {items.map(({ to, key, icon: Icon, end, center }) => (
          <li key={key}>
            <NavLink to={to} end={end} data-testid={`bottom-nav-${key}`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-[11px] font-semibold transition-colors ${isActive && !center ? "text-brand-electric" : "text-muted-foreground"}`
              }>
              {center ? (
                <span className="grid place-items-center h-11 w-11 -mt-5 rounded-full gf-gradient-bg shadow-[0_0_18px_rgba(255,61,190,0.5)]">
                  <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
                </span>
              ) : (
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
              )}
              <span className="truncate max-w-[70px]">{t(`nav.${key}`)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
