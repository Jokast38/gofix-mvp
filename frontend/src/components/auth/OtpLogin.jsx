import { useState } from "react";
import { Field, FormError } from "@/components/common/PageSkeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { authService } from "@/services/authService";
import { errorCode, isValidDzPhone } from "@/lib/format";
import { ui } from "@/lib/ui";

export function OtpLogin({ onDone }) {
  const { t, te } = useI18n();
  const { loginWithOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const send = (e) => {
    e.preventDefault();
    if (!isValidDzPhone(phone)) return setError(te("phone_invalid"));
    run(async () => {
      await authService.requestOtp(phone);
      setSent(true);
    });
  };
  const verify = (e) => {
    e.preventDefault();
    run(async () => onDone(await loginWithOtp(phone, code)));
  };

  return (
    <form onSubmit={sent ? verify : send} className="space-y-4" noValidate>
      <Field id="otp-phone" label={t("auth.phone")} hint={t("auth.phoneHint")}>
        <input id="otp-phone" type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
          className={ui.input} placeholder={t("auth.phonePh")} disabled={sent} data-testid="otp-phone-input" />
      </Field>
      {sent && (
        <Field id="otp-code" label={t("auth.code")} hint={t("auth.codeSent")}>
          <input id="otp-code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${ui.input} tracking-[0.5em] text-center text-lg`}
            data-testid="otp-code-input" />
        </Field>
      )}
      <FormError message={error} testId="otp-error" />
      <button type="submit" disabled={busy || (sent && code.length !== 6)} className={`${ui.btnGradient} w-full`} data-testid="otp-submit-button">
        {busy ? t("common.loading") : sent ? t("auth.verifyCode") : t("auth.sendCode")}
      </button>
    </form>
  );
}
