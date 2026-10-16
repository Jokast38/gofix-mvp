import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { errorCode, formatDA, formatDate, formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { billingService, saveBlob } from "@/services/marketplaceService";

export default function Billing() {
  const { t, te } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["billing-me"], queryFn: billingService.me });
  const download = async (number) => {
    try {
      saveBlob(await billingService.invoicePdf(number), `${number}.pdf`);
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };
  if (isLoading) return <div className={`${ui.container} py-10`}><Skeleton className="h-64 rounded-2xl" /></div>;
  const subs = data?.subscriptions || [];
  return (
    <div className={`${ui.container} max-w-3xl py-8 sm:py-12`} data-testid="billing-page">
      <PageHeader title={t("billing.title")} />
      <section className="gf-card p-5" data-testid="billing-current">
        <h2 className="font-extrabold mb-3">{t("billing.current")}</h2>
        {subs.length ? subs.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
            <div>
              <p className="font-bold">{t(`pricing.audiences.${s.audience}`)} · {s.tier === "student_pass" ? t("pricing.studentPass") : s.tier.toUpperCase()}</p>
              <p className="text-xs text-muted-foreground">{t("billing.until", { date: formatDate(s.ends_at) })}</p>
            </div>
            <Link to={`/pricing?audience=${s.audience}`} className={`${ui.btnOutline} min-h-[40px] text-sm`}>{t("pricing.renew")}</Link>
          </div>
        )) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("billing.none")}</p>
            <Link to="/pricing" className={`${ui.btnGradient} min-h-[40px] text-sm`} data-testid="billing-see-plans">{t("billing.seePlans")}</Link>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("pricing.noAutoRenew")}</p>
      </section>

      <section className="gf-card p-5 mt-6" data-testid="billing-invoices">
        <h2 className="font-extrabold mb-3">{t("billing.invoices")}</h2>
        {!data?.invoices?.length ? <p className="text-sm text-muted-foreground">{t("billing.noInvoices")}</p> : (
          <ul className="divide-y divide-border">
            {data.invoices.map((i) => (
              <li key={i.number} className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-3 min-w-0">
                  <Receipt size={18} className="text-brand-electric shrink-0" />
                  <span className="min-w-0"><span className="block font-bold text-sm">{i.number}</span><span className="block text-xs text-muted-foreground truncate">{i.plan_name} · {formatDate(i.paid_at)}</span></span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-bold text-sm whitespace-nowrap">{formatDA(i.amount_da)}</span>
                  <button type="button" onClick={() => download(i.number)} className={ui.btnGhost} aria-label={t("billing.download")} data-testid={`invoice-download-${i.number}`}><Download size={18} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gf-card p-5 mt-6" data-testid="billing-orders">
        <h2 className="font-extrabold mb-3">{t("billing.orders")}</h2>
        {!data?.orders?.length ? <p className="text-sm text-muted-foreground">{t("billing.noOrders")}</p> : (
          <ul className="divide-y divide-border text-sm">
            {data.orders.map((o) => (
              <li key={o.order_number} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0"><span className="block font-semibold">{o.plan_name} · {formatDA(o.amount_da)}</span><span className="block text-xs text-muted-foreground">{o.order_number} · {formatDateTime(o.created_at)}</span></span>
                <span className="text-xs font-bold whitespace-nowrap">{t(`payment.status.${o.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
