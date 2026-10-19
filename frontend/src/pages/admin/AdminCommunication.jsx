import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { BrandMark } from "@/components/promo/SocialLinks";
import { adminService } from "@/services/publicService";
import { SOCIAL_KEYS, youtubeId, youtubeThumb } from "@/services/promoService";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";

const SOCIAL = SOCIAL_KEYS.map((k) => `social_${k}_url`);
export const COMMUNICATION_KEYS = [...SOCIAL, "youtube_videos", "fixer_of_month_email", "highlights_show_identity"];
const MAX_VIDEOS = 12;

/** Super-admin: social networks, "Série GoFix" YouTube episodes, "Fixeur du mois". Saved as public settings:
 * the web app and the mobile app pick them up on their next configuration refresh (a few minutes at most). */
export function AdminCommunication({ canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-settings"], queryFn: adminService.settings });
  const byKey = useMemo(() => Object.fromEntries(data.map((s) => [s.key, s])), [data]);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(Object.fromEntries(COMMUNICATION_KEYS.filter((k) => byKey[k]).map((k) => [k, byKey[k].value]))); }, [byKey]);
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const videos = form.youtube_videos || [];
  const setVideo = (i, patch) => set("youtube_videos", videos.map((v, k) => (k === i ? { ...v, ...patch } : v)));
  const changed = COMMUNICATION_KEYS.filter((k) => byKey[k] && JSON.stringify(form[k]) !== JSON.stringify(byKey[k].value));

  const save = async () => {
    setBusy(true);
    try {
      for (const k of changed) {
        const v = form[k];
        await adminService.setSetting(k, k === "youtube_videos" ? v.filter((x) => x.url.trim()) : typeof v === "string" ? v.trim() : v);
      }
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["highlights"] });
      toast.success(t("admin.saved"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-communication">
      <p className="text-sm text-muted-foreground">{t("promoAdmin.hint")}</p>

      <section className="gf-card p-4 md:p-6">
        <h2 className="mb-1 text-lg font-bold">{t("promoAdmin.socialTitle")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("promoAdmin.socialHint")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {SOCIAL_KEYS.map((k) => (
            <label key={k}>
              <span className={`${ui.label} flex items-center gap-2`}><BrandMark name={k} size={18} />{t(`promo.social.${k}`)}</span>
              <input value={form[`social_${k}_url`] ?? ""} onChange={(e) => set(`social_${k}_url`, e.target.value)} disabled={!canEdit}
                dir="ltr" inputMode="url" placeholder="https://…" className={ui.input} data-testid={`comm-social-${k}`} />
            </label>
          ))}
        </div>
      </section>

      <section className="gf-card p-4 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><BrandMark name="youtube" />{t("promoAdmin.seriesTitle")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("promoAdmin.seriesHint")}</p>
        <ul className="space-y-3">
          {videos.map((v, i) => {
            const id = youtubeId(v.url);
            return (
              <li key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center" data-testid={`comm-video-${i}`}>
                {id ? <img src={youtubeThumb(id)} alt="" className="aspect-video w-full rounded-lg object-cover sm:w-[120px]" />
                  : <span className="grid aspect-video w-full place-items-center rounded-lg bg-secondary text-xs text-muted-foreground sm:w-[120px]">{t("promoAdmin.noPreview")}</span>}
                <div className="grid gap-2">
                  <input value={v.url} onChange={(e) => setVideo(i, { url: e.target.value })} disabled={!canEdit} dir="ltr" inputMode="url"
                    placeholder="https://www.youtube.com/watch?v=…" aria-label={t("promoAdmin.videoUrl")} className={ui.input} data-testid={`comm-video-url-${i}`} />
                  <input value={v.title} onChange={(e) => setVideo(i, { title: e.target.value })} disabled={!canEdit} maxLength={120}
                    placeholder={t("promoAdmin.videoTitle")} aria-label={t("promoAdmin.videoTitle")} className={ui.input} data-testid={`comm-video-title-${i}`} />
                  {v.url && !id && <p className="text-xs text-destructive">{t("errors.invalid_youtube_url")}</p>}
                </div>
                {canEdit && (
                  <button type="button" onClick={() => set("youtube_videos", videos.filter((_, k) => k !== i))} aria-label={t("promoAdmin.remove")}
                    className="grid h-11 w-11 place-items-center rounded-full text-destructive hover:bg-destructive/10" data-testid={`comm-video-remove-${i}`}><Trash2 size={18} /></button>
                )}
              </li>
            );
          })}
        </ul>
        {canEdit && videos.length < MAX_VIDEOS && (
          <button type="button" onClick={() => set("youtube_videos", [...videos, { url: "", title: "" }])} className={`${ui.btnOutline} mt-3`} data-testid="comm-video-add">
            <Plus size={18} aria-hidden="true" />{t("promoAdmin.addVideo")}
          </button>
        )}
      </section>

      <section className="gf-card p-4 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><Trophy size={18} className="text-brand-orange" aria-hidden="true" />{t("promoAdmin.fixerTitle")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("promoAdmin.fixerHint")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className={ui.label}>{t("promoAdmin.fixerEmail")}</span>
            <input type="email" value={form.fixer_of_month_email ?? ""} onChange={(e) => set("fixer_of_month_email", e.target.value)} disabled={!canEdit}
              dir="ltr" placeholder={t("promoAdmin.fixerAutoPh")} className={ui.input} data-testid="comm-fixer-email" />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-border p-3">
            <Switch checked={Boolean(form.highlights_show_identity)} onCheckedChange={(v) => set("highlights_show_identity", v)} disabled={!canEdit} data-testid="comm-show-identity" />
            <span className="text-sm">{t("promoAdmin.showIdentity")}</span>
          </label>
        </div>
      </section>

      {canEdit && (
        <button type="button" onClick={save} disabled={busy || !changed.length} className={`${ui.btnPrimary} w-full sm:w-auto`} data-testid="comm-save">{t("common.save")}</button>
      )}
    </div>
  );
}
