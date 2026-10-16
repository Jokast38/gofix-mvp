import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { errorCode, formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { adminOpsService } from "@/services/marketplaceService";

const EMPTY = { category: "general", question_fr: "", question_ar: "", answer_fr: "", answer_ar: "", variants: "", lang: "fr", active: true };

function Editor({ initial, onDone }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({ ...EMPTY, ...initial, variants: (initial?.variants || []).join("\n") });
  const set = (patch) => setF({ ...f, ...patch });
  const save = async (e) => {
    e.preventDefault();
    const body = { category: f.category, question_fr: f.question_fr, question_ar: f.question_ar || "", answer_fr: f.answer_fr, answer_ar: f.answer_ar || "",
      variants: f.variants.split("\n").map((x) => x.trim()).filter(Boolean), lang: f.lang, active: f.active };
    try {
      if (initial?.id) await adminOpsService.patchFaq(initial.id, body);
      else await adminOpsService.createFaq(body);
      qc.invalidateQueries({ queryKey: ["admin-faq"] });
      qc.invalidateQueries({ queryKey: ["faq"] });
      toast.success(t("admin.saved"));
      onDone();
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <form onSubmit={save} className="gf-card p-4 space-y-2" data-testid="faq-editor">
      <div className="grid gap-2 sm:grid-cols-3">
        <input required value={f.category} onChange={(e) => set({ category: e.target.value })} placeholder={t("adminx.faq.category")} className={`${ui.input} min-h-[40px]`} />
        <select value={f.lang} onChange={(e) => set({ lang: e.target.value })} className={`${ui.input} min-h-[40px]`} aria-label={t("prefs.language")}><option value="fr">FR</option><option value="ar">AR</option></select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => set({ active: v })} />{t("adminx.active")}</label>
      </div>
      <input required minLength={5} value={f.question_fr} onChange={(e) => set({ question_fr: e.target.value })} placeholder={t("adminx.faq.questionFr")} className={`${ui.input} min-h-[40px]`} data-testid="faq-question-fr" />
      <input value={f.question_ar} onChange={(e) => set({ question_ar: e.target.value })} placeholder={t("adminx.faq.questionAr")} dir="rtl" className={`${ui.input} min-h-[40px]`} />
      <textarea required minLength={5} rows={3} value={f.answer_fr} onChange={(e) => set({ answer_fr: e.target.value })} placeholder={t("adminx.faq.answerFr")} className={`${ui.input} py-2`} data-testid="faq-answer-fr" />
      <textarea rows={2} value={f.answer_ar} onChange={(e) => set({ answer_ar: e.target.value })} placeholder={t("adminx.faq.answerAr")} dir="rtl" className={`${ui.input} py-2`} />
      <textarea rows={3} value={f.variants} onChange={(e) => set({ variants: e.target.value })} placeholder={t("adminx.faq.variants")} className={`${ui.input} py-2 text-sm`} />
      <div className="flex gap-2">
        <button type="submit" className={`${ui.btnPrimary} min-h-[40px]`} data-testid="faq-save">{t("common.save")}</button>
        <button type="button" onClick={onDone} className={`${ui.btnOutline} min-h-[40px]`}>{t("common.cancel")}</button>
      </div>
    </form>
  );
}

function Unanswered({ onCreate }) {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ["admin-unanswered"], queryFn: adminOpsService.unanswered });
  if (!data) return null;
  return (
    <section className="gf-card p-4" data-testid="faq-unanswered">
      <h3 className="font-bold">{t("adminx.faq.unanswered")}</h3>
      <p className="text-xs text-muted-foreground mb-3">{t("adminx.faq.rate", { total: data.total_questions, missed: data.unanswered, rate: data.answer_rate == null ? "—" : Math.round(data.answer_rate * 100) })}</p>
      {!data.items.length ? <p className="text-sm text-muted-foreground">—</p> : (
        <ul className="divide-y divide-border text-sm">
          {data.items.map((q) => (
            <li key={q.question} className="flex items-center gap-3 py-2">
              <span className="flex-1">{q.question}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">×{q.count} · {formatDateTime(q.last_at)}</span>
              <button type="button" onClick={() => onCreate(q.question)} className={`${ui.btnOutline} min-h-[36px] px-3 text-xs`}><Plus size={14} />{t("adminx.faq.addFrom")}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminFaq({ canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-faq"], queryFn: adminOpsService.faq });
  const remove = async (id) => {
    if (!window.confirm(t("admin.taxonomy.confirmDelete"))) return;
    try {
      await adminOpsService.deleteFaq(id);
      qc.invalidateQueries({ queryKey: ["admin-faq"] });
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <div className="space-y-4" data-testid="admin-faq">
      <p className="text-sm text-muted-foreground">{t("adminx.faq.hint", { n: data.length })}</p>
      <Unanswered onCreate={(q) => setEditing({ question_fr: q, variants: [q] })} />
      {canEdit && !editing && <button type="button" onClick={() => setEditing({})} className={ui.btnPrimary} data-testid="faq-new"><Plus size={16} />{t("adminx.faq.new")}</button>}
      {editing && <Editor initial={editing} onDone={() => setEditing(null)} />}
      {isLoading ? <Skeleton className="h-40 rounded-xl" /> : (
        <ul className="grid gap-2">
          {data.map((e) => (
            <li key={e.id} className={`gf-card p-3 ${e.active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-brand-electric font-bold">{e.category} · {e.lang}</p>
                  <p className="font-bold">{e.question_fr}</p>
                  {e.question_ar && <p className="text-sm" dir="rtl">{e.question_ar}</p>}
                  <p className="text-sm text-muted-foreground line-clamp-2">{e.answer_fr}</p>
                  {e.variants?.length > 0 && <p className="text-[11px] text-muted-foreground mt-1">{e.variants.join(" · ")}</p>}
                </div>
                {canEdit && (
                  <>
                    <button type="button" onClick={() => setEditing(e)} className={ui.btnGhost} aria-label={t("onboarding.edit")}><Pencil size={16} /></button>
                    <button type="button" onClick={() => remove(e.id)} className={ui.btnGhost} aria-label={t("admin.taxonomy.delete")}><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
