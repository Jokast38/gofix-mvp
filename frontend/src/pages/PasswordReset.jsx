import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AuthCard, PasswordInput } from "@/components/auth/AuthParts";
import { Field, FormError } from "@/components/common/PageSkeleton";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";

/** /forgot-password asks for the e-mail; /reset-password?token=… (link from the e-mail) sets the new password. */
export default function PasswordReset() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get("token");
  return (
    <AuthCard title={t(token ? "pwreset.resetTitle" : "pwreset.forgotTitle")} subtitle={t(token ? "pwreset.resetSubtitle" : "pwreset.forgotSubtitle")} testId="password-reset-page">
      {token ? <ResetForm token={token} /> : <ForgotForm />}
      <p className="mt-6 text-sm text-center">
        <Link to="/login" className="inline-block py-3 font-bold underline" data-testid="reset-back-login">{t("pwreset.backToLogin")}</Link>
      </p>
    </AuthCard>
  );
}

function ForgotForm() {
  const { t, te } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/password/forgot", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };
  if (sent) return <p className="rounded-xl bg-secondary p-4 text-sm" role="status" data-testid="forgot-sent">{t("pwreset.sent")}</p>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="forgot-email" label={t("pwreset.email")}>
        <input id="forgot-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={ui.input}
          autoComplete="email" required data-testid="forgot-email-input" />
      </Field>
      <FormError message={error} testId="forgot-error" />
      <button type="submit" disabled={busy || !email.includes("@")} className={`${ui.btnGradient} w-full`} data-testid="forgot-submit">
        {busy ? t("common.loading") : t("pwreset.send")}
      </button>
    </form>
  );
}

function ResetForm({ token }) {
  const { t, te } = useI18n();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) return setError(t("pwreset.mismatch"));
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/password/reset", { token, new_password: pw });
      toast.success(t("pwreset.done"));
      navigate("/login", { replace: true });
    } catch (err) {
      setError(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="reset-pw" label={t("pwreset.newPassword")}>
        <PasswordInput id="reset-pw" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" testId="reset-password-input" />
      </Field>
      <Field id="reset-pw2" label={t("pwreset.confirm")}>
        <PasswordInput id="reset-pw2" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" testId="reset-confirm-input" />
      </Field>
      <FormError message={error} testId="reset-error" />
      <button type="submit" disabled={busy || pw.length < 8 || !pw2} className={`${ui.btnGradient} w-full`} data-testid="reset-submit">
        {busy ? t("common.loading") : t("pwreset.save")}
      </button>
    </form>
  );
}
