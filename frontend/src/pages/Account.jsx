import { useNavigate, Link } from "react-router-dom";
import { BadgeCheck, CalendarClock, ChevronRight, ClipboardList, Heart, LayoutDashboard, LogOut, MessageCircle, Receipt, Shield } from "lucide-react";
import { toast } from "sonner";
import { ModeSwitcher } from "@/components/account/ModeSwitcher";
import { PreferencesForm } from "@/components/account/PreferencesForm";
import { PrivacyActions } from "@/components/account/PrivacyActions";
import { ProviderStatus } from "@/components/account/ProviderStatus";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Avatar } from "@/components/catalog/Cards";
import { GuidedTours } from "@/components/tour/GuidedTours";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { formatPhone } from "@/lib/format";
import { ui } from "@/lib/ui";

function Verified({ ok, label, testId }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${ok ? "text-brand-electric" : "text-muted-foreground"}`} data-testid={testId}>
      <BadgeCheck size={14} strokeWidth={1.5} aria-hidden="true" />{label} · {ok ? t("account.verified") : t("account.notVerified")}
    </span>
  );
}

function QuickLinks() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isProvider = user.roles.includes("professional") || user.roles.includes("teacher");
  const links = [
    ...(isProvider ? [{ to: "/dashboard", icon: LayoutDashboard, key: "dashboard" }] : []),
    { to: "/jobs", icon: CalendarClock, key: "jobs" },
    { to: "/requests", icon: ClipboardList, key: "requests" },
    { to: "/messages", icon: MessageCircle, key: "messages" },
    { to: "/favorites", icon: Heart, key: "favorites" },
    { to: "/account/billing", icon: Receipt, key: "billing" },
  ];
  return (
    <nav className="gf-card mt-6 divide-y divide-border" aria-label={t("account.title")} data-testid="account-links">
      {links.map(({ to, icon: Icon, key }) => (
        <Link key={key} to={to} className="flex items-center gap-3 px-5 min-h-[56px] hover:bg-secondary/60" data-testid={`account-link-${key}`}>
          <Icon size={20} strokeWidth={1.6} className="text-brand-electric" aria-hidden="true" />
          <span className="flex-1 font-semibold">{t(`account.links.${key}`)}</span>
          <ChevronRight size={18} className="text-muted-foreground rtl:rotate-180" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

export default function Account() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    toast.success(t("nav.logout"));
    navigate("/");
  };

  return (
    <div className={`${ui.container} py-8 sm:py-12 max-w-3xl`} data-testid="account-page">
      <PageHeader title={t("account.title")} />
      <section className="gf-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <Avatar photoKey={user.photo_key} thumbKey={user.photo_thumb_key} name={user.full_name} size="h-14 w-14 text-lg" color="var(--brand-electric)" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold truncate" data-testid="account-name">{user.full_name}</h2>
            <p className="text-sm text-muted-foreground truncate" dir="ltr" data-testid="account-email">{user.email}</p>
            {user.phone && <p className="text-sm text-muted-foreground" dir="ltr" data-testid="account-phone">{formatPhone(user.phone)}</p>}
            <div className="mt-2 flex flex-wrap gap-3">
              <Verified ok={user.email_verified} label={t("account.email")} testId="account-email-verified" />
              <Verified ok={user.phone_verified} label={t("account.phone")} testId="account-phone-verified" />
            </div>
          </div>
          <button type="button" onClick={onLogout} className={ui.btnOutline} data-testid="account-logout-button" aria-label={t("nav.logout")}>
            <LogOut size={18} strokeWidth={1.5} /><span className="hidden sm:inline">{t("nav.logout")}</span>
          </button>
        </div>
        {user.admin_role && (
          <Link to="/admin" className={`${ui.btnPrimary} mt-5 w-full sm:w-auto`} data-testid="account-admin-link">
            <Shield size={18} strokeWidth={1.5} />{t("account.adminLink")}
          </Link>
        )}
      </section>
      <QuickLinks />
      <ProviderStatus />
      <ModeSwitcher />
      <PreferencesForm />
      <PrivacyActions />
      <GuidedTours />
    </div>
  );
}
