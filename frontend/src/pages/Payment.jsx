import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, CreditCard, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { useI18n } from "@/i18n";
import { errorCode, formatDA, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";
import { BACKEND, billingService } from "@/services/marketplaceService";

// Development "hosted payment page": records the gateway outcome, then goes through the real server callback.
export function PaymentMock() {
  const { t, te } = useI18n();
  const [sp] = useSearchParams();
  const gid = sp.get("orderId");
  const [busy, setBusy] = useState(null);
  const { data: order, isLoading, error } = useQuery({ queryKey: ["mock-order", gid], queryFn: () => billingService.mockOrder(gid), enabled: Boolean(gid) });

  const choose = async (outcome) => {
    setBusy(outcome);
    try {
      await billingService.simulate(gid, outcome);
      window.location.assign(`${BACKEND}/api/v1/billing/callback/mock?orderId=${encodeURIComponent(gid)}`);
    } catch (err) {
      toast.error(te(errorCode(err)));
      setBusy(null);
    }
  };

  if (isLoading) return <PageSkeleton />;
  if (error || !order) return <div className={`${ui.container} py-16 text-center`}><p className="font-bold">{t("notFound.title")}</p></div>;
  return (
    <div className={`${ui.container} max-w-md py-10`} data-testid="payment-mock">
      <div className="gf-card p-6 text-center">
        <CreditCard size={36} className="mx-auto text-brand-electric" />
        <h1 className="mt-3 text-xl font-extrabold">{t("payment.mockTitle")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("payment.mockText")}</p>
        <p className="mt-5 text-sm">{order.plan_name}</p>
        <p className="text-3xl font-extrabold">{formatDA(order.amount_da)}</p>
        <p className="text-xs text-muted-foreground">{t("payment.order", { n: order.order_number })}</p>
        <div className="mt-6 grid gap-2">
          <button type="button" onClick={() => choose("paid")} disabled={Boolean(busy)} className={ui.btnGradient} data-testid="mock-pay-success">{busy === "paid" && <Loader2 size={18} className="animate-spin" />}{t("payment.success")}</button>
          <button type="button" onClick={() => choose("failed")} disabled={Boolean(busy)} className={ui.btnOutline} data-testid="mock-pay-fail">{t("payment.fail")}</button>
          <button type="button" onClick={() => choose("cancelled")} disabled={Boolean(busy)} className={ui.btnGhost} data-testid="mock-pay-cancel">{t("payment.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

const ICON = { paid: CheckCircle2, failed: XCircle, cancelled: XCircle, expired: Clock, pending: Clock, processing: Loader2 };
const COLOR = { paid: "var(--brand-electric)", failed: "hsl(var(--destructive))", cancelled: "hsl(var(--destructive))" };

// Return page: ALWAYS asks the server to confirm (the server re-checks the gateway); never trusts the URL.
export function PaymentResult() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const number = sp.get("order");
  const [tries, setTries] = useState(0);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["order-confirm", number], queryFn: () => billingService.confirm(number), enabled: Boolean(number), retry: 2 });
  const status = data?.status;

  useEffect(() => {
    if ((status === "pending" || status === "processing") && tries < 5) {
      const id = setTimeout(() => { setTries((n) => n + 1); refetch(); }, 3000);
      return () => clearTimeout(id);
    }
    if (status === "paid") {
      qc.invalidateQueries({ queryKey: ["billing-me"] });
      qc.invalidateQueries({ queryKey: ["provider-me"] });
    }
    return undefined;
  }, [status, tries, refetch, qc]);

  if (isLoading || !data) {
    return <div className={`${ui.container} max-w-md py-16 text-center`} data-testid="payment-checking"><Loader2 size={36} className="mx-auto animate-spin text-brand-electric" /><p className="mt-4">{t("payment.processing")}</p></div>;
  }
  const Icon = ICON[status] || Clock;
  return (
    <div className={`${ui.container} max-w-md py-12 text-center`} data-testid="payment-result">
      <Icon size={56} className={`mx-auto ${status === "processing" ? "animate-spin" : ""}`} style={{ color: COLOR[status] || "var(--brand-orange)" }} />
      <h1 className="mt-4 text-2xl font-extrabold" data-testid="payment-status">{t(`payment.status.${status}`)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {status === "paid" && data.subscription ? t("payment.paidText", { plan: data.plan_name, date: formatDate(data.subscription.ends_at) }) : t(`payment.text.${status}`)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{t("payment.order", { n: data.order_number })} · {formatDA(data.amount_da)}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {status === "paid" ? (
          <>
            <Link to={data.audience === "professional" ? "/dashboard" : "/search"} className={ui.btnGradient} data-testid="payment-continue">{t("payment.continue")}</Link>
            <Link to="/account/billing" className={ui.btnOutline}>{t("billing.title")}</Link>
          </>
        ) : (
          <Link to="/pricing" className={ui.btnGradient} data-testid="payment-retry">{t("payment.retry")}</Link>
        )}
      </div>
    </div>
  );
}
