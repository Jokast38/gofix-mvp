import { useState } from "react";
import { Loader2, LocateFixed, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { getPosition } from "@/lib/geo";

const SORTS = [["relevance", Sparkles], ["rating", Star], ["distance", LocateFixed]];
// The client's position stays in memory for this visit only: it is not put in the URL or stored anywhere.
let lastPosition = null;

/** Sort of a catalog list (sort in the URL, position in memory). `query` is what to add to the API call. */
export function useSort(params, set) {
  const { t, te } = useI18n();
  const [pos, setPos] = useState(lastPosition);
  const [locating, setLocating] = useState(false);
  // "Near me" needs a reference point: the position, else the chosen wilaya. Without either it falls back to relevance.
  const sort = params.sort === "distance" && !pos && !params.wilaya ? "relevance" : params.sort || "relevance";
  const choose = async (next) => {
    if (next !== "distance") return set({ sort: next === "relevance" ? "" : next });
    setLocating(true);
    const res = await getPosition();
    setLocating(false);
    if (res.error) {
      if (!params.wilaya) return toast.error(te(res.error));
      toast(t("nearby.noPosition"));
    } else {
      lastPosition = res;
      setPos(res);
    }
    return set({ sort: "distance" });
  };
  const query = { ...(sort !== "relevance" && { sort }), ...(pos && { lat: pos.lat, lng: pos.lng }) };
  return { sort, choose, locating, query, fromYou: Boolean(pos) };
}

export function SortBar({ sort, choose, locating, fromYou }) {
  const { t } = useI18n();
  const hint = sort === "distance" ? t(fromYou ? "nearby.fromYou" : "nearby.fromWilaya") : sort === "rating" ? t("nearby.ratingHint") : null;
  return (
    <div className="mt-3" data-testid="catalog-sort">
      <div role="group" aria-label={t("nearby.label")} className="flex flex-wrap gap-2">
        {SORTS.map(([key, Icon]) => (
          <button key={key} type="button" aria-pressed={sort === key} onClick={() => choose(key)} disabled={locating} data-testid={`sort-${key}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[40px] text-xs font-bold transition-colors ${sort === key ? "border-brand-orange bg-brand-orange/15" : "border-border"}`}>
            {key === "distance" && locating ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}
            {key === "distance" && locating ? t("nearby.locating") : t(`nearby.${key}`)}
          </button>
        ))}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground" data-testid="sort-hint">{hint}</p>}
    </div>
  );
}
