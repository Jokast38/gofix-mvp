import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Cloud, CloudOff, GraduationCap, Loader2, Rocket, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { ProgressBar } from "@/components/onboarding/Parts";
import { StepCategory, StepFormats, StepIdentity, StepRole, StepSubjects } from "@/components/onboarding/Steps1to3";
import { StepMedia, StepPricing, StepZones } from "@/components/onboarding/Steps4to6";
import { StepSummary } from "@/components/onboarding/StepSummary";
import { useAuth } from "@/hooks/AuthProvider";
import { useDraft } from "@/hooks/useDraft";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";
import { onboardingService } from "@/services/marketplaceService";

const TOTAL = 7;

function validateStep(kind, step, d) {
  const e = [];
  if (step === 1) {
    if ((d.display_name || "").trim().length < 2) e.push("display_name");
    if ((d.bio || "").trim().length < 20) e.push("bio");
  }
  if (step === 2) {
    if (kind === "professional" && !d.category_key) e.push("category_key");
    if (kind === "teacher" && !(d.subjects || []).length) e.push("subjects");
  }
  if (step === 3) {
    if (kind === "professional" && !d.role_key) e.push("role_key");
    if (kind === "teacher" && !(d.formats || []).length) e.push("formats");
  }
  if (step === 4 && !(d.zones || []).length && !(kind === "teacher" && d.formats?.length === 1 && d.formats[0] === "online")) e.push("zones");
  if (step === 7 && !d.accept_charter) e.push("accept_charter");
  return e;
}

function SaveIndicator({ state }) {
  const { t } = useI18n();
  const Icon = state === "saving" ? Loader2 : state === "error" ? CloudOff : Cloud;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${state === "error" ? "text-destructive" : "text-muted-foreground"}`} data-testid="onboarding-save-state">
      <Icon size={13} className={state === "saving" ? "animate-spin" : ""} aria-hidden="true" />{t(`onboarding.save.${state}`)}
    </span>
  );
}

export function ChooseKind() {
  const { t } = useI18n();
  const { user } = useAuth();
  const status = useQuery({ queryKey: ["onboarding-status"], queryFn: onboardingService.status, enabled: Boolean(user) });
  if (user === null || (user && status.isLoading)) return <PageSkeleton />;
  if (user && (status.data?.professional || status.data?.teacher)) return <Navigate to="/account" replace />;
  const opts = [
    { kind: "professional", icon: Wrench, color: "var(--brand-pink)" },
    { kind: "teacher", icon: GraduationCap, color: "var(--brand-electric)" },
  ];
  return (
    <div className={`${ui.container} max-w-xl py-10`} data-testid="onboarding-choose">
      <p className="gf-eyebrow text-center">{t("onboarding.eyebrow")}</p>
      <h1 className="mt-2 text-center text-3xl sm:text-4xl font-extrabold">{t("onboarding.chooseTitle")}</h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">{t("onboarding.chooseHint")}</p>
      <div className="mt-8 grid gap-4">
        {opts.map(({ kind, icon: Icon, color }) => (
          <Link key={kind} to={user ? `/pro/join/${kind}` : "/register"} state={{ from: `/pro/join/${kind}` }} data-testid={`onboarding-choose-${kind}`}
            className="gf-card gf-card-hover flex items-center gap-4 p-5">
            <span className="grid place-items-center h-14 w-14 rounded-2xl shrink-0" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}><Icon size={28} strokeWidth={1.5} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold">{t(`onboarding.${kind}.title`)}</span>
              <span className="block text-sm text-muted-foreground">{t(`onboarding.${kind}.desc`)}</span>
            </span>
            <ArrowRight size={20} className="rtl:rotate-180 text-muted-foreground" />
          </Link>
        ))}
      </div>
      {!user && <p className="mt-6 text-center text-xs text-muted-foreground">{t("onboarding.needAccount")}</p>}
    </div>
  );
}

export default function Onboarding() {
  const { kind } = useParams();
  const { t, te } = useI18n();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const draft = useDraft(kind);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  if (!["professional", "teacher"].includes(kind)) return <Navigate to="/pro/join" replace />;
  if (draft.error) {
    const code = errorCode(draft.error);
    if (code === "role_conflict" || code === "profile_exists") return <Navigate to="/account" replace />;
  }
  if (!draft.ready) return <PageSkeleton />;

  const { step, data: d, update, goTo } = draft;
  const labels = t("onboarding.steps")[kind];
  const props = { d, update, kind, goTo };
  const Steps = kind === "professional"
    ? [StepIdentity, StepCategory, StepRole, StepZones, StepPricing, StepMedia, StepSummary]
    : [StepIdentity, StepSubjects, StepFormats, StepZones, StepPricing, StepMedia, StepSummary];
  const Current = Steps[step - 1];

  const next = () => {
    const e = validateStep(kind, step, d);
    setErrors(e);
    if (e.length) return toast.error(t("onboarding.fixErrors"));
    goTo(Math.min(TOTAL, step + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    const all = [1, 2, 3, 4, 7].flatMap((s) => validateStep(kind, s, d));
    setErrors(all);
    if (all.length) return toast.error(t("onboarding.fixErrors"));
    setBusy(true);
    try {
      await draft.flush();
      const { data: res } = await onboardingService.submit(kind);
      draft.clear();
      setUser(res.user);
      setDone({ plan: d.chosen_plan && d.chosen_plan !== "professional_free" ? d.chosen_plan : null });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.code === "draft_incomplete") setErrors(detail.fields);
      else toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className={`${ui.container} max-w-lg py-16 text-center`} data-testid="onboarding-done">
        <span className="mx-auto grid place-items-center h-20 w-20 rounded-full gf-gradient-bg gf-pulse-glow"><Rocket size={36} strokeWidth={1.6} /></span>
        <h1 className="mt-6 text-3xl font-extrabold">{t("onboarding.doneTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("onboarding.doneText")}</p>
        <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-orange/50 bg-brand-orange/10 px-4 py-1.5 text-sm font-bold text-brand-orange" data-testid="onboarding-done-status">
          <CheckCircle2 size={16} />{t("onboarding.status.pending")}
        </span>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {done.plan && <Link to={`/pricing?audience=professional&plan=${done.plan}`} className={ui.btnGradient} data-testid="onboarding-done-pay">{t("onboardingx.continueToPay")}</Link>}
          <button type="button" onClick={() => navigate("/dashboard")} className={done.plan ? ui.btnOutline : ui.btnGradient} data-testid="onboarding-done-account">{t("nav.dashboard")}</button>
          <Link to="/" className={ui.btnOutline} data-testid="onboarding-done-home">{t("nav.home")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${ui.container} max-w-2xl py-6 sm:py-10 pb-28 md:pb-10`} data-testid={`onboarding-${kind}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="gf-eyebrow">{t(`onboarding.${kind}.title`)}</p>
        <SaveIndicator state={draft.saveState} />
      </div>
      <ProgressBar step={step} total={TOTAL} labels={labels} />
      <div className="gf-card p-5 sm:p-7" key={step}>
        <Current {...props} errors={errors} />
        {errors.length > 0 && step !== 7 && (
          <p role="alert" className="mt-4 text-sm text-destructive" data-testid="onboarding-step-errors">{errors.map((e) => t(`onboarding.fields.${e}`)).join(" · ")}</p>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => { setErrors([]); goTo(Math.max(1, step - 1)); }} disabled={step === 1} className={ui.btnOutline} data-testid="onboarding-prev">
          <ArrowLeft size={18} className="rtl:rotate-180" />{t("common.back")}
        </button>
        {step < TOTAL ? (
          <button type="button" onClick={next} className={ui.btnGradient} data-testid="onboarding-next">
            {t("onboarding.next")}<ArrowRight size={18} className="rtl:rotate-180" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={busy} className={ui.btnGradient} data-testid="onboarding-submit">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />}{t("onboarding.submit")}
          </button>
        )}
      </div>
    </div>
  );
}
