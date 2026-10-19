import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, Mic, Search as SearchIcon, SearchX, Send } from "lucide-react";
import { toast } from "sonner";
import { BlurNotice, ProCard, QuotaNotice } from "@/components/catalog/Cards";
import { SmartMatch } from "@/components/catalog/SmartMatch";
import { RequestDialog } from "@/components/requests/RequestDialog";
import { useAuth } from "@/hooks/AuthProvider";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useWilayas } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { marketplaceService } from "@/services/marketplaceService";
import { ui } from "@/lib/ui";
import { BannerSlot } from "@/components/promo/BannerSlot";

export function Filters({ params, set, extra }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(params.q || "");
  useEffect(() => setDraft(params.q || ""), [params.q]);
  const loc = useLocalized();
  const { data: wilayas = [] } = useWilayas();
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="gf-card p-3 grid gap-2 sm:grid-cols-[1fr_200px_auto]" data-testid="catalog-filters">
      <label className="relative">
        <SearchIcon size={18} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" aria-hidden="true" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== (params.q || "") && set({ q: draft })}
          onKeyDown={(e) => e.key === "Enter" && set({ q: draft })} placeholder={t("match.placeholder")} enterKeyHint="search"
          className={`${ui.input} ps-10 pe-24 min-h-[44px]`} data-testid="catalog-search-input" maxLength={200} />
        <span className="absolute top-1/2 -translate-y-1/2 end-1.5 flex items-center">
          {[["voice", Mic], ["vision", Camera]].map(([k, Icon]) => (
            <button key={k} type="button" onClick={() => toast(t(`upcoming.toast.${k}`))} aria-label={t(`upcoming.${k}.title`)} data-testid={`search-${k}-soon`}
              className="relative grid place-items-center h-10 w-10 rounded-full text-muted-foreground hover:bg-secondary">
              <Icon size={18} strokeWidth={1.6} /><span className="absolute -top-0.5 end-0 rounded-full bg-brand-orange px-1 text-[8px] font-extrabold text-[#070911]">{t("upcoming.soon")}</span>
            </button>
          ))}
        </span>
      </label>
      <select value={params.wilaya || ""} onChange={(e) => set({ wilaya: e.target.value })} className={`${ui.input} min-h-[44px] appearance-none`} data-testid="catalog-wilaya-select">
        <option value="">{t("home.wilayaAll")}</option>
        {wilayas.map((w) => <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, "0")} – ${loc(w)}`}</option>)}
      </select>
      {extra}
    </form>
  );
}

export function useParamsState() {
  const [sp, setSp] = useSearchParams();
  const params = Object.fromEntries(sp.entries());
  const set = (patch) => {
    const next = { ...params, ...patch, page: patch.page || "1" };
    Object.keys(next).forEach((k) => (next[k] === "" || next[k] == null) && delete next[k]);
    setSp(next, { replace: true });
  };
  return [params, set];
}

export function Pager({ total, page, pageSize, onPage }) {
  const { t } = useI18n();
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm" data-testid="catalog-pager">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={ui.btnOutline} data-testid="catalog-prev">{t("admin.users.prev")}</button>
      <span className="font-bold">{page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={ui.btnOutline} data-testid="catalog-next">{t("admin.users.next")}</button>
    </div>
  );
}

export function Empty() {
  const { t } = useI18n();
  return (
    <div className="py-16 text-center text-muted-foreground" data-testid="catalog-empty">
      <SearchX size={36} strokeWidth={1.4} className="mx-auto mb-3" />{t("catalog.empty")}
    </div>
  );
}

export function PublishRequestBar({ kind, defaults }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 gf-card p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="publish-request-bar">
      <p className="text-sm flex-1">{kind === "teacher" ? t("requests.barTeacher") : t("requests.bar")}</p>
      {user ? (
        <button type="button" onClick={() => setOpen(true)} className={`${ui.btnPrimary} min-h-[44px]`} data-testid="publish-request-open"><Send size={16} />{t("catalog.publishRequest")}</button>
      ) : (
        <Link to="/login" className={`${ui.btnOutline} min-h-[44px]`} data-testid="publish-request-login">{t("nav.login")}</Link>
      )}
      {user && <RequestDialog open={open} onOpenChange={setOpen} kind={kind} defaults={defaults} />}
    </div>
  );
}

export default function Search() {
  const { t } = useI18n();
  const loc = useLocalized();
  const { user } = useAuth();
  const [params, set] = useParamsState();
  const navigate = useNavigate();
  const [intent, setIntent] = useState(null);
  useEffect(() => setIntent(null), [params.q]);
  const onIntent = (i, kind) => {
    if (kind === "teacher") navigate(`/academy?q=${encodeURIComponent(params.q)}`, { replace: true });
    else setIntent(i || {});
  };
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => marketplaceService.categories(), staleTime: 300_000 });
  // Free text understood by AI MATCH -> structured filters for the full list (keyword search only as a fallback).
  const understood = intent?.category_key;
  const query = understood
    ? { category_key: params.category_key || intent.category_key, wilaya: params.wilaya || intent.wilaya_code, commune: intent.commune, page: Number(params.page || 1), page_size: 12 }
    : { q: params.q, category_key: params.category_key, wilaya: params.wilaya, page: Number(params.page || 1), page_size: 12 };
  const { data, isLoading } = useQuery({ queryKey: ["pros", query, Boolean(user)], queryFn: () => marketplaceService.pros(query), keepPreviousData: true,
    enabled: !params.q || intent !== null });
  const cat = cats.data?.find((c) => c.key === params.category_key);

  return (
    <div className={`${ui.container} py-6 sm:py-10`} data-testid="search-page">
      <PageHeader eyebrow={t("appHome.services")} title={cat ? loc(cat) : t("catalog.prosTitle")} subtitle={data ? t("catalog.results", { n: data.total }) : ""} />
      <Filters params={params} set={set} extra={
        <select value={params.category_key || ""} onChange={(e) => set({ category_key: e.target.value })} className={`${ui.input} min-h-[44px] appearance-none sm:w-48`} data-testid="catalog-category-select">
          <option value="">{t("catalog.allCategories")}</option>
          {(cats.data || []).map((c) => <option key={c.key} value={c.key}>{loc(c)}</option>)}
        </select>
      } />
      <BannerSlot placement="search" className="mt-4" />
      {params.q && <div className="mt-4"><SmartMatch text={params.q} onIntent={onIntent} /></div>}
      {params.q && understood && <h2 className="mt-6 text-base font-extrabold" data-testid="all-results">{t("match.allResults")}</h2>}
      {data?.blurred && <div className="mt-4"><BlurNotice loggedIn={Boolean(user)} /></div>}
      <PublishRequestBar kind="professional" defaults={{ category_key: params.category_key, wilaya_code: params.wilaya }} />
      <div className="mt-3"><QuotaNotice used={data?.views_used} limit={data?.views_limit || null} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? [...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />) : data?.items.map((p, i) => <ProCard key={p.id} p={p} index={i} />)}
      </div>
      {!isLoading && data?.total === 0 && <Empty />}
      {data && <Pager total={data.total} page={data.page} pageSize={data.page_size} onPage={(p) => set({ page: String(p) })} />}
    </div>
  );
}
