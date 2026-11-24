import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeft, BellRing, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Download, FileText, Inbox, Lightbulb,
  Loader2, Lock, MessageSquare, Plus, Send, Settings, Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useConfig, useWilayas } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { dayKey, errorCode, formatDate, formatDateTime, formatMinor, formatTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { marketplaceService, proAiService, quoteService } from "@/services/marketplaceService";

const TABS = [
  { key: "home", icon: Sparkles }, { key: "leads", icon: Inbox }, { key: "quotes", icon: FileText }, { key: "followups", icon: BellRing },
  { key: "agenda", icon: CalendarDays }, { key: "assistant", icon: Wand2 }, { key: "settings", icon: Settings },
];
const LEAD_FILTERS = ["open", "new", "qualified", "quoted", "won", "lost"];
const LEAD_MOVES = { new: ["qualified", "lost"], qualified: ["new", "lost"], quoted: ["won", "lost"], lost: ["qualified"], won: [] };
const QUOTE_FILTERS = ["all", "draft", "sent", "accepted", "rejected", "expired"];
const STATUS_COLOR = {
  new: "bg-brand-electric/15 text-brand-electric", qualified: "bg-brand-violet/15", quoted: "bg-brand-orange/15 text-brand-orange",
  won: "bg-emerald-500/15 text-emerald-500", lost: "bg-secondary text-muted-foreground",
  draft: "bg-secondary text-muted-foreground", sent: "bg-brand-orange/15 text-brand-orange", accepted: "bg-emerald-500/15 text-emerald-500",
  rejected: "bg-destructive/15 text-destructive", expired: "bg-secondary text-muted-foreground",
  proposed: "bg-brand-orange/15 text-brand-orange", scheduled: "bg-brand-electric/15 text-brand-electric", completed: "bg-emerald-500/15 text-emerald-500",
};
const PURPOSES = ["reply", "quote_intro", "followup", "reschedule", "thanks", "decline"];
const TIP_LINK = { followups: "/pro-ai?tab=followups", leads: "/pro-ai?tab=leads", quotes: "/pro-ai?tab=quotes", pricing: "/pricing",
  passport: "/account/passport", assistant: "/pro-ai?tab=assistant", agenda: "/pro-ai?tab=agenda" };
const newKey = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`);

function Badge({ status, group = "status" }) {
  const { t } = useI18n();
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${STATUS_COLOR[status] || "bg-secondary"}`}>{t(`proai.${group}.${status}`)}</span>;
}

function Card({ title, children, testId, action }) {
  return (
    <section className="gf-card p-4 sm:p-5" data-testid={testId}>
      {(title || action) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-extrabold">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function ErrorBox({ error, onRetry }) {
  const { t, te } = useI18n();
  return (
    <div className="gf-card p-5 text-center" role="alert">
      <p className="text-sm">{te(errorCode(error))}</p>
      {onRetry && <button type="button" onClick={onRetry} className={`${ui.btnOutline} mt-3`}>{t("proai.retry")}</button>}
    </div>
  );
}

/** Trade / subject label of a lead or quote, in the current language. */
function useServiceLabel() {
  const loc = useLocalized();
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => marketplaceService.categories(), staleTime: 300_000 });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: marketplaceService.subjects, staleTime: 300_000 });
  const { data: wilayas = [] } = useWilayas();
  return {
    service: (x) => (x?.subject_key && !x?.category_key ? loc(subjects.data?.find((s) => s.key === x.subject_key)) : loc(cats.data?.find((c) => c.key === x?.category_key))) || "—",
    place: (x) => [x?.commune, loc(wilayas.find((w) => w.code === x?.wilaya_code))].filter(Boolean).join(", "),
  };
}

const run = async (fn, okMsg, te) => {
  try {
    const out = await fn();
    if (okMsg) toast.success(okMsg);
    return out ?? true;
  } catch (err) {
    toast.error(te(errorCode(err)));
    return null;
  }
};

// ---------------------------------------------------------------- entry point on the pro dashboard
export function ProAiCta() {
  const { t } = useI18n();
  const { flag } = useConfig();
  if (!flag("pro_ai")) return null;
  return (
    <div className="gf-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="proai-cta">
      <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-brand-electric/15 text-brand-electric"><Sparkles size={22} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{t("proai.cta.title")}</p>
        <p className="text-sm text-muted-foreground">{t("proai.cta.text")}</p>
      </div>
      <Link to="/pro-ai" className={`${ui.btnGradient} shrink-0`} data-testid="proai-cta-open">{t("proai.cta.button")}</Link>
    </div>
  );
}

// ---------------------------------------------------------------- home: indicators + coach
function Kpi({ label, value, hint, testId }) {
  return (
    <div className="rounded-2xl border border-border p-3 min-w-0" data-testid={testId}>
      <p className="text-xl sm:text-2xl font-extrabold truncate" dir="ltr">{value ?? "—"}</p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function HomeTab() {
  const { t } = useI18n();
  const [period, setPeriod] = useState("month");
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ["proai-dash", period], queryFn: () => proAiService.dashboard(period) });
  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;
  return (
    <div className="space-y-4">
      <Card title={t("proai.home.coach")} testId="proai-tips">
        {d.tips.length ? (
          <ul className="space-y-2">
            {d.tips.map((tip) => (
              <li key={tip.key} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <Lightbulb size={18} className={`mt-0.5 shrink-0 ${tip.level === "high" ? "text-brand-orange" : "text-brand-electric"}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{t(`proai.tips.${tip.key}.title`, tip.values)}</p>
                  <p className="text-xs text-muted-foreground">{t(`proai.tips.${tip.key}.why`, tip.values)}</p>
                </div>
                <Link to={TIP_LINK[tip.action]} className={`${ui.btnOutline} min-h-[40px] px-3 text-xs shrink-0`}>{t(`proai.tips.${tip.key}.cta`)}</Link>
              </li>
            ))}
          </ul>
        ) : <Empty>{t("proai.home.noTips")}</Empty>}
      </Card>
      <Card title={t("proai.home.indicators")} testId="proai-kpis"
        action={<select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${ui.input} min-h-[40px] w-auto py-1 text-sm`} aria-label={t("proai.home.period")} data-testid="proai-period">
          {["week", "month", "quarter", "year"].map((p) => <option key={p} value={p}>{t(`proai.periods.${p}`)}</option>)}
        </select>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi label={t("proai.kpi.leads")} value={d.leads_received} hint={d.leads_locked ? t("proai.kpi.locked", { n: d.leads_locked }) : null} testId="kpi-leads" />
          <Kpi label={t("proai.kpi.quotesSent")} value={d.quotes_sent} testId="kpi-quotes" />
          <Kpi label={t("proai.kpi.accepted")} value={d.quotes_accepted} />
          <Kpi label={t("proai.kpi.conversion")} value={d.conversion_pct == null ? null : `${d.conversion_pct} %`} />
          <Kpi label={t("proai.kpi.response")} value={d.response_hours_median == null ? null : `${d.response_hours_median} h`} />
          <Kpi label={t("proai.kpi.pending")} value={d.quotes_pending} />
          <Kpi label={t("proai.kpi.jobs")} value={d.jobs_completed} />
          <Kpi label={t("proai.kpi.rating")} value={d.rating_count ? `${d.rating_avg}/5` : null} hint={d.rating_count ? t("proai.kpi.reviews", { n: d.rating_count }) : null} />
        </div>
        <h3 className="mt-4 text-sm font-extrabold">{t("proai.kpi.money")}</h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Kpi label={t("proai.kpi.quoted")} value={formatMinor(d.amount_quoted_minor)} />
          <Kpi label={t("proai.kpi.signed")} value={formatMinor(d.amount_accepted_minor)} />
          <Kpi label={t("proai.kpi.declared")} value={formatMinor(d.revenue_declared_da * 100)} testId="kpi-declared" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("proai.kpi.moneyNote")}</p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- leads
function LeadsTab() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("open");
  const { service, place } = useServiceLabel();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-leads"], queryFn: () => proAiService.leads() });
  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;
  const items = data.items.filter((l) => (filter === "open" ? ["new", "qualified", "quoted"].includes(l.status) : l.status === filter));
  const count = (f) => (f === "open" ? data.counts.new + data.counts.qualified + data.counts.quoted : data.counts[f]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label={t("proai.leads.filter")}>
        {LEAD_FILTERS.map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} data-testid={`lead-filter-${f}`}
            className={`shrink-0 rounded-full border px-3 min-h-[40px] text-sm font-bold ${filter === f ? "border-transparent gf-gradient-bg text-[#070911]" : "border-border"}`}>
            {t(`proai.leads.filters.${f}`)} <span dir="ltr">({count(f)})</span>
          </button>
        ))}
      </div>
      {items.length === 0 ? <Empty>{t("proai.leads.empty")}</Empty> : (
        <ul className="space-y-2" data-testid="proai-leads">
          {items.map((l) => (
            <li key={l.id}>
              <Link to={`/pro-ai/leads/${l.id}`} className="gf-card block p-4 hover:border-brand-electric/50" data-testid="proai-lead">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{service(l)}</p>
                    <p className="text-xs text-muted-foreground truncate">{[l.client_name, place(l)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Badge status={l.status} />
                </div>
                {l.locked ? <p className="mt-2 flex items-center gap-1 text-xs text-brand-orange"><Lock size={13} aria-hidden="true" />{t("proai.leads.locked")}</p>
                  : <p className="mt-2 text-sm text-muted-foreground line-clamp-2" dir="auto">{l.message}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{formatDateTime(l.created_at)}</span>
                  {l.source === "ai_match" && <span className="font-bold text-brand-electric">AI MATCH</span>}
                  {l.priority === "high" && <span className="font-bold text-brand-orange">{t("proai.priority.high")}</span>}
                  {l.quotes > 0 && <span>{t("proai.leads.quotes", { n: l.quotes })}</span>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeadPage() {
  const { id } = useParams();
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { service, place } = useServiceLabel();
  const { data: l, isLoading, error, refetch } = useQuery({ queryKey: ["proai-lead", id], queryFn: () => proAiService.lead(id) });
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["proai-lead", id] }); qc.invalidateQueries({ queryKey: ["proai-leads"] }); };
  const patch = async (body, key) => {
    setBusy(key);
    const out = await run(() => proAiService.patchLead(id, body), t("proai.saved"), te);
    setBusy(null);
    if (out) { qc.setQueryData(["proai-lead", id], out); qc.invalidateQueries({ queryKey: ["proai-leads"] }); }
  };

  let body;
  if (isLoading) body = <Skeleton className="h-96 rounded-3xl" />;
  else if (error) body = <ErrorBox error={error} onRetry={refetch} />;
  else body = (
    <div className="space-y-4">
      <Card testId="lead-detail">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold">{service(l)}</h1>
            <p className="text-xs text-muted-foreground" dir="auto">{[l.ref, l.client_name, place(l)].filter(Boolean).join(" · ")}</p>
          </div>
          <Badge status={l.status} />
        </div>
        {l.locked ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-orange/10 p-3 text-sm"><Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{t("proai.leads.lockedHint")} <Link to="/pricing" className="font-bold underline">{t("proai.leads.subscribe")}</Link></span></p>
        ) : <p className="mt-3 whitespace-pre-line text-sm" dir="auto">{l.message}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">{formatDateTime(l.created_at)}{l.source === "ai_match" ? " · AI MATCH" : ""}</p>
        {!l.locked && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => nav(`/pro-ai/leads/${id}/quote`)} className={ui.btnGradient} data-testid="lead-new-quote"><FileText size={16} aria-hidden="true" />{t("proai.leads.newQuote")}</button>
            {l.conversation_id
              ? <Link to={`/messages/${l.conversation_id}`} className={ui.btnOutline}><MessageSquare size={16} aria-hidden="true" />{t("proai.leads.openChat")}</Link>
              : null}
            <Link to={`/pro-ai?tab=assistant&lead=${id}`} className={ui.btnOutline}><Wand2 size={16} aria-hidden="true" />{t("proai.leads.draftReply")}</Link>
          </div>
        )}
      </Card>

      {!l.locked && (
        <Card title={t("proai.leads.qualify")} testId="lead-qualify">
          <div className="flex flex-wrap gap-2">
            {LEAD_MOVES[l.status].map((s) => (
              <button key={s} type="button" disabled={busy === "status"} onClick={() => patch({ status: s }, "status")} className={ui.btnOutline} data-testid={`lead-move-${s}`}>
                {t(`proai.moves.${s}`)}
              </button>
            ))}
          </div>
          <label className={`${ui.label} mt-4`} htmlFor="lead-priority">{t("proai.priority.label")}</label>
          <select id="lead-priority" value={l.priority} onChange={(e) => patch({ priority: e.target.value }, "priority")} className={`${ui.input} min-h-[44px]`}>
            {["low", "normal", "high"].map((p) => <option key={p} value={p}>{t(`proai.priority.${p}`)}</option>)}
          </select>
          <label className={`${ui.label} mt-4`} htmlFor="lead-note">{t("proai.leads.note")}</label>
          <textarea id="lead-note" rows={3} maxLength={1000} value={note ?? l.note} onChange={(e) => setNote(e.target.value)} className={`${ui.input} py-3`} placeholder={t("proai.leads.notePh")} />
          {note !== null && note !== l.note && (
            <button type="button" onClick={() => patch({ note }, "note").then(() => setNote(null))} className={`${ui.btnPrimary} mt-2`} disabled={busy === "note"}>{t("proai.save")}</button>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">{t("proai.leads.notePrivate")}</p>
        </Card>
      )}

      <Card title={t("proai.quotes.title")} testId="lead-quotes">
        {l.quotes.length ? <QuoteList items={l.quotes} /> : <Empty>{t("proai.quotes.empty")}</Empty>}
      </Card>

      {!l.locked && <AppointmentForm lead={l} onDone={refresh} />}
      {!l.locked && <ReminderForm lead={l} onDone={refresh} />}
    </div>
  );
  return (
    <div className={`${ui.container} py-6 max-w-3xl`} data-testid="proai-lead-page">
      <Link to="/pro-ai?tab=leads" className={`${ui.btnGhost} -ms-3 mb-2`}><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{t("proai.tabs.leads")}</Link>
      {body}
    </div>
  );
}

function AppointmentForm({ lead, onDone }) {
  const { t, te } = useI18n();
  const [f, setF] = useState({ start: "", duration: 60, price: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e, allow = false) => {
    e?.preventDefault?.();
    if (!f.start) return;
    setBusy(true);
    try {
      await proAiService.createAppointment({ lead_id: lead.id, start_at: new Date(f.start).toISOString(), duration_min: Number(f.duration),
        price_da: f.price === "" ? null : Number(f.price), allow_conflict: allow });
      toast.success(t("proai.agenda.proposed"));
      setF({ start: "", duration: 60, price: "" });
      onDone();
    } catch (err) {
      if (errorCode(err) === "time_conflict" && window.confirm(t("proai.agenda.conflictConfirm"))) { setBusy(false); return submit(null, true); }
      toast.error(te(errorCode(err)));
    }
    setBusy(false);
  };
  return (
    <Card title={t("proai.agenda.add")} testId="lead-appointment">
      {lead.appointments.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {lead.appointments.map((a) => (
            <li key={a.id}><Link to={`/jobs/${a.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <span dir="ltr">{formatDateTime(a.scheduled_at)}</span><Badge status={a.status} group="jobStatus" />
            </Link></li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold sm:col-span-3">{t("proai.agenda.when")}
          <input type="datetime-local" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className={`${ui.input} mt-1`} data-testid="appointment-start" />
        </label>
        <label className="text-sm font-semibold">{t("proai.agenda.duration")}
          <select value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} className={`${ui.input} mt-1`}>
            {[30, 60, 90, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">{t("proai.agenda.price")}
          <input type="number" min="0" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={`${ui.input} mt-1`} placeholder="DA" />
        </label>
        <button type="submit" disabled={busy || !f.start} className={`${ui.btnPrimary} sm:col-span-3`} data-testid="appointment-submit">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CalendarDays size={16} aria-hidden="true" />}{t("proai.agenda.propose")}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("proai.agenda.clientConfirms")}</p>
    </Card>
  );
}

function ReminderForm({ lead, onDone }) {
  const { t, te } = useI18n();
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => proAiService.scheduleFollowup({ lead_id: lead.id, due_at: new Date(due).toISOString(), note }), t("proai.followups.scheduled"), te)) {
      setDue(""); setNote(""); onDone();
    }
  };
  const pending = lead.followups.filter((f) => f.status === "pending");
  return (
    <Card title={t("proai.followups.remindMe")} testId="lead-reminder">
      {pending.map((f) => <p key={f.id} className="mb-2 text-sm"><BellRing size={14} className="inline me-1" aria-hidden="true" /><span dir="ltr">{formatDateTime(f.due_at)}</span>{f.note ? ` · ${f.note}` : ""}</p>)}
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="datetime-local" required value={due} onChange={(e) => setDue(e.target.value)} className={ui.input} aria-label={t("proai.followups.when")} />
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={ui.input} placeholder={t("proai.followups.notePh")} aria-label={t("proai.followups.notePh")} />
        <button type="submit" disabled={!due} className={ui.btnOutline}><BellRing size={16} aria-hidden="true" />{t("proai.followups.plan")}</button>
      </form>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("proai.followups.reminderOnly")}</p>
    </Card>
  );
}

// ---------------------------------------------------------------- quotes
function QuoteList({ items }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-2" data-testid="quote-list">
      {items.map((q) => (
        <li key={q.id}>
          <Link to={`/pro-ai/quotes/${q.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 hover:border-brand-electric/50">
            <span className="min-w-0">
              <span className="block text-sm font-bold" dir="ltr">{q.ref}</span>
              <span className="block text-xs text-muted-foreground truncate">{[q.client_name, q.sent_at ? t("proai.quotes.sentOn", { date: formatDate(q.sent_at) }) : formatDate(q.created_at)].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-extrabold" dir="ltr">{formatMinor(q.total_minor)}</span>
              <Badge status={q.status} group="quoteStatus" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function QuotesTab() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-quotes"], queryFn: () => proAiService.quotes() });
  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;
  const items = data.items.filter((q) => filter === "all" || q.status === filter);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {QUOTE_FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full border px-3 min-h-[40px] text-sm font-bold ${filter === f ? "border-transparent gf-gradient-bg text-[#070911]" : "border-border"}`}>
            {f === "all" ? t("proai.quotes.all") : t(`proai.quoteStatus.${f}`)}
          </button>
        ))}
      </div>
      {items.length ? <QuoteList items={items} /> : <Empty>{t("proai.quotes.emptyAll")}</Empty>}
      <p className="text-xs text-muted-foreground">{t("proai.quotes.fromLead")}</p>
    </div>
  );
}

const toLine = (it) => ({ label: it.label, qty: String(it.qty), price: String(it.unit_price_minor / 100) });
const toMinor = (v) => Math.round(Number(String(v).replace(",", ".")) * 100);
const lineTotal = (l) => Math.round(Number(String(l.qty).replace(",", ".")) * toMinor(l.price));

/** Quote editor (draft) and preview + explicit send. /pro-ai/leads/:leadId/quote (new) or /pro-ai/quotes/:id. */
export function QuoteEditorPage() {
  const { id, leadId } = useParams();
  const { t, te, lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { service } = useServiceLabel();
  const existing = useQuery({ queryKey: ["proai-quote", id], queryFn: () => proAiService.quote(id), enabled: Boolean(id) });
  const settings = useQuery({ queryKey: ["proai-settings"], queryFn: proAiService.settings, enabled: !id });
  const [form, setForm] = useState(null);
  const [key] = useState(newKey);
  const [step, setStep] = useState("edit");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const q = existing.data;
  const f = form || (q ? { lines: q.items.map(toLine), notes: q.notes, valid_days: q.valid_days }
    : { lines: [{ label: "", qty: "1", price: "" }], notes: settings.data?.default_notes || "", valid_days: settings.data?.quote_valid_days || 15 });
  // Functional updates: two quick edits in a row never overwrite each other.
  const set = (p) => setForm((prev) => { const b = prev || f; return { ...b, ...(typeof p === "function" ? p(b) : p) }; });
  const setLine = (i, p) => set((b) => ({ lines: b.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) }));
  const total = f.lines.reduce((s, l) => s + (lineTotal(l) || 0), 0);
  const valid = f.lines.length > 0 && f.lines.every((l) => l.label.trim().length >= 2 && Number(String(l.qty).replace(",", ".")) > 0 && String(l.price) !== "" && toMinor(l.price) >= 0);
  const editable = !id || q?.status === "draft";

  const save = async () => {
    const body = { items: f.lines.map((l) => ({ label: l.label.trim(), qty: Number(String(l.qty).replace(",", ".")), unit_price_minor: toMinor(l.price) })),
      notes: f.notes, valid_days: Number(f.valid_days) };
    setBusy("save");
    const out = await run(() => (id ? proAiService.updateQuote(id, body) : proAiService.createQuote({ ...body, lead_id: leadId, currency: "DZD" }, key)), t("proai.quotes.saved"), te);
    setBusy(null);
    if (!out) return null;
    qc.setQueryData(["proai-quote", out.id], out);
    setForm(null);
    if (!id) nav(`/pro-ai/quotes/${out.id}`, { replace: true });
    return out;
  };
  const toPreview = async () => {
    const out = await save();
    if (out) setStep("preview");
  };
  const prefill = async () => {
    const out = await run(() => proAiService.draft({ purpose: "quote_intro", quote_id: id, lang }), null, te);
    if (out) setMessage(out.text);
  };
  const send = async () => {
    setBusy("send");
    const out = await run(() => proAiService.sendQuote(id, message), t("proai.quotes.sentOk"), te);
    setBusy(null);
    if (out) {
      qc.setQueryData(["proai-quote", id], out);
      qc.invalidateQueries({ queryKey: ["proai-leads"] });
      qc.invalidateQueries({ queryKey: ["proai-quotes"] });
      setStep("edit");
    }
  };
  const remove = async () => {
    if (!window.confirm(t("proai.quotes.deleteConfirm"))) return;
    if (await run(() => proAiService.deleteQuote(id), t("proai.quotes.deleted"), te)) nav(`/pro-ai/leads/${q.request_id}`, { replace: true });
  };

  const back = q?.request_id || leadId;
  let body;
  if (id && existing.isLoading) body = <Skeleton className="h-96 rounded-3xl" />;
  else if (id && existing.error) body = <ErrorBox error={existing.error} onRetry={existing.refetch} />;
  else if (!editable || step === "preview") body = (
    <div className="space-y-4">
      <QuoteDocument q={q} serviceLabel={service(q)} />
      {editable ? (
        <Card title={t("proai.quotes.sendTitle")} testId="quote-send">
          <p className="text-sm">{t("proai.quotes.recipient", { name: q.client_name || "—" })}</p>
          <label className={`${ui.label} mt-3`} htmlFor="quote-msg">{t("proai.quotes.message")}</label>
          <textarea id="quote-msg" rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className={`${ui.input} py-3`} dir="auto" placeholder={t("proai.quotes.messagePh")} />
          <button type="button" onClick={prefill} className={`${ui.btnGhost} mt-1 text-sm`}><Wand2 size={16} aria-hidden="true" />{t("proai.assistant.suggest")}</button>
          <div className="mt-3 flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" onClick={() => setStep("edit")} className={ui.btnOutline}>{t("proai.quotes.edit")}</button>
            <button type="button" onClick={send} disabled={busy === "send"} className={`${ui.btnGradient} sm:flex-1`} data-testid="quote-confirm-send">
              {busy === "send" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{t("proai.quotes.confirmSend")}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("proai.quotes.sendNote")}</p>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {q.conversation_id && <Link to={`/messages/${q.conversation_id}`} className={ui.btnOutline}><MessageSquare size={16} aria-hidden="true" />{t("proai.leads.openChat")}</Link>}
          {["sent", "expired"].includes(q.status) && <Link to="/pro-ai?tab=followups" className={ui.btnOutline}><BellRing size={16} aria-hidden="true" />{t("proai.followups.title")}</Link>}
        </div>
      )}
    </div>
  );
  else body = (
    <Card testId="quote-editor">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{q ? <span dir="ltr">{q.ref}</span> : t("proai.quotes.new")}</h1>
        <Badge status="draft" group="quoteStatus" />
      </div>
      <ul className="mt-4 space-y-3">
        {f.lines.map((l, i) => (
          <li key={i} className="rounded-2xl border border-border p-3" data-testid="quote-line">
            <div className="flex gap-2">
              <input value={l.label} maxLength={120} onChange={(e) => setLine(i, { label: e.target.value })} className={ui.input} placeholder={t("proai.quotes.labelPh")}
                aria-label={t("proai.quotes.label")} data-testid="quote-line-label" />
              {f.lines.length > 1 && <button type="button" onClick={() => set((b) => ({ lines: b.lines.filter((_, j) => j !== i) }))} className={`${ui.btnGhost} shrink-0`} aria-label={t("proai.quotes.removeLine")}><Trash2 size={16} aria-hidden="true" /></button>}
            </div>
            <div className="mt-2 grid grid-cols-[5.5rem_1fr] gap-2">
              <label className="text-xs font-semibold">{t("proai.quotes.qty")}
                <input type="number" min="0.01" step="0.01" inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className={`${ui.input} mt-1`} data-testid="quote-line-qty" />
              </label>
              <label className="text-xs font-semibold">{t("proai.quotes.unitPrice")}
                <input type="number" min="0" step="0.01" inputMode="decimal" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} className={`${ui.input} mt-1`} placeholder="DA" data-testid="quote-line-price" />
              </label>
            </div>
            <p className="mt-2 text-end text-sm font-bold" dir="ltr">{formatMinor(lineTotal(l) || 0)}</p>
          </li>
        ))}
      </ul>
      {f.lines.length < 30 && <button type="button" onClick={() => set((b) => ({ lines: [...b.lines, { label: "", qty: "1", price: "" }] }))} className={`${ui.btnOutline} mt-3 w-full`} data-testid="quote-add-line"><Plus size={16} aria-hidden="true" />{t("proai.quotes.addLine")}</button>}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
        <span className="font-bold">{t("proai.quotes.total")}</span>
        <span className="text-lg font-extrabold" dir="ltr" data-testid="quote-total">{formatMinor(total)}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{t("proai.quotes.serverTotal")}</p>
      <label className={`${ui.label} mt-4`} htmlFor="quote-notes">{t("proai.quotes.notes")}</label>
      <textarea id="quote-notes" rows={3} maxLength={1000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${ui.input} py-3`} placeholder={t("proai.quotes.notesPh")} />
      <label className={`${ui.label} mt-4`} htmlFor="quote-valid">{t("proai.quotes.validity")}</label>
      <select id="quote-valid" value={f.valid_days} onChange={(e) => set({ valid_days: e.target.value })} className={`${ui.input} min-h-[44px]`}>
        {[7, 15, 30, 60, 90].map((d) => <option key={d} value={d}>{t("proai.quotes.days", { n: d })}</option>)}
      </select>
      <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2">
        {id && <button type="button" onClick={remove} className={`${ui.btnGhost} text-destructive`}><Trash2 size={16} aria-hidden="true" />{t("proai.quotes.delete")}</button>}
        <button type="button" onClick={save} disabled={!valid || busy === "save"} className={ui.btnOutline} data-testid="quote-save">{t("proai.quotes.saveDraft")}</button>
        <button type="button" onClick={toPreview} disabled={!valid || busy === "save"} className={`${ui.btnGradient} sm:flex-1`} data-testid="quote-preview">{t("proai.quotes.previewSend")}</button>
      </div>
    </Card>
  );
  return (
    <div className={`${ui.container} py-6 max-w-3xl`} data-testid="proai-quote-page">
      {back && <Link to={`/pro-ai/leads/${back}`} className={`${ui.btnGhost} -ms-3 mb-2`}><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{t("proai.quotes.backLead")}</Link>}
      {body}
    </div>
  );
}

/** The quote as a document (pro preview and client view). */
function QuoteDocument({ q, serviceLabel }) {
  const { t } = useI18n();
  return (
    <article className="gf-card p-4 sm:p-5" data-testid="quote-document">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="gf-eyebrow">{t("proai.quotes.document")}</p>
          <h1 className="text-xl font-extrabold" dir="ltr">{q.ref}</h1>
          <p className="text-sm text-muted-foreground truncate">{[q.provider_display_name, serviceLabel].filter(Boolean).join(" · ")}</p>
        </div>
        <Badge status={q.status} group="quoteStatus" />
      </div>
      <ul className="mt-4 divide-y divide-border">
        {q.items.map((it, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="min-w-0"><span className="block font-semibold break-words" dir="auto">{it.label}</span>
              <span className="block text-xs text-muted-foreground" dir="ltr">{String(it.qty).replace(".", ",")} × {formatMinor(it.unit_price_minor)}</span></span>
            <span className="shrink-0 font-bold" dir="ltr">{formatMinor(it.total_minor)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
        <span className="font-bold">{t("proai.quotes.total")}</span>
        <span className="text-lg font-extrabold" dir="ltr" data-testid="quote-doc-total">{formatMinor(q.total_minor)}</span>
      </div>
      {q.notes && <p className="mt-3 whitespace-pre-line text-sm" dir="auto">{q.notes}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        {q.expires_at ? t("proai.quotes.validUntil", { date: formatDate(q.expires_at) }) : t("proai.quotes.validFor", { n: q.valid_days })}
        {q.decided_at ? ` · ${t(`proai.quotes.decidedOn.${q.status}`, { date: formatDate(q.decided_at) })}` : ""}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{t("proai.quotes.disclaimer")}</p>
    </article>
  );
}

/** /quotes/:id: what the client received (and the pro's read-only view). */
export function ClientQuote() {
  const { id } = useParams();
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const { service } = useServiceLabel();
  const { data: q, isLoading, error, refetch } = useQuery({ queryKey: ["quote", id], queryFn: () => quoteService.view(id), retry: false });
  const [busy, setBusy] = useState(null);
  const act = async (key, fn, ok) => {
    setBusy(key);
    const out = await run(fn, ok, te);
    setBusy(null);
    if (out) qc.setQueryData(["quote", id], (old) => ({ ...old, ...out }));
  };
  const reject = () => {
    const reason = window.prompt(t("proai.client.rejectReason"));
    if (reason !== null) act("reject", () => quoteService.reject(id, reason), t("proai.client.rejected"));
  };
  let body;
  if (isLoading) body = <Skeleton className="h-96 rounded-3xl" />;
  else if (error) body = <ErrorBox error={error} onRetry={refetch} />;
  else body = (
    <div className="space-y-4">
      <QuoteDocument q={q} serviceLabel={service(q)} />
      {q.role === "client" && q.status === "sent" && (
        <Card title={t("proai.client.answer")} testId="quote-answer">
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" disabled={Boolean(busy)} onClick={() => window.confirm(t("proai.client.acceptConfirm")) && act("accept", () => quoteService.accept(id), t("proai.client.accepted"))}
              className={`${ui.btnGradient} sm:flex-1`} data-testid="quote-accept"><Check size={16} aria-hidden="true" />{t("proai.client.accept")}</button>
            <button type="button" disabled={Boolean(busy)} onClick={reject} className={ui.btnOutline} data-testid="quote-reject"><X size={16} aria-hidden="true" />{t("proai.client.reject")}</button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("proai.client.acceptNote")}</p>
        </Card>
      )}
      {q.role === "client" && q.conversation_id && (
        <Card testId="quote-mute">
          <label className="flex items-center justify-between gap-3 min-h-[44px] text-sm">
            <span>{t("proai.client.mute")}</span>
            <Switch checked={Boolean(q.followups_muted)} onCheckedChange={(on) => act("mute", () => quoteService.muteFollowups(q.conversation_id, on).then((r) => ({ followups_muted: r.muted })), t("proai.saved"))} data-testid="quote-mute-switch" />
          </label>
          <p className="text-[11px] text-muted-foreground">{t("proai.client.muteHint")}</p>
        </Card>
      )}
      {q.conversation_id && <Link to={`/messages/${q.conversation_id}`} className={`${ui.btnOutline} w-full`}><MessageSquare size={16} aria-hidden="true" />{t("proai.client.chat")}</Link>}
      {q.role === "provider" && <Link to={`/pro-ai/quotes/${q.id}`} className={`${ui.btnGhost} w-full`}>{t("proai.client.proView")}</Link>}
    </div>
  );
  return <div className={`${ui.container} py-6 max-w-2xl`} data-testid="client-quote-page">{body}</div>;
}

// ---------------------------------------------------------------- follow-ups
function FollowupDraft({ item, onSent }) {
  const { t, te, lang } = useI18n();
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    const out = await run(() => proAiService.draft({ purpose: "followup", quote_id: item.quote.id, lang }), null, te);
    if (out) setText(out.text);
  };
  const send = async () => {
    setBusy(true);
    const out = await run(() => proAiService.sendFollowup({ lead_id: item.lead_id, quote_id: item.quote.id, message: text }), t("proai.followups.sentOk"), te);
    setBusy(false);
    if (out) { setText(null); onSent(); }
  };
  return (
    <li className="rounded-2xl border border-border p-3" data-testid="followup-item">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{item.client_name || "—"} · <span dir="ltr">{formatMinor(item.quote.total_minor)}</span></p>
          <p className="text-xs text-muted-foreground"><span dir="ltr">{item.quote.ref}</span> · {t("proai.followups.sentDaysAgo", { n: item.days })}</p>
        </div>
        <Link to={`/pro-ai/leads/${item.lead_id}`} className={`${ui.btnGhost} min-h-[40px] text-xs`}>{t("proai.followups.lead")}</Link>
      </div>
      {text === null ? (
        <button type="button" onClick={open} className={`${ui.btnOutline} mt-2 w-full`} data-testid="followup-prepare"><Wand2 size={16} aria-hidden="true" />{t("proai.followups.prepare")}</button>
      ) : (
        <div className="mt-2">
          <textarea rows={6} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className={`${ui.input} py-3`} dir="auto" aria-label={t("proai.followups.edit")} data-testid="followup-text" />
          <div className="mt-2 flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" onClick={() => setText(null)} className={ui.btnGhost}>{t("proai.cancel")}</button>
            <button type="button" onClick={send} disabled={busy || text.trim().length < 5} className={`${ui.btnGradient} sm:flex-1`} data-testid="followup-send">
              <Send size={16} aria-hidden="true" />{t("proai.followups.validate")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function FollowupsTab() {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-followups"], queryFn: proAiService.followups });
  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;
  const reload = () => qc.invalidateQueries({ queryKey: ["proai-followups"] });
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-brand-electric/10 p-3 text-xs">{t("proai.followups.manual")}</p>
      <Card title={t("proai.followups.toFollow", { n: data.to_follow.length })} testId="followups-todo">
        <p className="mb-3 text-xs text-muted-foreground">{t("proai.followups.rule", { n: data.after_days })}</p>
        {data.to_follow.length ? <ul className="space-y-2">{data.to_follow.map((it) => <FollowupDraft key={it.quote.id} item={it} onSent={reload} />)}</ul>
          : <Empty>{t("proai.followups.none")}</Empty>}
      </Card>
      <Card title={t("proai.followups.planned")}>
        {data.scheduled.length ? (
          <ul className="space-y-2">
            {data.scheduled.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-border ps-3 pe-1 py-1.5 text-sm">
                <Link to={`/pro-ai/leads/${f.lead_id}`} className="min-w-0">
                  <span className="block font-semibold truncate">{f.client_name || f.request_ref}</span>
                  <span className="block text-xs text-muted-foreground truncate"><span dir="ltr">{formatDateTime(f.due_at)}</span>{f.note ? ` · ${f.note}` : ""}</span>
                </Link>
                <button type="button" onClick={async () => (await run(() => proAiService.cancelFollowup(f.id), null, te)) && reload()} className={ui.btnGhost} aria-label={t("proai.cancel")}><X size={16} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        ) : <Empty>{t("proai.followups.noneScheduled")}</Empty>}
      </Card>
      <Card title={t("proai.followups.history")}>
        {data.history.length ? (
          <ul className="space-y-1.5 text-sm">
            {data.history.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{f.client_name || f.request_ref} · {t(`proai.followups.kind.${f.channel}`)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{f.status === "cancelled" ? t("proai.followups.cancelled") : formatDate(f.done_at || f.updated_at)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>{t("proai.followups.noHistory")}</Empty>}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- agenda
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function AgendaTab() {
  const { t, lang } = useI18n();
  const { service } = useServiceLabel();
  const [start, setStart] = useState(() => startOfDay(new Date()));
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-agenda", start.toISOString()], queryFn: () => proAiService.appointments(start.toISOString(), 7) });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86_400_000)), [start]);
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : lang === "en" ? "en-GB" : "fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Algiers" }), [lang]);
  const shift = (n) => setStart(new Date(start.getTime() + n * 7 * 86_400_000));
  return (
    <div className="space-y-3" data-testid="proai-agenda">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => shift(-1)} className={ui.btnGhost} aria-label={t("proai.agenda.prev")}><ChevronLeft size={18} className="rtl:rotate-180" aria-hidden="true" /></button>
        <p className="text-sm font-bold">{dayFmt.format(days[0])} – {dayFmt.format(days[6])}</p>
        <button type="button" onClick={() => shift(1)} className={ui.btnGhost} aria-label={t("proai.agenda.next")}><ChevronRight size={18} className="rtl:rotate-180" aria-hidden="true" /></button>
      </div>
      {isLoading ? <Skeleton className="h-64 rounded-3xl" /> : error ? <ErrorBox error={error} onRetry={refetch} /> : (
        <ul className="space-y-2">
          {days.map((d) => {
            const items = data.items.filter((a) => dayKey(a.start_at) === dayKey(d));
            return (
              <li key={d.toISOString()} className="gf-card p-3">
                <p className="text-xs font-extrabold uppercase text-muted-foreground">{dayFmt.format(d)}</p>
                {items.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {items.map((a) => (
                      <li key={a.id}>
                        <Link to={`/jobs/${a.id}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${a.conflict ? "border-destructive/60" : "border-border"}`} data-testid="agenda-item">
                          <span className="shrink-0 font-bold" dir="ltr">{formatTime(a.start_at)}–{formatTime(a.end_at)}</span>
                          <span className="min-w-0 flex-1 truncate">{[a.client_name, service(a)].filter((x) => x && x !== "—").join(" · ")}</span>
                          {a.conflict && <AlertTriangle size={16} className="shrink-0 text-destructive" aria-label={t("proai.agenda.conflict")} />}
                          <Badge status={a.status} group="jobStatus" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-1 text-xs text-muted-foreground">{t("proai.agenda.free")}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("proai.agenda.hint")}</p>
    </div>
  );
}

// ---------------------------------------------------------------- assistant
function AssistantTab() {
  const { t, te, lang: uiLang } = useI18n();
  const [params] = useSearchParams();
  const { service } = useServiceLabel();
  const leads = useQuery({ queryKey: ["proai-leads"], queryFn: () => proAiService.leads() });
  const [f, setF] = useState({ purpose: "reply", tone: "formal", lang: uiLang, lead_id: params.get("lead") || "", quote_id: "" });
  const quotes = useQuery({ queryKey: ["proai-quotes", f.lead_id], queryFn: () => proAiService.quotes({ lead_id: f.lead_id }), enabled: Boolean(f.lead_id) });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const lead = leads.data?.items.find((l) => l.id === f.lead_id);
  const generate = async () => {
    setBusy(true);
    const out = await run(() => proAiService.draft({ purpose: f.purpose, tone: f.tone, lang: f.lang, lead_id: f.lead_id || null, quote_id: f.quote_id || null }), null, te);
    setBusy(false);
    if (out) setText(out.text);
  };
  const copy = () => navigator.clipboard?.writeText(text).then(() => toast.success(t("proai.assistant.copied")), () => {});
  return (
    <div className="space-y-4">
      <Card title={t("proai.assistant.title")} testId="proai-assistant">
        <p className="text-xs text-muted-foreground">{t("proai.assistant.hint")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">{t("proai.assistant.purpose")}
            <select value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} className={`${ui.input} mt-1`} data-testid="assistant-purpose">
              {PURPOSES.map((p) => <option key={p} value={p}>{t(`proai.assistant.purposes.${p}`)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">{t("proai.assistant.lead")}
            <select value={f.lead_id} onChange={(e) => setF({ ...f, lead_id: e.target.value, quote_id: "" })} className={`${ui.input} mt-1`} data-testid="assistant-lead">
              <option value="">{t("proai.assistant.noLead")}</option>
              {(leads.data?.items || []).filter((l) => !l.locked).map((l) => <option key={l.id} value={l.id}>{[l.client_name, service(l), formatDate(l.created_at)].filter(Boolean).join(" · ")}</option>)}
            </select>
          </label>
          {f.lead_id && (quotes.data?.items || []).length > 0 && (
            <label className="text-sm font-semibold sm:col-span-2">{t("proai.assistant.quote")}
              <select value={f.quote_id} onChange={(e) => setF({ ...f, quote_id: e.target.value })} className={`${ui.input} mt-1`}>
                <option value="">—</option>
                {quotes.data.items.map((q) => <option key={q.id} value={q.id}>{q.ref} · {formatMinor(q.total_minor)}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm font-semibold">{t("proai.assistant.tone")}
            <select value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })} className={`${ui.input} mt-1`}>
              {["formal", "friendly"].map((x) => <option key={x} value={x}>{t(`proai.assistant.tones.${x}`)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">{t("proai.assistant.lang")}
            <select value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value })} className={`${ui.input} mt-1`}>
              <option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option>
            </select>
          </label>
        </div>
        {f.purpose === "quote_intro" && !f.quote_id && <p className="mt-2 text-xs text-brand-orange">{t("proai.assistant.needQuote")}</p>}
        <button type="button" onClick={generate} disabled={busy || (f.purpose === "quote_intro" && !f.quote_id)} className={`${ui.btnGradient} mt-4 w-full`} data-testid="assistant-generate">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Wand2 size={16} aria-hidden="true" />}{t("proai.assistant.generate")}
        </button>
      </Card>
      {text && (
        <Card title={t("proai.assistant.draft")} testId="assistant-result">
          <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} className={`${ui.input} py-3`} dir={f.lang === "ar" ? "rtl" : "ltr"} aria-label={t("proai.assistant.draft")} data-testid="assistant-text" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className={ui.btnOutline}><Copy size={16} aria-hidden="true" />{t("proai.assistant.copy")}</button>
            {lead?.conversation_id && <Link to={`/messages/${lead.conversation_id}`} className={ui.btnOutline}><MessageSquare size={16} aria-hidden="true" />{t("proai.leads.openChat")}</Link>}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("proai.assistant.never")}</p>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- settings
function SettingsTab() {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-settings"], queryFn: proAiService.settings });
  const [form, setForm] = useState(null);
  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;
  const f = form || data;
  const save = async (patch) => {
    const out = await run(() => proAiService.saveSettings(patch), t("proai.saved"), te);
    if (out) { qc.setQueryData(["proai-settings"], out); setForm(null); }
  };
  const exportData = async () => {
    const out = await run(() => proAiService.exportData(), null, te);
    if (!out) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "gofix-pro-ai.json" });
    a.click();
    URL.revokeObjectURL(url);
  };
  const erase = async () => {
    if (!window.confirm(t("proai.settings.deleteConfirm"))) return;
    if (await run(() => proAiService.deleteData(), t("proai.settings.deleted"), te)) qc.invalidateQueries();
  };
  return (
    <div className="space-y-4" data-testid="proai-settings">
      <Card title={t("proai.settings.notifications")}>
        <label className="flex items-center justify-between gap-3 min-h-[44px] text-sm">
          <span>{t("proai.settings.reminders")}</span>
          <Switch checked={Boolean(f.reminders)} onCheckedChange={(on) => save({ reminders: on })} data-testid="settings-reminders" />
        </label>
        <p className="text-xs text-muted-foreground">{t("proai.settings.manual")}</p>
      </Card>
      <Card title={t("proai.settings.quotes")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">{t("proai.settings.followupAfter")}
            <select value={f.followup_after_days} onChange={(e) => setForm({ ...f, followup_after_days: Number(e.target.value) })} className={`${ui.input} mt-1`}>
              {[1, 2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{t("proai.quotes.days", { n: d })}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">{t("proai.settings.validity")}
            <select value={f.quote_valid_days} onChange={(e) => setForm({ ...f, quote_valid_days: Number(e.target.value) })} className={`${ui.input} mt-1`}>
              {[7, 15, 30, 60, 90].map((d) => <option key={d} value={d}>{t("proai.quotes.days", { n: d })}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">{t("proai.settings.defaultNotes")}
            <textarea rows={3} maxLength={1000} value={f.default_notes} onChange={(e) => setForm({ ...f, default_notes: e.target.value })} className={`${ui.input} mt-1 py-3`} placeholder={t("proai.quotes.notesPh")} />
          </label>
        </div>
        {form && <button type="button" onClick={() => save({ followup_after_days: f.followup_after_days, quote_valid_days: f.quote_valid_days, default_notes: f.default_notes })} className={`${ui.btnPrimary} mt-3`} data-testid="settings-save">{t("proai.save")}</button>}
      </Card>
      <Card title={t("proai.settings.data")}>
        <p className="text-xs text-muted-foreground">{t("proai.settings.privacy")}</p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={exportData} className={ui.btnOutline}><Download size={16} aria-hidden="true" />{t("proai.settings.export")}</button>
          <button type="button" onClick={erase} className={`${ui.btnGhost} text-destructive`} data-testid="settings-delete"><Trash2 size={16} aria-hidden="true" />{t("proai.settings.delete")}</button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- page
const PANES = { home: HomeTab, leads: LeadsTab, quotes: QuotesTab, followups: FollowupsTab, agenda: AgendaTab, assistant: AssistantTab, settings: SettingsTab };

export default function ProAi() {
  const { t } = useI18n();
  const { flag } = useConfig();
  const [params, setParams] = useSearchParams();
  const tab = PANES[params.get("tab")] ? params.get("tab") : "home";
  const Pane = PANES[tab];
  return (
    <div className={`${ui.container} py-6 max-w-4xl`} data-testid="proai-page">
      <PageHeader eyebrow="GOFIX PRO AI" title={t("proai.title")} subtitle={t("proai.subtitle")} />
      <nav className="-mt-4 mb-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label={t("proai.title")}>
        {TABS.map(({ key, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setParams(key === "home" ? {} : { tab: key })} data-testid={`proai-tab-${key}`}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 min-h-[44px] text-sm font-bold ${tab === key ? "border-transparent gf-gradient-bg text-[#070911]" : "border-border hover:bg-secondary"}`}>
            <Icon size={16} aria-hidden="true" />{t(`proai.tabs.${key}`)}
          </button>
        ))}
      </nav>
      {flag("pro_ai") ? <Pane /> : <div className="gf-card p-5 text-sm">{t("errors.feature_disabled")}</div>}
    </div>
  );
}
