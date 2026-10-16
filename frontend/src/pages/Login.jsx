import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthCard, PasswordInput } from "@/components/auth/AuthParts";
import { OtpLogin } from "@/components/auth/OtpLogin";
import { Field, FormError } from "@/components/common/PageSkeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";

export default function Login() {
  const { t, te } = useI18n();
  const { login } = useAuth();
  const { flag } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onDone = (u) => {
    toast.success(t("auth.welcome", { name: u.full_name }));
    navigate(location.state?.from || (u.admin_role ? "/admin" : "/"), { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onDone(await login(identifier.trim(), password));
    } catch (err) {
      setError(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const otpEnabled = flag("auth_phone_otp");
  return (
    <AuthCard title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")} testId="login-page">
      {otpEnabled && (
        <div className="mb-5 grid grid-cols-2 rounded-full bg-secondary p-1" role="tablist">
          {["password", "otp"].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`login-tab-${k}`}
              className={`min-h-[40px] rounded-full text-sm font-bold transition-colors ${tab === k ? "bg-background" : "text-muted-foreground"}`}>
              {t(`auth.${k}Tab`)}
            </button>
          ))}
        </div>
      )}
      {tab === "otp" && otpEnabled ? (
        <OtpLogin onDone={onDone} />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="login-identifier" label={t("auth.identifier")}>
            <input id="login-identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={ui.input}
              placeholder={t("auth.identifierPh")} autoComplete="username" required data-testid="login-identifier-input" />
          </Field>
          <Field id="login-password" label={t("auth.password")}>
            <PasswordInput id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} testId="login-password-input" />
          </Field>
          <div className="text-end -mt-2">
            <Link to="/forgot-password" className="inline-block py-2 text-sm font-semibold text-muted-foreground underline hover:text-foreground" data-testid="login-forgot-link">{t("pwreset.forgotLink")}</Link>
          </div>
          <FormError message={error} testId="login-error" />
          <button type="submit" disabled={busy || !identifier || !password} className={`${ui.btnGradient} w-full`} data-testid="login-submit-button">
            {busy ? t("common.loading") : t("auth.loginBtn")}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm text-center text-muted-foreground">
        {t("auth.noAccount")} <Link to="/register" className="inline-block py-3 font-bold text-foreground underline" data-testid="login-register-link">{t("auth.registerLink")}</Link>
      </p>
    </AuthCard>
  );
}
