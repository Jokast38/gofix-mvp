import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { errorCode, formatDA, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";
import { billingService } from "@/services/marketplaceService";

const AUDIENCES = ["client", "professional", "student"];

function defaultAudience(user) {
  if (!user) return "client";
  if (user.roles.includes("professional") || user.roles.includes("teacher")) return "professional";
  if (user.roles.includes("student")) return "student";
  return "client";
}

export default function Pricing() {
  const { t, te, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [audience, setAudience] = useState(sp.get("audience") || defaultAudience(user));
  const [busy, setBusy] = useState(null);
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => billingService.plans(), staleTime: 60_000 });
  const billing = useQuery({ queryKey: ["billing-me"], queryFn: billingService.me, enabled: Boolean(user) });
  const items = (plans.data || []).filter((p) => p.audience === audience);
  const activeSubs = billing.data?.subscriptions || [];
  const highlight = sp.get("plan");

  const buy = async (plan) => {
    if (!user) return navigate("/login", { state: { from: `/pricing?audience=${audience}&plan=${plan.key}` } });
    setBusy(plan.key);
    try {
      const order = await billingService.order(plan.key);
      window.location.assign(order.redirect_url);  // hosted payment page (SATIM, or the mock page in dev)
    } catch (err) {
      toast.error(te(errorCode(err)));
      setBusy(null);
    }
  };

  return (
    <div className={`${ui.container} max-w-5xl py-8 sm:py-12`} data-testid="pricing-page">
      <PageHeader eyebrow={t("pricing.eyebrow")} title={t("pricing.title")} subtitle={t("pricing.subtitle")} />
      <div className="flex flex-wrap gap-2 mb-6" role="tablist">
        {AUDIENCES.map((a) => (
          <button key={a} type="button" role="tab" aria-selected={audience === a} onClick={() => setAudience(a)} data-testid={`pricing-audience-${a}`}
            className={`rounded-full border px-4 min-h-[44px] text-sm font-bold ${audience === a ? "border-brand-electric bg-brand-electric/15" : "border-border"}`}>{t(`pricing.audiences.${a}`)}</button>
        ))}
      </div>
      {plans.isLoading ? <Skeleton className="h-64 rounded-2xl" /> : (
        <div className={`grid gap-4 ${items.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {items.map((p) => {
            const active = activeSubs.find((s) => s.plan_key === p.key);
            const featured = p.key === highlight || p.tier === "premium";
            return (
              <article key={p.key} className={`gf-card p-6 flex flex-col ${featured ? "gf-gradient-border" : ""}`} data-testid={`plan-${p.key}`}>
                <h2 className="text-xl font-extrabold">{lang === "ar" ? p.name_ar || p.name_fr : p.name_fr}</h2>
                <p className="mt-3 text-3xl font-extrabold">
                  {p.tier === "free" ? t("pricing.free") : p.price_da ? formatDA(p.price_da) : <span className="text-lg text-muted-foreground">{t("pricing.tbd")}</span>}
                  {p.tier !== "free" && p.price_da ? <span className="text-sm font-semibold text-muted-foreground"> {t("pricing.per", { days: p.duration_days })}</span> : null}
                </p>
                <ul className="mt-4 space-y-2 text-sm flex-1">
                  {(p.perks_fr || []).map((perk) => <li key={perk} className="flex gap-2"><Check size={16} className="text-brand-electric shrink-0 mt-0.5" />{perk}</li>)}
                </ul>
                {active ? (
                  <p className="mt-5 rounded-full border border-brand-electric/50 px-4 py-2.5 text-center text-sm font-bold text-brand-electric" data-testid={`plan-active-${p.key}`}>
                    {t("pricing.activeUntil", { date: formatDate(active.ends_at) })}
                  </p>
                ) : null}
                {p.tier !== "free" && p.price_da ? (
                  <button type="button" onClick={() => buy(p)} disabled={Boolean(busy)} className={`${featured ? ui.btnGradient : ui.btnPrimary} mt-3 w-full`} data-testid={`plan-buy-${p.key}`}>
                    {busy === p.key ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}{active ? t("pricing.renew") : t("pricing.choose")}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      <div className="mt-8 gf-card p-5 flex items-start gap-3 text-sm" data-testid="pricing-secure">
        <ShieldCheck size={22} className="text-brand-electric shrink-0" />
        <div>
          <p className="font-bold">{t("pricing.secure")}</p>
          <p className="text-muted-foreground">{t("pricing.noAutoRenew")} <Link to="/legal/cgv" className="underline">{t("footer.cgv")}</Link></p>
        </div>
      </div>
    </div>
  );
}
