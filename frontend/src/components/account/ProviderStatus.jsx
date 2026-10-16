import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Rocket, ShieldCheck, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";
import { onboardingService } from "@/services/marketplaceService";

const STYLE = {
  pending: { icon: Clock, color: "var(--brand-orange)" },
  verified: { icon: ShieldCheck, color: "var(--brand-electric)" },
  unverified: { icon: Clock, color: "var(--brand-violet)" },
  rejected: { icon: XCircle, color: "hsl(var(--destructive))" },
};

export function ProviderStatus() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["onboarding-status"], queryFn: onboardingService.status });
  if (!data) return null;
  const kind = data.professional ? "professional" : data.teacher ? "teacher" : null;
  const profile = kind && data[kind];
  const draft = data.drafts?.[0];

  if (!profile) {
    if (user.admin_role) return null;
    return (
      <section className="gf-gradient-border rounded-2xl p-5 mt-6 flex items-center gap-4" data-testid="account-become-provider">
        <span className="grid place-items-center h-12 w-12 rounded-xl bg-brand-pink/15 text-brand-pink shrink-0"><Rocket size={24} strokeWidth={1.6} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{draft ? t("account.resumeDraft") : t("appHome.talentTitle")}</p>
          <p className="text-xs text-muted-foreground">{draft ? t("onboarding.stepOf", { step: draft.step, total: 7 }) : t("appHome.talentText")}</p>
        </div>
        <Link to={draft ? `/pro/join/${draft.kind}` : "/pro/join"} className={`${ui.btnGradient} min-h-[40px] px-4 text-sm`} data-testid="account-provider-cta">{draft ? t("account.resume") : t("account.start")}</Link>
      </section>
    );
  }
  const s = STYLE[profile.verification_status] || STYLE.pending;
  const Icon = s.icon;
  return (
    <section className="gf-card p-5 mt-6" data-testid="account-provider-status">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center h-12 w-12 rounded-xl shrink-0" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 14%, transparent)` }}><Icon size={24} strokeWidth={1.6} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{t(`onboarding.${kind}.title`)} · {profile.display_name}</p>
          <p className="font-extrabold" style={{ color: s.color }} data-testid="account-provider-status-label">{t(`onboarding.status.${profile.verification_status}`)}</p>
          <p className="text-xs text-muted-foreground">{t(`onboarding.statusText.${profile.verification_status}`)}</p>
        </div>
        <Link to="/dashboard" className={`${ui.btnOutline} min-h-[40px] text-sm`} data-testid="account-provider-view">{t("nav.dashboard")}</Link>
      </div>
    </section>
  );
}
