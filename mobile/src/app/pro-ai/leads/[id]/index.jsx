import { useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarDays, FileText, Lock, MessageSquare, Wand2 } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { proAiService } from "@/api/services";
import { ErrorCard, LEAD_MOVES, QuoteRows, StatusPill, useRun, useServiceLabel } from "@/components/proai";
import { useI18n } from "@/i18n";
import { algiersDays, algiersISO, formatDateTime } from "@/lib/format";
import { alpha, BRAND, useTheme } from "@/theme";
import { Btn, Card, Chip, confirm, Empty, Field, Input, Loading, Row, Screen, Section, TopBar, Txt, useToast } from "@/ui";

const TIMES = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const DURATIONS = [30, 60, 90, 120, 180, 240, 480];

function useDayLabel() {
  const { t } = useI18n();
  return (d, i) => (i === 0 ? t("mobile.today") : i === 1 ? t("mobile.tomorrow") : `${d.slice(8, 10)}/${d.slice(5, 7)}`);
}

function Appointment({ lead, onDone }) {
  const { t, te } = useI18n();
  const toast = useToast();
  const dayLabel = useDayLabel();
  const days = algiersDays(21);
  const [f, setF] = useState({ day: days[1], time: "10:00", duration: 60, price: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (allow = false) => {
    setBusy(true);
    try {
      await proAiService.createAppointment({ lead_id: lead.id, start_at: algiersISO(f.day, f.time), duration_min: f.duration,
        price_da: f.price === "" ? null : Number(f.price), allow_conflict: allow });
      toast(t("proai.agenda.proposed"));
      onDone();
    } catch (err) {
      if (errorCode(err) === "time_conflict" && (await confirm(t("proai.agenda.conflict"), t("proai.agenda.conflictConfirm"), t("proai.agenda.propose"), t("proai.cancel")))) {
        setBusy(false);
        return submit(true);
      }
      toast(te(errorCode(err)), "error");
    }
    setBusy(false);
  };
  return (
    <Section title={t("proai.agenda.add")}>
      <Card style={{ gap: 10 }} testID="lead-appointment">
        {lead.appointments.map((a) => (
          <Card key={a.id} onPress={() => router.push(`/jobs/${a.id}`)} style={{ flexDirection: "row", justifyContent: "space-between", padding: 10 }}>
            <Txt variant="small">{formatDateTime(a.scheduled_at)}</Txt><StatusPill status={a.status} group="jobStatus" />
          </Card>
        ))}
        <Txt variant="label">{t("proai.agenda.when")}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {days.map((d, i) => <Chip key={d} label={dayLabel(d, i)} selected={f.day === d} onPress={() => setF({ ...f, day: d })} />)}
        </ScrollView>
        <Row gap={8} wrap>{TIMES.map((h) => <Chip key={h} label={h} selected={f.time === h} onPress={() => setF({ ...f, time: h })} />)}</Row>
        <Txt variant="label">{t("proai.agenda.duration")}</Txt>
        <Row gap={8} wrap>{DURATIONS.map((m) => <Chip key={m} label={m < 60 ? `${m} min` : `${m / 60} h`} selected={f.duration === m} onPress={() => setF({ ...f, duration: m })} />)}</Row>
        <Field label={t("proai.agenda.price")}><Input value={f.price} onChangeText={(v) => setF({ ...f, price: v.replace(/\D/g, "") })} keyboardType="number-pad" ltr /></Field>
        <Btn icon={CalendarDays} title={t("proai.agenda.propose")} loading={busy} onPress={() => submit(false)} testID="appointment-submit" />
        <Txt variant="tiny" muted>{t("proai.agenda.clientConfirms")}</Txt>
      </Card>
    </Section>
  );
}

function Reminder({ lead, onDone }) {
  const { t } = useI18n();
  const run = useRun();
  const dayLabel = useDayLabel();
  const days = algiersDays(30);
  const [f, setF] = useState({ day: days[2], time: "09:00", note: "" });
  const pending = lead.followups.filter((x) => x.status === "pending");
  const submit = async () => {
    if (await run(() => proAiService.scheduleFollowup({ lead_id: lead.id, due_at: algiersISO(f.day, f.time), note: f.note }), t("proai.followups.scheduled"))) {
      setF({ ...f, note: "" });
      onDone();
    }
  };
  return (
    <Section title={t("proai.followups.remindMe")}>
      <Card style={{ gap: 10 }} testID="lead-reminder">
        {pending.map((x) => <Row key={x.id} gap={6}><BellRing size={14} color={BRAND.electric} /><Txt variant="small">{formatDateTime(x.due_at)}{x.note ? ` · ${x.note}` : ""}</Txt></Row>)}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {days.map((d, i) => <Chip key={d} label={dayLabel(d, i)} selected={f.day === d} onPress={() => setF({ ...f, day: d })} />)}
        </ScrollView>
        <Row gap={8} wrap>{["09:00", "12:00", "15:00", "18:00"].map((h) => <Chip key={h} label={h} selected={f.time === h} onPress={() => setF({ ...f, time: h })} />)}</Row>
        <Input value={f.note} onChangeText={(v) => setF({ ...f, note: v })} maxLength={500} placeholder={t("proai.followups.notePh")} />
        <Btn small variant="outline" icon={BellRing} title={t("proai.followups.plan")} onPress={submit} />
        <Txt variant="tiny" muted>{t("proai.followups.reminderOnly")}</Txt>
      </Card>
    </Section>
  );
}

export default function LeadScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const { c } = useTheme();
  const qc = useQueryClient();
  const run = useRun();
  const { service, place } = useServiceLabel();
  const { data: l, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["proai-lead", String(id)], queryFn: () => proAiService.lead(String(id)) });
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["proai-lead", String(id)] }); qc.invalidateQueries({ queryKey: ["proai-leads"] }); };
  const patch = async (body, key) => {
    setBusy(key);
    const out = await run(() => proAiService.patchLead(String(id), body), t("proai.saved"));
    setBusy(null);
    if (out) { qc.setQueryData(["proai-lead", String(id)], out); qc.invalidateQueries({ queryKey: ["proai-leads"] }); }
    return out;
  };

  let body;
  if (isLoading) body = <Loading />;
  else if (error) body = <ErrorCard error={error} onRetry={refetch} />;
  else body = (
    <View style={{ gap: 4 }}>
      <Card style={{ gap: 8 }} testID="lead-detail">
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Txt variant="h3">{service(l)}</Txt>
            <Txt variant="tiny" muted>{[l.ref, l.client_name, place(l)].filter(Boolean).join(" · ")}</Txt>
          </View>
          <StatusPill status={l.status} />
        </Row>
        {l.locked ? (
          <View style={{ backgroundColor: alpha(BRAND.orange, 0.12), borderRadius: 12, padding: 10, gap: 8 }}>
            <Row gap={6}><Lock size={14} color={BRAND.orange} /><Txt variant="small" style={{ flex: 1 }}>{t("proai.leads.lockedHint")}</Txt></Row>
            <Btn small variant="outline" title={t("proai.leads.subscribe")} onPress={() => router.push("/pricing")} />
          </View>
        ) : <Txt variant="small" auto>{l.message}</Txt>}
        <Txt variant="tiny" muted>{formatDateTime(l.created_at)}{l.source === "ai_match" ? " · AI MATCH" : ""}</Txt>
        {!l.locked ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Btn variant="gradient" icon={FileText} title={t("proai.leads.newQuote")} onPress={() => router.push(`/pro-ai/leads/${l.id}/quote`)} testID="lead-new-quote" />
            {l.conversation_id ? <Btn small variant="outline" icon={MessageSquare} title={t("proai.leads.openChat")} onPress={() => router.push(`/messages/${l.conversation_id}`)} /> : null}
            <Btn small variant="outline" icon={Wand2} title={t("proai.leads.draftReply")} onPress={() => router.push(`/pro-ai?tab=assistant&lead=${l.id}`)} />
          </View>
        ) : null}
      </Card>

      {!l.locked ? (
        <Section title={t("proai.leads.qualify")}>
          <Card style={{ gap: 10 }} testID="lead-qualify">
            <Row gap={8} wrap>
              {LEAD_MOVES[l.status].map((s) => <Btn key={s} small variant="outline" title={t(`proai.moves.${s}`)} loading={busy === `s-${s}`} onPress={() => patch({ status: s }, `s-${s}`)} testID={`lead-move-${s}`} />)}
            </Row>
            <Txt variant="label">{t("proai.priority.label")}</Txt>
            <Row gap={8} wrap>{["low", "normal", "high"].map((p) => <Chip key={p} label={t(`proai.priority.${p}`)} selected={l.priority === p} onPress={() => patch({ priority: p }, "priority")} />)}</Row>
            <Field label={t("proai.leads.note")} hint={t("proai.leads.notePrivate")}>
              <Input multiline value={note ?? l.note} onChangeText={setNote} maxLength={1000} placeholder={t("proai.leads.notePh")} />
            </Field>
            {note !== null && note !== l.note ? <Btn small title={t("proai.save")} loading={busy === "note"} onPress={async () => (await patch({ note }, "note")) && setNote(null)} /> : null}
          </Card>
        </Section>
      ) : null}

      <Section title={t("proai.quotes.title")}>{l.quotes.length ? <QuoteRows items={l.quotes} /> : <Empty text={t("proai.quotes.empty")} />}</Section>
      {!l.locked ? <Appointment lead={l} onDone={refresh} /> : null}
      {!l.locked ? <Reminder lead={l} onDone={refresh} /> : null}
    </View>
  );
  return (
    <Screen padded={false} refreshing={isRefetching} onRefresh={refetch}>
      <TopBar title={t("proai.tabs.leads")} />
      <View style={{ padding: 16, paddingBottom: 32, backgroundColor: c.bg }} testID="proai-lead-page">{body}</View>
    </Screen>
  );
}
