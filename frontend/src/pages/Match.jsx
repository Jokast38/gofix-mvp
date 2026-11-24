import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCircle2, LocateFixed, Loader2, Search as SearchIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ProCard } from "@/components/catalog/Cards";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useConfig, useWilayas } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { errorCode } from "@/lib/format";
import { getPosition } from "@/lib/geo";
import { ui } from "@/lib/ui";
import { marketplaceService, matchService, requestService } from "@/services/marketplaceService";

// Guided AI MATCH flow: trade -> need -> place -> results -> recap -> sent. The draft survives "back", a reload and a
// sign-in (sessionStorage); the device position is only sent with the search and never stored.
const STEPS = ["service", "need", "place", "results"];
const RADII = [5, 10, 20, 50];
const KEY = "gofix_match_draft";
const EMPTY = { category_key: "", description: "", when: "week", wilaya_code: "", commune: "", radius_km: 10, gps: null, selected: [], names: {} };

function loadDraft() {
  try {
    return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(KEY) || "{}") };
  } catch {
    return EMPTY;
  }
}

function useDraft() {
  const [d, setD] = useState(loadDraft);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(d));
    } catch { /* private mode: the draft simply is not kept */ }
  }, [d]);
  return [d, (patch) => setD((x) => ({ ...x, ...patch })), () => setD(EMPTY)];
}

/** Entry card (home, search). */
export function MatchCta({ className = "" }) {
  const { t } = useI18n();
  const { flag } = useConfig();
  if (!flag("ai_match")) return null;
  return (
    <div className={`gf-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 ${className}`} data-testid="match-cta">
      <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-brand-pink/15 text-brand-pink"><Sparkles size={22} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{t("aimatch.cta.title")}</p>
        <p className="text-sm text-muted-foreground">{t("aimatch.cta.text")}</p>
      </div>
      <Link to="/match" className={`${ui.btnGradient} shrink-0`} data-testid="match-cta-start">{t("aimatch.cta.button")}</Link>
    </div>
  );
}

function Progress({ step }) {
  const { t } = useI18n();
  const i = Math.min(STEPS.indexOf(step), STEPS.length - 1);
  return (
    <div className="mb-5" aria-label={t("aimatch.stepOf", { i: i + 1, n: STEPS.length })}>
      <div className="flex gap-1.5">{STEPS.map((s, n) => <span key={s} className={`h-1.5 flex-1 rounded-full ${n <= i ? "gf-gradient-bg" : "bg-secondary"}`} />)}</div>
      <p className="mt-2 text-xs font-bold text-muted-foreground">{t("aimatch.stepOf", { i: i + 1, n: STEPS.length })} · {t(`aimatch.steps.${STEPS[i]}`)}</p>
    </div>
  );
}

function Nav({ onBack, onNext, nextLabel, disabled, testId }) {
  const { t } = useI18n();
  return (
    <div className="mt-6 flex items-center justify-between gap-2">
      {onBack ? <button type="button" onClick={onBack} className={ui.btnOutline}><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{t("aimatch.back")}</button> : <span />}
      <button type="button" onClick={onNext} disabled={disabled} className={ui.btnGradient} data-testid={testId}>{nextLabel || t("aimatch.next")}</button>
    </div>
  );
}

function ServiceStep({ d, set, go }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const [q, setQ] = useState("");
  const { data: cats = [], isLoading } = useQuery({ queryKey: ["cats-all"], queryFn: () => marketplaceService.categories(), staleTime: 300_000 });
  const list = cats.filter((c) => c.key !== "private_tutoring" && (!q.trim() || loc(c).toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <section>
      <h1 className="text-xl font-extrabold">{t("aimatch.serviceTitle")}</h1>
      <label className="relative mt-3 block">
        <SearchIcon size={18} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("aimatch.serviceSearch")} className={`${ui.input} ps-10`} data-testid="match-service-search" />
      </label>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup">
        {isLoading ? [...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />) : list.map((c) => (
          <button key={c.key} type="button" role="radio" aria-checked={d.category_key === c.key} onClick={() => set({ category_key: c.key, selected: [] })}
            data-testid={`match-cat-${c.key}`}
            className={`min-h-[48px] rounded-xl border px-3 text-sm font-bold text-start transition-colors ${d.category_key === c.key ? "border-brand-pink bg-brand-pink/15" : "border-border hover:bg-secondary"}`}>
            {loc(c)}
          </button>
        ))}
      </div>
      {!isLoading && !list.length && <p className="mt-3 text-sm text-muted-foreground">{t("aimatch.noService")}</p>}
      <Nav onNext={() => go("need")} disabled={!d.category_key} testId="match-next-service" />
    </section>
  );
}

function NeedStep({ d, set, go }) {
  const { t } = useI18n();
  const ok = d.description.trim().length >= 10;
  return (
    <section>
      <h1 className="text-xl font-extrabold">{t("aimatch.needTitle")}</h1>
      <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={5} maxLength={500} dir="auto"
        placeholder={t("aimatch.needPlaceholder")} className={`${ui.input} mt-3 py-3`} data-testid="match-description" />
      <p className="mt-1 text-xs text-muted-foreground">{t("aimatch.needHint")}</p>
      <h2 className="mt-5 font-bold">{t("aimatch.whenTitle")}</h2>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
        {["today", "week", "flexible"].map((w) => (
          <button key={w} type="button" role="radio" aria-checked={d.when === w} onClick={() => set({ when: w })} data-testid={`match-when-${w}`}
            className={`rounded-full border px-4 min-h-[44px] text-sm font-bold ${d.when === w ? "border-brand-pink bg-brand-pink/15" : "border-border"}`}>{t(`aimatch.when.${w}`)}</button>
        ))}
      </div>
      <Nav onBack={() => go("service")} onNext={() => go("place")} disabled={!ok} testId="match-next-need" />
    </section>
  );
}

function PlaceStep({ d, set, go }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const { data: wilayas = [] } = useWilayas();
  const communes = useQuery({ queryKey: ["communes", d.wilaya_code], queryFn: () => marketplaceService.communes(d.wilaya_code), enabled: Boolean(d.wilaya_code), staleTime: 300_000 });
  const [locating, setLocating] = useState(false);
  const useGps = async () => {
    setLocating(true);
    const pos = await getPosition();
    setLocating(false);
    if (pos.error) return toast.error(te(pos.error));
    set({ gps: pos });
  };
  return (
    <section>
      <h1 className="text-xl font-extrabold">{t("aimatch.placeTitle")}</h1>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label><span className={ui.label}>{t("aimatch.wilaya")}</span>
          <select value={d.wilaya_code} onChange={(e) => set({ wilaya_code: e.target.value, commune: "" })} className={`${ui.input} appearance-none`} data-testid="match-wilaya">
            <option value="">—</option>
            {wilayas.map((w) => <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, "0")} – ${loc(w)}`}</option>)}
          </select>
        </label>
        <label><span className={ui.label}>{t("aimatch.commune")}</span>
          <select value={d.commune} onChange={(e) => set({ commune: e.target.value })} disabled={!d.wilaya_code} className={`${ui.input} appearance-none`} data-testid="match-commune">
            <option value="">{t("aimatch.anyCommune")}</option>
            {(communes.data || []).map((c) => <option key={c.name_fr} value={c.name_fr}>{loc(c)}</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={d.gps ? () => set({ gps: null }) : useGps} disabled={locating} aria-pressed={Boolean(d.gps)} data-testid="match-gps"
        className={`mt-3 ${ui.btnOutline} ${d.gps ? "border-brand-electric bg-brand-electric/10" : ""}`}>
        {locating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={16} aria-hidden="true" />}{t("aimatch.useGps")}
      </button>
      {d.gps && <p className="mt-1 text-xs text-muted-foreground">{t("aimatch.gpsOn")}</p>}
      <h2 className="mt-5 font-bold">{t("aimatch.radius")}</h2>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
        {RADII.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={d.radius_km === r} onClick={() => set({ radius_km: r })} data-testid={`match-radius-${r}`}
            className={`rounded-full border px-4 min-h-[44px] text-sm font-bold ${d.radius_km === r ? "border-brand-pink bg-brand-pink/15" : "border-border"}`}>
            <span dir="ltr">{t("aimatch.km", { n: r })}</span>
          </button>
        ))}
      </div>
      <Nav onBack={() => go("need")} onNext={() => go("results")} nextLabel={t("aimatch.search")} disabled={!d.wilaya_code && !d.gps} testId="match-search" />
    </section>
  );
}

const SORTS = ["best", "today", "rating", "near"];
const availableToday = (p) => (p.match?.reasons || []).some((r) => r.code === "available_today");

function Results({ d, set, go }) {
  const { t } = useI18n();
  const { settings } = useConfig();
  const max = settings.request_max_recipients || 5;
  const [sort, setSort] = useState("best");
  const body = { kind: "professional", text: d.description, category_key: d.category_key, wilaya_code: d.wilaya_code ? Number(d.wilaya_code) : null,
    commune: d.commune || null, radius_km: d.radius_km, urgency: d.when === "today" ? "high" : "normal", ...(d.gps || {}) };
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["match-flow", body], queryFn: () => matchService.recommend(body), retry: 1, staleTime: 60_000 });
  const all = useMemo(() => [...(data?.items || []), ...(data?.alternatives || [])], [data]);
  const shown = useMemo(() => {
    const list = sort === "today" ? all.filter(availableToday) : [...all];
    if (sort === "rating") list.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
    if (sort === "near") list.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
    return list;
  }, [all, sort]);
  const toggle = (p) => set({ names: { ...d.names, [p.id]: p.display_name },
    selected: d.selected.includes(p.id) ? d.selected.filter((x) => x !== p.id) : d.selected.length >= max ? d.selected : [...d.selected, p.id] });

  if (isLoading) {
    return (
      <section className="gf-card p-6 text-center" data-testid="match-analysing" aria-live="polite">
        <Loader2 size={32} className="mx-auto animate-spin text-brand-electric" aria-hidden="true" />
        <p className="mt-3 text-lg font-extrabold">{t("aimatch.analysing")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("aimatch.analysingText")}</p>
        <button type="button" onClick={() => go("place")} className={`${ui.btnOutline} mt-4`}>{t("aimatch.cancel")}</button>
      </section>
    );
  }
  if (isError) {
    return (
      <section className="gf-card p-6" role="alert" data-testid="match-error">
        <p className="font-bold">{t("aimatch.error")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => refetch()} className={ui.btnPrimary}>{t("aimatch.retry")}</button>
          <button type="button" onClick={() => go("place")} className={ui.btnOutline}>{t("aimatch.edit")}</button>
        </div>
      </section>
    );
  }
  if (!all.length) {
    const wider = RADII.find((r) => r > d.radius_km);
    return (
      <section className="gf-card p-6" data-testid="match-empty">
        <p className="text-lg font-extrabold text-brand-orange">{t("aimatch.emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("aimatch.emptyText")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {wider && <button type="button" onClick={() => set({ radius_km: wider })} className={ui.btnGradient} data-testid="match-widen">{t("aimatch.widen", { n: wider })}</button>}
          <button type="button" onClick={() => go("service")} className={ui.btnOutline}>{t("aimatch.edit")}</button>
        </div>
      </section>
    );
  }
  return (
    <section data-testid="match-results">
      <h1 className="text-xl font-extrabold">{t("aimatch.resultsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("aimatch.resultsCount", { n: all.length })} · <span dir="auto">{t("aimatch.within", { n: d.radius_km })}</span></p>
      <div className="mt-3 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 w-max">
          {SORTS.map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} data-testid={`match-sort-${s}`}
              className={`rounded-full border px-3 min-h-[40px] text-xs font-bold whitespace-nowrap ${sort === s ? "border-brand-orange bg-brand-orange/15" : "border-border"}`}>{t(`aimatch.sort.${s}`)}</button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("aimatch.selectHint", { n: max })}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => {
          const on = d.selected.includes(p.id);
          return (
            <div key={p.id} className="min-w-0 flex flex-col gap-2">
              <ProCard p={p} index={i} />
              {!p.is_owner && (
                <button type="button" onClick={() => toggle(p)} aria-pressed={on} data-testid={`match-select-${p.id}`}
                  className={`${ui.btnOutline} ${on ? "border-brand-pink bg-brand-pink/15" : ""}`}>
                  {on && <Check size={16} aria-hidden="true" />}{t(on ? "aimatch.selected" : "aimatch.select")}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!shown.length && <p className="mt-3 text-sm text-muted-foreground">{t("aimatch.emptyText")}</p>}
      <div className="mt-6 flex justify-between gap-2">
        <button type="button" onClick={() => go("place")} className={ui.btnOutline}><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{t("aimatch.back")}</button>
        <button type="button" onClick={() => go("recap")} disabled={!d.selected.length} className={ui.btnGradient} data-testid="match-quote">{t("aimatch.quote", { n: d.selected.length })}</button>
      </div>
    </section>
  );
}

function Recap({ d, go, onSent }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: wilayas = [] } = useWilayas();
  const pros = d.selected.map((id) => ({ id, display_name: d.names[id] }));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [idem] = useState(() => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`); // one key per recap: a double tap sends once
  const wilaya = wilayas.find((w) => String(w.code) === String(d.wilaya_code));
  const send = async () => {
    setBusy(true);
    try {
      const res = await requestService.create({ kind: "professional", profile_ids: d.selected, category_key: d.category_key,
        wilaya_code: d.wilaya_code ? Number(d.wilaya_code) : null, commune: d.commune || null, message: d.description.trim() }, idem);
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      onSent(res);
    } catch (err) {
      const code = errorCode(err);
      toast.error(te(code));
      if (code === "plan_required") navigate("/pricing");
      setBusy(false);
    }
  };
  return (
    <section data-testid="match-recap">
      <h1 className="text-xl font-extrabold">{t("aimatch.recapTitle")}</h1>
      <dl className="gf-card mt-3 p-4 space-y-3 text-sm">
        <div><dt className="text-muted-foreground">{t("aimatch.recapNeed")}</dt><dd className="font-semibold whitespace-pre-line" dir="auto">{d.description}</dd></div>
        <div><dt className="text-muted-foreground">{t("aimatch.recapPlace")}</dt><dd className="font-semibold">{[d.commune, wilaya && loc(wilaya)].filter(Boolean).join(", ") || "—"}</dd></div>
        <div><dt className="text-muted-foreground">{t("aimatch.recapPros")}</dt>
          <dd><ul className="mt-1 space-y-1">{pros.map((p) => <li key={p.id} className="font-semibold">{p.display_name}</li>)}</ul></dd></div>
      </dl>
      {user ? (
        <label className="mt-4 flex items-start gap-3 text-sm min-h-[44px]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" data-testid="match-consent" />
          {t("aimatch.consent")}
        </label>
      ) : <p className="mt-4 gf-card p-4 text-sm" data-testid="match-login">{t("aimatch.loginToSend")}</p>}
      <div className="mt-6 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go("results")} className={ui.btnOutline}><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{t("aimatch.back")}</button>
        {user ? (
          <button type="button" onClick={send} disabled={!consent || busy || !pros.length} className={ui.btnGradient} data-testid="match-send">
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{t("aimatch.send")}
          </button>
        ) : <Link to="/login" state={{ from: "/match?step=recap" }} className={ui.btnGradient}>{t("nav.login")}</Link>}
      </div>
    </section>
  );
}

function Sent({ res, reset }) {
  const { t } = useI18n();
  return (
    <section className="gf-card p-6 text-center" data-testid="match-sent">
      <CheckCircle2 size={44} className="mx-auto text-brand-electric" aria-hidden="true" />
      <h1 className="mt-3 text-xl font-extrabold">{t("aimatch.sentTitle")}</h1>
      {res?.ref && <p className="mt-1 font-mono text-sm" dir="ltr" data-testid="match-ref">{t("aimatch.sentRef", { ref: res.ref })}</p>}
      <p className="mt-2 text-sm text-muted-foreground">{t("aimatch.sentText")}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to="/requests" className={ui.btnGradient} data-testid="match-track">{t("aimatch.track")}</Link>
        <button type="button" onClick={reset} className={ui.btnOutline}>{t("aimatch.newSearch")}</button>
      </div>
    </section>
  );
}

export default function Match() {
  const { t } = useI18n();
  const { flag } = useConfig();
  const [params, setParams] = useSearchParams();
  const [d, set, clear] = useDraft();
  const [sent, setSent] = useState(null);
  const valid = { service: true, need: Boolean(d.category_key), place: d.description.trim().length >= 10,
    results: Boolean(d.wilaya_code || d.gps), recap: d.selected.length > 0 };
  // A step whose earlier answers are missing (old link, cleared storage) falls back to the first step.
  const asked = params.get("step") || "service";
  const step = sent ? "sent" : valid[asked] ? asked : "service";
  const go = (s) => {
    setParams({ step: s });
    window.scrollTo({ top: 0 });
  };
  if (!flag("ai_match")) return <div className={`${ui.container} py-10`}><p className="gf-card p-6 text-sm">{t("errors.feature_disabled")}</p></div>;
  return (
    <div className={`${ui.container} max-w-3xl py-6 sm:py-10`} data-testid="match-page">
      <PageHeader eyebrow={t("aimatch.eyebrow")} title={t("aimatch.title")} subtitle={step === "service" ? t("aimatch.subtitle") : ""} />
      {step !== "sent" && <Progress step={step === "recap" ? "results" : step} />}
      {step === "service" && <ServiceStep d={d} set={set} go={go} />}
      {step === "need" && <NeedStep d={d} set={set} go={go} />}
      {step === "place" && <PlaceStep d={d} set={set} go={go} />}
      {step === "results" && <Results d={d} set={set} go={go} />}
      {step === "recap" && <Recap d={d} go={go} onSent={(res) => { setSent(res); clear(); setParams({ step: "sent" }, { replace: true }); }} />}
      {step === "sent" && <Sent res={sent} reset={() => { setSent(null); go("service"); }} />}
    </div>
  );
}
