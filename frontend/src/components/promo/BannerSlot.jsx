import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { fileUrl } from "@/services/marketplaceService";
import { promoService } from "@/services/promoService";

const ROTATE_MS = 7000;

/** Sponsored banners of a placement ("home", "search"), set in Admin → Bannières. Always labelled "Sponsorisé". */
export function BannerSlot({ placement = "home", className = "" }) {
  const { t } = useI18n();
  const { data = [] } = useQuery({ queryKey: ["promos", placement], queryFn: () => promoService.banners(placement), staleTime: 5 * 60_000 });
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (data.length < 2 || paused) return undefined;
    const timer = setInterval(() => setI((x) => (x + 1) % data.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [data.length, paused]);
  if (!data.length) return null;
  const b = data[i % data.length];
  const img = (
    <img src={fileUrl(b.image_key)} srcSet={`${fileUrl(b.image_thumb_key)} 600w, ${fileUrl(b.image_key)} 1200w`} sizes="(max-width: 700px) 100vw, 1200px"
      alt={b.alt} className="block h-full w-full object-cover" loading="lazy" decoding="async" width="1200" height="400" />
  );
  const cls = "block aspect-[3/1] overflow-hidden rounded-2xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-electric";

  return (
    <aside className={`relative ${className}`} aria-label={t("promo.sponsored")} data-testid={`banner-slot-${placement}`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {b.internal_path ? (
        <Link to={b.internal_path} onClick={() => promoService.countClick(b.id)} className={cls} data-testid="banner-link">{img}</Link>
      ) : (
        <a href={promoService.clickUrl(b)} target="_blank" rel="sponsored noopener noreferrer" className={cls} data-testid="banner-link">{img}</a>
      )}
      <span className="pointer-events-none absolute top-2 start-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        {t("promo.sponsored")} · {b.advertiser}
      </span>
      {data.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {data.map((x, k) => (
            <button key={x.id} type="button" onClick={() => setI(k)} aria-label={t("promo.bannerN", { n: k + 1, total: data.length })} aria-current={k === i % data.length}
              className="grid h-6 w-6 place-items-center" data-testid={`banner-dot-${k}`}>
              <span className={`h-1.5 rounded-full transition-all ${k === i % data.length ? "w-5 bg-brand-electric" : "w-1.5 bg-border"}`} />
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
