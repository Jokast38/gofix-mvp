import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Scale, Send, Star, XCircle } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { catalogService, jobService, requestService } from "@/api/services";
import { useWilayas } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { algiersDays, algiersISO, formatDA, formatDate, formatTime } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { Btn, Card, Chip, Field, Input, Pill, Row, SelectField, Sheet, Txt, useToast } from "@/ui";

// ---------- Request (targeted or open, dispatched by AI MATCH) ----------
export function RequestSheet({ visible, onClose, kind = "professional", profileIds = [], defaults = {}, recipientLabel }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: wilayas = [] } = useWilayas();
  const targeted = profileIds.length > 0;
  const [f, setF] = useState({ message: "", ...defaults });
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => catalogService.categories(), staleTime: 300_000, enabled: visible && kind === "professional" && !targeted });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: catalogService.subjects, staleTime: 300_000, enabled: visible && kind === "teacher" });
  const levels = useQuery({ queryKey: ["levels"], queryFn: catalogService.levels, staleTime: 300_000, enabled: visible && kind === "teacher" });
  const submit = async () => {
    if ((f.message || "").trim().length < 10) return toast(t("requests.messageShort"), "error");
    setBusy(true);
    try {
      const res = await requestService.create({ kind, profile_ids: profileIds, message: f.message.trim(), wilaya_code: f.wilaya_code ? Number(f.wilaya_code) : null,
        category_key: f.category_key || null, subject_key: f.subject_key || null, level_key: f.level_key || null, format: f.format || null });
      toast(t("requests.sent", { n: res.recipients }));
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      onClose();
      router.push("/requests");
    } catch (err) {
      const code = errorCode(err);
      toast(te(code), "error");
      if (code === "plan_required") router.push("/pricing");
    } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={targeted ? t("requests.dialogTargeted") : t("requests.dialogOpen")} full>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
        <Txt variant="small" muted style={{ marginBottom: 12 }}>{targeted ? recipientLabel || t("requests.toN", { n: profileIds.length }) : t("requests.openHint")}</Txt>
        {kind === "professional" && !targeted && (
          <Field label={t("requests.category")}>
            <SelectField label={t("requests.category")} value={f.category_key} onChange={(v) => set({ category_key: v })}
              options={(cats.data || []).map((x) => ({ value: x.key, label: loc(x) }))} testID="req-category" />
          </Field>
        )}
        {kind === "teacher" && (
          <>
            <Field label={t("requests.subject")}><SelectField label={t("requests.subject")} value={f.subject_key} onChange={(v) => set({ subject_key: v })} options={(subjects.data || []).map((x) => ({ value: x.key, label: loc(x) }))} /></Field>
            <Field label={t("requests.level")}><SelectField label={t("requests.level")} value={f.level_key} onChange={(v) => set({ level_key: v })} options={(levels.data || []).map((x) => ({ value: x.key, label: loc(x) }))} /></Field>
            <Row gap={8} wrap style={{ marginBottom: 14 }}>
              {["home", "online", "center"].map((m) => <Chip key={m} label={t(`onboarding.formats.${m}`)} selected={f.format === m} onPress={() => set({ format: f.format === m ? "" : m })} />)}
            </Row>
          </>
        )}
        {!targeted && (
          <Field label={t("home.wilayaLabel")}>
            <SelectField label={t("home.wilayaLabel")} value={f.wilaya_code} onChange={(v) => set({ wilaya_code: v })} placeholder={t("home.wilayaAll")}
              options={wilayas.map((w) => ({ value: w.code, label: `${String(w.code).padStart(2, "0")} – ${loc(w)}` }))} />
          </Field>
        )}
        <Field label={t("requests.message")} hint={t("requests.messageHint")}>
          <Input multiline value={f.message} onChangeText={(v) => set({ message: v })} maxLength={2000}
            placeholder={kind === "teacher" ? t("requests.messagePhTeacher") : t("requests.messagePh")} testID="req-message" />
        </Field>
        <Btn variant="gradient" icon={Send} title={t("requests.send")} onPress={submit} loading={busy} testID="req-submit" />
      </ScrollView>
    </Sheet>
  );
}

// ---------- Appointments ----------
const JOB_COLOR = { proposed: BRAND.orange, scheduled: BRAND.electric, completed: BRAND.violet, cancelled: "#F87171", disputed: BRAND.pink, failed: "#F87171" };
const TIMES = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

export function JobStatus({ status }) {
  const { t } = useI18n();
  return <Pill label={t(`jobs.status.${status}`)} color={JOB_COLOR[status] || BRAND.orange} />;
}

export function ProposeJobSheet({ visible, onClose, conversationId, kind }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const qc = useQueryClient();
  const days = algiersDays(14);
  const [f, setF] = useState({ day: days[1], time: "10:00", mode: kind === "teacher" ? "online" : "home", note: "", price: "", subject_key: "" });
  const [busy, setBusy] = useState(false);
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: catalogService.subjects, staleTime: 300_000, enabled: visible && kind === "teacher" });
  const dayLabel = (d, i) => (i === 0 ? t("mobile.today") : i === 1 ? t("mobile.tomorrow") : d.slice(8, 10) + "/" + d.slice(5, 7));
  const submit = async () => {
    setBusy(true);
    try {
      await jobService.propose({ conversation_id: conversationId, scheduled_at: algiersISO(f.day, f.time), mode: f.mode, note: f.note,
        price_da: f.price === "" ? null : Number(f.price), subject_key: f.subject_key || null });
      toast(t("jobs.proposed"));
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(false); }
  };
  const modes = kind === "teacher" ? ["online", "home", "center"] : ["home", "workshop"];
  return (
    <Sheet visible={visible} onClose={onClose} title={t("jobs.proposeTitle")} full>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
        <Txt variant="small" muted style={{ marginBottom: 10 }}>{t("jobs.proposeHint")}</Txt>
        <Txt variant="label" style={{ marginBottom: 6 }}>{t("mobile.day")}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {days.map((d, i) => <Chip key={d} label={dayLabel(d, i)} selected={f.day === d} onPress={() => setF({ ...f, day: d })} />)}
        </ScrollView>
        <Txt variant="label" style={{ marginBottom: 6 }}>{t("mobile.time")}</Txt>
        <Row gap={8} wrap style={{ marginBottom: 14 }}>
          {TIMES.map((h) => <Chip key={h} label={h} selected={f.time === h} onPress={() => setF({ ...f, time: h })} />)}
        </Row>
        <Txt variant="label" style={{ marginBottom: 6 }}>{t("jobs.mode")}</Txt>
        <Row gap={8} wrap style={{ marginBottom: 14 }}>{modes.map((m) => <Chip key={m} label={t(`jobs.modes.${m}`)} selected={f.mode === m} onPress={() => setF({ ...f, mode: m })} />)}</Row>
        {kind === "teacher" && (
          <Field label={t("requests.subject")}><SelectField label={t("requests.subject")} value={f.subject_key} onChange={(v) => setF({ ...f, subject_key: v })} options={(subjects.data || []).map((x) => ({ value: x.key, label: loc(x) }))} /></Field>
        )}
        <Field label={t("jobs.price")} hint={t("jobs.priceHint")}><Input value={f.price} onChangeText={(v) => setF({ ...f, price: v.replace(/\D/g, "") })} keyboardType="number-pad" ltr /></Field>
        <Field label={t("jobs.note")}><Input value={f.note} onChangeText={(v) => setF({ ...f, note: v })} maxLength={500} placeholder={t("jobs.notePh")} /></Field>
        <Btn variant="gradient" icon={CalendarCheck} title={t("jobs.propose")} onPress={submit} loading={busy} testID="job-propose-submit" />
      </ScrollView>
    </Sheet>
  );
}

function ReasonSheet({ visible, onClose, title, hint, cta, danger, onSubmit }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Txt variant="small" muted style={{ marginBottom: 10 }}>{hint}</Txt>
      <Input multiline value={reason} onChangeText={setReason} maxLength={500} placeholder={t("jobs.reasonPh")} />
      <Btn variant={danger ? "danger" : "primary"} title={cta} disabled={reason.trim().length < 3} onPress={() => onSubmit(reason.trim())} style={{ marginTop: 12 }} />
    </Sheet>
  );
}

function ReviewSheet({ job, visible, onClose, onDone }) {
  const { t, te } = useI18n();
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const submit = async () => {
    try {
      await jobService.review(job.id, { rating, comment, subject_key: job.subject_key || null });
      toast(t("reviews.thanks"));
      onDone();
      onClose();
    } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("reviews.title", { name: job.other_name })}>
      <Txt variant="small" muted>{t("reviews.verifiedHint")}</Txt>
      <Row gap={4} style={{ justifyContent: "center", marginVertical: 14 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="radio" accessibilityState={{ checked: rating === n }} accessibilityLabel={`${n}/5`}
            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
            <Star size={32} color={BRAND.orange} fill={n <= rating ? BRAND.orange : "transparent"} />
          </Pressable>
        ))}
      </Row>
      <Input multiline value={comment} onChangeText={setComment} maxLength={1000} placeholder={t("reviews.commentPh")} />
      <Btn variant="gradient" title={t("reviews.submit")} onPress={submit} style={{ marginTop: 12 }} testID="review-submit" />
    </Sheet>
  );
}

/** Appointment card; the available actions come from the server for my role. */
export function JobCard({ job, compact }) {
  const { c } = useTheme();
  const { t, te } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["jobs"] }); qc.invalidateQueries({ queryKey: ["provider-me"] }); };
  const run = async (name, fn, ok) => {
    setBusy(name);
    try { await fn(); toast(ok); refresh(); setSheet(null); } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(null); }
  };
  const A = job.actions || [];
  const d = new Date(job.scheduled_at);
  return (
    <Card style={{ padding: compact ? 12 : 14 }} onPress={compact ? undefined : () => router.push(`/jobs/${job.id}`)} testID={`job-${job.id}`}>
      <Row gap={12} style={{ alignItems: "flex-start" }}>
        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: c.cardAlt, alignItems: "center", justifyContent: "center" }}>
          <Txt variant="h3">{formatDate(d).slice(0, 2)}</Txt><Txt variant="tiny" muted>{formatDate(d).slice(3, 5)}</Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Row style={{ justifyContent: "space-between" }} gap={6}><Txt weight={800} numberOfLines={1} style={{ flex: 1 }}>{job.other_name}</Txt><JobStatus status={job.status} /></Row>
          <Txt variant="tiny" muted>{formatDate(d)} · {formatTime(d)} · {t(`jobs.modes.${job.mode}`)}{job.price_da != null ? ` · ${formatDA(job.price_da)}` : ""}</Txt>
          {job.note ? <Txt variant="small" auto>{job.note}</Txt> : null}
          {job.status === "proposed" && <Txt variant="tiny" color={BRAND.orange}>{job.proposed_by === job.role ? t("jobs.waitingOther") : t("jobs.toConfirm")}</Txt>}
          {job.provider_done_at && job.status === "scheduled" && <Txt variant="tiny" color={BRAND.violet}>{job.role === "client" ? t("jobs.providerDoneClient") : t("jobs.providerDone")}</Txt>}
          {job.dispute && <Txt variant="tiny" color={BRAND.pink}>{t(`jobs.dispute.${job.dispute.status}`)}{job.dispute.note ? ` — ${job.dispute.note}` : ""}</Txt>}
        </View>
      </Row>
      {A.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {A.includes("confirm") && <Btn small variant="gradient" icon={CalendarCheck} title={t("jobs.confirm")} loading={busy === "confirm"} style={{ flexGrow: 1 }}
            onPress={() => run("confirm", () => jobService.confirm(job.id), t("jobs.confirmed"))} testID="job-confirm" />}
          {A.includes("complete") && <Btn small variant="gradient" icon={CheckCircle2} title={t("jobs.complete")} loading={busy === "complete"} style={{ flexGrow: 1 }}
            onPress={() => run("complete", () => jobService.complete(job.id), t("jobs.completed"))} testID="job-complete" />}
          {A.includes("mark_done") && <Btn small icon={CheckCircle2} title={t("jobs.markDone")} loading={busy === "done"} style={{ flexGrow: 1 }}
            onPress={() => run("done", () => jobService.complete(job.id), t("jobs.markedDone"))} />}
          {A.includes("review") && <Btn small variant="gradient" icon={Star} title={t("requests.rate")} onPress={() => setSheet("review")} style={{ flexGrow: 1 }} testID="job-review" />}
          {A.includes("cancel") && <Btn small variant="outline" icon={XCircle} title={t("jobs.cancel")} onPress={() => setSheet("cancel")} style={{ flexGrow: 1 }} testID="job-cancel" />}
          {A.includes("dispute") && <Btn small variant="outline" icon={Scale} title={t("jobs.openDispute")} onPress={() => setSheet("dispute")} style={{ flexGrow: 1 }} />}
        </View>
      )}
      <ReasonSheet visible={sheet === "cancel"} onClose={() => setSheet(null)} title={t("jobs.cancelTitle")} danger cta={t("jobs.cancel")}
        hint={job.role === "provider" ? t("jobs.cancelHintProvider") : t("jobs.cancelHint")} onSubmit={(r) => run("cancel", () => jobService.cancel(job.id, r), t("jobs.cancelled"))} />
      <ReasonSheet visible={sheet === "dispute"} onClose={() => setSheet(null)} title={t("jobs.disputeTitle")} cta={t("jobs.openDispute")}
        hint={t("jobs.disputeHint")} onSubmit={(r) => run("dispute", () => jobService.dispute(job.id, r), t("jobs.disputeOpened"))} />
      {A.includes("review") && <ReviewSheet job={job} visible={sheet === "review"} onClose={() => setSheet(null)} onDone={refresh} />}
    </Card>
  );
}

// ---------- Report ----------
const REASONS = ["fake_profile", "inappropriate", "fraud", "harassment", "spam", "other"];
export function ReportSheet({ visible, onClose, targetType, targetId }) {
  const { t, te } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState("fake_profile");
  const [details, setDetails] = useState("");
  const send = async () => {
    try {
      await requestService.report({ target_type: targetType, target_id: targetId, reason, details });
      toast(t("report.sent"));
      onClose();
    } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("report.title")}>
      <Txt variant="small" muted style={{ marginBottom: 10 }}>{t("report.hint")}</Txt>
      <Row gap={8} wrap style={{ marginBottom: 12 }}>{REASONS.map((r) => <Chip key={r} label={t(`report.reasons.${r}`)} selected={reason === r} color="#F87171" onPress={() => setReason(r)} />)}</Row>
      <Input multiline value={details} onChangeText={setDetails} maxLength={1000} placeholder={t("report.detailsPh")} />
      <Btn variant="danger" title={t("report.send")} onPress={send} style={{ marginTop: 12 }} />
    </Sheet>
  );
}

