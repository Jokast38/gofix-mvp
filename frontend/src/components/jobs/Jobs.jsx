import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarClock, CalendarPlus, CheckCircle2, Loader2, Scale, Star, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/common/PageSkeleton";
import { useI18n, useLocalized } from "@/i18n";
import { errorCode, formatDA, formatDate, formatTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { jobService, marketplaceService } from "@/services/marketplaceService";
import { useQuery } from "@tanstack/react-query";

export const JOB_COLOR = { proposed: "var(--brand-orange)", scheduled: "var(--brand-electric)", completed: "var(--brand-violet)",
  cancelled: "hsl(var(--destructive))", disputed: "var(--brand-pink)", failed: "hsl(var(--destructive))" };

export function JobStatus({ status }) {
  const { t } = useI18n();
  const c = JOB_COLOR[status] || "var(--brand-orange)";
  return <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ color: c, borderColor: `color-mix(in srgb, ${c} 50%, transparent)` }} data-testid={`job-status-${status}`}>{t(`jobs.status.${status}`)}</span>;
}

function localInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Propose an appointment / lesson from a conversation. */
export function ProposeJobDialog({ open, onOpenChange, conversationId, kind }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const qc = useQueryClient();
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setHours(10, 0, 0, 0);
  const [f, setF] = useState({ when: localInputValue(tomorrow), mode: kind === "teacher" ? "online" : "home", note: "", price: "", subject_key: "" });
  const [busy, setBusy] = useState(false);
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: marketplaceService.subjects, staleTime: 300_000, enabled: open && kind === "teacher" });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await jobService.propose({ conversation_id: conversationId, scheduled_at: new Date(f.when).toISOString(), mode: f.mode, note: f.note,
        price_da: f.price === "" ? null : Number(f.price), subject_key: f.subject_key || null });
      toast.success(t("jobs.proposed"));
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onOpenChange(false);
    } catch (err) { toast.error(te(errorCode(err))); } finally { setBusy(false); }
  };
  const modes = kind === "teacher" ? ["online", "home", "center"] : ["home", "workshop"];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto" data-testid="propose-job-dialog">
        <DialogHeader>
          <DialogTitle>{t("jobs.proposeTitle")}</DialogTitle>
          <DialogDescription>{t("jobs.proposeHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field id="job-when" label={t("jobs.when")}>
            <input id="job-when" type="datetime-local" required value={f.when} min={localInputValue(new Date())} onChange={(e) => setF({ ...f, when: e.target.value })} className={ui.input} data-testid="job-when" />
          </Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("jobs.mode")}>
            {modes.map((m) => (
              <button key={m} type="button" aria-pressed={f.mode === m} onClick={() => setF({ ...f, mode: m })}
                className={`rounded-full border px-3 min-h-[44px] text-xs font-bold ${f.mode === m ? "border-brand-electric bg-brand-electric/15" : "border-border"}`}>{t(`jobs.modes.${m}`)}</button>
            ))}
          </div>
          {kind === "teacher" && (
            <Field id="job-subject" label={t("requests.subject")}>
              <select id="job-subject" value={f.subject_key} onChange={(e) => setF({ ...f, subject_key: e.target.value })} className={`${ui.input} appearance-none`}>
                <option value="">—</option>
                {(subjects.data || []).map((s) => <option key={s.key} value={s.key}>{loc(s)}</option>)}
              </select>
            </Field>
          )}
          <Field id="job-price" label={t("jobs.price")} hint={t("jobs.priceHint")}>
            <input id="job-price" type="number" min={0} step={100} inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={ui.input} dir="ltr" />
          </Field>
          <Field id="job-note" label={t("jobs.note")}>
            <input id="job-note" value={f.note} maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t("jobs.notePh")} className={ui.input} />
          </Field>
          <button type="submit" disabled={busy} className={`${ui.btnGradient} w-full`} data-testid="job-propose-submit">{busy ? <Loader2 size={18} className="animate-spin" /> : <CalendarPlus size={18} />}{t("jobs.propose")}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({ open, onOpenChange, title, hint, cta, onSubmit, danger }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{hint}</DialogDescription></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(reason.trim()); }} className="space-y-3">
          <textarea rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("jobs.reasonPh")} className={`${ui.input} py-3`} data-testid="job-reason" />
          <button type="submit" className={`${danger ? ui.btnDanger : ui.btnPrimary} w-full`} data-testid="job-reason-submit">{cta}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewJobDialog({ job, open, onOpenChange, onDone }) {
  const { t, te } = useI18n();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await jobService.review(job.id, { rating, comment, subject_key: job.subject_key || null });
      toast.success(t("reviews.thanks"));
      onDone();
      onOpenChange(false);
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="review-dialog">
        <DialogHeader><DialogTitle>{t("reviews.title", { name: job.other_name })}</DialogTitle><DialogDescription>{t("reviews.verifiedHint")}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex justify-center gap-1" role="radiogroup" aria-label={t("reviews.rating")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}/5`} onClick={() => setRating(n)} data-testid={`review-star-${n}`} className="grid place-items-center h-11 w-11">
                <Star size={30} className="text-brand-orange" fill={n <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("reviews.commentPh")} className={`${ui.input} py-3`} data-testid="review-comment" />
          <button type="submit" className={`${ui.btnGradient} w-full`} data-testid="review-submit">{t("reviews.submit")}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One appointment with the actions the server allows for my role (never computed client-side). */
export function JobCard({ job, compact = false }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["provider-me"] });
  };
  const run = async (name, fn, okMsg) => {
    setBusy(name);
    try { await fn(); toast.success(okMsg); refresh(); setDialog(null); } catch (err) { toast.error(te(errorCode(err))); } finally { setBusy(null); }
  };
  const d = new Date(job.scheduled_at);
  const A = job.actions || [];
  return (
    <div className={`gf-card ${compact ? "p-3" : "p-4"}`} data-testid={`job-${job.id}`}>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center h-12 w-12 shrink-0 rounded-xl bg-secondary text-center leading-none">
          <span><span className="block text-base font-extrabold">{d.toLocaleDateString("fr-FR", { day: "2-digit", timeZone: "Africa/Algiers" })}</span>
            <span className="block text-[10px] uppercase text-muted-foreground">{d.toLocaleDateString("fr-FR", { month: "short", timeZone: "Africa/Algiers" })}</span></span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-extrabold truncate">{job.other_name}</p>
            <JobStatus status={job.status} />
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(job.scheduled_at)} · {formatTime(job.scheduled_at)} · {t(`jobs.modes.${job.mode}`)}{job.price_da != null ? ` · ${formatDA(job.price_da)}` : ""}</p>
          {job.note && <p className="mt-1 text-sm">{job.note}</p>}
          {job.status === "proposed" && <p className="mt-1 text-xs text-brand-orange">{job.proposed_by === job.role ? t("jobs.waitingOther") : t("jobs.toConfirm")}</p>}
          {job.provider_done_at && job.status === "scheduled" && <p className="mt-1 text-xs text-brand-violet">{job.role === "client" ? t("jobs.providerDoneClient") : t("jobs.providerDone")}</p>}
          {job.dispute && <p className="mt-1 text-xs text-brand-pink">{t(`jobs.dispute.${job.dispute.status}`)}{job.dispute.note ? ` — ${job.dispute.note}` : ""}</p>}
        </div>
      </div>
      {A.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {A.includes("confirm") && <button type="button" disabled={Boolean(busy)} onClick={() => run("confirm", () => jobService.confirm(job.id), t("jobs.confirmed"))} className={`${ui.btnGradient} min-h-[44px] text-sm`} data-testid="job-confirm"><CalendarCheck size={16} />{t("jobs.confirm")}</button>}
          {A.includes("complete") && <button type="button" disabled={Boolean(busy)} onClick={() => run("complete", () => jobService.complete(job.id), t("jobs.completed"))} className={`${ui.btnGradient} min-h-[44px] text-sm`} data-testid="job-complete"><CheckCircle2 size={16} />{t("jobs.complete")}</button>}
          {A.includes("mark_done") && <button type="button" disabled={Boolean(busy)} onClick={() => run("done", () => jobService.complete(job.id), t("jobs.markedDone"))} className={`${ui.btnPrimary} min-h-[44px] text-sm`} data-testid="job-mark-done"><CheckCircle2 size={16} />{t("jobs.markDone")}</button>}
          {A.includes("review") && <button type="button" onClick={() => setDialog("review")} className={`${ui.btnGradient} min-h-[44px] text-sm`} data-testid="job-review"><Star size={16} />{t("requests.rate")}</button>}
          {A.includes("cancel") && <button type="button" onClick={() => setDialog("cancel")} className={`${ui.btnOutline} min-h-[44px] text-sm`} data-testid="job-cancel"><XCircle size={16} />{t("jobs.cancel")}</button>}
          {A.includes("dispute") && <button type="button" onClick={() => setDialog("dispute")} className={`${ui.btnOutline} min-h-[44px] text-sm`} data-testid="job-dispute"><Scale size={16} />{t("jobs.openDispute")}</button>}
        </div>
      )}
      <ReasonDialog open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} title={t("jobs.cancelTitle")}
        hint={job.role === "provider" ? t("jobs.cancelHintProvider") : t("jobs.cancelHint")} cta={t("jobs.cancel")} danger
        onSubmit={(r) => run("cancel", () => jobService.cancel(job.id, r), t("jobs.cancelled"))} />
      <ReasonDialog open={dialog === "dispute"} onOpenChange={(o) => setDialog(o ? "dispute" : null)} title={t("jobs.disputeTitle")}
        hint={t("jobs.disputeHint")} cta={t("jobs.openDispute")} onSubmit={(r) => run("dispute", () => jobService.dispute(job.id, r), t("jobs.disputeOpened"))} />
      {A.includes("review") && <ReviewJobDialog job={job} open={dialog === "review"} onOpenChange={(o) => setDialog(o ? "review" : null)} onDone={refresh} />}
    </div>
  );
}

export function JobsEmpty({ text }) {
  return (
    <div className="py-10 text-center text-muted-foreground" data-testid="jobs-empty">
      <CalendarClock size={34} strokeWidth={1.4} className="mx-auto mb-3" /><p className="text-sm">{text}</p>
    </div>
  );
}
