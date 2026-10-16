import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Clock, FileUp, ImagePlus, Inbox, Loader2, Lock, MessageCircle, Rocket, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Cover } from "@/components/catalog/Cards";
import { PageHeader, PageSkeleton } from "@/components/common/PageSkeleton";
import { StepPricing, StepZones } from "@/components/onboarding/Steps4to6";
import { Textarea } from "@/components/onboarding/Parts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n, useLocalized } from "@/i18n";
import { errorCode, formatDate, formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { marketplaceService, providerService, requestService } from "@/services/marketplaceService";
import { StatusPill } from "./Requests";
import { JobsList } from "./Jobs";
import { TrustBadge, TrustSubscores } from "@/components/trust/Trust";
import { UpcomingTeaser } from "@/components/home/Upcoming";

function AccessBanner({ access }) {
  const { t } = useI18n();
  if (access.subscribed) {
    return (
      <div className="gf-card p-4 flex items-center gap-3" data-testid="dashboard-subscribed">
        <ShieldCheck size={24} className="text-brand-electric shrink-0" />
        <p className="text-sm flex-1">{t("dashboard.subscribed", { tier: access.tier.toUpperCase(), date: formatDate(access.subscription_ends_at) })}</p>
        <Link to="/account/billing" className={`${ui.btnOutline} min-h-[40px] text-sm`}>{t("billing.title")}</Link>
      </div>
    );
  }
  if (access.blocked) {
    return (
      <div className="gf-gradient-border rounded-2xl p-5" data-testid="dashboard-blocked">
        <div className="flex items-start gap-3">
          <Lock size={26} className="text-brand-pink shrink-0" />
          <div className="flex-1">
            <p className="font-extrabold text-lg">{t("dashboard.blockedTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("dashboard.blockedText", { days: access.free_days, n: access.free_max_requests })}</p>
          </div>
        </div>
        <Link to="/pricing?audience=professional" className={`${ui.btnGradient} w-full mt-4`} data-testid="dashboard-subscribe"><Rocket size={18} />{t("dashboard.subscribe")}</Link>
      </div>
    );
  }
  const pct = Math.round((access.requests_used / access.free_max_requests) * 100);
  return (
    <div className="gf-card p-4" data-testid="dashboard-free-access">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-bold flex items-center gap-2"><Clock size={18} className="text-brand-orange" />{t("dashboard.freeTitle")}</p>
        <Link to="/pricing?audience=professional" className="inline-flex items-center min-h-[44px] px-2 -me-2 text-xs font-bold underline">{t("dashboard.upgrade")}</Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.freeLeft", { days: access.days_left, n: access.requests_left })}</p>
      <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full gf-gradient-bg" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function InboxTab() {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const qc = useQueryClient();
  const [reply, setReply] = useState({});
  const [busy, setBusy] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["inbox"], queryFn: requestService.inbox, refetchInterval: 30_000 });
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => marketplaceService.categories(), staleTime: 300_000 });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: marketplaceService.subjects, staleTime: 300_000 });
  const label = (r) => (r.kind === "teacher" ? loc(subjects.data?.find((s) => s.key === r.subject_key)) : loc(cats.data?.find((c) => c.key === r.category_key)));

  const respond = async (id, action) => {
    setBusy(`${id}-${action}`);
    try {
      const res = await requestService.respond(id, action, reply[id] || "");
      toast.success(action === "accept" ? t("dashboard.accepted") : t("dashboard.refused"));
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["provider-me"] });
      if (res.conversation_id) qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <PageSkeleton />;
  if (!data?.items.length) return <div className="py-12 text-center text-muted-foreground" data-testid="inbox-empty"><Inbox size={36} strokeWidth={1.4} className="mx-auto mb-3" />{t("dashboard.inboxEmpty")}</div>;
  return (
    <ul className="grid gap-3" data-testid="inbox">
      {data.items.map((r) => (
        <li key={r.id} className="gf-card p-4" data-testid={`inbox-${r.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-extrabold">{label(r) || "—"}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}{r.client_name ? ` · ${r.client_name}` : ""}{r.format ? ` · ${t(`onboarding.formats.${r.format}`)}` : ""}</p>
            </div>
            <StatusPill status={r.status} />
          </div>
          {r.locked ? (
            <div className="mt-3 rounded-xl border border-dashed border-brand-pink/60 p-3 text-sm flex items-center gap-3" data-testid="inbox-locked">
              <Lock size={18} className="text-brand-pink shrink-0" />
              <span className="flex-1">{t("dashboard.lockedText")}</span>
              <Link to="/pricing?audience=professional" className={`${ui.btnGradient} min-h-[40px] px-4 text-sm`}>{t("dashboard.subscribe")}</Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm whitespace-pre-line">{r.message}</p>
              {["sent", "seen"].includes(r.status) && r.request_status !== "closed" && (
                <div className="mt-3 space-y-2">
                  <input value={reply[r.id] || ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} maxLength={1000} placeholder={t("dashboard.replyPh")} className={`${ui.input} min-h-[44px]`} data-testid={`inbox-reply-${r.id}`} />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={Boolean(busy)} onClick={() => respond(r.id, "refuse")} className={ui.btnOutline} data-testid={`inbox-refuse-${r.id}`}><X size={16} />{t("dashboard.refuse")}</button>
                    <button type="button" disabled={Boolean(busy)} onClick={() => respond(r.id, "accept")} className={ui.btnGradient} data-testid={`inbox-accept-${r.id}`}>{busy === `${r.id}-accept` ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{t("dashboard.accept")}</button>
                  </div>
                </div>
              )}
              {r.conversation_id && <Link to={`/messages/${r.conversation_id}`} className={`${ui.btnOutline} mt-3 w-full`} data-testid="inbox-open-conversation"><MessageCircle size={16} />{t("requests.openConversation")}</Link>}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function MediaPicker({ media, profile, onDone }) {
  const { t, te } = useI18n();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const has = Boolean(profile[`${media}_key`]);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await providerService.uploadMedia(media, file);
      toast.success(t(`dashboard.${media}Saved`));
      onDone();
    } catch (err) { toast.error(te(errorCode(err))); } finally { setBusy(false); }
  };
  const remove = async () => {
    await providerService.deleteMedia(media);
    onDone();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} data-testid={`dashboard-${media}-input`} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${ui.btnOutline} min-h-[40px] text-sm`} data-testid={`dashboard-${media}-button`}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : media === "photo" ? <Camera size={16} /> : <ImagePlus size={16} />}
        {has ? t(`dashboard.${media}Change`) : t(`dashboard.${media}Add`)}
      </button>
      {has && <button type="button" onClick={remove} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive min-h-[40px] px-2" data-testid={`dashboard-${media}-remove`}><Trash2 size={14} />{t("onboarding.removePhoto")}</button>}
    </div>
  );
}

const DOC_TYPES = { professional: ["id_card", "trade_register"], teacher: ["id_card", "diploma"] };

function Documents({ kind, profile, onDone }) {
  const { t, te } = useI18n();
  const [busy, setBusy] = useState(null);
  const upload = async (type, file) => {
    if (!file) return;
    setBusy(type);
    try {
      await providerService.uploadDocument(type, file);
      toast.success(t("dashboard.docSent"));
      onDone();
    } catch (err) { toast.error(te(errorCode(err))); } finally { setBusy(null); }
  };
  return (
    <section className="gf-card p-5" data-testid="dashboard-documents">
      <h3 className="font-extrabold">{t("onboarding.documents")}</h3>
      <p className="text-xs text-muted-foreground mb-3">{t("dashboard.docsHint")}</p>
      <ul className="space-y-2">
        {DOC_TYPES[kind].map((type) => {
          const docs = (profile.documents || []).filter((d) => d.type === type);
          const last = docs[docs.length - 1];
          return (
            <li key={type} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <span className="flex-1 min-w-[140px] text-sm font-semibold">{t(`onboarding.docs.${type}`)}</span>
              {last && <span className="text-xs font-bold" data-testid={`doc-status-${type}`}>{t(`dashboard.docStatus.${last.status}`)}</span>}
              <label className={`${ui.btnOutline} min-h-[40px] text-sm cursor-pointer`}>
                {busy === type ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}{t("dashboard.docUpload")}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { upload(type, e.target.files?.[0]); e.target.value = ""; }} data-testid={`doc-input-${type}`} />
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProfileTab({ kind, profile }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["provider-me"] });
  const priceKey = kind === "teacher" ? "price_hint_da_hour" : "price_hint_da";
  const [d, setD] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setD({ bio: profile.bio, experience_years: profile.experience_years, [priceKey]: profile[priceKey], zones: profile.zones || [], slots: profile.availability?.slots || [], formats: profile.formats });
  }, [profile, priceKey]);
  const update = (patch) => setD((x) => ({ ...x, ...patch }));
  const save = async () => {
    setSaving(true);
    try {
      await providerService.patch({ bio: d.bio, experience_years: Number(d.experience_years) || 0, [priceKey]: d[priceKey] ?? null, zones: d.zones, slots: d.slots });
      toast.success(t("account.saved"));
      refresh();
    } catch (err) { toast.error(te(errorCode(err))); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-5">
      <section className="gf-card overflow-hidden" data-testid="dashboard-media">
        <Cover coverKey={profile.cover_key} thumbKey={profile.cover_thumb_key} color="var(--brand-pink)" className="h-32 sm:h-40" large />
        <div className="px-5 pb-5 -mt-10 relative">
          <Avatar photoKey={profile.photo_key} thumbKey={profile.photo_thumb_key} name={profile.display_name} size="h-20 w-20 text-xl" color="var(--brand-electric)" ring large />
          <p className="mt-2 font-extrabold">{profile.display_name}</p>
          <p className="text-xs text-muted-foreground mb-3">{t("dashboard.mediaHint")}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><p className={ui.label}>{t("dashboard.photo")}</p><MediaPicker media="photo" profile={profile} onDone={refresh} /></div>
            <div><p className={ui.label}>{t("dashboard.cover")}</p><MediaPicker media="cover" profile={profile} onDone={refresh} /></div>
          </div>
        </div>
      </section>
      <section className="gf-card p-5 space-y-4">
        <div>
          <label htmlFor="db-bio" className={ui.label}>{t("onboarding.bio")}</label>
          <Textarea id="db-bio" value={d.bio} onChange={(v) => update({ bio: v })} testId="dashboard-bio" />
        </div>
        <div>
          <label htmlFor="db-exp" className={ui.label}>{t("onboarding.experience")}</label>
          <input id="db-exp" type="number" min={0} max={60} value={d.experience_years ?? ""} onChange={(e) => update({ experience_years: e.target.value })} className={ui.input} />
        </div>
      </section>
      <section className="gf-card p-5"><StepZones d={d} update={update} kind={kind} /></section>
      <section className="gf-card p-5"><StepPricing d={d} update={update} kind={kind} /></section>
      <button type="button" onClick={save} disabled={saving} className={`${ui.btnGradient} w-full`} data-testid="dashboard-save">{saving && <Loader2 size={18} className="animate-spin" />}{t("common.save")}</button>
      <Documents kind={kind} profile={profile} onDone={refresh} />
    </div>
  );
}

function TrustTab({ trust }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const contest = async (e) => {
    e.preventDefault();
    try {
      await providerService.contest({ message: msg });
      toast.success(t("trust.contestSent"));
      setMsg("");
      qc.invalidateQueries({ queryKey: ["provider-me"] });
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <div className="space-y-5" data-testid="dashboard-trust">
      <section className="gf-card p-5 text-center">
        <p className="text-sm text-muted-foreground">{t("trust.title")}</p>
        <p className="mt-1 text-5xl font-extrabold gf-gradient-text" data-testid="trust-score">{trust.score ?? "—"}<span className="text-xl text-muted-foreground">/100</span></p>
        <div className="mt-2 flex justify-center"><TrustBadge status={trust.status} /></div>
        <p className="mt-2 text-xs text-muted-foreground" data-testid="trust-visibility">{trust.public ? t("trust.publicYes") : t("trust.publicNo")}</p>
        <p className="mt-3 text-xs text-muted-foreground max-w-md mx-auto">{t("trust.disclaimer")}</p>
      </section>
      <section className="gf-card p-5">
        <h3 className="font-extrabold mb-3">{t("trust.subsTitle")}</h3>
        <TrustSubscores subscores={trust.subscores} />
      </section>
      <section className="gf-card p-5">
        <h3 className="font-extrabold mb-3">{t("trust.breakdown")}</h3>
        <ul className="divide-y divide-border text-sm" data-testid="trust-breakdown">
          {trust.breakdown.map((b, i) => (
            <li key={`${b.type}-${i}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block">{t(`trust.signals.${b.type}`, b)}</span>
                <span className="block text-[11px] text-muted-foreground">{t(`trust.subs.${b.sub}`)} · {t(`trust.source.${b.source_type}`)}</span>
              </span>
              {b.points != null && b.points !== 0 && <span className={`font-extrabold whitespace-nowrap ${b.points < 0 ? "text-destructive" : "text-brand-electric"}`}>{b.points > 0 ? "+" : ""}{b.points}</span>}
              {b.value != null && <span className="font-extrabold whitespace-nowrap">{b.value} %</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="gf-card p-5">
        <h3 className="font-extrabold mb-3">{t("trust.history")}</h3>
        {!trust.events.length ? <p className="text-sm text-muted-foreground">—</p> : (
          <ul className="text-sm space-y-1.5">
            {trust.events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3"><span className="text-muted-foreground">{formatDate(e.created_at)} · {t(`trust.events.${e.type}`)}</span><span className="font-bold">{e.weight > 0 ? "+" : ""}{e.weight} → {e.score_after}</span></li>
            ))}
          </ul>
        )}
      </section>
      <section className="gf-card p-5">
        <h3 className="font-extrabold">{t("trust.contest")}</h3>
        <p className="text-xs text-muted-foreground mb-3">{t("trust.contestHint")}</p>
        {trust.contests.map((c) => (
          <p key={c.id} className="text-xs mb-2 rounded-lg bg-secondary p-2">{formatDate(c.created_at)} · <b>{t(`trust.contestStatus.${c.status}`)}</b>{c.note ? ` — ${c.note}` : ""}</p>
        ))}
        <form onSubmit={contest} className="space-y-2">
          <textarea rows={3} minLength={10} maxLength={1500} required value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("trust.contestPh")} className={`${ui.input} py-3`} data-testid="trust-contest-input" />
          <button type="submit" className={ui.btnOutline} data-testid="trust-contest-submit">{t("trust.contestSend")}</button>
        </form>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({ queryKey: ["provider-me"], queryFn: providerService.me });
  if (isLoading) return <PageSkeleton />;
  if (error?.response?.status === 404) return <Navigate to="/pro/join" replace />;
  if (!data) return null;
  const { kind, profile, access, requests, trust } = data;
  return (
    <div className={`${ui.container} max-w-3xl py-6 sm:py-10`} data-testid="dashboard-page">
      <PageHeader eyebrow={t(`onboarding.${kind}.title`)} title={t("dashboard.title")} subtitle={t(`onboarding.status.${profile.verification_status}`)} />
      <AccessBanner access={access} />
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[["pending", requests.pending], ["accepted", requests.accepted], ["trust", trust.score ?? "—"]].map(([k, v]) => (
          <div key={k} className="gf-card p-3" data-testid={`dashboard-stat-${k}`}><p className="text-2xl font-extrabold">{v}</p><p className="text-[11px] text-muted-foreground">{t(`dashboard.stats.${k}`)}</p></div>
        ))}
      </div>
      <Tabs defaultValue="requests" className="mt-6">
        <TabsList className="w-full grid grid-cols-4 h-auto rounded-2xl bg-secondary p-1">
          {["requests", "jobs", "profile", "trust"].map((k) => <TabsTrigger key={k} value={k} className="min-h-[44px] rounded-xl font-semibold" data-testid={`dashboard-tab-${k}`}>{t(`dashboard.tabs.${k}`)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="requests" className="mt-5"><InboxTab /></TabsContent>
        <TabsContent value="jobs" className="mt-5"><JobsList role="provider" /></TabsContent>
        <TabsContent value="profile" className="mt-5"><ProfileTab kind={kind} profile={profile} /></TabsContent>
        <TabsContent value="trust" className="mt-5"><TrustTab trust={trust} /></TabsContent>
      </Tabs>
      <div className="mt-6"><UpcomingTeaser keys={["pro_ai", "passport"]} /></div>
      {["verified", "unverified"].includes(profile.verification_status) && (
        <div className="mt-6 text-center">
          <Link to={`/${kind === "teacher" ? "teacher" : "pro"}/${profile.id}`} className="inline-flex items-center min-h-[44px] px-3 text-sm underline" data-testid="dashboard-view-public">{t("account.viewProfile")}</Link>
        </div>
      )}
    </div>
  );
}
