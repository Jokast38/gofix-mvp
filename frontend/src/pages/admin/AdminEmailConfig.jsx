import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Info, Lock, Mail, MailX, Send, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/publicService";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { errorCode, formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";

const DEFAULT_PORT = { ssl: 465, starttls: 587, none: 25 };

const toForm = (v) => ({
  provider: v.provider === "smtp" ? "smtp" : "console",
  host: v.smtp.host || "",
  port: String(v.smtp.port || 465),
  security: v.smtp.security || "ssl",
  username: v.smtp.username || "",
  from_email: v.smtp.from_email || "",
  from_name: v.smtp.from_name || "GoFix",
  reply_to: v.smtp.reply_to || "",
  password: "",
});

function ModeCard({ value, current, onSelect, icon: Icon, title, text, testId }) {
  const active = current === value;
  return (
    <button type="button" onClick={() => onSelect(value)} aria-pressed={active} data-testid={testId}
      className={`gf-card w-full p-4 text-start transition-colors ${active ? "ring-2 ring-primary" : ""}`}>
      <span className="flex items-center gap-2 font-bold"><Icon size={18} aria-hidden="true" />{title}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
    </button>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label className={ui.label} htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Super-admin: outgoing e-mail (SMTP server, sender and reply-to addresses) + test e-mail. */
export function AdminEmailConfig() {
  const { t, te } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-email-config"], queryFn: adminService.emailConfig });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState(user?.email || "");
  const [test, setTest] = useState(null);

  useEffect(() => { if (data) setForm(toForm(data)); }, [data]);
  if (isLoading || !form) return <Skeleton className="h-64 rounded-xl" />;

  const saved = toForm(data);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setSecurity = (e) => {
    const security = e.target.value;
    // Follow the usual port of the chosen security unless a custom port was typed.
    setForm((f) => ({ ...f, security, port: Object.values(DEFAULT_PORT).map(String).includes(f.port) ? String(DEFAULT_PORT[security]) : f.port }));
  };

  const save = async () => {
    setBusy(true);
    setTest(null);
    try {
      const { password, provider, port, ...smtp } = form;
      const payload = { provider, smtp: { ...smtp, port: Number(port) || 465, ...(password ? { password } : {}) } };
      qc.setQueryData(["admin-email-config"], await adminService.setEmailConfig(payload));
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
      setTest(await adminService.testEmailConfig(testTo));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const select = (v) => setForm((f) => ({ ...f, provider: v }));
  return (
    <div className="space-y-6" data-testid="admin-email-config">
      <div className="gf-card p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" data-testid="mailcfg-status">
        <span className="font-bold">{t("mailcfg.inForce")} : {t(`mailcfg.provider.${data.provider}`)}</span>
        {data.provider === "smtp" && !data.complete && <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs font-bold text-destructive">{t("mailcfg.incomplete")}</span>}
        <span className="text-muted-foreground">{t(`mailcfg.source.${data.source}`)}</span>
        {data.updated_at && <span className="text-muted-foreground">{t("mailcfg.updated", { date: formatDateTime(data.updated_at), by: data.updated_by })}</span>}
      </div>
      {data.password_unreadable && (
        <p className="rounded-xl border border-destructive/50 p-3 text-sm" role="alert">{t("mailcfg.unreadable")}</p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">{t("mailcfg.providerTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <ModeCard value="smtp" current={form.provider} onSelect={select} icon={Mail} title={t("mailcfg.provider.smtp")} text={t("mailcfg.smtpText")} testId="mailcfg-provider-smtp" />
          <ModeCard value="console" current={form.provider} onSelect={select} icon={MailX} title={t("mailcfg.provider.console")} text={t("mailcfg.consoleText")} testId="mailcfg-provider-console" />
        </div>
      </section>

      {form.provider === "smtp" && (
        <>
          <section className="gf-card p-4 md:p-6">
            <h2 className="mb-4 text-lg font-bold">{t("mailcfg.addrTitle")}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="mailcfg-from" label={t("mailcfg.fromEmail")} hint={t("mailcfg.fromEmailHint")}>
                <input id="mailcfg-from" type="email" value={form.from_email} onChange={set("from_email")} dir="ltr" autoComplete="off" placeholder="no-reply@gofix-digital.dz"
                  className={ui.input} data-testid="mailcfg-from-email" />
              </Field>
              <Field id="mailcfg-name" label={t("mailcfg.fromName")}>
                <input id="mailcfg-name" value={form.from_name} onChange={set("from_name")} maxLength={80} autoComplete="off" className={ui.input} data-testid="mailcfg-from-name" />
              </Field>
              <Field id="mailcfg-reply" label={t("mailcfg.replyTo")} hint={t("mailcfg.replyToHint")}>
                <input id="mailcfg-reply" type="email" value={form.reply_to} onChange={set("reply_to")} dir="ltr" autoComplete="off" placeholder="contact@gofix-digital.dz"
                  className={ui.input} data-testid="mailcfg-reply-to" />
              </Field>
            </div>
          </section>

          <section className="gf-card p-4 md:p-6">
            <h2 className="mb-4 text-lg font-bold">{t("mailcfg.serverTitle")}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="mailcfg-host" label={t("mailcfg.host")}>
                <input id="mailcfg-host" value={form.host} onChange={set("host")} dir="ltr" autoComplete="off" placeholder="smtp.…"
                  className={`${ui.input} font-mono text-sm`} data-testid="mailcfg-host" />
              </Field>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field id="mailcfg-security" label={t("mailcfg.security")}>
                  <select id="mailcfg-security" value={form.security} onChange={setSecurity} className={ui.input} data-testid="mailcfg-security">
                    {["ssl", "starttls", "none"].map((k) => <option key={k} value={k}>{t(`mailcfg.sec.${k}`)}</option>)}
                  </select>
                </Field>
                <Field id="mailcfg-port" label={t("mailcfg.port")}>
                  <input id="mailcfg-port" value={form.port} onChange={set("port")} dir="ltr" inputMode="numeric" className={ui.input} data-testid="mailcfg-port" />
                </Field>
              </div>
              <Field id="mailcfg-user" label={t("mailcfg.username")}>
                <input id="mailcfg-user" value={form.username} onChange={set("username")} dir="ltr" autoComplete="off" className={ui.input} data-testid="mailcfg-username" />
              </Field>
              <div>
                <label className={ui.label} htmlFor="mailcfg-pw">{t("mailcfg.password")}</label>
                <input id="mailcfg-pw" type="password" value={form.password} onChange={set("password")} dir="ltr" autoComplete="new-password"
                  placeholder={data.smtp.password_set ? t("mailcfg.passwordKept") : ""} className={ui.input} data-testid="mailcfg-password" />
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Lock size={12} aria-hidden="true" />{t("mailcfg.passwordHint")}</p>
              </div>
            </div>
          </section>
        </>
      )}

      <button type="button" onClick={save} disabled={busy || !dirty} className={`${ui.btnPrimary} w-full sm:w-auto`} data-testid="mailcfg-save">{t("common.save")}</button>

      {data.provider === "smtp" && (
        <section className="gf-card p-4 md:p-6">
          <h2 className="mb-3 text-lg font-bold">{t("mailcfg.testTitle")}</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className={ui.label} htmlFor="mailcfg-test-to">{t("mailcfg.testTo")}</label>
              <input id="mailcfg-test-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} dir="ltr" className={ui.input} data-testid="mailcfg-test-to" />
            </div>
            <button type="button" onClick={runTest} disabled={busy || dirty || !testTo} className={`${ui.btnOutline} w-full sm:w-auto`} data-testid="mailcfg-test">
              <Send size={18} aria-hidden="true" />{t("mailcfg.test")}
            </button>
          </div>
          {dirty && <p className="mt-2 text-xs text-muted-foreground">{t("mailcfg.saveFirst")}</p>}
          {test && (
            <div className={`mt-4 flex gap-3 rounded-xl border p-3 text-sm ${test.ok ? "border-border" : "border-destructive/60"}`} role="status" data-testid="mailcfg-test-result">
              {test.ok ? <CheckCircle2 className="shrink-0 text-emerald-500" aria-hidden="true" /> : <XCircle className="shrink-0 text-destructive" aria-hidden="true" />}
              <div>
                <p className="font-bold">{test.ok ? t("mailcfg.testOk") : t(`mailcfg.stage.${test.stage}`)}</p>
                {test.message && <p className="text-muted-foreground" dir="ltr">SMTP {test.message}</p>}
              </div>
            </div>
          )}
        </section>
      )}

      <p className="flex gap-2 text-xs text-muted-foreground"><Info size={14} className="shrink-0" aria-hidden="true" />{t("mailcfg.note")}</p>
    </div>
  );
}
