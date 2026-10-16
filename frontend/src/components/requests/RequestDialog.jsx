import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/common/PageSkeleton";
import { useWilayas } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";
import { marketplaceService, requestService } from "@/services/marketplaceService";

const FORMATS = ["home", "online", "center"];

/**
 * kind: "professional" | "teacher". profileIds: [] = open request dispatched by AI Match, else targeted.
 * defaults: prefilled filters (category_key, subject_key, level_key, wilaya_code, format).
 */
export function RequestDialog({ open, onOpenChange, kind = "professional", profileIds = [], defaults = {}, recipientLabel }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: wilayas = [] } = useWilayas();
  const targeted = profileIds.length > 0;
  const [f, setF] = useState({ message: "", ...defaults });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => marketplaceService.categories(), staleTime: 300_000, enabled: open && kind === "professional" && !targeted });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: marketplaceService.subjects, staleTime: 300_000, enabled: open && kind === "teacher" });
  const levels = useQuery({ queryKey: ["levels"], queryFn: marketplaceService.levels, staleTime: 300_000, enabled: open && kind === "teacher" });

  const submit = async (e) => {
    e.preventDefault();
    if ((f.message || "").trim().length < 10) return toast.error(t("requests.messageShort"));
    setBusy(true);
    try {
      const body = { kind, profile_ids: profileIds, message: f.message.trim(), wilaya_code: f.wilaya_code ? Number(f.wilaya_code) : null,
        category_key: f.category_key || null, subject_key: f.subject_key || null, level_key: f.level_key || null, format: f.format || null };
      const res = await requestService.create(body);
      toast.success(t("requests.sent", { n: res.recipients }));
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      onOpenChange(false);
      navigate("/requests");
    } catch (err) {
      const code = errorCode(err);
      toast.error(te(code));
      if (code === "plan_required") navigate("/pricing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" data-testid="request-dialog">
        <DialogHeader>
          <DialogTitle>{targeted ? t("requests.dialogTargeted") : t("requests.dialogOpen")}</DialogTitle>
          <DialogDescription>{targeted ? (recipientLabel || t("requests.toN", { n: profileIds.length })) : t("requests.openHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {kind === "professional" && !targeted && (
            <Field id="rq-cat" label={t("requests.category")}>
              <select id="rq-cat" required value={f.category_key || ""} onChange={(e) => set({ category_key: e.target.value })} className={`${ui.input} appearance-none`} data-testid="request-category">
                <option value="">—</option>
                {(cats.data || []).map((c) => <option key={c.key} value={c.key}>{loc(c)}</option>)}
              </select>
            </Field>
          )}
          {kind === "teacher" && (
            <div className="grid grid-cols-2 gap-3">
              <Field id="rq-subj" label={t("requests.subject")}>
                <select id="rq-subj" required={!targeted} value={f.subject_key || ""} onChange={(e) => set({ subject_key: e.target.value })} className={`${ui.input} appearance-none`} data-testid="request-subject">
                  <option value="">—</option>
                  {(subjects.data || []).map((s) => <option key={s.key} value={s.key}>{loc(s)}</option>)}
                </select>
              </Field>
              <Field id="rq-lvl" label={t("requests.level")}>
                <select id="rq-lvl" value={f.level_key || ""} onChange={(e) => set({ level_key: e.target.value })} className={`${ui.input} appearance-none`} data-testid="request-level">
                  <option value="">—</option>
                  {(levels.data || []).map((l) => <option key={l.key} value={l.key}>{loc(l)}</option>)}
                </select>
              </Field>
            </div>
          )}
          {!targeted && (
            <Field id="rq-wil" label={t("home.wilayaLabel")}>
              <select id="rq-wil" value={f.wilaya_code || ""} onChange={(e) => set({ wilaya_code: e.target.value })} className={`${ui.input} appearance-none`} data-testid="request-wilaya">
                <option value="">{t("home.wilayaAll")}</option>
                {wilayas.map((w) => <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, "0")} – ${loc(w)}`}</option>)}
              </select>
            </Field>
          )}
          {kind === "teacher" && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("onboarding.format")}>
              {FORMATS.map((x) => (
                <button key={x} type="button" aria-pressed={f.format === x} onClick={() => set({ format: f.format === x ? "" : x })} data-testid={`request-format-${x}`}
                  className={`rounded-full border px-3 min-h-[40px] text-xs font-bold ${f.format === x ? "border-brand-pink bg-brand-pink/15" : "border-border"}`}>{t(`onboarding.formats.${x}`)}</button>
              ))}
            </div>
          )}
          <Field id="rq-msg" label={t("requests.message")} hint={t("requests.messageHint")}>
            <textarea id="rq-msg" rows={5} maxLength={2000} value={f.message} onChange={(e) => set({ message: e.target.value })}
              placeholder={kind === "teacher" ? t("requests.messagePhTeacher") : t("requests.messagePh")} className={`${ui.input} py-3 resize-y`} data-testid="request-message" />
          </Field>
          <button type="submit" disabled={busy} className={`${ui.btnGradient} w-full`} data-testid="request-submit">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}{t("requests.send")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
