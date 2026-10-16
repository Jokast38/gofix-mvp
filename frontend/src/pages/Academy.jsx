import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { BlurNotice, QuotaNotice, TeacherCard } from "@/components/catalog/Cards";
import { SmartMatch } from "@/components/catalog/SmartMatch";
import { PageHeader } from "@/components/common/PageSkeleton";
import { RequestDialog } from "@/components/requests/RequestDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useConfig } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { marketplaceService } from "@/services/marketplaceService";
import { ui } from "@/lib/ui";
import { Empty, Filters, Pager, PublishRequestBar, useParamsState } from "./Search";

const FORMATS = ["home", "online", "center"];

export default function Academy() {
  const { t } = useI18n();
  const loc = useLocalized();
  const { user } = useAuth();
  const { settings } = useConfig();
  const [params, set] = useParamsState();
  const [selected, setSelected] = useState([]);
  const [intent, setIntent] = useState(null);
  useEffect(() => setIntent(null), [params.q]);
  const [dialog, setDialog] = useState(false);
  const max = settings.request_max_recipients || 5;
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: marketplaceService.subjects, staleTime: 300_000 });
  const levels = useQuery({ queryKey: ["levels"], queryFn: marketplaceService.levels, staleTime: 300_000 });
  const understood = intent?.subject_key;
  const query = understood
    ? { subject_key: params.subject_key || intent.subject_key, level_key: params.level_key || intent.level_key, format: params.format || intent.mode,
        wilaya: params.wilaya || intent.wilaya_code, page: Number(params.page || 1), page_size: 12 }
    : { q: params.q, subject_key: params.subject_key, level_key: params.level_key, format: params.format, wilaya: params.wilaya, page: Number(params.page || 1), page_size: 12 };
  const { data, isLoading } = useQuery({ queryKey: ["teachers", query, Boolean(user)], queryFn: () => marketplaceService.teachers(query), keepPreviousData: true,
    enabled: !params.q || intent !== null });
  const canSelect = Boolean(user) && data && !data.blurred;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= max ? s : [...s, id]));
  const defaults = { subject_key: params.subject_key, level_key: params.level_key, format: params.format, wilaya_code: params.wilaya };

  return (
    <div className={`${ui.container} py-6 sm:py-10`} data-testid="academy-page">
      <PageHeader eyebrow={t("appHome.academy")} title={t("catalog.teachersTitle")} subtitle={data ? t("catalog.results", { n: data.total }) : ""} />
      <Filters params={params} set={set} extra={
        <select value={params.subject_key || ""} onChange={(e) => set({ subject_key: e.target.value })} className={`${ui.input} min-h-[44px] appearance-none sm:w-48`} data-testid="catalog-subject-select">
          <option value="">{t("catalog.allSubjects")}</option>
          {(subjects.data || []).map((s) => <option key={s.key} value={s.key}>{loc(s)}</option>)}
        </select>
      } />
      <div className="mt-3 flex flex-wrap gap-2" data-testid="academy-chips">
        {FORMATS.map((f) => (
          <button key={f} type="button" aria-pressed={params.format === f} onClick={() => set({ format: params.format === f ? "" : f })} data-testid={`academy-format-${f}`}
            className={`rounded-full border px-3 min-h-[40px] text-xs font-bold transition-colors ${params.format === f ? "border-brand-pink bg-brand-pink/15" : "border-border"}`}>{t(`onboarding.formats.${f}`)}</button>
        ))}
        <span className="w-px bg-border mx-1" aria-hidden="true" />
        {(levels.data || []).map((l) => (
          <button key={l.key} type="button" aria-pressed={params.level_key === l.key} onClick={() => set({ level_key: params.level_key === l.key ? "" : l.key })} data-testid={`academy-level-${l.key}`}
            className={`rounded-full border px-3 min-h-[40px] text-xs font-bold transition-colors ${params.level_key === l.key ? "border-brand-electric bg-brand-electric/15" : "border-border"}`}>{loc(l)}</button>
        ))}
      </div>
      {params.q && <div className="mt-4"><SmartMatch text={params.q} kind="teacher" onIntent={(i) => setIntent(i || {})} /></div>}
      {params.q && understood && <h2 className="mt-6 text-base font-extrabold">{t("match.allResults")}</h2>}
      {data?.blurred && <div className="mt-4"><BlurNotice loggedIn={Boolean(user)} /></div>}
      {data?.blurred ? <PublishRequestBar kind="teacher" defaults={defaults} /> : canSelect && (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="academy-multi-hint">{t("catalog.multiHint", { n: max })}</p>
      )}
      <div className="mt-3"><QuotaNotice used={data?.views_used} limit={data?.views_limit || null} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? [...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />) : data?.items.map((x, i) => (
          <TeacherCard key={x.id} tch={x} index={i} selectable={canSelect && !x.is_owner} selected={selected.includes(x.id)} onSelect={() => toggle(x.id)} />
        ))}
      </div>
      {!isLoading && data?.total === 0 && <Empty />}
      {data && <Pager total={data.total} page={data.page} pageSize={data.page_size} onPage={(p) => set({ page: String(p) })} />}

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-[68px] md:bottom-4 z-40 px-4" data-testid="academy-selection-bar">
          <div className="mx-auto max-w-xl gf-glass border border-border rounded-full p-1.5 ps-4 flex items-center gap-2 shadow-lg">
            <span className="text-sm font-bold flex-1">{t("catalog.selectedN", { n: selected.length, max })}</span>
            <button type="button" onClick={() => setSelected([])} aria-label={t("common.cancel")} className={ui.btnGhost}><X size={18} /></button>
            <button type="button" onClick={() => setDialog(true)} className={`${ui.btnGradient} min-h-[44px] px-4`} data-testid="academy-send-selected"><Send size={16} />{t("catalog.sendToSelected", { n: selected.length })}</button>
          </div>
        </div>
      )}
      <RequestDialog open={dialog} onOpenChange={(o) => { setDialog(o); }} kind="teacher" profileIds={selected} defaults={defaults} />
    </div>
  );
}
