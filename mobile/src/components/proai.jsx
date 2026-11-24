import { useMemo, useState } from "react";
import { ScrollView, Share, Switch, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Download, Lightbulb, Lock, MessageSquare, Send, Trash2, Wand2, X } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { catalogService, proAiService } from "@/api/services";
import { useWilayas } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { algiersDays, dayKey, formatDate, formatDateTime, formatMinor, formatTime } from "@/lib/format";
import { alpha, BRAND, useTheme } from "@/theme";
import { Btn, Card, Chip, confirm, Empty, Field, IconBtn, Input, Loading, Row, SelectField, Txt, useToast } from "@/ui";

export const LEAD_MOVES = { new: ["qualified", "lost"], qualified: ["new", "lost"], quoted: ["won", "lost"], lost: ["qualified"], won: [] };
const COLOR = {
  new: BRAND.electric, qualified: BRAND.violet, quoted: BRAND.orange, won: "#10b981", lost: "#8a8fa3",
  draft: "#8a8fa3", sent: BRAND.orange, accepted: "#10b981", rejected: "#ef4444", expired: "#8a8fa3",
  proposed: BRAND.orange, scheduled: BRAND.electric, completed: "#10b981", cancelled: "#8a8fa3",
};
const TIP_ROUTE = { followups: "/pro-ai?tab=followups", leads: "/pro-ai?tab=leads", quotes: "/pro-ai?tab=quotes", pricing: "/pricing",
  passport: "/passport", assistant: "/pro-ai?tab=assistant", agenda: "/pro-ai?tab=agenda" };
const PURPOSES = ["reply", "quote_intro", "followup", "reschedule", "thanks", "decline"];

export function StatusPill({ status, group = "status" }) {
  const { t } = useI18n();
  const color = COLOR[status] || BRAND.electric;
  return (
    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: alpha(color, 0.15), alignSelf: "flex-start" }}>
      <Txt variant="tiny" weight={800} color={color}>{t(`proai.${group}.${status}`)}</Txt>
    </View>
  );
}

/** Trade / subject label and place of a lead, quote or appointment. */
export function useServiceLabel() {
  const loc = useLocalized();
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => catalogService.categories(), staleTime: 300_000 });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: catalogService.subjects, staleTime: 300_000 });
  const { data: wilayas = [] } = useWilayas();
  return {
    service: (x) => (x?.subject_key && !x?.category_key ? loc(subjects.data?.find((s) => s.key === x.subject_key)) : loc(cats.data?.find((c) => c.key === x?.category_key))) || "—",
    place: (x) => [x?.commune, loc(wilayas.find((w) => w.code === x?.wilaya_code))].filter(Boolean).join(", "),
  };
}

/** Runs an API call with an error toast; returns the result or null. */
export function useRun() {
  const { te } = useI18n();
  const toast = useToast();
  return async (fn, ok) => {
    try {
      const out = await fn();
      if (ok) toast(ok);
      return out ?? true;
    } catch (err) {
      toast(te(errorCode(err)), "error");
      return null;
    }
  };
}

export function ErrorCard({ error, onRetry }) {
  const { t, te } = useI18n();
  return (
    <Card style={{ gap: 10, alignItems: "center" }}>
      <Txt variant="small" center>{te(errorCode(error))}</Txt>
      {onRetry ? <Btn small variant="outline" title={t("proai.retry")} onPress={onRetry} /> : null}
    </Card>
  );
}

// ---------------------------------------------------------------- home
function Kpi({ label, value, hint }) {
  const { c } = useTheme();
  return (
    <View style={{ flexBasis: "48%", flexGrow: 1, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 12 }}>
      <Txt variant="h3" numberOfLines={1}>{value ?? "—"}</Txt>
      <Txt variant="tiny" muted weight={600}>{label}</Txt>
      {hint ? <Txt variant="tiny" muted>{hint}</Txt> : null}
    </View>
  );
}

export function HomeTab() {
  const { t } = useI18n();
  const { c } = useTheme();
  const [period, setPeriod] = useState("month");
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ["proai-dash", period], queryFn: () => proAiService.dashboard(period) });
  if (isLoading) return <Loading />;
  if (error) return <ErrorCard error={error} onRetry={refetch} />;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }} testID="proai-tips">
        <Txt weight={800}>{t("proai.home.coach")}</Txt>
        {d.tips.length ? d.tips.map((tip) => (
          <View key={tip.key} style={{ flexDirection: "row", gap: 10, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10 }}>
            <Lightbulb size={18} color={tip.level === "high" ? BRAND.orange : BRAND.electric} />
            <View style={{ flex: 1, gap: 6 }}>
              <Txt variant="small" weight={700}>{t(`proai.tips.${tip.key}.title`, tip.values)}</Txt>
              <Txt variant="tiny" muted>{t(`proai.tips.${tip.key}.why`, tip.values)}</Txt>
              <Btn small variant="outline" title={t(`proai.tips.${tip.key}.cta`)} onPress={() => router.push(TIP_ROUTE[tip.action])} style={{ alignSelf: "flex-start" }} />
            </View>
          </View>
        )) : <Txt variant="small" muted>{t("proai.home.noTips")}</Txt>}
      </Card>
      <Card style={{ gap: 10 }} testID="proai-kpis">
        <Txt weight={800}>{t("proai.home.indicators")}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {["week", "month", "quarter", "year"].map((p) => <Chip key={p} label={t(`proai.periods.${p}`)} selected={period === p} onPress={() => setPeriod(p)} />)}
        </ScrollView>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Kpi label={t("proai.kpi.leads")} value={d.leads_received} hint={d.leads_locked ? t("proai.kpi.locked", { n: d.leads_locked }) : null} />
          <Kpi label={t("proai.kpi.quotesSent")} value={d.quotes_sent} />
          <Kpi label={t("proai.kpi.accepted")} value={d.quotes_accepted} />
          <Kpi label={t("proai.kpi.conversion")} value={d.conversion_pct == null ? null : `${d.conversion_pct} %`} />
          <Kpi label={t("proai.kpi.response")} value={d.response_hours_median == null ? null : `${d.response_hours_median} h`} />
          <Kpi label={t("proai.kpi.pending")} value={d.quotes_pending} />
          <Kpi label={t("proai.kpi.jobs")} value={d.jobs_completed} />
          <Kpi label={t("proai.kpi.rating")} value={d.rating_count ? `${d.rating_avg}/5` : null} hint={d.rating_count ? t("proai.kpi.reviews", { n: d.rating_count }) : null} />
        </View>
        <Txt variant="small" weight={800}>{t("proai.kpi.money")}</Txt>
        <View style={{ gap: 8 }}>
          <Kpi label={t("proai.kpi.quoted")} value={formatMinor(d.amount_quoted_minor)} />
          <Kpi label={t("proai.kpi.signed")} value={formatMinor(d.amount_accepted_minor)} />
          <Kpi label={t("proai.kpi.declared")} value={formatMinor(d.revenue_declared_da * 100)} />
        </View>
        <Txt variant="tiny" muted>{t("proai.kpi.moneyNote")}</Txt>
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- leads
export function LeadsTab() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("open");
  const { service, place } = useServiceLabel();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-leads"], queryFn: () => proAiService.leads() });
  if (isLoading) return <Loading />;
  if (error) return <ErrorCard error={error} onRetry={refetch} />;
  const items = data.items.filter((l) => (filter === "open" ? ["new", "qualified", "quoted"].includes(l.status) : l.status === filter));
  const count = (f) => (f === "open" ? data.counts.new + data.counts.qualified + data.counts.quoted : data.counts[f]);
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {["open", "new", "qualified", "quoted", "won", "lost"].map((f) => (
          <Chip key={f} label={`${t(`proai.leads.filters.${f}`)} (${count(f)})`} selected={filter === f} onPress={() => setFilter(f)} testID={`lead-filter-${f}`} />
        ))}
      </ScrollView>
      {items.length === 0 ? <Empty text={t("proai.leads.empty")} /> : items.map((l) => (
        <Card key={l.id} onPress={() => router.push(`/pro-ai/leads/${l.id}`)} style={{ gap: 6 }} testID="proai-lead">
          <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Txt weight={800} numberOfLines={1}>{service(l)}</Txt>
              <Txt variant="tiny" muted numberOfLines={1}>{[l.client_name, place(l)].filter(Boolean).join(" · ")}</Txt>
            </View>
            <StatusPill status={l.status} />
          </Row>
          {l.locked ? <Row gap={4}><Lock size={13} color={BRAND.orange} /><Txt variant="tiny" color={BRAND.orange}>{t("proai.leads.locked")}</Txt></Row>
            : <Txt variant="small" muted auto numberOfLines={2}>{l.message}</Txt>}
          <Txt variant="tiny" muted>
            {formatDateTime(l.created_at)}{l.source === "ai_match" ? " · AI MATCH" : ""}{l.priority === "high" ? ` · ${t("proai.priority.high")}` : ""}
            {l.quotes ? ` · ${t("proai.leads.quotes", { n: l.quotes })}` : ""}
          </Txt>
        </Card>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- quotes
export function QuoteRows({ items }) {
  const { t } = useI18n();
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }} testID="quote-list">
      {items.map((q) => (
        <Card key={q.id} onPress={() => router.push(`/pro-ai/quotes/${q.id}`)} style={{ flexDirection: "row", gap: 10, alignItems: "center", borderColor: c.border }}>
          <View style={{ flex: 1 }}>
            <Txt variant="small" weight={700}>{q.ref}</Txt>
            <Txt variant="tiny" muted numberOfLines={1}>{[q.client_name, q.sent_at ? t("proai.quotes.sentOn", { date: formatDate(q.sent_at) }) : formatDate(q.created_at)].filter(Boolean).join(" · ")}</Txt>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Txt variant="small" weight={800}>{formatMinor(q.total_minor)}</Txt>
            <StatusPill status={q.status} group="quoteStatus" />
          </View>
        </Card>
      ))}
    </View>
  );
}

export function QuotesTab() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-quotes"], queryFn: () => proAiService.quotes() });
  if (isLoading) return <Loading />;
  if (error) return <ErrorCard error={error} onRetry={refetch} />;
  const items = data.items.filter((q) => filter === "all" || q.status === filter);
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {["all", "draft", "sent", "accepted", "rejected", "expired"].map((f) => (
          <Chip key={f} label={f === "all" ? t("proai.quotes.all") : t(`proai.quoteStatus.${f}`)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>
      {items.length ? <QuoteRows items={items} /> : <Empty text={t("proai.quotes.emptyAll")} />}
      <Txt variant="tiny" muted>{t("proai.quotes.fromLead")}</Txt>
    </View>
  );
}

/** The quote as a document (pro and client). */
export function QuoteDocument({ q, serviceLabel }) {
  const { t } = useI18n();
  const { c } = useTheme();
  return (
    <Card style={{ gap: 10 }} testID="quote-document">
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Txt variant="tiny" weight={800} color={BRAND.electric}>{t("proai.quotes.document").toUpperCase()}</Txt>
          <Txt variant="h3">{q.ref}</Txt>
          <Txt variant="tiny" muted numberOfLines={1}>{[q.provider_display_name, serviceLabel].filter(Boolean).join(" · ")}</Txt>
        </View>
        <StatusPill status={q.status} group="quoteStatus" />
      </Row>
      {q.items.map((it, i) => (
        <Row key={i} style={{ justifyContent: "space-between", alignItems: "flex-start", borderTopWidth: i ? 1 : 0, borderColor: c.border, paddingTop: i ? 8 : 0 }}>
          <View style={{ flex: 1 }}>
            <Txt variant="small" weight={700} auto>{it.label}</Txt>
            <Txt variant="tiny" muted>{`⁦${String(it.qty).replace(".", ",")} × ${formatMinor(it.unit_price_minor)}⁩`}</Txt>
          </View>
          <Txt variant="small" weight={800}>{formatMinor(it.total_minor)}</Txt>
        </Row>
      ))}
      <Row style={{ justifyContent: "space-between", backgroundColor: c.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Txt weight={800}>{t("proai.quotes.total")}</Txt>
        <Txt variant="h3" testID="quote-doc-total">{formatMinor(q.total_minor)}</Txt>
      </Row>
      {q.notes ? <Txt variant="small" auto>{q.notes}</Txt> : null}
      <Txt variant="tiny" muted>
        {q.expires_at ? t("proai.quotes.validUntil", { date: formatDate(q.expires_at) }) : t("proai.quotes.validFor", { n: q.valid_days })}
        {q.decided_at ? ` · ${t(`proai.quotes.decidedOn.${q.status}`, { date: formatDate(q.decided_at) })}` : ""}
      </Txt>
      <Txt variant="tiny" muted>{t("proai.quotes.disclaimer")}</Txt>
    </Card>
  );
}

// ---------------------------------------------------------------- follow-ups
function FollowupItem({ item, onSent }) {
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const run = useRun();
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    const out = await run(() => proAiService.draft({ purpose: "followup", quote_id: item.quote.id, lang }));
    if (out) setText(out.text);
  };
  const send = async () => {
    setBusy(true);
    const out = await run(() => proAiService.sendFollowup({ lead_id: item.lead_id, quote_id: item.quote.id, message: text }), t("proai.followups.sentOk"));
    setBusy(false);
    if (out) { setText(null); onSent(); }
  };
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, gap: 8 }} testID="followup-item">
      <Row style={{ justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Txt variant="small" weight={700}>{item.client_name || "—"} · {formatMinor(item.quote.total_minor)}</Txt>
          <Txt variant="tiny" muted>{item.quote.ref} · {t("proai.followups.sentDaysAgo", { n: item.days })}</Txt>
        </View>
        <Btn small variant="ghost" title={t("proai.followups.lead")} onPress={() => router.push(`/pro-ai/leads/${item.lead_id}`)} />
      </Row>
      {text === null ? <Btn small variant="outline" icon={Wand2} title={t("proai.followups.prepare")} onPress={open} testID="followup-prepare" /> : (
        <>
          <Input multiline value={text} onChangeText={setText} maxLength={2000} style={{ minHeight: 140 }} testID="followup-text" />
          <Btn small variant="gradient" icon={Send} title={t("proai.followups.validate")} loading={busy} disabled={text.trim().length < 5} onPress={send} testID="followup-send" />
          <Btn small variant="ghost" title={t("proai.cancel")} onPress={() => setText(null)} />
        </>
      )}
    </View>
  );
}

export function FollowupsTab() {
  const { t } = useI18n();
  const { c } = useTheme();
  const qc = useQueryClient();
  const run = useRun();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-followups"], queryFn: proAiService.followups });
  if (isLoading) return <Loading />;
  if (error) return <ErrorCard error={error} onRetry={refetch} />;
  const reload = () => qc.invalidateQueries({ queryKey: ["proai-followups"] });
  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: alpha(BRAND.electric, 0.1), borderRadius: 14, padding: 12 }}><Txt variant="tiny">{t("proai.followups.manual")}</Txt></View>
      <Card style={{ gap: 10 }} testID="followups-todo">
        <Txt weight={800}>{t("proai.followups.toFollow", { n: data.to_follow.length })}</Txt>
        <Txt variant="tiny" muted>{t("proai.followups.rule", { n: data.after_days })}</Txt>
        {data.to_follow.length ? data.to_follow.map((it) => <FollowupItem key={it.quote.id} item={it} onSent={reload} />) : <Txt variant="small" muted>{t("proai.followups.none")}</Txt>}
      </Card>
      <Card style={{ gap: 8 }}>
        <Txt weight={800}>{t("proai.followups.planned")}</Txt>
        {data.scheduled.length ? data.scheduled.map((f) => (
          <Row key={f.id} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingStart: 12 }}>
            <View style={{ flex: 1, paddingVertical: 6 }}>
              <Txt variant="small" weight={700} numberOfLines={1}>{f.client_name || f.request_ref}</Txt>
              <Txt variant="tiny" muted numberOfLines={1}>{formatDateTime(f.due_at)}{f.note ? ` · ${f.note}` : ""}</Txt>
            </View>
            <IconBtn label={t("proai.cancel")} onPress={async () => (await run(() => proAiService.cancelFollowup(f.id))) && reload()}><X size={18} color={c.muted} /></IconBtn>
          </Row>
        )) : <Txt variant="small" muted>{t("proai.followups.noneScheduled")}</Txt>}
      </Card>
      <Card style={{ gap: 6 }}>
        <Txt weight={800}>{t("proai.followups.history")}</Txt>
        {data.history.length ? data.history.map((f) => (
          <Row key={f.id} style={{ justifyContent: "space-between" }}>
            <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>{f.client_name || f.request_ref} · {t(`proai.followups.kind.${f.channel}`)}</Txt>
            <Txt variant="tiny" muted>{f.status === "cancelled" ? t("proai.followups.cancelled") : formatDate(f.done_at || f.updated_at)}</Txt>
          </Row>
        )) : <Txt variant="small" muted>{t("proai.followups.noHistory")}</Txt>}
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- agenda
export function AgendaTab() {
  const { t } = useI18n();
  const { c } = useTheme();
  const { service } = useServiceLabel();
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => algiersDays(7 * (offset + 1)).slice(7 * offset), [offset]);
  const start = useMemo(() => new Date(`${days[0]}T00:00:00+01:00`).toISOString(), [days]);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-agenda", start], queryFn: () => proAiService.appointments(start, 7) });
  const label = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return (
    <View style={{ gap: 10 }} testID="proai-agenda">
      <Row style={{ justifyContent: "space-between" }}>
        <IconBtn label={t("proai.agenda.prev")} onPress={() => setOffset(Math.max(0, offset - 1))}><ChevronLeft size={20} color={offset ? c.text : c.muted} /></IconBtn>
        <Txt variant="small" weight={700}>{label(days[0])} – {label(days[6])}</Txt>
        <IconBtn label={t("proai.agenda.next")} onPress={() => setOffset(offset + 1)}><ChevronRight size={20} color={c.text} /></IconBtn>
      </Row>
      {isLoading ? <Loading /> : error ? <ErrorCard error={error} onRetry={refetch} /> : days.map((d) => {
        const items = data.items.filter((a) => dayKey(a.start_at) === d);
        return (
          <Card key={d} style={{ gap: 6 }}>
            <Txt variant="tiny" weight={800} muted>{label(d)}</Txt>
            {items.length ? items.map((a) => (
              <Card key={a.id} onPress={() => router.push(`/jobs/${a.id}`)} style={{ flexDirection: "row", gap: 8, alignItems: "center", padding: 10, borderColor: a.conflict ? "#ef4444" : c.border }} testID="agenda-item">
                <Txt variant="small" weight={800}>{`⁦${formatTime(a.start_at)}–${formatTime(a.end_at)}⁩`}</Txt>
                <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>{[a.client_name, service(a)].filter((x) => x && x !== "—").join(" · ")}</Txt>
                {a.conflict ? <AlertTriangle size={16} color="#ef4444" accessibilityLabel={t("proai.agenda.conflict")} /> : null}
                <StatusPill status={a.status} group="jobStatus" />
              </Card>
            )) : <Txt variant="tiny" muted>{t("proai.agenda.free")}</Txt>}
          </Card>
        );
      })}
      <Txt variant="tiny" muted>{t("proai.agenda.hint")}</Txt>
    </View>
  );
}

// ---------------------------------------------------------------- assistant
export function AssistantTab({ initialLead = "" }) {
  const { t, lang: uiLang } = useI18n();
  const run = useRun();
  const { service } = useServiceLabel();
  const leads = useQuery({ queryKey: ["proai-leads"], queryFn: () => proAiService.leads() });
  const [f, setF] = useState({ purpose: "reply", tone: "formal", lang: uiLang, lead_id: initialLead, quote_id: "" });
  const quotes = useQuery({ queryKey: ["proai-quotes", f.lead_id], queryFn: () => proAiService.quotes({ lead_id: f.lead_id }), enabled: Boolean(f.lead_id) });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const lead = leads.data?.items.find((l) => l.id === f.lead_id);
  const generate = async () => {
    setBusy(true);
    const out = await run(() => proAiService.draft({ purpose: f.purpose, tone: f.tone, lang: f.lang, lead_id: f.lead_id || null, quote_id: f.quote_id || null }));
    setBusy(false);
    if (out) setText(out.text);
  };
  const needQuote = f.purpose === "quote_intro" && !f.quote_id;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }} testID="proai-assistant">
        <Txt weight={800}>{t("proai.assistant.title")}</Txt>
        <Txt variant="tiny" muted>{t("proai.assistant.hint")}</Txt>
        <Field label={t("proai.assistant.purpose")}>
          <SelectField label={t("proai.assistant.purpose")} value={f.purpose} allowClear={false} onChange={(v) => setF({ ...f, purpose: v })}
            options={PURPOSES.map((p) => ({ value: p, label: t(`proai.assistant.purposes.${p}`) }))} testID="assistant-purpose" />
        </Field>
        <Field label={t("proai.assistant.lead")}>
          <SelectField label={t("proai.assistant.lead")} value={f.lead_id} placeholder={t("proai.assistant.noLead")} onChange={(v) => setF({ ...f, lead_id: v, quote_id: "" })}
            options={(leads.data?.items || []).filter((l) => !l.locked).map((l) => ({ value: l.id, label: [l.client_name, service(l), formatDate(l.created_at)].filter(Boolean).join(" · ") }))} testID="assistant-lead" />
        </Field>
        {f.lead_id && quotes.data?.items.length ? (
          <Field label={t("proai.assistant.quote")}>
            <SelectField label={t("proai.assistant.quote")} value={f.quote_id} onChange={(v) => setF({ ...f, quote_id: v })}
              options={quotes.data.items.map((q) => ({ value: q.id, label: `${q.ref} · ${formatMinor(q.total_minor)}` }))} />
          </Field>
        ) : null}
        <Txt variant="label">{t("proai.assistant.tone")}</Txt>
        <Row gap={8} wrap>{["formal", "friendly"].map((x) => <Chip key={x} label={t(`proai.assistant.tones.${x}`)} selected={f.tone === x} onPress={() => setF({ ...f, tone: x })} />)}</Row>
        <Txt variant="label">{t("proai.assistant.lang")}</Txt>
        <Row gap={8} wrap>{[["fr", "Français"], ["ar", "العربية"], ["en", "English"]].map(([k, l]) => <Chip key={k} label={l} selected={f.lang === k} onPress={() => setF({ ...f, lang: k })} />)}</Row>
        {needQuote ? <Txt variant="tiny" color={BRAND.orange}>{t("proai.assistant.needQuote")}</Txt> : null}
        <Btn variant="gradient" icon={Wand2} title={t("proai.assistant.generate")} loading={busy} disabled={needQuote} onPress={generate} testID="assistant-generate" />
      </Card>
      {text ? (
        <Card style={{ gap: 10 }} testID="assistant-result">
          <Txt weight={800}>{t("proai.assistant.draft")}</Txt>
          <Input multiline value={text} onChangeText={setText} style={{ minHeight: 200, writingDirection: f.lang === "ar" ? "rtl" : "ltr" }} testID="assistant-text" />
          <Btn small variant="outline" icon={Copy} title={t("proai.assistant.copy")} onPress={() => Share.share({ message: text }).catch(() => {})} />
          {lead?.conversation_id ? <Btn small variant="outline" icon={MessageSquare} title={t("proai.leads.openChat")} onPress={() => router.push(`/messages/${lead.conversation_id}`)} /> : null}
          <Txt variant="tiny" muted>{t("proai.assistant.never")}</Txt>
        </Card>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- settings
export function SettingsTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const run = useRun();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["proai-settings"], queryFn: proAiService.settings });
  const [form, setForm] = useState(null);
  if (isLoading) return <Loading />;
  if (error) return <ErrorCard error={error} onRetry={refetch} />;
  const f = form || data;
  const save = async (body) => {
    const out = await run(() => proAiService.saveSettings(body), t("proai.saved"));
    if (out) { qc.setQueryData(["proai-settings"], out); setForm(null); }
  };
  const exportData = async () => {
    const out = await run(() => proAiService.exportData());
    if (out) Share.share({ title: "gofix-pro-ai.json", message: JSON.stringify(out, null, 2) }).catch(() => {});
  };
  const erase = async () => {
    if (!(await confirm(t("proai.settings.delete"), t("proai.settings.deleteConfirm"), t("proai.settings.delete"), t("proai.cancel")))) return;
    if (await run(() => proAiService.deleteData(), t("proai.settings.deleted"))) qc.invalidateQueries();
  };
  const days = (list) => list.map((d) => ({ value: d, label: t("proai.quotes.days", { n: d }) }));
  return (
    <View style={{ gap: 14 }} testID="proai-settings">
      <Card style={{ gap: 6 }}>
        <Txt weight={800}>{t("proai.settings.notifications")}</Txt>
        <Row style={{ justifyContent: "space-between", minHeight: 44 }}>
          <Txt variant="small" style={{ flex: 1 }}>{t("proai.settings.reminders")}</Txt>
          <Switch value={Boolean(f.reminders)} onValueChange={(on) => save({ reminders: on })} trackColor={{ true: BRAND.electric }} accessibilityLabel={t("proai.settings.reminders")} />
        </Row>
        <Txt variant="tiny" muted>{t("proai.settings.manual")}</Txt>
      </Card>
      <Card style={{ gap: 4 }}>
        <Txt weight={800}>{t("proai.settings.quotes")}</Txt>
        <Field label={t("proai.settings.followupAfter")}>
          <SelectField label={t("proai.settings.followupAfter")} allowClear={false} value={f.followup_after_days} options={days([1, 2, 3, 5, 7, 10, 14])} onChange={(v) => setForm({ ...f, followup_after_days: Number(v) })} />
        </Field>
        <Field label={t("proai.settings.validity")}>
          <SelectField label={t("proai.settings.validity")} allowClear={false} value={f.quote_valid_days} options={days([7, 15, 30, 60, 90])} onChange={(v) => setForm({ ...f, quote_valid_days: Number(v) })} />
        </Field>
        <Field label={t("proai.settings.defaultNotes")}>
          <Input multiline value={f.default_notes} maxLength={1000} onChangeText={(v) => setForm({ ...f, default_notes: v })} placeholder={t("proai.quotes.notesPh")} />
        </Field>
        {form ? <Btn title={t("proai.save")} onPress={() => save({ followup_after_days: f.followup_after_days, quote_valid_days: f.quote_valid_days, default_notes: f.default_notes })} /> : null}
      </Card>
      <Card style={{ gap: 8 }}>
        <Txt weight={800}>{t("proai.settings.data")}</Txt>
        <Txt variant="tiny" muted>{t("proai.settings.privacy")}</Txt>
        <Btn small variant="outline" icon={Download} title={t("proai.settings.export")} onPress={exportData} />
        <Btn small variant="ghost" icon={Trash2} title={t("proai.settings.delete")} onPress={erase} testID="settings-delete" />
      </Card>
    </View>
  );
}

