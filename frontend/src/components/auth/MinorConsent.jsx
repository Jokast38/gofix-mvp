import { Field } from "@/components/common/PageSkeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

export function MinorConsent({ f, set, isMinor, error }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <Field id="reg-birth" label={`${t("auth.birthYear")} (${t("common.optional")})`}>
        <input id="reg-birth" type="number" inputMode="numeric" dir="ltr" min="1920" max={new Date().getFullYear()}
          value={f.birth_year} onChange={set("birth_year")} className={ui.input} data-testid="register-birthyear-input" />
      </Field>
      {isMinor && (
        <div className="rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4 space-y-3" data-testid="register-minor-block">
          <p className="text-sm font-bold">{t("auth.minorTitle")}</p>
          <Field id="reg-gname" label={t("auth.guardianName")}>
            <input id="reg-gname" value={f.guardian_name} onChange={set("guardian_name")} className={ui.input} maxLength={80} data-testid="register-guardian-name-input" />
          </Field>
          <Field id="reg-gphone" label={t("auth.guardianPhone")}>
            <input id="reg-gphone" type="tel" dir="ltr" value={f.guardian_phone} onChange={set("guardian_phone")} className={ui.input}
              placeholder={t("auth.phonePh")} data-testid="register-guardian-phone-input" />
          </Field>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox checked={f.guardian_consent} onCheckedChange={(v) => set("guardian_consent")(v === true)} className="mt-0.5 h-5 w-5"
              data-testid="register-guardian-consent-checkbox" />
            <span>{t("auth.guardianConsent")}</span>
          </label>
          {error && <p className="text-sm text-destructive" role="alert" data-testid="register-guardian-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
