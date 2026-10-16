import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { useI18n } from "@/i18n";

const COLOR = { excellent: "var(--brand-electric)", established: "var(--brand-violet)", insufficient: "var(--brand-orange)" };
export const SUBS = ["identity", "reactivity", "satisfaction", "reliability"];

/** Trust status pill (Insuffisant / Établi / Excellent). The number is shown only when the server made it public. */
export function TrustBadge({ status, score, compact = false }) {
  const { t } = useI18n();
  if (!status) return null;
  const c = COLOR[status] || COLOR.insufficient;
  const Icon = status === "insufficient" ? ShieldQuestion : ShieldCheck;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-bold whitespace-nowrap ${compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"}`}
      style={{ color: c, borderColor: `color-mix(in srgb, ${c} 50%, transparent)` }} data-testid="trust-badge" title={t("trust.disclaimerShort")}>
      <Icon size={compact ? 11 : 13} aria-hidden="true" />
      {t(`trust.status.${status}`)}{score != null ? ` · ${score}` : ""}
    </span>
  );
}

/** 4 sub-indicators (GF2-005); a dash means "no data yet", never a bad score. */
export function TrustSubscores({ subscores }) {
  const { t } = useI18n();
  if (!subscores) return null;
  return (
    <ul className="grid grid-cols-2 gap-3" data-testid="trust-subscores">
      {SUBS.map((k) => {
        const v = subscores[k];
        return (
          <li key={k} className="rounded-xl border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">{t(`trust.subs.${k}`)}</span>
              <span className="text-sm font-extrabold">{v == null ? "—" : v}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={v ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={t(`trust.subs.${k}`)}>
              {v != null && <div className="h-full gf-gradient-bg" style={{ width: `${v}%` }} />}
            </div>
            {v == null && <p className="mt-1 text-[10px] text-muted-foreground">{t("trust.noData")}</p>}
          </li>
        );
      })}
    </ul>
  );
}
