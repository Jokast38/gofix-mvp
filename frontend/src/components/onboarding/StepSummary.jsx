import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useWilayas } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { formatDA } from "@/lib/format";
import { billingService, marketplaceService } from "@/services/marketplaceService";
import { OTHER } from "./Steps1to3";
import { StepTitle, useList } from "./Parts";

function Row({ label, value, step, goTo, testId }) {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0" data-testid={testId}>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold break-words">{value || <span className="text-destructive">{t("onboarding.missing")}</span>}</p>
      </div>
      <button type="button" onClick={() => goTo(step)} className="shrink-0 grid place-items-center h-9 w-9 rounded-full hover:bg-secondary" aria-label={t("onboarding.edit")} data-testid={`${testId}-edit`}><Pencil size={15} /></button>
    </div>
  );
}

export function StepSummary({ d, update, kind, goTo, errors = [] }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const { data: wilayas = [] } = useWilayas();
  const cats = useList(["cats", d.family_key], () => marketplaceService.categories({ family_key: d.family_key }), kind === "professional" && Boolean(d.family_key));
  const roles = useList(["roles", d.family_key], () => marketplaceService.roles(d.family_key), kind === "professional" && Boolean(d.family_key));
  const subjects = useList(["subjects"], marketplaceService.subjects, kind === "teacher");
  const name = (list, k) => loc((list || []).find((x) => x.key === k));
  const zones = (d.zones || []).map((z) => `${name(wilayas.map((w) => ({ ...w, key: w.code })), z.wilaya_code)} (${z.radius_km} km)`).join(", ");
  const priceKey = kind === "teacher" ? "price_hint_da_hour" : "price_hint_da";
  const plans = useList(["plans-pro"], () => billingService.plans("professional"));
  const docs = (d.documents || []).map((x) => (typeof x === "string" ? { type: x } : x));
  const chosen = d.chosen_plan || "professional_free";

  return (
    <>
      <StepTitle title={t("onboarding.s7Title")} hint={t("onboarding.s7Hint")} />
      {errors.length > 0 && (
        <p role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm" data-testid="onboarding-summary-errors">
          {t("onboarding.incomplete")} : {errors.map((e) => t(`onboarding.fields.${e}`)).join(", ")}
        </p>
      )}
      <div className="gf-card px-4" data-testid="onboarding-summary">
        <Row label={t("onboarding.displayName")} value={d.display_name} step={1} goTo={goTo} testId="summary-name" />
        <Row label={t("onboarding.bio")} value={d.bio} step={1} goTo={goTo} testId="summary-bio" />
        {kind === "professional" ? (
          <>
            <Row label={t("onboarding.category")} value={d.category_key === OTHER ? `${d.other_category_name} (${t("onboardingx.otherPending")})` : name(cats.data, d.category_key)} step={2} goTo={goTo} testId="summary-category" />
            <Row label={t("onboarding.role")} value={name(roles.data, d.role_key)} step={3} goTo={goTo} testId="summary-role" />
          </>
        ) : (
          <>
            <Row label={t("onboarding.subjects")} value={(d.subjects || []).map((s) => name(subjects.data, s.subject_key)).join(", ")} step={2} goTo={goTo} testId="summary-subjects" />
            <Row label={t("onboarding.format")} value={(d.formats || []).map((f) => t(`onboarding.formats.${f}`)).join(", ")} step={3} goTo={goTo} testId="summary-formats" />
          </>
        )}
        <Row label={t("onboarding.s4Title")} value={zones} step={4} goTo={goTo} testId="summary-zones" />
        <Row label={t(`onboarding.${kind}.price`)} value={d[priceKey] != null ? formatDA(d[priceKey]) : t("onboarding.onQuote")} step={5} goTo={goTo} testId="summary-price" />
        <Row label={t("onboarding.documents")} value={docs.map((x) => `${t(`onboarding.docs.${x.type}`)}${x.key ? " ✓" : ""}`).join(", ") || t("onboarding.noneDeclared")} step={6} goTo={goTo} testId="summary-docs" />
      </div>
      <div className="mt-5" data-testid="onboarding-plan-choice">
        <p className="font-extrabold">{t("onboardingx.planTitle")}</p>
        <p className="text-xs text-muted-foreground mb-2">{t("onboardingx.planHint")}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(plans.data || []).map((p) => (
            <button key={p.key} type="button" aria-pressed={chosen === p.key} onClick={() => update({ chosen_plan: p.key })} data-testid={`onboarding-plan-${p.key}`}
              className={`rounded-xl border p-3 text-start min-h-[64px] ${chosen === p.key ? "border-brand-pink bg-brand-pink/10" : "border-border"}`}>
              <span className="block font-extrabold">{loc(p) || p.name_fr}</span>
              <span className="block text-xs text-muted-foreground">{p.tier === "free" ? t("pricing.free") : p.price_da ? `${formatDA(p.price_da)} ${t("pricing.per", { days: p.duration_days })}` : t("pricing.tbd")}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="mt-5 flex items-start gap-3 text-sm cursor-pointer min-h-[44px]">
        <Checkbox checked={Boolean(d.accept_charter)} onCheckedChange={(v) => update({ accept_charter: v === true })} className="mt-0.5 h-5 w-5" data-testid="onboarding-accept-charter" />
        <span>{t("onboarding.acceptCharter")} <Link to="/legal/cgu" target="_blank" className="underline font-semibold">{t("auth.terms")}</Link>.</span>
      </label>
      <p className="mt-4 text-xs text-muted-foreground">{t("onboarding.pendingNotice")}</p>
    </>
  );
}
