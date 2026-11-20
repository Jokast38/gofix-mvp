import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Info, Sparkles, X } from "lucide-react";
import { TeacherCard } from "@/components/catalog/Cards";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { errorCode, formatDA, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";
import { eduService } from "@/services/eduService";
import { marketplaceService } from "@/services/marketplaceService";

const TABS = ["classes", "languages", "higher", "history"];
const CYCLES = ["primary", "middle", "secondary"];
const BAND_COLOR = { very_good: "var(--brand-electric)", satisfactory: "var(--brand-violet)", fragile: "var(--brand-orange)", to_strengthen: "var(--brand-pink)" };

/** Readable name of a test key: class-1AP-3, lang-fr-2, express-1AP, higher-info_l1, import-1AM. */
export function useEduLabels() {
  const { t } = useI18n();
  const subject = (s) => {
    const v = t(`edu.subjects.${s}`);
    return v.startsWith("edu.") ? s : v;
  };
  const test = (key) => {
    const [kind, ...rest] = key.split("-");
    if (kind === "class") return `${rest[0]} · ${t("edu.testN", { n: rest[1] })}`;
    if (kind === "lang") return `${t(`edu.langs.${rest[0]}`)} · ${t("edu.levelN", { n: rest[1] })}`;
    if (kind === "express") return `${rest[0]} · ${t("edu.express")}`;
    if (kind === "higher") return t(`edu.tracks.${rest.join("-")}`);
    if (kind === "import") return `${rest.join("-")} · ${t("edu.imported")}`;
    return key;
  };
  return { subject, test };
}

/** Entry card shown on Home and in the Academy. */
export function EduCta({ className = "" }) {
  const { t } = useI18n();
  const { flag } = useConfig();
  if (!flag("edu_ai")) return null;
  return (
    <div className={`gf-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 ${className}`} data-testid="edu-cta">
      <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-brand-violet/15 text-brand-violet"><GraduationCap size={22} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{t("edu.cta.title")}</p>
        <p className="text-sm text-muted-foreground">{t("edu.cta.text")}</p>
      </div>
      <Link to="/academy/tests" className={`${ui.btnGradient} shrink-0`} data-testid="edu-cta-start">{t("edu.cta.button")}</Link>
    </div>
  );
}

function Disabled() {
  const { t } = useI18n();
  return <p className="gf-card p-6 text-sm" data-testid="edu-disabled">{t("errors.feature_disabled")}</p>;
}

function TestCard({ test, title, subtitle }) {
  const { t } = useI18n();
  return (
    <Link to={`/academy/tests/${test.key}`} className="gf-card p-4 flex items-center gap-3 min-w-0 hover:border-brand-violet/60 transition-colors" data-testid={`edu-test-${test.key}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold truncate">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle ? `${subtitle} · ` : ""}{t("edu.questions", { n: test.count })}</span>
      </span>
      {test.best != null && (
        <span className="shrink-0 rounded-full bg-brand-electric/15 px-2 py-1 text-[11px] font-extrabold" data-testid="edu-best">{t("edu.best", { pct: test.best })}</span>
      )}
      <ArrowRight size={18} className="shrink-0 rtl:rotate-180 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function Classes({ classes }) {
  const { t } = useI18n();
  const label = useEduLabels();
  const [params, setParams] = useSearchParams();
  const level = params.get("level") || classes[0]?.level;
  const current = classes.find((c) => c.level === level) || classes[0];
  if (!current) return null;
  return (
    <div>
      <p className="text-sm font-bold">{t("edu.chooseClass")}</p>
      {CYCLES.map((cy) => {
        const list = classes.filter((c) => c.cycle === cy);
        if (!list.length) return null;
        return (
          <div key={cy} className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground">{t(`edu.cycles.${cy}`)}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {list.map((c) => (
                <button key={c.level} type="button" aria-pressed={c.level === current.level} data-testid={`edu-class-${c.level}`}
                  onClick={() => setParams((p) => { p.set("level", c.level); return p; }, { replace: true })}
                  className={`rounded-full border px-4 min-h-[40px] text-sm font-bold transition-colors ${c.level === current.level ? "border-brand-violet bg-brand-violet/15" : "border-border"}`}>
                  <span dir="ltr">{c.level}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {current.tests.map((x) => <TestCard key={x.key} test={x} title={t("edu.testN", { n: x.number })} subtitle={t(`edu.levels.${x.number}`)} />)}
        {current.extra.map((x) => <TestCard key={x.key} test={x} title={label.test(x.key)} />)}
      </div>
    </div>
  );
}

function Languages({ languages }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {languages.map((l) => (
        <section key={l.lang}>
          <h2 className="font-extrabold">{t(`edu.langs.${l.lang}`)}</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {l.tests.map((x) => <TestCard key={x.key} test={x} title={t("edu.levelN", { n: x.number })} subtitle={t(`edu.levels.${x.number}`)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function History() {
  const { t } = useI18n();
  const { user } = useAuth();
  const label = useEduLabels();
  const { data, isLoading } = useQuery({ queryKey: ["edu-history"], queryFn: eduService.history, enabled: Boolean(user) });
  if (user === null) return <Skeleton className="h-40 rounded-xl" />; // session still loading
  if (!user) {
    return (
      <div className="gf-card p-5" data-testid="edu-history-login">
        <p className="text-sm">{t("edu.historyLogin")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/login" state={{ from: "/academy/tests?tab=history" }} className={ui.btnPrimary}>{t("nav.login")}</Link>
          <Link to="/register" className={ui.btnOutline}>{t("edu.visitorCta")}</Link>
        </div>
      </div>
    );
  }
  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!data?.length) return <p className="gf-card p-5 text-sm" data-testid="edu-history-empty">{t("edu.historyEmpty")}</p>;
  return (
    <ul className="space-y-2" data-testid="edu-history">
      {data.map((a) => (
        <li key={a.id}>
          <Link to={`/academy/tests/result/${a.id}`} className="gf-card p-4 flex items-center gap-3 min-w-0">
            <span className="min-w-0 flex-1">
              <span className="block font-bold truncate">{label.test(a.test_key)}</span>
              <span className="block text-xs text-muted-foreground">{formatDate(a.finished_at)} · {t(`edu.bands.${a.band}`)}</span>
            </span>
            <span className="shrink-0 text-lg font-extrabold" style={{ color: BAND_COLOR[a.band] }} dir="ltr">{a.score}%</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function EduHome() {
  const { t } = useI18n();
  const { flag } = useConfig();
  const label = useEduLabels();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "classes";
  const { data, isLoading } = useQuery({ queryKey: ["edu-catalog"], queryFn: eduService.catalog, enabled: flag("edu_ai") });
  return (
    <div className={`${ui.container} py-6 sm:py-10`} data-testid="edu-page">
      <PageHeader eyebrow={t("edu.eyebrow")} title={t("edu.title")} subtitle={t("edu.subtitle")} />
      {!flag("edu_ai") ? <Disabled /> : (
        <>
          <div className="mt-2 -mx-4 px-4 overflow-x-auto" role="tablist">
            <div className="flex gap-2 w-max">
              {TABS.map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} data-testid={`edu-tab-${k}`}
                  onClick={() => setParams((p) => { p.set("tab", k); return p; }, { replace: true })}
                  className={`rounded-full px-4 min-h-[44px] text-sm font-bold whitespace-nowrap transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {t(`edu.tabs.${k}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-4 flex gap-2 text-xs text-muted-foreground"><Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />{t("edu.disclaimer")}</p>
          <div className="mt-5">
            {tab === "history" ? <History /> : isLoading || !data ? <Skeleton className="h-60 rounded-xl" /> :
              tab === "classes" ? <Classes classes={data.classes} /> :
              tab === "languages" ? <Languages languages={data.languages} /> : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.higher.map((x) => <TestCard key={x.key} test={x} title={label.test(x.key)} />)}
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}

function QuestionFlow({ attempt, onDone }) {
  const { t, te, lang } = useI18n();
  const label = useEduLabels();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const qs = attempt.questions;
  const q = qs[i];
  const done = qs.every((x) => answers[x.key] != null);
  const contentLang = qs[0]?.lang;
  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await eduService.finish(attempt.id, answers, attempt.token));
    } catch (err) {
      setError(te(errorCode(err)));
      setBusy(false);
    }
  };
  const choose = (idx) => {
    setAnswers((a) => ({ ...a, [q.key]: idx }));
    if (i < qs.length - 1) setTimeout(() => setI((n) => Math.min(n + 1, qs.length - 1)), 250);
  };
  return (
    <div className="mx-auto max-w-2xl" data-testid="edu-flow">
      <p className="gf-eyebrow">{label.test(attempt.test_key)}</p>
      {attempt.draft && <p className="mt-2 rounded-xl bg-brand-orange/10 border border-brand-orange/40 p-3 text-xs" data-testid="edu-draft">{t("edu.draft")}</p>}
      {contentLang && contentLang !== lang && <p className="mt-2 text-xs text-muted-foreground">{t("edu.contentLang", { lang: t(`edu.langs.${contentLang}`) })}</p>}
      <div className="mt-4 flex items-center justify-between text-sm font-bold">
        <span data-testid="edu-progress">{t("edu.question", { i: i + 1, n: qs.length })}</span>
        <span className="text-xs text-muted-foreground">{label.subject(q.subject)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden" aria-hidden="true">
        <div className="h-full gf-gradient-bg transition-[width]" style={{ width: `${(Object.keys(answers).length / qs.length) * 100}%` }} />
      </div>
      <div className="gf-card mt-4 p-4 sm:p-6" dir={q.lang === "ar" ? "rtl" : "ltr"} lang={q.lang}>
        <h1 className="text-lg sm:text-xl font-extrabold whitespace-pre-line" data-testid="edu-question">{q.question}</h1>
        <div className="mt-4 grid gap-2" role="radiogroup">
          {q.options.map((o, idx) => {
            const on = answers[q.key] === idx;
            return (
              <button key={idx} type="button" role="radio" aria-checked={on} onClick={() => choose(idx)} data-testid={`edu-option-${idx}`}
                className={`flex items-center gap-3 rounded-xl border px-4 min-h-[52px] text-start font-semibold transition-colors ${on ? "border-brand-violet bg-brand-violet/15" : "border-border hover:bg-secondary"}`}>
                <span className={`grid place-items-center h-7 w-7 shrink-0 rounded-full border text-xs font-extrabold ${on ? "bg-brand-violet text-white border-brand-violet" : "border-border"}`}>{"ABCD"[idx]}</span>
                <span className="min-w-0 break-words">{o}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setI(i - 1)} disabled={i === 0} className={ui.btnOutline} data-testid="edu-prev">
          <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{t("edu.prev")}
        </button>
        {i < qs.length - 1 ? (
          <button type="button" onClick={() => setI(i + 1)} className={ui.btnOutline} data-testid="edu-next">
            {t("edu.next")}<ArrowRight size={16} className="rtl:rotate-180" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={finish} disabled={!done || busy} className={ui.btnGradient} data-testid="edu-finish">{t("edu.finish")}</button>
        )}
      </div>
      {!done && i === qs.length - 1 && <p className="mt-2 text-xs text-muted-foreground text-end">{t("edu.answerAll")}</p>}
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-1.5 justify-center" aria-label={t("edu.question", { i: i + 1, n: qs.length })}>
        {qs.map((x, n) => (
          <button key={x.key} type="button" onClick={() => setI(n)} aria-label={String(n + 1)} aria-current={n === i}
            className={`h-9 w-9 rounded-full text-xs font-bold border ${n === i ? "border-brand-violet" : "border-border"} ${answers[x.key] != null ? "bg-brand-violet/15" : ""}`}>{n + 1}</button>
        ))}
      </div>
    </div>
  );
}

function Teachers({ rec }) {
  const { t } = useI18n();
  const label = useEduLabels();
  const query = { subject_key: rec.subject_key, ...(rec.level_key && { level_key: rec.level_key }), sort: "rating", page_size: 3 };
  const { data, isLoading } = useQuery({ queryKey: ["edu-teachers", query], queryFn: () => marketplaceService.teachers(query) });
  const more = `/academy?subject_key=${rec.subject_key}${rec.level_key ? `&level_key=${rec.level_key}` : ""}&sort=rating`;
  return (
    <section className="mt-6" data-testid="edu-teachers">
      <h2 className="text-lg font-extrabold">{t("edu.teachersTitle", { subject: label.subject(rec.subject_key) })}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {isLoading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />) : data?.items.map((x, i) => <TeacherCard key={x.id} tch={x} index={i} />)}
      </div>
      {!isLoading && !data?.items.length && <p className="mt-2 text-sm text-muted-foreground">{t("edu.noTeacher")}</p>}
      <Link to={more} className={`${ui.btnOutline} mt-3`} data-testid="edu-teachers-all">{t("edu.teachersAll")}</Link>
    </section>
  );
}

export function EduResultView({ result, onRetry }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { settings } = useConfig();
  const label = useEduLabels();
  const color = BAND_COLOR[result.band];
  const price = settings.plan_price_student_student_pass;
  return (
    <div className="mx-auto max-w-3xl" data-testid="edu-result">
      <p className="gf-eyebrow">{label.test(result.test_key)}</p>
      <h1 className="mt-1 text-2xl font-extrabold">{t("edu.resultTitle")}</h1>
      <div className="gf-card mt-4 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="grid place-items-center h-24 w-24 shrink-0 rounded-full border-4 text-2xl font-extrabold" style={{ borderColor: color, color }} dir="ltr" data-testid="edu-score">{result.score}%</span>
        <div className="min-w-0">
          <p className="text-lg font-extrabold" style={{ color }} data-testid="edu-band">{t(`edu.bands.${result.band}`)}</p>
          <p className="text-sm font-semibold">{t("edu.score", { correct: result.correct, total: result.total })}</p>
          <p className="mt-1 text-sm">{t(result.passed ? "edu.passed" : "edu.failed")}</p>
        </div>
      </div>
      <p className="mt-2 flex gap-2 text-xs text-muted-foreground"><Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />{t("edu.disclaimer")}</p>

      {result.saved ? <p className="mt-3 text-sm font-semibold text-brand-electric" data-testid="edu-saved">{t("edu.saved")}</p> : (
        <div className="gf-card mt-4 p-4 border-brand-orange/50" data-testid="edu-visitor">
          <p className="font-extrabold">{t("edu.visitorTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("edu.visitorText")}</p>
          <Link to="/register" className={`${ui.btnPrimary} mt-3`} data-testid="edu-visitor-cta">{t("edu.visitorCta")}</Link>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {result.next_test_key && <Link to={`/academy/tests/${result.next_test_key}`} className={ui.btnGradient} data-testid="edu-next-test">{t("edu.nextTest")}</Link>}
        {onRetry ? <button type="button" onClick={onRetry} className={ui.btnOutline} data-testid="edu-retry">{t("edu.retry")}</button>
          : <Link to={`/academy/tests/${result.test_key}`} className={ui.btnOutline} data-testid="edu-retry">{t("edu.retry")}</Link>}
        <Link to="/academy/tests" className={ui.btnGhost}>{t("edu.backToTests")}</Link>
      </div>

      {!result.student_pass && (
        <div className="mt-6 gf-card p-5 border-brand-violet/50" data-testid="edu-pass">
          <p className="flex items-center gap-2 font-extrabold"><Sparkles size={18} className="text-brand-violet" aria-hidden="true" />{t("edu.passTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("edu.passText")}</p>
          {price ? <p className="mt-2 font-extrabold" dir="auto">{t("edu.passPrice", { price: formatDA(price).replace(/\s?DA$/, "") })}</p> : null}
          <Link to="/pricing?audience=student" className={`${ui.btnGradient} mt-3`} data-testid="edu-pass-cta">{t("edu.passCta")}</Link>
        </div>
      )}

      {result.recommendation && <Teachers rec={result.recommendation} />}

      <section className="mt-6">
        <h2 className="text-lg font-extrabold">{t("edu.bySubject")}</h2>
        <ul className="mt-2 space-y-2">
          {result.subjects.map((s) => (
            <li key={s.subject} className="gf-card p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-bold">{label.subject(s.subject)}</span>
                <span className="text-muted-foreground" dir="ltr">{s.correct}/{s.total}{s.pct != null ? ` · ${s.pct}%` : ""}</span>
              </div>
              {s.pct == null ? <p className="mt-1 text-xs text-muted-foreground">{t("edu.insufficient")}</p> : (
                <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full gf-gradient-bg" style={{ width: `${s.pct}%` }} /></div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6" data-testid="edu-corrections">
        <h2 className="text-lg font-extrabold">{t("edu.corrections")}</h2>
        <ol className="mt-2 space-y-3">
          {result.corrections.map((c, n) => (
            <li key={c.key} className="gf-card p-4">
              <p className="flex items-start gap-2 font-bold">
                {c.ok ? <Check size={18} className="shrink-0 text-brand-electric mt-0.5" aria-hidden="true" /> : <X size={18} className="shrink-0 text-destructive mt-0.5" aria-hidden="true" />}
                <span className="min-w-0 whitespace-pre-line" dir="auto">{n + 1}. {c.question}</span>
              </p>
              {!c.ok && (
                <p className="mt-2 text-sm"><span className="text-muted-foreground">{t("edu.yourAnswer")} : </span>
                  <span className="text-destructive font-semibold" dir="auto">{c.chosen == null ? t("edu.noAnswer") : c.options[c.chosen]}</span></p>
              )}
              <p className="mt-1 text-sm"><span className="text-muted-foreground">{t("edu.rightAnswer")} : </span><span className="font-semibold" dir="auto">{c.options[c.correct]}</span></p>
              {c.explanation && <p className="mt-2 text-xs text-muted-foreground" dir="auto">{c.explanation}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function TestRun({ testKey, onRetry }) {
  const { t, te } = useI18n();
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice: start a single attempt
    started.current = true;
    eduService.start(testKey).then(setAttempt).catch((err) => setError(te(errorCode(err))));
  }, [testKey, te]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [result]);
  if (error) {
    return (
      <div className="gf-card p-6 mx-auto max-w-2xl" data-testid="edu-error">
        <p className="text-sm">{error}</p>
        <Link to="/academy/tests" className={`${ui.btnOutline} mt-3`}>{t("edu.backToTests")}</Link>
      </div>
    );
  }
  if (result) return <EduResultView result={result} onRetry={onRetry} />;
  if (!attempt) return <Skeleton className="h-80 rounded-xl mx-auto max-w-2xl" />;
  return <QuestionFlow attempt={attempt} onDone={setResult} />;
}

export function EduTest() {
  const { key } = useParams();
  const { flag } = useConfig();
  const [run, setRun] = useState(0);
  return (
    <div className={`${ui.container} py-6 sm:py-10`} data-testid="edu-test-page">
      {flag("edu_ai") ? <TestRun key={`${key}-${run}`} testKey={key} onRetry={() => setRun((n) => n + 1)} /> : <Disabled />}
    </div>
  );
}

export function EduResult() {
  const { id } = useParams();
  const { t, te } = useI18n();
  const { data, error, isLoading } = useQuery({ queryKey: ["edu-attempt", id], queryFn: () => eduService.attempt(id), retry: false });
  return (
    <div className={`${ui.container} py-6 sm:py-10`}>
      {isLoading ? <Skeleton className="h-80 rounded-xl" /> : error ? (
        <div className="gf-card p-6" data-testid="edu-error">
          <p className="text-sm">{te(errorCode(error))}</p>
          <Link to="/academy/tests?tab=history" className={`${ui.btnOutline} mt-3`}>{t("edu.backToTests")}</Link>
        </div>
      ) : <EduResultView result={data} />}
    </div>
  );
}
