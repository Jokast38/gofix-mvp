import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Copy, Download, Globe, IdCard, Loader2, Plus, QrCode, Share2, ShieldCheck, ShieldOff, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/catalog/Cards";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useConfig } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { errorCode, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";
import { passportService } from "@/services/marketplaceService";

const VIS = ["full_name", "city", "photo", "rating", "trust"];
const CREDS = ["id_card", "diploma", "trade_register"];
const CRED_COLOR = { validated: "text-brand-electric", submitted: "text-brand-orange", expired: "text-destructive", rejected: "text-destructive", missing: "text-muted-foreground" };

function Chip({ ok, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${ok ? "border-brand-electric/60 bg-brand-electric/10" : "border-border text-muted-foreground"}`}>
      {ok ? <BadgeCheck size={13} aria-hidden="true" /> : null}{children}
    </span>
  );
}

/** The public page content (also used as the pro's preview). Only what the API's allow-list returns is shown. */
export function PassportCard({ data }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const trade = data.trade ? loc(data.trade) : (data.subjects || []).map((s) => loc(s)).join(", ");
  return (
    <article className="gf-card p-5" data-testid="passport-card">
      <div className="flex items-center gap-4 min-w-0">
        <Avatar thumbKey={data.photo_thumb_key} name={data.name} color="var(--brand-electric)" size="h-16 w-16" />
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold truncate" dir="auto">{data.name}</h2>
          <p className="text-sm font-semibold text-brand-electric truncate">{trade}</p>
          {data.wilayas?.length ? <p className="text-xs text-muted-foreground truncate">{data.wilayas.map((w) => loc(w)).join(", ")}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip ok={data.identity_verified}>{t(data.identity_verified ? "passport.public.identity" : "passport.public.identityNo")}</Chip>
        {data.profile_verified && <Chip ok>{t("passport.public.profileVerified")}</Chip>}
        {data.trust_score != null && <span className="inline-flex items-center gap-1 rounded-full bg-brand-violet/15 px-2.5 py-1 text-xs font-bold"><ShieldCheck size={13} aria-hidden="true" />{t("passport.public.trust")} <span dir="ltr">{data.trust_score}/100</span></span>}
        {data.rating && <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/15 px-2.5 py-1 text-xs font-bold"><Star size={13} aria-hidden="true" /><span dir="ltr">{t("passport.public.rating", { avg: data.rating.avg, n: data.rating.count })}</span></span>}
      </div>
      {data.skills?.length > 0 && (
        <section className="mt-5">
          <h3 className="text-sm font-extrabold">{t("passport.public.skills")}</h3>
          <ul className="mt-2 space-y-1.5">
            {data.skills.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <span className="min-w-0 break-words" dir="auto">{s.label}</span>
                <span className={`shrink-0 text-xs font-bold ${s.verified ? "text-brand-electric" : "text-muted-foreground"}`}>{t(s.verified ? "passport.verified" : "passport.declared")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.credentials?.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-extrabold">{t("passport.public.credentials")}</h3>
          <div className="mt-2 flex flex-wrap gap-2">{data.credentials.map((c) => <Chip key={c.type} ok={c.verified}>{t(`passport.creds.${c.type}`)} · {t(c.verified ? "passport.verified" : "passport.declared")}</Chip>)}</div>
        </section>
      )}
      <p className="mt-4 text-[11px] text-muted-foreground">{t("passport.public.legend")}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {data.member_since && t("passport.public.memberSince", { date: formatDate(data.member_since) })}
        {data.updated_at && ` · ${t("passport.public.updated", { date: formatDate(data.updated_at) })}`}
      </p>
    </article>
  );
}

export function PublicPassport() {
  const { token } = useParams();
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({ queryKey: ["passport-public", token], queryFn: () => passportService.view(token), retry: false });
  const profile = data && `/${data.kind === "teacher" ? "teacher" : "pro"}/${data.profile_id}`;
  return (
    <div className={`${ui.container} max-w-xl py-6 sm:py-10`} data-testid="passport-public">
      <p className="gf-eyebrow mb-3">{t("passport.public.eyebrow")}</p>
      {isLoading ? <Skeleton className="h-80 rounded-2xl" /> : error ? (
        <div className="gf-card p-6 text-center" data-testid="passport-not-found">
          <ShieldOff size={36} className="mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-extrabold">{t("passport.public.notFound")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("passport.public.notFoundHint")}</p>
          <Link to="/" className={`${ui.btnOutline} mt-4`}>{t("passport.public.home")}</Link>
        </div>
      ) : (
        <>
          <PassportCard data={data} />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link to={profile} className={ui.btnGradient} data-testid="passport-quote">{t("passport.public.quote")}</Link>
            <Link to={profile} className={ui.btnOutline} data-testid="passport-open-profile">{t("passport.public.openProfile")}</Link>
          </div>
        </>
      )}
    </div>
  );
}

/** Dashboard entry card for providers. */
export function PassportCta() {
  const { t } = useI18n();
  const { flag } = useConfig();
  if (!flag("passport")) return null;
  return (
    <div className="gf-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="passport-cta">
      <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-brand-electric/15 text-brand-electric"><IdCard size={22} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{t("passport.cta.title")}</p>
        <p className="text-sm text-muted-foreground">{t("passport.cta.text")}</p>
      </div>
      <Link to="/account/passport" className={`${ui.btnGradient} shrink-0`} data-testid="passport-cta-open">{t("passport.cta.button")}</Link>
    </div>
  );
}

function Section({ title, children, testId }) {
  return (
    <section className="gf-card p-5" data-testid={testId}>
      <h2 className="font-extrabold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function History() {
  const { t } = useI18n();
  const { data = [] } = useQuery({ queryKey: ["passport-history"], queryFn: passportService.history });
  if (!data.length) return <p className="text-sm text-muted-foreground">{t("passport.historyEmpty")}</p>;
  return (
    <ul className="space-y-2" data-testid="passport-history">
      {data.map((h, i) => (
        <li key={i} className="flex items-start justify-between gap-3 text-sm border-b border-border pb-2 last:border-0">
          <span className="min-w-0">
            <span className="font-semibold">{t(`passport.actions.${h.action.split(".")[1]}`)}</span>
            {(h.meta?.label || h.meta?.type) && <span className="text-muted-foreground" dir="auto"> · {h.meta.label || t(`passport.creds.${h.meta.type}`)}</span>}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground text-end">{formatDate(h.at)}<br />{t(`passport.by.${h.by}`)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MyPassport() {
  const { t, te } = useI18n();
  const { flag } = useConfig();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["passport-me"], queryFn: passportService.me, retry: false, enabled: flag("passport") });
  const [skill, setSkill] = useState("");
  const [busy, setBusy] = useState(null);
  const run = async (key, action, ok) => {
    setBusy(key);
    try {
      qc.setQueryData(["passport-me"], await action());
      qc.invalidateQueries({ queryKey: ["passport-history"] });
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      toast.error(te(errorCode(err)));
      return false;
    } finally { setBusy(null); }
  };
  const addSkill = async (e) => {
    e.preventDefault();
    if (skill.trim().length >= 2 && await run("skill", () => passportService.addSkill(skill.trim()))) setSkill("");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.share.url);
      toast.success(t("passport.copied"));
    } catch { /* clipboard blocked: the link stays selectable on screen */ }
  };

  if (!flag("passport")) return <div className={`${ui.container} py-10`}><p className="gf-card p-6 text-sm">{t("errors.feature_disabled")}</p></div>;
  if (isLoading) return <div className={`${ui.container} py-10`}><Skeleton className="h-96 rounded-2xl" /></div>;
  if (error) return <div className={`${ui.container} py-10`}><p className="gf-card p-6 text-sm">{te(errorCode(error))}</p></div>;
  const published = data.status === "published";
  const isPublicProfile = ["verified", "unverified"].includes(data.profile_status);
  return (
    <div className={`${ui.container} max-w-3xl py-6 sm:py-10 space-y-4`} data-testid="passport-page">
      <PageHeader eyebrow={t("passport.eyebrow")} title={t("passport.title")} subtitle={t("passport.subtitle")} />

      <section className="gf-card p-5" data-testid="passport-status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${published ? "bg-brand-electric/15 text-brand-electric" : "bg-brand-orange/15 text-brand-orange"}`}>{t(`passport.status.${data.status}`)}</span>
          <span className="text-sm font-bold">{t("passport.completeness", { pct: data.completeness })}</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden" aria-hidden="true"><div className="h-full gf-gradient-bg" style={{ width: `${data.completeness}%` }} /></div>
        {!isPublicProfile && <p className="mt-3 text-sm text-brand-orange">{t("passport.notPublic")}</p>}
        <button type="button" disabled={busy === "publish" || (!published && !isPublicProfile)} onClick={() => run("publish", () => passportService.publish(!published))}
          className={`mt-4 ${published ? ui.btnOutline : ui.btnGradient}`} data-testid="passport-publish">
          {busy === "publish" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{t(published ? "passport.unpublish" : "passport.publish")}
        </button>
      </section>

      <Section title={t("passport.checksTitle")} testId="passport-checks">
        <ul className="space-y-2">
          {CREDS.map((c) => {
            const cr = data.credentials[c];
            return (
              <li key={c} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <span className="font-semibold">{t(`passport.creds.${c}`)}</span>
                <span className={`text-xs font-bold ${CRED_COLOR[cr.status]}`}>
                  {t(`passport.credStatus.${cr.status}`)}{cr.expires_at && cr.status === "validated" ? ` · ${t("passport.expiresOn", { date: formatDate(cr.expires_at) })}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
        <Link to="/dashboard" className={`${ui.btnOutline} mt-3`}>{t("passport.addDocs")}</Link>
      </Section>

      <Section title={t("passport.skillsTitle")} testId="passport-skills">
        <p className="text-xs text-muted-foreground">{t("passport.skillsHint")}</p>
        <form onSubmit={addSkill} className="mt-3 flex gap-2">
          <input value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={60} placeholder={t("passport.skillPlaceholder")} className={`${ui.input} min-h-[44px]`} data-testid="passport-skill-input" />
          <button type="submit" disabled={busy === "skill" || skill.trim().length < 2} className={`${ui.btnPrimary} shrink-0`} data-testid="passport-skill-add"><Plus size={16} aria-hidden="true" />{t("passport.addSkill")}</button>
        </form>
        <ul className="mt-3 space-y-2">
          {data.skills.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-xl border border-border ps-3 pe-1 py-1 text-sm">
              <span className="flex-1 min-w-0 break-words" dir="auto">{s.label}</span>
              <span className={`text-xs font-bold ${s.verified ? "text-brand-electric" : "text-muted-foreground"}`}>{t(s.verified ? "passport.verified" : "passport.declared")}</span>
              <button type="button" onClick={() => run(`rm-${s.id}`, () => passportService.removeSkill(s.id))} className={ui.btnGhost} aria-label={t("passport.removeSkill", { label: s.label })}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("passport.visibilityTitle")} testId="passport-visibility">
        <ul className="space-y-1">
          {VIS.map((v) => (
            <li key={v}>
              <label className="flex items-center justify-between gap-3 min-h-[44px] text-sm">
                <span>{t(`passport.vis.${v}`)}</span>
                <Switch checked={Boolean(data.visibility[v])} onCheckedChange={(on) => run(`vis-${v}`, () => passportService.update({ visibility: { [v]: on } }))} data-testid={`passport-vis-${v}`} />
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">{t("passport.phoneHidden")} · {t("passport.docsPrivate")}</p>
      </Section>

      <Section title={t("passport.shareTitle")} testId="passport-share">
        <p className="text-xs text-muted-foreground">{t("passport.shareHint")}</p>
        {!published && <p className="mt-2 text-sm text-brand-orange">{t("passport.publishFirst")}</p>}
        {data.share ? (
          <div className="mt-3 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            <img src={data.share.qr} alt={t("passport.shareTitle")} className="h-48 w-48 rounded-xl bg-white p-1" data-testid="passport-qr" />
            <div className="min-w-0 w-full space-y-2">
              <p className="text-xs break-all rounded-xl bg-secondary px-3 py-2" dir="ltr" data-testid="passport-url">{data.share.url}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copy} className={ui.btnOutline}><Copy size={16} aria-hidden="true" />{t("passport.copy")}</button>
                {navigator.share && <button type="button" onClick={() => navigator.share({ url: data.share.url, title: t("passport.title") }).catch(() => {})} className={ui.btnOutline}><Share2 size={16} aria-hidden="true" />{t("passport.share")}</button>}
                <a href={data.share.qr} download="gofix-passport-qr.png" className={ui.btnOutline}><Download size={16} aria-hidden="true" />{t("passport.download")}</a>
                <Link to={`/p/${data.share.url.split("/p/")[1]}`} className={ui.btnGhost}><Globe size={16} aria-hidden="true" />{t("passport.preview")}</Link>
              </div>
              <button type="button" onClick={() => window.confirm(t("passport.revokeConfirm")) && run("revoke", passportService.revoke)} className={`${ui.btnGhost} text-destructive`} data-testid="passport-revoke">
                <X size={16} aria-hidden="true" />{t("passport.revoke")}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => run("share", passportService.share)} disabled={busy === "share"} className={`${ui.btnGradient} mt-3`} data-testid="passport-create-link">
            <QrCode size={16} aria-hidden="true" />{t("passport.createLink")}
          </button>
        )}
      </Section>

      <section data-testid="passport-preview">
        <h2 className="mb-2 font-extrabold">{t("passport.preview")}</h2>
        <PassportCard data={data.preview} />
      </section>

      <Section title={t("passport.historyTitle")}><History /></Section>
    </div>
  );
}
