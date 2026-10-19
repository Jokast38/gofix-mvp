import { Play } from "lucide-react";
import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { youtubeId, youtubeThumb } from "@/services/promoService";
import { ui } from "@/lib/ui";
import { BrandMark } from "./SocialLinks";

/** "Série GoFix" (YouTube vlog / podcast): episodes and channel link set in Admin → Communication.
 * Videos open on YouTube (no embedded player: no third-party cookies on GoFix pages). Hidden while nothing is set. */
export function GoFixSeries({ className = "" }) {
  const { t } = useI18n();
  const { settings = {} } = useConfig();
  const channel = settings.social_youtube_url || "";
  const videos = (settings.youtube_videos || []).map((v) => ({ ...v, id: youtubeId(v.url) })).filter((v) => v.id);
  if (!channel && !videos.length) return null;

  return (
    <section className={className} aria-labelledby="series-title" data-testid="gofix-series">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="gf-eyebrow flex items-center gap-1.5"><BrandMark name="youtube" size={16} />{t("promo.seriesEyebrow")}</p>
          <h2 id="series-title" className="mt-1 text-xl sm:text-2xl font-extrabold">{t("promo.seriesTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("promo.seriesText")}</p>
        </div>
        {channel && (
          <a href={channel} target="_blank" rel="noopener noreferrer" className={ui.btnOutline} data-testid="series-channel">
            <BrandMark name="youtube" size={18} />{t("promo.seriesChannel")}
          </a>
        )}
      </div>
      {videos.length > 0 && (
        <ul className="mt-4 -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {videos.map((v) => (
            <li key={v.id + v.url} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <a href={v.url} target="_blank" rel="noopener noreferrer" className="group block gf-card overflow-hidden" data-testid="series-video">
                <span className="relative block aspect-video bg-secondary">
                  <img src={youtubeThumb(v.id)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/20 group-hover:bg-black/35 transition-colors">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FF0000] text-white shadow-lg"><Play size={22} fill="currentColor" aria-hidden="true" /></span>
                  </span>
                </span>
                <span className="block p-3 text-sm font-semibold line-clamp-2">{v.title || t("promo.seriesEpisode")}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
