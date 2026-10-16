import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Briefcase, CalendarDays, Clock, Heart, Lock, MapPin, MessageCircle, Phone, Send, ShieldCheck, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Cover, Rating } from "@/components/catalog/Cards";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { ReportButton } from "@/components/common/ReportButton";
import { TrustBadge, TrustSubscores } from "@/components/trust/Trust";
import { RequestDialog } from "@/components/requests/RequestDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n, useLocalized } from "@/i18n";
import { errorCode, formatDA, formatDate, formatPhone } from "@/lib/format";
import { marketplaceService, socialService } from "@/services/marketplaceService";
import { ui } from "@/lib/ui";

const DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

function Chip({ children, color = "var(--brand-electric)" }) {
  return <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)`, color }}>{children}</span>;
}

function Stat({ icon: Icon, label, value, testId }) {
  return (
    <div className="gf-card p-3 text-center" data-testid={testId}>
      <Icon size={18} strokeWidth={1.6} className="mx-auto text-brand-electric" aria-hidden="true" />
      <p className="mt-1 text-sm font-extrabold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MessageDialog({ open, onOpenChange, kind, profileId, name }) {
  const { t, te } = useI18n();
  const navigate = useNavigate();
  const [body, setBody] = useState("");
  const send = async (e) => {
    e.preventDefault();
    try {
      const c = await socialService.start(kind, profileId, body.trim());
      navigate(`/messages/${c.id}`);
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="message-dialog">
        <DialogHeader><DialogTitle>{t("messages.startTitle", { name })}</DialogTitle></DialogHeader>
        <form onSubmit={send} className="space-y-3">
          <textarea rows={4} required minLength={1} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("messages.placeholder")} className={`${ui.input} py-3`} data-testid="message-dialog-input" />
          <button type="submit" disabled={!body.trim()} className={`${ui.btnGradient} w-full`} data-testid="message-dialog-send"><Send size={18} />{t("messages.send")}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Availability({ slots }) {
  const { t } = useI18n();
  if (!slots?.length) return null;
  return (
    <section className="mt-6" data-testid="profile-availability">
      <h2 className="text-base font-extrabold mb-2 flex items-center gap-2"><CalendarDays size={18} className="text-brand-electric" />{t("onboarding.availability")}</h2>
      <div className="flex flex-wrap gap-2">
        {DAYS.filter((d) => slots.some((s) => s.day === d)).map((d) => (
          <Chip key={d} color="var(--brand-violet)">{t(`onboarding.days.${d}`)} · {slots.filter((s) => s.day === d).map((s) => t(`onboarding.slots.${s.slot}`)).join(", ")}</Chip>
        ))}
      </div>
    </section>
  );
}

function Reviews({ items, subjects }) {
  const { t } = useI18n();
  const loc = useLocalized();
  return (
    <section className="mt-6" data-testid="profile-reviews">
      <h2 className="text-base font-extrabold mb-2">{t("catalog.reviews")}</h2>
      {!items?.length ? <p className="text-sm text-muted-foreground">{t("catalog.noReviews")}</p> : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold">{r.author}</span>
                <span className="inline-flex items-center gap-1 font-bold text-brand-orange"><Star size={12} fill="currentColor" strokeWidth={0} />{r.rating}/5</span>
              </div>
              {r.subject_key && <p className="text-[11px] text-brand-electric font-semibold">{loc(subjects?.find((s) => s.key === r.subject_key)) || r.subject_key}</p>}
              {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(r.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ProfileDetail({ kind }) {
  const { id } = useParams();
  const { t, te } = useI18n();
  const loc = useLocalized();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const { data: p, isLoading, error } = useQuery({ queryKey: [kind, id, Boolean(user)], queryFn: () => (kind === "teacher" ? marketplaceService.teacher(id) : marketplaceService.pro(id)) });
  const favs = useQuery({ queryKey: ["favorites"], queryFn: socialService.favorites, enabled: Boolean(user) });

  if (isLoading) return <PageSkeleton />;
  if (error || !p) return <div className={`${ui.container} py-16 text-center`} data-testid="profile-not-found"><p className="text-xl font-bold">{t("notFound.title")}</p><Link to="/" className={`${ui.btnPrimary} mt-6`}>{t("notFound.back")}</Link></div>;

  const color = kind === "teacher" ? "var(--brand-electric)" : "var(--brand-pink)";
  const price = kind === "teacher" ? p.price_hint_da_hour : p.price_hint_da;
  const backTo = kind === "teacher" ? "/academy" : "/search";
  const isFav = favs.data?.ids?.includes(p.id);
  const toggleFav = async () => {
    try {
      if (isFav) await socialService.removeFavorite(p.id);
      else await socialService.addFavorite(kind, p.id);
      qc.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(isFav ? t("favorites.removed") : t("favorites.added"));
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  const requestDefaults = kind === "teacher" ? { subject_key: p.subjects?.[0]?.subject_key } : { category_key: p.category_key };

  return (
    <div className={`${ui.container} max-w-3xl py-6 sm:py-10`} data-testid={`${kind}-detail`}>
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 min-h-[44px]" data-testid="profile-back"><ArrowLeft size={16} className="rtl:rotate-180" />{t("common.back")}</Link>
      <div className="gf-card overflow-hidden">
        <div className="relative">
          <Cover coverKey={p.cover_key} thumbKey={p.cover_thumb_key} blurred={p.blurred} color={color} className="h-36 sm:h-52" large />
          {user && !p.is_owner && !p.blurred && (
            <button type="button" onClick={toggleFav} aria-pressed={Boolean(isFav)} aria-label={isFav ? t("favorites.remove") : t("favorites.add")} data-testid="profile-favorite"
              className="absolute top-3 end-3 grid place-items-center h-11 w-11 rounded-full gf-glass border border-border">
              <Heart size={20} className={isFav ? "text-brand-pink" : ""} fill={isFav ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        <div className="px-5 sm:px-7 pb-6 -mt-12 relative">
          <div className="flex items-end gap-4">
            <Avatar photoKey={p.photo_key} thumbKey={p.photo_thumb_key} name={p.display_name} blurred={p.blurred} size="h-24 w-24 text-2xl" color={color} ring large />
            <div className="min-w-0 flex-1 pb-1">
              {p.blurred ? (
                <p className="flex items-center gap-2 text-lg font-extrabold text-muted-foreground" data-testid="profile-name"><Lock size={18} />{t("catalog.hiddenName")}</p>
              ) : (
                <h1 className="text-2xl font-extrabold flex items-center gap-2" data-testid="profile-name">
                  <span className="truncate">{p.display_name}</span>{p.verification_status === "verified" && <BadgeCheck size={20} className="text-brand-electric shrink-0" aria-label={t("catalog.verified")} />}
                </h1>
              )}
              <p className="text-sm font-semibold" style={{ color }}>
                {kind === "teacher" ? t("onboarding.teacher.title") : `${loc(p.category)}${p.role ? ` · ${loc(p.role)}` : ""}`}
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{p.wilayas?.map((w) => `${loc(w)}${w.communes?.length ? ` (${w.communes.join(", ")})` : ""}`).join(" · ") || t("onboarding.formats.online")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Rating avg={p.rating_avg} count={p.rating_count} bucket={p.rating_bucket} />
            {p.verification_status === "verified" ? <Chip>{t("catalog.verified")}</Chip> : <Chip color="var(--brand-orange)">{t("catalog.unverified")}</Chip>}
          </div>

          {p.quota_exceeded && (
            <div className="mt-4 rounded-xl border border-brand-orange/50 bg-brand-orange/10 p-3 text-sm" data-testid="profile-quota-exceeded">
              {t("catalog.quotaExceeded", { limit: p.views_limit })} <Link to="/pricing" className="font-bold underline">{t("catalog.upgrade")}</Link>
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat icon={Briefcase} label={t("catalog.experience")} value={p.experience_years != null ? `${p.experience_years} ${t("catalog.years")}` : "—"} testId="profile-stat-exp" />
            <Stat icon={ShieldCheck} label={t("catalog.trust")} value={p.trust_score != null ? `${p.trust_score}/100` : p.trust_status ? t(`trust.status.${p.trust_status}`) : "—"} testId="profile-stat-trust" />
            <Stat icon={Clock} label={kind === "teacher" ? t("catalog.perHour") : t("catalog.from")} value={price != null ? <bdi dir="ltr">{formatDA(price)}</bdi> : p.blurred ? "—" : t("onboarding.onQuote")} testId="profile-stat-price" />
          </div>
          {p.trust_subscores && (
            <section className="mt-4" data-testid="profile-trust">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-base font-extrabold">{t("trust.subsTitle")}</h2>
                <TrustBadge status={p.trust_status} />
              </div>
              <TrustSubscores subscores={p.trust_subscores} />
            </section>
          )}
          {p.trust_status && <p className="mt-2 text-[11px] text-muted-foreground">{t("trust.disclaimerShort")}</p>}

          <section className="mt-6">
            <h2 className="text-base font-extrabold mb-2">{t("catalog.about")}</h2>
            {p.blurred ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground flex items-center gap-2" data-testid="profile-bio-locked"><Lock size={16} />{user ? t("catalog.blurNoticeFree") : t("catalog.blurNotice")}</div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-line" data-testid="profile-bio">{p.bio}</p>
            )}
          </section>

          {kind === "teacher" ? (
            <section className="mt-6" data-testid="profile-subjects">
              <h2 className="text-base font-extrabold mb-2">{t("onboarding.subjects")}</h2>
              <ul className="space-y-2">
                {p.subjects_full?.map((s) => (
                  <li key={s.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold">{loc(s)}</span>
                    {s.rating?.count > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange" data-testid={`subject-rating-${s.key}`}><Star size={12} fill="currentColor" strokeWidth={0} />{s.rating.avg} ({s.rating.count})</span>}
                    {s.levels.map((l) => <Chip key={l.key} color="var(--brand-orange)">{loc(l)}</Chip>)}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">{(p.formats || []).map((f) => <Chip key={f} color="var(--brand-pink)">{t(`onboarding.formats.${f}`)}</Chip>)}</div>
            </section>
          ) : p.specialties?.length > 0 && (
            <section className="mt-6" data-testid="profile-specialties">
              <h2 className="text-base font-extrabold mb-2">{t("onboarding.specialties")}</h2>
              <div className="flex flex-wrap gap-2">{p.specialties.map((s) => <Chip key={s.key} color="var(--brand-violet)">{loc(s)}</Chip>)}</div>
            </section>
          )}

          {!p.blurred && <Availability slots={p.availability?.slots} />}
          {!p.blurred && <Reviews items={p.reviews} subjects={p.subjects_full} />}

          {p.phone && (
            <a href={`tel:${p.phone}`} className={`${ui.btnOutline} mt-6 w-full`} dir="ltr" data-testid="profile-phone"><Phone size={18} />{formatPhone(p.phone)}</a>
          )}

          <div className="mt-6 grid gap-3">
            {p.is_owner ? (
              <Link to="/dashboard" className={`${ui.btnPrimary} w-full`} data-testid="profile-owner-dashboard">{t("dashboard.title")}</Link>
            ) : !user ? (
              <Link to="/login" state={{ from: `/${kind === "teacher" ? "teacher" : "pro"}/${id}` }} className={`${ui.btnGradient} w-full`} data-testid="profile-login-to-unlock"><Lock size={18} />{t("catalog.loginToUnlock")}</Link>
            ) : p.blurred ? (
              <>
                <Link to="/pricing" className={`${ui.btnGradient} w-full`} data-testid="profile-unlock"><Sparkles size={18} />{t("catalog.unlock")}</Link>
                {p.can_request && <button type="button" onClick={() => setDialog("open")} className={`${ui.btnOutline} w-full`} data-testid="profile-open-request"><Send size={18} />{t("catalog.publishRequest")}</button>}
              </>
            ) : (
              <>
                {p.can_request && <button type="button" onClick={() => setDialog("request")} className={`${ui.btnGradient} w-full`} data-testid="profile-request"><Send size={18} />{t("catalog.sendRequest")}</button>}
                {p.can_contact && <button type="button" onClick={() => setDialog("message")} className={`${ui.btnOutline} w-full`} data-testid="profile-contact"><MessageCircle size={18} />{t("catalog.message")}</button>}
              </>
            )}
          </div>
          {!p.is_owner && <div className="mt-3 text-end"><ReportButton targetType={kind} targetId={p.id} /></div>}
        </div>
      </div>
      <RequestDialog open={dialog === "request"} onOpenChange={(o) => setDialog(o ? "request" : null)} kind={kind} profileIds={[p.id]} defaults={requestDefaults} recipientLabel={p.display_name} />
      <RequestDialog open={dialog === "open"} onOpenChange={(o) => setDialog(o ? "open" : null)} kind={kind} defaults={{ ...requestDefaults, wilaya_code: p.wilayas?.[0]?.code }} />
      <MessageDialog open={dialog === "message"} onOpenChange={(o) => setDialog(o ? "message" : null)} kind={kind} profileId={p.id} name={p.display_name} />
    </div>
  );
}
