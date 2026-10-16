import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

export function PasswordInput({ id, value, onChange, autoComplete = "current-password", testId }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete}
        className={`${ui.input} pe-12`} data-testid={testId} required maxLength={128} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
        className="absolute inset-y-0 end-0 grid place-items-center w-12 text-muted-foreground hover:text-foreground"
        data-testid={`${testId}-toggle`}>
        {show ? <EyeOff size={20} strokeWidth={1.5} /> : <Eye size={20} strokeWidth={1.5} />}
      </button>
    </div>
  );
}

export function AuthCard({ title, subtitle, children, testId }) {
  return (
    <div className={`${ui.container} py-10 sm:py-16`}>
      <div className="mx-auto max-w-md gf-card p-6 sm:p-8 gf-fade-up" data-testid={testId}>
        <div className="flex justify-center mb-4"><Logo size="lg" /></div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
