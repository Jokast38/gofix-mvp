import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, LocateFixed, Sparkles } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { catalogService, matchService, publicService, requestService } from "@/api/services";
import { ProfileCard } from "@/components/catalog";
import { CheckRow } from "@/ui/CheckRow";
import { useAuth, useConfig, useWilayas } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { getPosition } from "@/lib/location";
import { BRAND } from "@/theme";
import { Btn, Card, Chip, Input, Loading, Row, Screen, SelectField, TopBar, Txt, useToast } from "@/ui";

// Guided AI MATCH flow: trade -> need -> place -> results -> recap -> sent. The draft lives for the app session
// (it survives going to the login screen and back); the device position is only sent with the search.
const STEPS = ["service", "need", "place", "results"];
const RADII = [5, 10, 20, 50];
const EMPTY = { category_key: "", description: "", when: "week", wilaya_code: "", commune: "", radius_km: 10, gps: null, selected: [], names: {} };
let saved = { ...EMPTY, step: "service" };

function Progress({ step }) {
  const { t } = useI18n();
  const i = Math.min(STEPS.indexOf(step), STEPS.length - 1);
  return (
    <View style={{ marginBottom: 14, gap: 6 }}>
      <Row gap={6}>{STEPS.map((s, n) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: n <= i ? BRAND.pink : "rgba(127,127,127,0.25)" }} />)}</Row>
      <Txt variant="tiny" muted weight={700}>{t("aimatch.stepOf", { i: i + 1, n: STEPS.length })} · {t(`aimatch.steps.${STEPS[i]}`)}</Txt>
    </View>
  );
}

function Nav({ onBack, onNext, nextLabel, disabled, testID }) {
  const { t } = useI18n();
  return (
    <Row style={{ justifyContent: "space-between", marginTop: 18 }}>
      {onBack ? <Btn small variant="outline" title={t("aimatch.back")} onPress={onBack} /> : <View />}
      <Btn small variant="gradient" title={nextLabel || t("aimatch.next")} onPress={onNext} disabled={disabled} testID={testID} />
    </Row>
  );
}

function ServiceStep({ d, set, go }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const [q, setQ] = useState("");
  const { data: cats = [], isLoading } = useQuery({ queryKey: ["cats-all"], queryFn: () => catalogService.categories(), staleTime: 300_000 });
  const list = cats.filter((c) => c.key !== "private_tutoring" && (!q.trim() || loc(c).toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <View>
      <Txt variant="h3">{t("aimatch.serviceTitle")}</Txt>
      <Input value={q} onChangeText={setQ} placeholder={t("aimatch.serviceSearch")} style={{ marginTop: 10 }} testID="match-service-search" />
      {isLoading ? <Loading /> : (
        <Row gap={8} wrap style={{ marginTop: 12 }}>
          {list.map((c) => <Chip key={c.key} label={loc(c)} selected={d.category_key === c.key} color={BRAND.pink} onPress={() => set({ category_key: c.key, selected: [] })} testID={`match-cat-${c.key}`} />)}
        </Row>
      )}
      {!isLoading && !list.length && <Txt variant="small" muted style={{ marginTop: 10 }}>{t("aimatch.noService")}</Txt>}
      <Nav onNext={() => go("need")} disabled={!d.category_key} testID="match-next-service" />
    </View>
  );
}

function NeedStep({ d, set, go }) {
  const { t } = useI18n();
  return (
    <View>
      <Txt variant="h3">{t("aimatch.needTitle")}</Txt>
      <Input multiline value={d.description} onChangeText={(v) => set({ description: v })} maxLength={500} placeholder={t("aimatch.needPlaceholder")}
        style={{ marginTop: 10, minHeight: 120 }} testID="match-description" />
      <Txt variant="tiny" muted style={{ marginTop: 4 }}>{t("aimatch.needHint")}</Txt>
      <Txt weight={700} style={{ marginTop: 16 }}>{t("aimatch.whenTitle")}</Txt>
      <Row gap={8} wrap style={{ marginTop: 8 }}>
        {["today", "week", "flexible"].map((w) => <Chip key={w} label={t(`aimatch.when.${w}`)} selected={d.when === w} color={BRAND.pink} onPress={() => set({ when: w })} testID={`match-when-${w}`} />)}
      </Row>
      <Nav onBack={() => go("service")} onNext={() => go("place")} disabled={d.description.trim().length < 10} testID="match-next-need" />
    </View>
  );
}

function PlaceStep({ d, set, go }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const { data: wilayas = [] } = useWilayas();
  const communes = useQuery({ queryKey: ["communes", d.wilaya_code], queryFn: () => publicService.communes(d.wilaya_code), enabled: Boolean(d.wilaya_code), staleTime: 300_000 });
  const [locating, setLocating] = useState(false);
  const useGps = async () => {
    setLocating(true);
    const pos = await getPosition();
    setLocating(false);
    if (pos.error) return toast(te(pos.error), "error");
    set({ gps: pos });
  };
  return (
    <View style={{ gap: 10 }}>
      <Txt variant="h3">{t("aimatch.placeTitle")}</Txt>
      <SelectField label={t("aimatch.wilaya")} value={d.wilaya_code} onChange={(v) => set({ wilaya_code: v, commune: "" })} testID="match-wilaya"
        options={wilayas.map((w) => ({ value: String(w.code), label: `${String(w.code).padStart(2, "0")} – ${loc(w)}` }))} />
      {d.wilaya_code ? (
        <SelectField label={t("aimatch.commune")} value={d.commune} onChange={(v) => set({ commune: v })} placeholder={t("aimatch.anyCommune")} testID="match-commune"
          options={(communes.data || []).map((c) => ({ value: c.name_fr, label: loc(c) }))} />
      ) : null}
      <Btn small variant="outline" icon={LocateFixed} loading={locating} title={t("aimatch.useGps")} onPress={d.gps ? () => set({ gps: null }) : useGps}
        style={d.gps ? { borderColor: BRAND.electric } : undefined} testID="match-gps" />
      {d.gps && <Txt variant="tiny" muted>{t("aimatch.gpsOn")}</Txt>}
      <Txt weight={700} style={{ marginTop: 6 }}>{t("aimatch.radius")}</Txt>
      <Row gap={8} wrap>{RADII.map((r) => <Chip key={r} label={`⁦${t("aimatch.km", { n: r })}⁩`} selected={d.radius_km === r} color={BRAND.pink} onPress={() => set({ radius_km: r })} testID={`match-radius-${r}`} />)}</Row>
      <Nav onBack={() => go("need")} onNext={() => go("results")} nextLabel={t("aimatch.search")} disabled={!d.wilaya_code && !d.gps} testID="match-search" />
    </View>
  );
}

const SORTS = ["best", "today", "rating", "near"];
const availableToday = (p) => (p.match?.reasons || []).some((r) => r.code === "available_today");

function Results({ d, set, go }) {
  const { t } = useI18n();
  const { settings } = useConfig();
  const max = settings.request_max_recipients || 5;
  const [sort, setSort] = useState("best");
  const body = { kind: "professional", text: d.description, category_key: d.category_key, wilaya_code: d.wilaya_code ? Number(d.wilaya_code) : null,
    commune: d.commune || null, radius_km: d.radius_km, urgency: d.when === "today" ? "high" : "normal", ...(d.gps || {}) };
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["match-flow", body], queryFn: () => matchService.recommend(body), retry: 1, staleTime: 60_000 });
  const all = useMemo(() => [...(data?.items || []), ...(data?.alternatives || [])], [data]);
  const shown = useMemo(() => {
    const list = sort === "today" ? all.filter(availableToday) : [...all];
    if (sort === "rating") list.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
    if (sort === "near") list.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
    return list;
  }, [all, sort]);
  const toggle = (p) => set({ names: { ...d.names, [p.id]: p.display_name },
    selected: d.selected.includes(p.id) ? d.selected.filter((x) => x !== p.id) : d.selected.length >= max ? d.selected : [...d.selected, p.id] });

  if (isLoading) {
    return (
      <Card style={{ alignItems: "center", gap: 8, paddingVertical: 28 }} testID="match-analysing">
        <Sparkles size={30} color={BRAND.electric} />
        <Txt variant="h3">{t("aimatch.analysing")}</Txt>
        <Txt variant="small" muted center>{t("aimatch.analysingText")}</Txt>
        <Loading />
        <Btn small variant="outline" title={t("aimatch.cancel")} onPress={() => go("place")} />
      </Card>
    );
  }
  if (isError) {
    return (
      <Card style={{ gap: 10 }} testID="match-error">
        <Txt weight={700}>{t("aimatch.error")}</Txt>
        <Btn small title={t("aimatch.retry")} onPress={() => refetch()} />
        <Btn small variant="outline" title={t("aimatch.edit")} onPress={() => go("place")} />
      </Card>
    );
  }
  if (!all.length) {
    const wider = RADII.find((r) => r > d.radius_km);
    return (
      <Card style={{ gap: 8 }} testID="match-empty">
        <Txt variant="h3" color={BRAND.orange}>{t("aimatch.emptyTitle")}</Txt>
        <Txt variant="small" muted>{t("aimatch.emptyText")}</Txt>
        {wider ? <Btn small variant="gradient" title={t("aimatch.widen", { n: wider })} onPress={() => set({ radius_km: wider })} testID="match-widen" /> : null}
        <Btn small variant="outline" title={t("aimatch.edit")} onPress={() => go("service")} />
      </Card>
    );
  }
  return (
    <View testID="match-results">
      <Txt variant="h3">{t("aimatch.resultsTitle")}</Txt>
      <Txt variant="small" muted>{t("aimatch.resultsCount", { n: all.length })} · {t("aimatch.within", { n: d.radius_km })}</Txt>
      <Row gap={6} wrap style={{ marginTop: 10 }}>
        {SORTS.map((s) => <Chip key={s} label={t(`aimatch.sort.${s}`)} selected={sort === s} color={BRAND.orange} onPress={() => setSort(s)} testID={`match-sort-${s}`} />)}
      </Row>
      <Txt variant="tiny" muted style={{ marginVertical: 8 }}>{t("aimatch.selectHint", { n: max })}</Txt>
      <View style={{ gap: 12 }}>
        {shown.map((p, i) => (
          <ProfileCard key={p.id} item={{ kind: "professional", ...p }} index={i} selectable={!p.is_owner} selected={d.selected.includes(p.id)} onSelect={() => toggle(p)} />
        ))}
      </View>
      <Row style={{ justifyContent: "space-between", marginTop: 16 }}>
        <Btn small variant="outline" title={t("aimatch.back")} onPress={() => go("place")} />
        <Btn small variant="gradient" title={t("aimatch.quote", { n: d.selected.length })} disabled={!d.selected.length} onPress={() => go("recap")} testID="match-quote" />
      </Row>
    </View>
  );
}

function Recap({ d, go, onSent }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: wilayas = [] } = useWilayas();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [idem] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`); // one key per recap: a double tap sends once
  const wilaya = wilayas.find((w) => String(w.code) === String(d.wilaya_code));
  const send = async () => {
    setBusy(true);
    try {
      const res = await requestService.create({ kind: "professional", profile_ids: d.selected, category_key: d.category_key,
        wilaya_code: d.wilaya_code ? Number(d.wilaya_code) : null, commune: d.commune || null, message: d.description.trim() }, idem);
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      onSent(res);
    } catch (err) {
      const code = errorCode(err);
      toast(te(code), "error");
      if (code === "plan_required") router.push("/pricing");
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }} testID="match-recap">
      <Txt variant="h3">{t("aimatch.recapTitle")}</Txt>
      <Card style={{ gap: 10 }}>
        <View><Txt variant="small" muted>{t("aimatch.recapNeed")}</Txt><Txt weight={600} auto>{d.description}</Txt></View>
        <View><Txt variant="small" muted>{t("aimatch.recapPlace")}</Txt><Txt weight={600}>{[d.commune, wilaya && loc(wilaya)].filter(Boolean).join(", ") || "—"}</Txt></View>
        <View><Txt variant="small" muted>{t("aimatch.recapPros")}</Txt>{d.selected.map((id) => <Txt key={id} weight={600}>• {d.names[id]}</Txt>)}</View>
      </Card>
      {user ? <CheckRow checked={consent} onChange={setConsent} testID="match-consent"><Txt variant="small" style={{ flex: 1 }}>{t("aimatch.consent")}</Txt></CheckRow>
        : <Card testID="match-login"><Txt variant="small">{t("aimatch.loginToSend")}</Txt></Card>}
      <Row style={{ justifyContent: "space-between" }}>
        <Btn small variant="outline" title={t("aimatch.back")} onPress={() => go("results")} />
        {user ? <Btn small variant="gradient" title={t("aimatch.send")} disabled={!consent} loading={busy} onPress={send} testID="match-send" />
          : <Btn small variant="gradient" title={t("nav.login")} onPress={() => router.push("/login")} />}
      </Row>
    </View>
  );
}

function Sent({ res, reset }) {
  const { t } = useI18n();
  return (
    <Card style={{ alignItems: "center", gap: 8, paddingVertical: 24 }} testID="match-sent">
      <CheckCircle2 size={44} color={BRAND.electric} />
      <Txt variant="h3">{t("aimatch.sentTitle")}</Txt>
      {res?.ref ? <Txt variant="small" weight={700} testID="match-ref">{t("aimatch.sentRef", { ref: `⁦${res.ref}⁩` })}</Txt> : null}
      <Txt variant="small" muted center>{t("aimatch.sentText")}</Txt>
      <Btn variant="gradient" icon={Check} title={t("aimatch.track")} onPress={() => router.replace("/requests")} testID="match-track" />
      <Btn variant="outline" title={t("aimatch.newSearch")} onPress={reset} />
    </Card>
  );
}

export default function MatchScreen() {
  const { t } = useI18n();
  const { flag } = useConfig();
  const [d, setD] = useState(saved);
  const [sent, setSent] = useState(null);
  const set = (patch) => setD((x) => (saved = { ...x, ...patch }));
  const go = (step) => set({ step });
  const reset = () => { setSent(null); setD((saved = { ...EMPTY, step: "service" })); };
  const prev = { need: "service", place: "need", results: "place", recap: "results" }[d.step];
  return (
    <Screen padded={false}>
      <TopBar title={t("aimatch.title")} onBack={prev && !sent ? () => go(prev) : undefined} />
      <View style={{ padding: 16, paddingBottom: 32 }} testID="match-page">
        {!flag("ai_match") ? <Card><Txt variant="small">{t("errors.feature_disabled")}</Txt></Card> : sent ? <Sent res={sent} reset={reset} /> : (
          <>
            {d.step === "service" && <Txt variant="small" muted style={{ marginBottom: 12 }}>{t("aimatch.subtitle")}</Txt>}
            <Progress step={d.step === "recap" ? "results" : d.step} />
            {d.step === "service" && <ServiceStep d={d} set={set} go={go} />}
            {d.step === "need" && <NeedStep d={d} set={set} go={go} />}
            {d.step === "place" && <PlaceStep d={d} set={set} go={go} />}
            {d.step === "results" && <Results d={d} set={set} go={go} />}
            {d.step === "recap" && <Recap d={d} go={go} onSent={(res) => { setSent(res); saved = { ...EMPTY, step: "service" }; }} />}
          </>
        )}
      </View>
    </Screen>
  );
}
