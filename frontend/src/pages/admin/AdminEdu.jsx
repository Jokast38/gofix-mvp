import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";
import { eduService } from "@/services/eduService";

const STATUSES = ["draft", "published", "archived"];
const BADGE = { draft: "bg-brand-orange/15 text-brand-orange", published: "bg-brand-electric/15", archived: "bg-secondary text-muted-foreground" };

function Import() {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [replace, setReplace] = useState(false);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrors([]);
    let items;
    try {
      const data = JSON.parse(await file.text());
      items = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(items)) throw new Error("not a list");
    } catch {
      toast.error(t("adminEdu.badJson"));
      return;
    }
    setBusy(true);
    try {
      const r = await eduService.import(items, replace);
      toast.success(t("adminEdu.imported", r));
      qc.invalidateQueries({ queryKey: ["admin-edu"] });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.code === "import_invalid") {
        setErrors(detail.errors || []);
        toast.error(te("import_invalid"));
      } else toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="gf-card p-4" data-testid="edu-import">
      <h3 className="font-bold">{t("adminEdu.importTitle")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("adminEdu.importHint")}</p>
      <label className="mt-3 flex items-center gap-2 text-sm min-h-[44px]">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-5 w-5" />{t("adminEdu.replace")}
      </label>
      <label className={`${ui.btnOutline} cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
        {t("adminEdu.importBtn")}
        <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} data-testid="edu-import-file" />
      </label>
      {errors.length > 0 && (
        <ul className="mt-3 max-h-48 overflow-auto text-xs text-destructive space-y-1" data-testid="edu-import-errors">
          {errors.map((x, i) => <li key={i} dir="ltr">#{(x.index ?? i) + 1} {x.id || ""} — {x.error}{x.field ? ` (${x.field})` : ""}</li>)}
        </ul>
      )}
    </section>
  );
}

export function AdminEdu({ canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({ test_key: "", status: "", q: "", page: 1 });
  const set = (patch) => setF({ ...f, page: 1, ...patch });
  const { data, isLoading } = useQuery({ queryKey: ["admin-edu", f], queryFn: () => eduService.items({ ...f, page_size: 50 }), keepPreviousData: true });
  const act = async (fn) => {
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["admin-edu"] });
      toast.success(t("admin.saved"));
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  return (
    <div className="space-y-4" data-testid="admin-edu">
      <p className="text-sm text-muted-foreground">{t("adminEdu.hint")}</p>
      {data && (
        <p className="flex flex-wrap gap-2 text-xs font-bold">
          {STATUSES.map((s) => <span key={s} className={`rounded-full px-2 py-1 ${BADGE[s]}`}>{t(`adminEdu.statuses.${s}`)} : {data.stats[s] || 0}</span>)}
          <span className="rounded-full px-2 py-1 bg-secondary">{t("adminEdu.finished", { n: data.attempts })}</span>
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={f.test_key} onChange={(e) => set({ test_key: e.target.value.trim() })} placeholder={t("adminEdu.filterTest")} dir="ltr" className={`${ui.input} min-h-[44px]`} data-testid="edu-filter-test" />
        <select value={f.status} onChange={(e) => set({ status: e.target.value })} className={`${ui.input} min-h-[44px]`} aria-label={t("adminEdu.all")}>
          <option value="">{t("adminEdu.all")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`adminEdu.statuses.${s}`)}</option>)}
        </select>
        <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t("adminEdu.search")} className={`${ui.input} min-h-[44px]`} />
      </div>
      {canEdit && f.test_key && data?.total > 0 && (
        <button type="button" onClick={() => act(() => eduService.setTestStatus(f.test_key, "published"))} className={ui.btnPrimary} data-testid="edu-publish-test">
          {t("adminEdu.publishTest")}
        </button>
      )}
      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <ul className="space-y-2">
          {data?.items.map((it) => (
            <li key={it.key} className="gf-card p-3" data-testid={`edu-item-${it.key}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-bold" dir="ltr">{it.key}</span>
                <span className="text-muted-foreground" dir="ltr">{it.test_key}</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${BADGE[it.status]}`}>{t(`adminEdu.statuses.${it.status}`)}</span>
              </div>
              <p className="mt-1 font-semibold whitespace-pre-line" dir="auto">{it.question}</p>
              <p className="mt-1 text-sm" dir="auto"><span className="text-muted-foreground">{t("adminEdu.answer")} : </span><b>{it.correct}</b>
                <span className="text-muted-foreground"> · {it.distractors.join(" · ")}</span></p>
              {it.explanation && <p className="mt-1 text-xs text-muted-foreground" dir="auto">{it.explanation}</p>}
              {canEdit && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {it.status !== "published" && <button type="button" onClick={() => act(() => eduService.setItemStatus(it.key, "published"))} className={`${ui.btnOutline} min-h-[40px] text-sm`}>{t("adminEdu.publish")}</button>}
                  {it.status !== "draft" && <button type="button" onClick={() => act(() => eduService.setItemStatus(it.key, "draft"))} className={`${ui.btnGhost} min-h-[40px] text-sm`}>{t("adminEdu.toDraft")}</button>}
                  {it.status !== "archived" && <button type="button" onClick={() => act(() => eduService.setItemStatus(it.key, "archived"))} className={`${ui.btnGhost} min-h-[40px] text-sm text-destructive`}>{t("adminEdu.archive")}</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })} className={ui.btnOutline}>‹</button>
          <span className="text-sm" dir="ltr">{f.page} / {pages}</span>
          <button type="button" disabled={f.page >= pages} onClick={() => setF({ ...f, page: f.page + 1 })} className={ui.btnOutline}>›</button>
        </div>
      )}
      {canEdit && <Import />}
    </div>
  );
}
