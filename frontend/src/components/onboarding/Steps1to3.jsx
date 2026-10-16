import { useState } from "react";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/PageSkeleton";
import { useI18n, useLocalized } from "@/i18n";
import { errorCode } from "@/lib/format";
import { marketplaceService, onboardingService } from "@/services/marketplaceService";
import { ui } from "@/lib/ui";
import { ChoiceGrid, StepTitle, Textarea, useList } from "./Parts";

// Step 1 — identity (shared)
export function StepIdentity({ d, update, kind }) {
  const { t } = useI18n();
  return (
    <>
      <StepTitle title={t(`onboarding.${kind}.s1Title`)} hint={t("onboarding.s1Hint")} />
      <div className="space-y-4">
        <Field id="ob-name" label={t("onboarding.displayName")} hint={t("onboarding.displayNameHint")}>
          <input id="ob-name" value={d.display_name || ""} onChange={(e) => update({ display_name: e.target.value })} className={ui.input} maxLength={80} data-testid="onboarding-display-name" />
        </Field>
        <Field id="ob-exp" label={t("onboarding.experience")}>
          <input id="ob-exp" type="number" min={0} max={60} inputMode="numeric" value={d.experience_years ?? ""} onChange={(e) => update({ experience_years: e.target.value === "" ? "" : Number(e.target.value) })}
            className={ui.input} data-testid="onboarding-experience" />
        </Field>
        <Field id="ob-bio" label={t("onboarding.bio")} hint={t("onboarding.bioHint")}>
          <Textarea id="ob-bio" value={d.bio} onChange={(v) => update({ bio: v })} testId="onboarding-bio" placeholder={t(`onboarding.${kind}.bioPh`)} />
        </Field>
      </div>
    </>
  );
}

export const OTHER = "__other__";

function OtherCategory({ d, update }) {
  const { t, te } = useI18n();
  const [name, setName] = useState(d.other_category_name || "");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  if (d.category_request_id) {
    return <p className="mt-3 rounded-xl border border-brand-orange/50 bg-brand-orange/10 p-3 text-sm" data-testid="onboarding-other-sent">{t("onboardingx.otherSent", { name: d.other_category_name })}</p>;
  }
  const send = async () => {
    if (name.trim().length < 2) return toast.error(t("onboardingx.otherName"));
    setBusy(true);
    try {
      const res = await onboardingService.requestCategory({ family_key: d.family_key, name: name.trim(), description: desc.trim() });
      update({ category_key: OTHER, category_request_id: res.id, other_category_name: name.trim(), specialty_keys: [] });
      toast.success(t("onboardingx.otherSentToast"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border p-3" data-testid="onboarding-other-form">
      <p className="text-sm font-bold">{t("onboardingx.otherTitle")}</p>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t("onboardingx.otherName")} className={ui.input} data-testid="onboarding-other-name" />
      <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} placeholder={t("onboardingx.otherDesc")} className={ui.input} />
      <button type="button" onClick={send} disabled={busy} className={`${ui.btnOutline} w-full`} data-testid="onboarding-other-send">{busy && <Loader2 size={16} className="animate-spin" />}{t("onboardingx.otherSend")}</button>
      <p className="text-xs text-muted-foreground">{t("onboardingx.otherHint")}</p>
    </div>
  );
}

// Step 2 (pro) — family + category
export function StepCategory({ d, update }) {
  const { t } = useI18n();
  const [other, setOther] = useState(d.category_key === OTHER);
  const fams = useList(["families"], marketplaceService.families);
  const cats = useList(["cats", d.family_key], () => marketplaceService.categories({ family_key: d.family_key }), Boolean(d.family_key));
  const families = (fams.data || []).filter((f) => f.key !== "academy");
  return (
    <>
      <StepTitle title={t("onboarding.professional.s2Title")} hint={t("onboarding.professional.s2Hint")} />
      <p className={ui.label}>{t("onboarding.family")}</p>
      <ChoiceGrid items={families} value={d.family_key} testPrefix="onboarding-family" color="var(--brand-pink)"
        onChange={(k) => { setOther(false); update({ family_key: k, category_key: null, specialty_keys: [], category_request_id: null, other_category_name: null }); }} />
      {d.family_key && (
        <div className="mt-6">
          <p className={ui.label}>{t("onboarding.category")}</p>
          <ChoiceGrid items={cats.data || []} value={d.category_key} testPrefix="onboarding-category"
            onChange={(k) => { setOther(false); update({ category_key: k, specialty_keys: [], category_request_id: null, other_category_name: null }); }} />
          <button type="button" onClick={() => setOther(true)} aria-pressed={other} data-testid="onboarding-category-other"
            className={`mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 min-h-[48px] text-sm font-semibold ${other ? "border-brand-orange" : "border-border"}`}>
            <PlusCircle size={16} />{t("onboardingx.other")}
          </button>
          {other && <OtherCategory d={d} update={update} />}
        </div>
      )}
    </>
  );
}

// Step 3 (pro) — role + specialties
export function StepRole({ d, update }) {
  const { t } = useI18n();
  const roles = useList(["roles", d.family_key], () => marketplaceService.roles(d.family_key), Boolean(d.family_key));
  const specs = useList(["specs", d.category_key], () => marketplaceService.specialties(d.category_key), Boolean(d.category_key));
  return (
    <>
      <StepTitle title={t("onboarding.professional.s3Title")} hint={t("onboarding.professional.s3Hint")} />
      <p className={ui.label}>{t("onboarding.role")}</p>
      <ChoiceGrid items={roles.data || []} value={d.role_key} onChange={(k) => update({ role_key: k })} testPrefix="onboarding-role" color="var(--brand-orange)" cols="grid-cols-1 sm:grid-cols-3" />
      <div className="mt-6">
        <p className={ui.label}>{t("onboarding.specialties")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></p>
        {specs.data?.length ? (
          <ChoiceGrid items={specs.data} value={d.specialty_keys} multiple onChange={(v) => update({ specialty_keys: v })} testPrefix="onboarding-specialty" />
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="onboarding-no-specialties">{t("onboarding.noSpecialties")}</p>
        )}
      </div>
    </>
  );
}

// Step 2 (teacher) — subjects + levels
export function StepSubjects({ d, update }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const subjects = useList(["subjects"], marketplaceService.subjects);
  const levels = useList(["levels"], marketplaceService.levels);
  const current = d.subjects || [];
  const keys = current.map((s) => s.subject_key);
  const setSubjects = (ks) => update({ subjects: ks.map((k) => current.find((s) => s.subject_key === k) || { subject_key: k, level_keys: [] }) });
  const setLevels = (k, lv) => update({ subjects: current.map((s) => (s.subject_key === k ? { ...s, level_keys: lv } : s)) });
  return (
    <>
      <StepTitle title={t("onboarding.teacher.s2Title")} hint={t("onboarding.teacher.s2Hint")} />
      <ChoiceGrid items={subjects.data || []} value={keys} multiple onChange={setSubjects} testPrefix="onboarding-subject" color="var(--brand-pink)" />
      {current.map((s) => (
        <div key={s.subject_key} className="mt-5 rounded-xl border border-border p-3" data-testid={`onboarding-levels-${s.subject_key}`}>
          <p className="text-sm font-bold mb-2">{loc(subjects.data?.find((x) => x.key === s.subject_key))} — {t("onboarding.levels")}</p>
          <ChoiceGrid items={levels.data || []} value={s.level_keys} multiple onChange={(lv) => setLevels(s.subject_key, lv)} testPrefix={`onboarding-level-${s.subject_key}`} cols="grid-cols-2 sm:grid-cols-3" />
        </div>
      ))}
    </>
  );
}

// Step 3 (teacher) — formats + languages
const FORMATS = ["home", "online", "center"];
const LANGS = ["fr", "ar", "en"];
export function StepFormats({ d, update }) {
  const { t } = useI18n();
  const fmt = FORMATS.map((k) => ({ key: k, name_fr: t(`onboarding.formats.${k}`), name_ar: t(`onboarding.formats.${k}`) }));
  const lg = LANGS.map((k) => ({ key: k, name_fr: t(`onboarding.langs.${k}`), name_ar: t(`onboarding.langs.${k}`) }));
  return (
    <>
      <StepTitle title={t("onboarding.teacher.s3Title")} hint={t("onboarding.teacher.s3Hint")} />
      <p className={ui.label}>{t("onboarding.format")}</p>
      <ChoiceGrid items={fmt} value={d.formats} multiple onChange={(v) => update({ formats: v })} testPrefix="onboarding-format" color="var(--brand-orange)" cols="grid-cols-1 sm:grid-cols-3" />
      <div className="mt-6">
        <p className={ui.label}>{t("onboarding.teachingLangs")}</p>
        <ChoiceGrid items={lg} value={d.teaching_languages || ["fr", "ar"]} multiple onChange={(v) => update({ teaching_languages: v })} testPrefix="onboarding-lang" cols="grid-cols-3" />
      </div>
    </>
  );
}
