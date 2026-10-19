import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { fileUrl } from "@/services/marketplaceService";
import { adminPromoService } from "@/services/promoService";
import { useI18n } from "@/i18n";
import { errorCode, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";

const PLACEMENTS = ["home", "search"];
const EMPTY = { title: "", advertiser: "", link_url: "https://", alt: "", placements: ["home"], active: true, starts_at: "", ends_at: "", order: 0 };
const dayInput = (iso) => (iso ? String(iso).slice(0, 10) : "");

function toBody(f) {
  return { ...f, order: Number(f.order) || 0, starts_at: f.starts_at ? new Date(`${f.starts_at}T00:00:00`).toISOString() : null,
    ends_at: f.ends_at ? new Date(`${f.ends_at}T23:59:59`).toISOString() : null };
}

function BannerDialog({ banner, onClose }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const editing = banner && banner !== "new";
  const [form, setForm] = useState(() => (editing ? { ...EMPTY, ...banner, starts_at: dayInput(banner.starts_at), ends_at: dayInput(banner.ends_at) } : EMPTY));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const togglePlacement = (p) => setForm((f) => ({ ...f, placements: f.placements.includes(p) ? f.placements.filter((x) => x !== p) : [...f.placements, p] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { id, image_key, image_thumb_key, impressions, clicks, ctr, created_at, updated_at, created_by, seed, ...rest } = form;
      const saved = editing ? await adminPromoService.update(banner.id, toBody(rest)) : await adminPromoService.create(toBody(rest));
      if (file) await adminPromoService.uploadImage(saved.id, file);
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      qc.invalidateQueries({ queryKey: ["promos"] });
      toast.success(t("admin.saved"));
      onClose();
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl" data-testid="banner-dialog">
        <DialogHeader><DialogTitle>{t(editing ? "promoAdmin.editBanner" : "promoAdmin.newBanner")}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className={ui.label}>{t("promoAdmin.image")}</span>
            {(file || form.image_key) && (
              <img src={file ? URL.createObjectURL(file) : fileUrl(form.image_thumb_key || form.image_key)} alt="" className="mb-2 aspect-[3/1] w-full rounded-xl object-cover" />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2" data-testid="banner-file" />
            <span className="mt-1 block text-xs text-muted-foreground">{t("promoAdmin.imageHint")}</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={ui.label}>{t("promoAdmin.title")}</span>
              <input value={form.title} onChange={set("title")} required minLength={2} maxLength={80} className={ui.input} data-testid="banner-title" /></label>
            <label><span className={ui.label}>{t("promoAdmin.advertiser")}</span>
              <input value={form.advertiser} onChange={set("advertiser")} required minLength={2} maxLength={80} className={ui.input} data-testid="banner-advertiser" /></label>
          </div>
          <label className="block"><span className={ui.label}>{t("promoAdmin.link")}</span>
            <input value={form.link_url} onChange={set("link_url")} required dir="ltr" inputMode="url" className={ui.input} data-testid="banner-link-url" />
            <span className="mt-1 block text-xs text-muted-foreground">{t("promoAdmin.linkHint")}</span></label>
          <label className="block"><span className={ui.label}>{t("promoAdmin.alt")}</span>
            <input value={form.alt} onChange={set("alt")} maxLength={160} className={ui.input} data-testid="banner-alt" /></label>
          <fieldset>
            <legend className={ui.label}>{t("promoAdmin.placements")}</legend>
            <div className="flex flex-wrap gap-4">
              {PLACEMENTS.map((p) => (
                <label key={p} className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.placements.includes(p)} onChange={() => togglePlacement(p)} className="h-4 w-4" data-testid={`banner-placement-${p}`} />
                  {t(`promoAdmin.placement.${p}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className={ui.label}>{t("promoAdmin.starts")}</span><input type="date" value={form.starts_at} onChange={set("starts_at")} className={ui.input} /></label>
            <label><span className={ui.label}>{t("promoAdmin.ends")}</span><input type="date" value={form.ends_at} onChange={set("ends_at")} className={ui.input} /></label>
            <label><span className={ui.label}>{t("promoAdmin.order")}</span><input type="number" min={0} max={999} value={form.order} onChange={set("order")} className={ui.input} /></label>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} data-testid="banner-active" />{t("promoAdmin.active")}
          </label>
          <button type="submit" disabled={busy || !form.placements.length || (!editing && !file)} className={`${ui.btnPrimary} w-full`} data-testid="banner-save">
            {t("common.save")}
          </button>
          {!editing && !file && <p className="text-xs text-muted-foreground">{t("promoAdmin.imageRequired")}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Super-admin: sponsored banners shown on the home pages and the search results (web and app). */
export function AdminBanners({ canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-banners"], queryFn: adminPromoService.banners });
  const [editing, setEditing] = useState(null);
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const toggle = async (b, active) => {
    try {
      const { id, image_key, image_thumb_key, impressions, clicks, ctr, created_at, updated_at, created_by, seed, ...rest } = b;
      await adminPromoService.update(b.id, { ...rest, active });
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      qc.invalidateQueries({ queryKey: ["promos"] });
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };
  const remove = async (b) => {
    if (!window.confirm(t("promoAdmin.confirmDelete", { title: b.title }))) return;
    try {
      await adminPromoService.remove(b.id);
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      qc.invalidateQueries({ queryKey: ["promos"] });
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-banners">
      <p className="text-sm text-muted-foreground">{t("promoAdmin.bannersHint")}</p>
      {canEdit && (
        <button type="button" onClick={() => setEditing("new")} className={`${ui.btnPrimary} w-full sm:w-auto`} data-testid="banner-new">
          <Plus size={18} aria-hidden="true" />{t("promoAdmin.newBanner")}
        </button>
      )}
      {!data.length ? <p className="gf-card p-6 text-center text-muted-foreground">{t("promoAdmin.noBanner")}</p> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.map((b) => (
            <li key={b.id} className="gf-card overflow-hidden" data-testid={`banner-row-${b.id}`}>
              {b.image_key ? <img src={fileUrl(b.image_thumb_key || b.image_key)} alt={b.alt} className="aspect-[3/1] w-full object-cover" />
                : <span className="grid aspect-[3/1] w-full place-items-center bg-secondary text-sm text-muted-foreground"><ImageUp size={20} aria-hidden="true" /></span>}
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.advertiser} · <span dir="ltr">{b.link_url}</span></p>
                  </div>
                  <Switch checked={b.active} disabled={!canEdit} onCheckedChange={(v) => toggle(b, v)} aria-label={t("promoAdmin.active")} data-testid={`banner-toggle-${b.id}`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {b.placements.map((p) => t(`promoAdmin.placement.${p}`)).join(", ")}
                  {(b.starts_at || b.ends_at) && ` · ${b.starts_at ? formatDate(b.starts_at) : "…"} → ${b.ends_at ? formatDate(b.ends_at) : "…"}`}
                </p>
                <p className="text-sm" data-testid={`banner-stats-${b.id}`}>{t("promoAdmin.stats", { views: b.impressions || 0, clicks: b.clicks || 0, ctr: b.ctr || 0 })}</p>
                {canEdit && (
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setEditing(b)} className={`${ui.btnOutline} min-h-[40px] flex-1`} data-testid={`banner-edit-${b.id}`}><Pencil size={16} aria-hidden="true" />{t("promoAdmin.edit")}</button>
                    <button type="button" onClick={() => remove(b)} className={`${ui.btnOutline} min-h-[40px] text-destructive`} aria-label={t("promoAdmin.remove")} data-testid={`banner-delete-${b.id}`}><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <BannerDialog banner={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
