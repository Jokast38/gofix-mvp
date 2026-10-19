import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Crown, MapPin, Medal, Star, Trophy } from "lucide-react";
import { Avatar } from "@/components/catalog/Cards";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n, useLocalized } from "@/i18n";
import { neonFor } from "@/lib/icons";
import { promoService } from "@/services/promoService";

// Phones: one swipeable row per list (short page); larger screens: a grid.
const ROW = "mt-3 -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3";
const ITEM = "w-[82%] shrink-0 snap-start sm:w-auto";

function monthLabel(period, lang) {
  const [y, m] = (period || "").split("-").map(Number);
  if (!y || !m) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : "fr-FR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 15)));
}

function Stars({ avg, count, label }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange">
      <Star size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" />{Number(avg).toFixed(1)}
      <span className="font-normal text-muted-foreground">({label || count})</span>
    </span>
  );
}

function MiniCard({ p, index, rank }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const color = neonFor(index);
  return (
    <Link to={`/pro/${p.id}`} className="gf-card flex items-center gap-3 p-3 hover:border-brand-electric/50 transition-colors" data-testid="highlight-card">
      <span className="relative">
        <Avatar photoKey={p.photo_key} thumbKey={p.photo_thumb_key} name={p.display_name || loc(p.category)} size="h-12 w-12" color={color} />
        {rank && <span className="absolute -top-1.5 -start-1.5 grid h-6 w-6 place-items-center rounded-full gf-gradient-bg text-[11px] font-extrabold">{rank}</span>}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-bold truncate">
          {p.display_name || loc(p.category)}
          {p.verification_status === "verified" && <BadgeCheck size={14} className="shrink-0 text-brand-electric" aria-label={t("catalog.verified")} />}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{p.display_name ? loc(p.category) : ""}{p.wilaya ? `${p.display_name ? " · " : ""}${loc(p.wilaya)}` : ""}</span>
        <Stars avg={p.month?.avg ?? p.rating_avg} count={p.month?.count ?? p.rating_count} label={p.month ? t("promo.reviewsMonth", { n: p.month.count }) : null} />
      </span>
    </Link>
  );
}

/** "Fixeur du mois" + best pros of the month + best rated (web home pages). */
export function Highlights({ className = "" }) {
  const { t, lang } = useI18n();
  const loc = useLocalized();
  const { data, isLoading } = useQuery({ queryKey: ["highlights"], queryFn: promoService.highlights, staleTime: 10 * 60_000 });
  if (isLoading) return <Skeleton className={`h-56 rounded-2xl ${className}`} />;
  if (!data?.fixer && !data?.top_rated?.length) return null;
  const f = data.fixer;
  const month = monthLabel(data.period, lang);

  return (
    <section className={className} aria-labelledby="fixer-title" data-testid="highlights">
      {f && (
        <Link to={`/pro/${f.id}`} className="block rounded-2xl gf-gradient-border p-4 sm:p-6 gf-pulse-glow hover:brightness-110 transition-[filter]" data-testid="fixer-of-month">
          <p className="gf-eyebrow flex items-center gap-1.5 text-brand-orange"><Trophy size={15} aria-hidden="true" />{t("promo.fixerEyebrow", { month })}</p>
          <div className="mt-3 flex items-center gap-4">
            <span className="relative">
              <Avatar photoKey={f.photo_key} thumbKey={f.photo_thumb_key} name={f.display_name || loc(f.category)} size="h-20 w-20 text-2xl" color="var(--brand-orange)" ring large />
              <span className="absolute -bottom-2 -end-2 grid h-8 w-8 place-items-center rounded-full bg-brand-orange text-[#070911] shadow"><Crown size={16} aria-hidden="true" /></span>
            </span>
            <span className="min-w-0">
              <h2 id="fixer-title" className="flex items-center gap-1.5 text-xl sm:text-2xl font-extrabold">
                <span className="truncate">{f.display_name || loc(f.category)}</span>
                {f.verification_status === "verified" && <BadgeCheck size={20} className="shrink-0 text-brand-electric" aria-label={t("catalog.verified")} />}
              </h2>
              <span className="block text-sm text-muted-foreground">
                {f.display_name && loc(f.category)}{f.wilaya && <><MapPin size={13} className="ms-2 me-0.5 inline align-[-2px]" aria-hidden="true" />{loc(f.wilaya)}</>}
              </span>
              <span className="mt-1 flex flex-wrap gap-x-3">
                {f.month && <Stars avg={f.month.avg} count={f.month.count} label={t("promo.reviewsMonth", { n: f.month.count })} />}
                <Stars avg={f.rating_avg} count={f.rating_count} label={t("promo.reviewsTotal", { n: f.rating_count })} />
              </span>
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t(data.manual ? "promo.fixerManual" : "promo.fixerAuto")}</p>
        </Link>
      )}

      {data.best_of_month?.length > 0 && (
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-brand-pink"><Medal size={16} aria-hidden="true" />{t("promo.bestOfMonth", { month })}</h3>
          <ul className={ROW}>
            {data.best_of_month.map((p, i) => <li key={p.id} className={ITEM}><MiniCard p={p} index={i} rank={i + 2} /></li>)}
          </ul>
        </div>
      )}

      {data.top_rated?.length > 0 && (
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-brand-electric"><Star size={16} aria-hidden="true" />{t("promo.topRated")}</h3>
          <ul className={ROW}>
            {data.top_rated.map((p, i) => <li key={p.id} className={ITEM}><MiniCard p={p} index={i + 3} /></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
