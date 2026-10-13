import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Inbox, Lock, MessageCircle, Rocket, ShieldCheck, X } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { catalogService, providerService, requestService } from "@/api/services";
import { TrustBadge, TrustSubscores, Upcoming } from "@/components/catalog";
import { AvailabilityEditor, DocRow, MediaEditor, pickDocument, pickImage, ZonesEditor } from "@/components/editors";
import { JobsList } from "@/components/JobsList";
import { useI18n, useLocalized } from "@/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import { alpha, BRAND, useTheme } from "@/theme";
import { Btn, Card, Chip, Empty, Field, Input, Loading, Pill, Row, Screen, Section, TopBar, Txt, useToast } from "@/ui";

const STATUS_COLOR = { sent: BRAND.violet, seen: BRAND.blue, accepted: BRAND.electric, refused: "#F87171" };
const DOC_TYPES = { professional: ["id_card", "trade_register"], teacher: ["id_card", "diploma"] };

function AccessBanner({ access }) {
  const { c } = useTheme();
  const { t } = useI18n();
  if (access.subscribed) return (
    <Card style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
      <ShieldCheck size={22} color={BRAND.electric} /><Txt variant="small" style={{ flex: 1 }}>{t("dashboard.subscribed", { tier: access.tier.toUpperCase(), date: formatDate(access.subscription_ends_at) })}</Txt>
    </Card>
  );
  if (access.blocked) return (
    <Card glow style={{ gap: 10 }} testID="blocked">
      <Row gap={10} style={{ alignItems: "flex-start" }}><Lock size={24} color={BRAND.pink} /><View style={{ flex: 1 }}><Txt weight={800}>{t("dashboard.blockedTitle")}</Txt>
        <Txt variant="small" muted>{t("dashboard.blockedText", { days: access.free_days, n: access.free_max_requests })}</Txt></View></Row>
      <Btn variant="gradient" icon={Rocket} title={t("dashboard.subscribe")} onPress={() => router.push("/pricing?audience=professional")} />
    </Card>
  );
  const pct = Math.min(100, Math.round((access.requests_used / access.free_max_requests) * 100));
  return (
    <Card style={{ gap: 8 }}>
      <Row style={{ justifyContent: "space-between" }}><Row gap={6}><Clock size={18} color={BRAND.orange} /><Txt weight={700}>{t("dashboard.freeTitle")}</Txt></Row>
        <Txt variant="tiny" weight={700} color={BRAND.electric} onPress={() => router.push("/pricing?audience=professional")}>{t("dashboard.upgrade")}</Txt></Row>
      <Txt variant="small" muted>{t("dashboard.freeLeft", { days: access.days_left, n: access.requests_left })}</Txt>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.cardAlt, overflow: "hidden" }}><View style={{ width: `${pct}%`, height: "100%", backgroundColor: BRAND.pink }} /></View>
    </Card>
  );
}

function Inboxes() {
  const { c } = useTheme();
  const { t, te } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const qc = useQueryClient();
  const [reply, setReply] = useState({});
  const [busy, setBusy] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["inbox"], queryFn: requestService.inbox, refetchInterval: 30_000 });
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => catalogService.categories(), staleTime: 300_000 });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: catalogService.subjects, staleTime: 300_000 });
  const label = (r) => (r.kind === "teacher" ? loc(subjects.data?.find((s) => s.key === r.subject_key)) : loc(cats.data?.find((x) => x.key === r.category_key))) || "—";
  const respond = async (id, action) => {
    setBusy(`${id}-${action}`);
    try {
      await requestService.respond(id, action, reply[id] || "");
      toast(action === "accept" ? t("dashboard.accepted") : t("dashboard.refused"));
      qc.invalidateQueries({ queryKey: ["inbox"] }); qc.invalidateQueries({ queryKey: ["provider-me"] }); qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(null); }
  };
  if (isLoading) return <Loading />;
  if (!data?.items?.length) return <Empty icon={Inbox} text={t("dashboard.inboxEmpty")} />;
  return data.items.map((r) => (
    <Card key={r.id} style={{ gap: 8, marginBottom: 12 }} testID={`inbox-${r.id}`}>
      <Row style={{ justifyContent: "space-between" }} gap={8}><Txt weight={800} style={{ flex: 1 }}>{label(r)}</Txt><Pill label={t(`requests.status.${r.status}`)} color={STATUS_COLOR[r.status]} /></Row>
      <Txt variant="tiny" muted>{formatDateTime(r.created_at)}{r.client_name ? ` · ${r.client_name}` : ""}{r.format ? ` · ${t(`onboarding.formats.${r.format}`)}` : ""}</Txt>
      {r.locked ? (
        <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: alpha(BRAND.pink, 0.6), borderRadius: 12, padding: 10, gap: 8 }}>
          <Row gap={8}><Lock size={18} color={BRAND.pink} /><Txt variant="small" style={{ flex: 1 }}>{t("dashboard.lockedText")}</Txt></Row>
          <Btn small variant="gradient" title={t("dashboard.subscribe")} onPress={() => router.push("/pricing?audience=professional")} />
        </View>
      ) : (
        <>
          <Txt variant="small" auto>{r.message}</Txt>
          {["sent", "seen"].includes(r.status) && r.request_status !== "closed" && (
            <>
              <Input value={reply[r.id] || ""} onChangeText={(v) => setReply({ ...reply, [r.id]: v })} maxLength={1000} placeholder={t("dashboard.replyPh")} />
              <Row gap={8}>
                <Btn small variant="outline" icon={X} title={t("dashboard.refuse")} disabled={Boolean(busy)} onPress={() => respond(r.id, "refuse")} style={{ flex: 1 }} />
                <Btn small variant="gradient" icon={Check} title={t("dashboard.accept")} loading={busy === `${r.id}-accept`} disabled={Boolean(busy)} onPress={() => respond(r.id, "accept")} style={{ flex: 1 }} testID={`accept-${r.id}`} />
              </Row>
            </>
          )}
          {r.conversation_id && <Btn small variant="outline" icon={MessageCircle} title={t("requests.openConversation")} onPress={() => router.push(`/messages/${r.conversation_id}`)} />}
        </>
      )}
    </Card>
  ));
}

function ProfileEditor({ kind, profile }) {
  const { t, te } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["provider-me"] });
  const priceKey = kind === "teacher" ? "price_hint_da_hour" : "price_hint_da";
  const [d, setD] = useState({});
  const [busy, setBusy] = useState(null);
  useEffect(() => setD({ bio: profile.bio, experience_years: String(profile.experience_years ?? ""), price: profile[priceKey] != null ? String(profile[priceKey]) : "",
    zones: profile.zones || [], slots: profile.availability?.slots || [] }), [profile, priceKey]);
  const media = async (m) => {
    const asset = await pickImage(m === "photo" ? [1, 1] : [3, 1]);
    if (!asset) return;
    setBusy(m);
    try { await providerService.uploadMedia(m, asset); toast(t(`dashboard.${m}Saved`)); refresh(); } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(null); }
  };
  const doc = async (type) => {
    const asset = await pickDocument();
    if (!asset) return;
    setBusy(type);
    try { await providerService.uploadDocument(type, asset); toast(t("dashboard.docSent")); refresh(); } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(null); }
  };
  const save = async () => {
    setBusy("save");
    try {
      await providerService.patch({ bio: d.bio, experience_years: Number(d.experience_years) || 0, [priceKey]: d.price === "" ? null : Number(d.price), zones: d.zones, slots: d.slots });
      toast(t("account.saved")); refresh();
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(null); }
  };
  return (
    <View style={{ gap: 16 }}>
      <Card><Txt weight={800} style={{ marginBottom: 4 }}>{profile.display_name}</Txt><Txt variant="tiny" muted style={{ marginBottom: 10 }}>{t("dashboard.mediaHint")}</Txt>
        <MediaEditor value={profile} name={profile.display_name} busy={busy} onPhoto={() => media("photo")} onCover={() => media("cover")}
          onRemove={async (m) => { await providerService.deleteMedia(m); refresh(); }} /></Card>
      <Card>
        <Field label={t("onboarding.bio")} hint={t("onboarding.bioHint")}><Input multiline value={d.bio} onChangeText={(v) => setD({ ...d, bio: v })} maxLength={1500} /></Field>
        <Field label={t("onboarding.experience")}><Input value={d.experience_years} onChangeText={(v) => setD({ ...d, experience_years: v.replace(/\D/g, "") })} keyboardType="number-pad" ltr /></Field>
        <Field label={t(`onboarding.${kind}.price`)} hint={t("onboarding.priceHint")}><Input value={d.price} onChangeText={(v) => setD({ ...d, price: v.replace(/\D/g, "") })} keyboardType="number-pad" ltr /></Field>
      </Card>
      <Card><Txt variant="h3" style={{ marginBottom: 10 }}>{t("onboarding.s4Title")}</Txt><ZonesEditor zones={d.zones || []} onChange={(z) => setD({ ...d, zones: z })} /></Card>
      <Card><Txt variant="h3" style={{ marginBottom: 10 }}>{t("onboarding.availability")}</Txt><AvailabilityEditor slots={d.slots || []} onChange={(s) => setD({ ...d, slots: s })} /></Card>
      <Btn variant="gradient" title={t("common.save")} loading={busy === "save"} onPress={save} testID="profile-save" />
      <Card style={{ gap: 8 }}>
        <Txt variant="h3">{t("onboarding.documents")}</Txt>
        <Txt variant="tiny" muted>{t("dashboard.docsHint")}</Txt>
        {DOC_TYPES[kind].map((type) => {
          const docs = (profile.documents || []).filter((x) => x.type === type);
          return <DocRow key={type} label={t(`onboarding.docs.${type}`)} status={docs[docs.length - 1]?.status} busy={busy === type} onUpload={() => doc(type)} />;
        })}
      </Card>
    </View>
  );
}

function TrustTab({ trust }) {
  const { c } = useTheme();
  const { t, te } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const contest = async () => {
    try { await providerService.contest(msg); toast(t("trust.contestSent")); setMsg(""); qc.invalidateQueries({ queryKey: ["provider-me"] }); } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ alignItems: "center", gap: 6 }}>
        <Txt variant="small" muted>{t("trust.title")}</Txt>
        <Txt style={{ fontSize: 48, fontWeight: "800", color: BRAND.electric }}>{trust.score ?? "—"}<Txt muted>/100</Txt></Txt>
        <TrustBadge status={trust.status} />
        <Txt variant="tiny" muted center>{trust.public ? t("trust.publicYes") : t("trust.publicNo")}</Txt>
        <Txt variant="tiny" muted center>{t("trust.disclaimer")}</Txt>
      </Card>
      <Card><Txt variant="h3" style={{ marginBottom: 10 }}>{t("trust.subsTitle")}</Txt><TrustSubscores subscores={trust.subscores} /></Card>
      <Card style={{ padding: 0 }}>
        <Txt variant="h3" style={{ padding: 14, paddingBottom: 6 }}>{t("trust.breakdown")}</Txt>
        {trust.breakdown.map((b, i) => (
          <Row key={`${b.type}-${i}`} gap={8} style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderColor: c.border }}>
            <View style={{ flex: 1 }}><Txt variant="small">{t(`trust.signals.${b.type}`, b)}</Txt><Txt variant="tiny" muted>{t(`trust.subs.${b.sub}`)} · {t(`trust.source.${b.source_type}`)}</Txt></View>
            {b.points ? <Txt variant="small" weight={800} color={b.points < 0 ? "#F87171" : BRAND.electric}>{b.points > 0 ? "+" : ""}{b.points}</Txt> : null}
            {b.value != null ? <Txt variant="small" weight={800}>{b.value} %</Txt> : null}
          </Row>
        ))}
      </Card>
      <Card style={{ gap: 6 }}>
        <Txt variant="h3">{t("trust.history")}</Txt>
        {!trust.events.length ? <Txt muted>—</Txt> : trust.events.map((e) => (
          <Row key={e.id} style={{ justifyContent: "space-between" }} gap={8}><Txt variant="small" muted style={{ flex: 1 }}>{formatDate(e.created_at)} · {t(`trust.events.${e.type}`)}</Txt>
            <Txt variant="small" weight={700}>{e.weight > 0 ? "+" : ""}{e.weight} → {e.score_after}</Txt></Row>
        ))}
      </Card>
      <Card style={{ gap: 8 }}>
        <Txt variant="h3">{t("trust.contest")}</Txt>
        <Txt variant="tiny" muted>{t("trust.contestHint")}</Txt>
        {trust.contests.map((x) => <Txt key={x.id} variant="tiny">{formatDate(x.created_at)} · {t(`trust.contestStatus.${x.status}`)}{x.note ? ` — ${x.note}` : ""}</Txt>)}
        <Input multiline value={msg} onChangeText={setMsg} maxLength={1500} placeholder={t("trust.contestPh")} />
        <Btn variant="outline" title={t("trust.contestSend")} disabled={msg.trim().length < 10} onPress={contest} />
      </Card>
    </View>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const [tab, setTab] = useState("requests");
  const { data, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["provider-me"], queryFn: providerService.me });
  if (error?.response?.status === 404) return <Redirect href="/onboarding" />;
  if (isLoading || !data) return <Screen><TopBar title={t("dashboard.title")} /><Loading /></Screen>;
  const { kind, profile, access, requests, trust } = data;
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <TopBar title={t("dashboard.title")} />
      <Txt variant="small" muted style={{ marginVertical: 10 }}>{t(`onboarding.${kind}.title`)} · {t(`onboarding.status.${profile.verification_status}`)}</Txt>
      <AccessBanner access={access} />
      <Row gap={8} style={{ marginTop: 12 }}>
        {[["pending", requests.pending], ["accepted", requests.accepted], ["trust", trust.score ?? "—"]].map(([k, v]) => (
          <Card key={k} style={{ flex: 1, alignItems: "center", padding: 10 }}><Txt variant="h2">{v}</Txt><Txt variant="tiny" muted center>{t(`dashboard.stats.${k}`)}</Txt></Card>
        ))}
      </Row>
      <Row gap={8} wrap style={{ marginTop: 16, marginBottom: 14 }}>
        {["requests", "jobs", "profile", "trust"].map((k) => <Chip key={k} label={t(`dashboard.tabs.${k}`)} selected={tab === k} onPress={() => setTab(k)} testID={`dash-${k}`} />)}
      </Row>
      {tab === "requests" && <Inboxes />}
      {tab === "jobs" && <JobsList role="provider" />}
      {tab === "profile" && <ProfileEditor kind={kind} profile={profile} />}
      {tab === "trust" && <TrustTab trust={trust} />}
      <Section title={t("upcoming.title")}><Upcoming keys={["pro_ai", "passport"]} /></Section>
      {["verified", "unverified"].includes(profile.verification_status) && (
        <Btn variant="ghost" title={t("account.viewProfile")} onPress={() => router.push(`/${kind === "teacher" ? "teacher" : "pro"}/${profile.id}`)} style={{ marginTop: 12 }} />
      )}
    </Screen>
  );
}
