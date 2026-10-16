import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { matchService } from "@/services/marketplaceService";

// Detailed, explainable score of a recommendation (criteria, weights, contributions, formula version).
export function WhyDialog({ match, profileId, open, onOpenChange }) {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ["why", match?.match_result_id, profileId], enabled: open && Boolean(match?.match_result_id),
    queryFn: () => matchService.explanation(match.match_result_id, profileId),
  });
  const r = data?.results?.[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="why-dialog">
        <DialogHeader>
          <DialogTitle>{t("match.whyTitle")}</DialogTitle>
          <DialogDescription>{match?.explanation}</DialogDescription>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-32 rounded-xl" /> : error || !r ? <p className="text-sm text-muted-foreground">{t("match.whyUnavailable")}</p> : (
          <div className="space-y-3">
            <p className="text-3xl font-extrabold">{r.score}<span className="text-base text-muted-foreground">/100</span></p>
            <ul className="space-y-2 text-sm">
              {r.components.map((c) => (
                <li key={c.criterion}>
                  <div className="flex justify-between gap-2"><span>{t(`match.criteria.${c.criterion}`)}</span><span className={`font-bold ${c.contribution < 0 ? "text-destructive" : ""}`}>{c.contribution > 0 ? "+" : ""}{c.contribution}</span></div>
                  {c.contribution > 0 && <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full gf-gradient-bg" style={{ width: `${Math.min(100, c.value * 100)}%` }} /></div>}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">{t("match.formula", { v: data.formula_version })}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WhyButton({ match, profileId }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!match?.match_result_id) return null;
  // Inside a card link: keep clicks (including the portal dialog's) from bubbling to the <Link>.
  return (
    <span onClick={(e) => e.stopPropagation()} role="presentation">
      <button type="button" onClick={(e) => { e.preventDefault(); setOpen(true); }}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-electric underline min-h-[32px]" data-testid="why-button">
        <Info size={13} />{t("match.why")}
      </button>
      <WhyDialog match={match} profileId={profileId} open={open} onOpenChange={setOpen} />
    </span>
  );
}

