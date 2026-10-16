import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthCard, PasswordInput } from "@/components/auth/AuthParts";
import { MinorConsent } from "@/components/auth/MinorConsent";
import { Field, FormError } from "@/components/common/PageSkeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/AuthProvider";
import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { errorCode, isValidDzPhone, isValidPassword } from "@/lib/format";
import { ui } from "@/lib/ui";

const TYPES = ["client", "student", "professional", "teacher"];
const INITIAL = { full_name: "", email: "", phone: "", password: "", account_type: "client", birth_year: "",
  guardian_name: "", guardian_phone: "", guardian_consent: false, accept_terms: false, accept_privacy: false };

function validate(f, isMinor) {
  const e = {};
  if (f.full_name.trim().length < 2) e.full_name = "name_short";
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "email_invalid";
  if (!isValidDzPhone(f.phone)) e.phone = "phone_invalid";
  if (!isValidPassword(f.password)) e.password = "password_weak";
  if (isMinor && !(f.guardian_consent && f.guardian_name && isValidDzPhone(f.guardian_phone))) e.guardian = "guardian_consent_required";
  if (!(f.accept_terms && f.accept_privacy)) e.consent = "consent_required";
  return e;
}

export default function Register() {
  const { t, te, lang } = useI18n();
  const { register } = useAuth();
  const { settings } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [f, setF] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const threshold = settings.minor_age_threshold || 18;
  const isMinor = f.account_type === "student" && f.birth_year && new Date().getFullYear() - Number(f.birth_year) < threshold;

  const submit = async (e) => {
    e.preventDefault();
    const v = validate(f, isMinor);
    setErrors(v);
    setError("");
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      const payload = { ...f, preferred_language: lang, birth_year: f.birth_year ? Number(f.birth_year) : null,
        guardian_phone: isMinor ? f.guardian_phone : null, guardian_name: isMinor ? f.guardian_name : null };
      const u = await register(payload);
      toast.success(t("auth.welcome", { name: u.full_name }));
      const from = location.state?.from || (["professional", "teacher"].includes(f.account_type) ? `/pro/join/${f.account_type}` : "/");
      navigate(from, { replace: true });
    } catch (err) {
      setError(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const err = (k) => (errors[k] ? te(errors[k]) : null);
  return (
    <AuthCard title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")} testId="register-page">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset>
          <legend className={ui.label}>{t("auth.accountType")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((k) => (
              <button key={k} type="button" onClick={() => set("account_type")(k)} aria-pressed={f.account_type === k}
                data-testid={`register-type-${k}`}
                className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition-colors ${f.account_type === k ? "border-brand-electric bg-brand-electric/10" : "border-border hover:bg-secondary"}`}>
                {t(`auth.types.${k}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <Field id="reg-name" label={t("auth.fullName")} error={err("full_name")}>
          <input id="reg-name" value={f.full_name} onChange={set("full_name")} className={ui.input} autoComplete="name" maxLength={80} data-testid="register-name-input" />
        </Field>
        <Field id="reg-email" label={t("auth.email")} error={err("email")}>
          <input id="reg-email" type="email" dir="ltr" value={f.email} onChange={set("email")} className={ui.input} autoComplete="email" data-testid="register-email-input" />
        </Field>
        <Field id="reg-phone" label={t("auth.phone")} hint={t("auth.phoneHint")} error={err("phone")}>
          <input id="reg-phone" type="tel" inputMode="tel" dir="ltr" value={f.phone} onChange={set("phone")} className={ui.input}
            placeholder={t("auth.phonePh")} autoComplete="tel" data-testid="register-phone-input" />
        </Field>
        <Field id="reg-password" label={t("auth.password")} hint={t("auth.passwordRule")} error={err("password")}>
          <PasswordInput id="reg-password" value={f.password} onChange={set("password")} autoComplete="new-password" testId="register-password-input" />
        </Field>
        {f.account_type === "student" && <MinorConsent f={f} set={set} isMinor={isMinor} error={err("guardian")} />}
        <div className="space-y-3 pt-1">
          {[["accept_terms", "acceptTerms", "terms", "/legal/cgu"], ["accept_privacy", "acceptPrivacy", "privacy", "/legal/privacy"]].map(([k, pre, label, to]) => (
            <label key={k} className="flex items-start gap-3 text-sm cursor-pointer min-h-[44px]">
              <Checkbox checked={f[k]} onCheckedChange={(v) => set(k)(v === true)} className="mt-0.5 h-5 w-5" data-testid={`register-${k}-checkbox`} />
              <span>{t(`auth.${pre}`)} <Link to={to} target="_blank" className="underline font-semibold">{t(`auth.${label}`)}</Link></span>
            </label>
          ))}
          {errors.consent && <p className="text-sm text-destructive" role="alert" data-testid="register-consent-error">{te(errors.consent)}</p>}
        </div>
        <FormError message={error} testId="register-error" />
        <button type="submit" disabled={busy} className={`${ui.btnGradient} w-full`} data-testid="register-submit-button">
          {busy ? t("common.loading") : t("auth.registerBtn")}
        </button>
      </form>
      <p className="mt-6 text-sm text-center text-muted-foreground">
        {t("auth.haveAccount")} <Link to="/login" className="font-bold text-foreground underline" data-testid="register-login-link">{t("auth.loginLink")}</Link>
      </p>
    </AuthCard>
  );
}
