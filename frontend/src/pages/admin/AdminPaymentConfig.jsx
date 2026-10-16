import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, FlaskConical, Info, Lock, PlugZap, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/publicService";
import { useI18n } from "@/i18n";
import { errorCode, formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";

const toForm = (v) => ({
  provider: v.provider === "satim" ? "satim" : "mock",
  environment: v.satim.environment || "test",
  base_url: v.satim.base_url || "",
  username: v.satim.username || "",
  terminal_id: v.satim.terminal_id || "",
  password: "",
});

function ProviderCard({ value, current, onSelect, icon: Icon, title, text, disabled, testId }) {
  const active = current === value;
  return (
    <button type="button" onClick={() => onSelect(value)} disabled={disabled} aria-pressed={active} data-testid={testId}
      className={`gf-card w-full p-4 text-start transition-colors disabled:opacity-50 ${active ? "ring-2 ring-primary" : ""}`}>
      <span className="flex items-center gap-2 font-bold"><Icon size={18} aria-hidden="true" />{title}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
    </button>
  );
}

/** Super-admin: payment gateway in force (SATIM CIB / Edahabia, or the test gateway outside production). */
export function AdminPaymentConfig() {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-payment-config"], queryFn: adminService.paymentConfig });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState(null);

  useEffect(() => { if (data) setForm(toForm(data)); }, [data]);
  if (isLoading || !form) return <Skeleton className="h-64 rounded-xl" />;

  const saved = toForm(data);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    setTest(null);
    try {
      const { password, provider, ...satim } = form;
      const payload = { provider, satim: { ...satim, ...(password ? { password } : {}) } };
      qc.setQueryData(["admin-payment-config"], await adminService.setPaymentConfig(payload));
      toast.success(t("admin.saved"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setBusy(true);
    try {
      setTest(await adminService.testPaymentConfig());
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-payment-config">
      <div className="gf-card p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" data-testid="paycfg-status">
        <span className="font-bold">{t("paycfg.inForce")} : {t(`paycfg.provider.${data.provider}`)}</span>
        {data.provider === "satim" && !data.complete && <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs font-bold text-destructive">{t("paycfg.incomplete")}</span>}
        {data.provider === "satim" && <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">{t(`paycfg.env.${data.satim.environment}`)}</span>}
        <span className="text-muted-foreground">{t(`paycfg.source.${data.source}`)}</span>
        {data.updated_at && <span className="text-muted-foreground">{t("paycfg.updated", { date: formatDateTime(data.updated_at), by: data.updated_by })}</span>}
      </div>
      {data.password_unreadable && (
        <p className="rounded-xl border border-destructive/50 p-3 text-sm" role="alert">{t("paycfg.unreadable")}</p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">{t("paycfg.providerTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <ProviderCard value="satim" current={form.provider} onSelect={(v) => setForm((f) => ({ ...f, provider: v }))} icon={CreditCard}
            title={t("paycfg.provider.satim")} text={t("paycfg.satimText")} testId="paycfg-provider-satim" />
          <ProviderCard value="mock" current={form.provider} onSelect={(v) => setForm((f) => ({ ...f, provider: v }))} icon={FlaskConical}
            title={t("paycfg.provider.mock")} text={t(data.mock_allowed ? "paycfg.mockText" : "paycfg.mockForbidden")} disabled={!data.mock_allowed} testId="paycfg-provider-mock" />
        </div>
      </section>

      {form.provider === "satim" && (
        <section className="gf-card p-4 md:p-6">
          <h2 className="mb-4 text-lg font-bold">{t("paycfg.satimTitle")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={ui.label} htmlFor="paycfg-env">{t("paycfg.environment")}</label>
              <select id="paycfg-env" value={form.environment} onChange={set("environment")} className={ui.input} data-testid="paycfg-environment">
                <option value="test">{t("paycfg.env.test")}</option>
                <option value="production">{t("paycfg.env.production")}</option>
              </select>
            </div>
            <div>
              <label className={ui.label} htmlFor="paycfg-url">{t("paycfg.baseUrl")}</label>
              <input id="paycfg-url" value={form.base_url} onChange={set("base_url")} dir="ltr" inputMode="url" autoComplete="off" placeholder="https://…/payment/rest"
                className={`${ui.input} font-mono text-sm`} data-testid="paycfg-base-url" />
            </div>
            <div>
              <label className={ui.label} htmlFor="paycfg-user">{t("paycfg.username")}</label>
              <input id="paycfg-user" value={form.username} onChange={set("username")} dir="ltr" autoComplete="off" className={ui.input} data-testid="paycfg-username" />
            </div>
            <div>
              <label className={ui.label} htmlFor="paycfg-pw">{t("paycfg.password")}</label>
              <input id="paycfg-pw" type="password" value={form.password} onChange={set("password")} dir="ltr" autoComplete="new-password"
                placeholder={data.satim.password_set ? t("paycfg.passwordKept") : ""} className={ui.input} data-testid="paycfg-password" />
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Lock size={12} aria-hidden="true" />{t("paycfg.passwordHint")}</p>
            </div>
            <div>
              <label className={ui.label} htmlFor="paycfg-terminal">{t("paycfg.terminal")}</label>
              <input id="paycfg-terminal" value={form.terminal_id} onChange={set("terminal_id")} dir="ltr" autoComplete="off" className={ui.input} data-testid="paycfg-terminal" />
            </div>
            <div>
              <p className={ui.label}>{t("paycfg.callback")}</p>
              <p className="break-all rounded-xl bg-secondary px-3 py-2.5 font-mono text-xs" dir="ltr" data-testid="paycfg-callback">{data.callback_url}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("paycfg.callbackHint")}</p>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={save} disabled={busy || !dirty} className={`${ui.btnPrimary} w-full sm:w-auto`} data-testid="paycfg-save">{t("common.save")}</button>
        {data.provider === "satim" && (
          <button type="button" onClick={runTest} disabled={busy || dirty} className={`${ui.btnOutline} w-full sm:w-auto`} data-testid="paycfg-test">
            <PlugZap size={18} aria-hidden="true" />{t("paycfg.test")}
          </button>
        )}
      </div>
      {dirty && data.provider === "satim" && <p className="text-xs text-muted-foreground">{t("paycfg.saveFirst")}</p>}

      {test && (
        <div className={`gf-card flex gap-3 p-4 text-sm ${test.ok ? "" : "border-destructive/60"}`} role="status" data-testid="paycfg-test-result">
          {test.ok ? <CheckCircle2 className="shrink-0 text-emerald-500" aria-hidden="true" /> : <XCircle className="shrink-0 text-destructive" aria-hidden="true" />}
          <div>
            <p className="font-bold">{t(test.ok ? "paycfg.testOk" : test.reachable ? "paycfg.testRefused" : "paycfg.testUnreachable")}</p>
            {test.error_code != null && <p className="text-muted-foreground" dir="ltr">SATIM {test.error_code}{test.message ? ` · ${test.message}` : ""}</p>}
          </div>
        </div>
      )}

      <p className="flex gap-2 text-xs text-muted-foreground"><Info size={14} className="shrink-0" aria-hidden="true" />{t("paycfg.note")}</p>
    </div>
  );
}
