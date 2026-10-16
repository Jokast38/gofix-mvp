import { Link } from "react-router-dom";
import { BadgeCheck, Check, Lock, MapPin, Sparkles, Star } from "lucide-react";
import { useI18n, useLocalized } from "@/i18n";
import { formatDA } from "@/lib/format";
import { neonFor } from "@/lib/icons";
import { fileUrl, matchService } from "@/services/marketplaceService";
import { WhyButton } from "./Why";
import { TrustBadge } from "@/components/trust/Trust";

// Profile picture: thumbnail when small, initials when there is no photo, lock when the server masked the profile.
export function Avatar({ photoKey, thumbKey, name, blurred, size = "h-14 w-14", color, ring = false, large = false }) {
  const initials = (name || "?").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const src = fileUrl(large ? photoKey || thumbKey : thumbKey || photoKey);
  return (
    <span className={`${size} shrink-0 rounded-2xl overflow-hidden grid place-items-center font-extrabold text-lg border ${ring ? "ring-4 ring-card" : ""}`}
      style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)`, background: `color-mix(in srgb, ${color} 14%, hsl(var(--card)))`, color }} aria-hidden="true">
      {src && !blurred ? <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : blurred ? <Lock size={20} strokeWidth={1.6} /> : initials}
    </span>
  );
}

// Cover banner: uploaded image, or a brand-gradient placeholder (always the placeholder when masked).
export function Cover({ coverKey, thumbKey, blurred, color, className = "h-20", large = false }) {
  const src = !blurred && fileUrl(large ? coverKey || thumbKey : thumbKey || coverKey);
  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden="true"
      style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${color} 45%, hsl(var(--card))) 0%, color-mix(in srgb, var(--brand-violet) 30%, hsl(var(--card))) 60%, hsl(var(--card)) 100%)` }}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        : <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,.25) 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.18) 0 2px, transparent 3px)", backgroundSize: "60px 60px, 90px 90px" }} />}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, hsl(var(--card) / 0.75), transparent 70%)" }} />
    </div>
  );
}

export function Rating({ avg, count, bucket }) {
  const { t } = useI18n();
  if (bucket) {
    return <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange"><Star size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" />{t("catalog.ratingBucket", { b: bucket })}</span>;
  }
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange">
      <Star size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" />{Number(avg).toFixed(1)} <span className="text-muted-foreground font-normal">({count})</span>
    </span>
  );
}

function MatchBadge({ match }) {
  const { t } = useI18n();
  if (!match?.top) return null;
  return (
    <span className="absolute top-2 end-2 z-10 inline-flex items-center gap-1 rounded-full gf-gradient-bg px-2.5 py-1 text-[11px] font-extrabold shadow" data-testid="match-top-badge">
      <Sparkles size={12} aria-hidden="true" />{t("catalog.topMatch")}
    </span>
  );
}

function Why({ match, profileId }) {
  const { t } = useI18n();
  if (!match?.top || !match.explanation) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2">
      <p className="text-[11px] leading-snug text-brand-electric" data-testid="match-why"><span className="sr-only">{t("catalog.why")} </span>« {match.explanation} »</p>
      <WhyButton match={match} profileId={profileId} />
    </div>
  );
}

// AI MATCH feedback loop (GF1-006): which recommended profiles get opened.
const clicked = (item) => () => item.match?.match_result_id && matchService.feedback(item.match.match_result_id, item.id, "click");

function Name({ value, blurred, testId }) {
  const { t } = useI18n();
  return blurred || !value ? (
    <span className="inline-flex items-center gap-1.5" data-testid={testId}>
      <span className="h-3.5 w-28 rounded-full bg-muted" aria-hidden="true" /><span className="sr-only">{t("catalog.hiddenName")}</span>
    </span>
  ) : <h3 className="font-extrabold truncate" data-testid={testId}>{value}</h3>;
}

function CardShell({ to, index, testId, children, cover, selectable, selected, onSelect, onClick }) {
  const { t } = useI18n();
  return (
    <div className="relative gf-fade-up" style={{ animationDelay: `${index * 40}ms` }}>
      <Link to={to} onClick={onClick} className={`gf-card gf-card-hover block overflow-hidden ${selected ? "ring-2 ring-brand-pink" : ""}`} data-testid={testId}>
        {cover}
        <div className="px-4 pb-4 -mt-8 relative">{children}</div>
      </Link>
      {selectable && (
        <button type="button" onClick={onSelect} aria-pressed={selected} data-testid={`${testId}-select`}
          className={`absolute top-2 start-2 z-10 inline-flex items-center gap-1 rounded-full border px-2.5 min-h-[32px] text-[11px] font-bold backdrop-blur ${selected ? "bg-brand-pink text-white border-brand-pink" : "gf-glass border-border"}`}>
          <Check size={13} aria-hidden="true" />{selected ? t("catalog.selected") : t("catalog.select")}
        </button>
      )}
    </div>
  );
}

export function ProCard({ p, index = 0 }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const color = neonFor(index);
  return (
    <CardShell to={`/pro/${p.id}`} index={index} testId={`pro-card-${p.id}`} onClick={clicked(p)}
      cover={<div className="relative"><MatchBadge match={p.match} /><Cover coverKey={p.cover_key} thumbKey={p.cover_thumb_key} blurred={p.blurred} color={color} /></div>}>
      <div className="flex items-end gap-3">
        <Avatar photoKey={p.photo_key} thumbKey={p.photo_thumb_key} name={p.display_name} blurred={p.blurred} color={color} ring />
        <div className="min-w-0 flex-1 pb-0.5">
          <div className="flex items-center gap-1.5">
            <Name value={p.display_name} blurred={p.blurred} testId="pro-card-name" />
            {p.verification_status === "verified" && <BadgeCheck size={16} className="text-brand-electric shrink-0" aria-label={t("catalog.verified")} />}
          </div>
          <p className="text-xs font-semibold truncate" style={{ color }}>{loc(p.category)}</p>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground truncate"><MapPin size={12} aria-hidden="true" />{p.wilayas?.map((w) => loc(w)).join(", ")}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2"><Rating avg={p.rating_avg} count={p.rating_count} bucket={p.rating_bucket} /><TrustBadge status={p.trust_status} score={p.trust_score} compact /></span>
        {p.price_hint_da != null && <span className="text-xs font-bold">{t("catalog.from")} <bdi dir="ltr">{formatDA(p.price_hint_da)}</bdi></span>}
      </div>
      <Why match={p.match} profileId={p.id} />
    </CardShell>
  );
}

export function TeacherCard({ tch, index = 0, selectable, selected, onSelect }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const color = neonFor(index + 1);
  return (
    <CardShell to={`/teacher/${tch.id}`} index={index} testId={`teacher-card-${tch.id}`} onClick={clicked(tch)} selectable={selectable} selected={selected} onSelect={onSelect}
      cover={<div className="relative"><MatchBadge match={tch.match} /><Cover coverKey={tch.cover_key} thumbKey={tch.cover_thumb_key} blurred={tch.blurred} color={color} /></div>}>
      <div className="flex items-end gap-3">
        <Avatar photoKey={tch.photo_key} thumbKey={tch.photo_thumb_key} name={tch.display_name} blurred={tch.blurred} color={color} ring />
        <div className="min-w-0 flex-1 pb-0.5">
          <div className="flex items-center gap-1.5">
            <Name value={tch.display_name} blurred={tch.blurred} testId="teacher-card-name" />
            {tch.verification_status === "verified" && <BadgeCheck size={16} className="text-brand-electric shrink-0" aria-label={t("catalog.verified")} />}
          </div>
          <p className="text-xs font-semibold truncate" style={{ color }}>{tch.subjects_full?.map((s) => loc(s)).join(" · ")}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground truncate">{(tch.formats || []).map((f) => t(`onboarding.formats.${f}`)).join(" · ")}{tch.wilayas?.length ? ` · ${tch.wilayas.map((w) => loc(w)).join(", ")}` : ""}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2"><Rating avg={tch.rating_avg} count={tch.rating_count} bucket={tch.rating_bucket} /><TrustBadge status={tch.trust_status} score={tch.trust_score} compact /></span>
        {tch.price_hint_da_hour != null && <span className="text-xs font-bold"><bdi dir="ltr">{formatDA(tch.price_hint_da_hour)}</bdi> / {t("catalog.hour")}</span>}
      </div>
      <Why match={tch.match} profileId={tch.id} />
    </CardShell>
  );
}

export function BlurNotice({ loggedIn }) {
  const { t } = useI18n();
  return (
    <div className="gf-gradient-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="catalog-blur-notice">
      <div className="flex items-center gap-3 flex-1">
        <Lock size={22} strokeWidth={1.6} className="text-brand-pink shrink-0" aria-hidden="true" />
        <p className="text-sm">{loggedIn ? t("catalog.blurNoticeFree") : t("catalog.blurNotice")}</p>
      </div>
      <div className="flex gap-2">
        {!loggedIn && <Link to="/login" className="rounded-full border border-border px-4 min-h-[44px] inline-flex items-center text-sm font-bold whitespace-nowrap" data-testid="catalog-blur-login">{t("nav.login")}</Link>}
        <Link to="/pricing" className="rounded-full gf-gradient-bg px-4 min-h-[44px] inline-flex items-center text-sm font-bold whitespace-nowrap" data-testid="catalog-unlock">{t("catalog.unlock")}</Link>
      </div>
    </div>
  );
}

export function QuotaNotice({ used, limit }) {
  const { t } = useI18n();
  if (limit == null || used == null) return null;
  return <p className="text-xs text-muted-foreground" data-testid="catalog-quota">{t("catalog.viewsUsed", { used, limit })}</p>;
}
