import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Cloud, CloudOff, PlusCircle, Rocket } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { prefs } from "@/api/storage";
import { billingService, catalogService, onboardingService } from "@/api/services";
import { AvailabilityEditor, DocRow, MediaEditor, pickDocument, pickImage, ZonesEditor } from "@/components/editors";
import { useAuth } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { formatDA } from "@/lib/format";
import { alpha, BRAND, useTheme } from "@/theme";
import { Btn, Card, Chip, Field, Input, Loading, Row, TopBar, Txt, useToast } from "@/ui";
import { CheckRow } from "@/ui/CheckRow";

const TOTAL = 7;
const OTHER = "__other__";
const DOCS = { professional: ["id_card", "trade_register"], teacher: ["id_card", "diploma"] };

function validate(kind, step, d) {
  const e = [];
  if (step === 1) { if ((d.display_name || "").trim().length < 2) e.push("display_name"); if ((d.bio || "").trim().length < 20) e.push("bio"); }
  if (step === 2) { if (kind === "professional" && !d.category_key) e.push("category_key"); if (kind === "teacher" && !(d.subjects || []).length) e.push("subjects"); }
  if (step === 3) { if (kind === "professional" && !d.role_key) e.push("role_key"); if (kind === "teacher" && !(d.formats || []).length) e.push("formats"); }
  if (step === 4 && !(d.zones || []).length && !(kind === "teacher" && d.formats?.length === 1 && d.formats[0] === "online")) e.push("zones");
  if (step === 7 && !d.accept_charter) e.push("accept_charter");
  return e;
}

/** Draft autosave: device immediately, server debounced (resume on any device). */
function useDraft(kind) {
  const [state, setState] = useState({ step: 1, data: {}, ready: false, save: "idle" });
  const timer = useRef(null);
  const remote = useQuery({ queryKey: ["draft", kind], queryFn: () => onboardingService.draft(kind), retry: false });
  useEffect(() => {
    if (!remote.data && !remote.error) return;
    prefs.getJSON(`gofix_draft_${kind}`).then((local) => {
      const r = remote.data;
      const useLocal = local && (!r?.updated_at || new Date(local.updated_at) > new Date(r.updated_at));
      const src = useLocal ? local : r || { step: 1, data: {} };
      setState({ step: src.step || 1, data: src.data || {}, ready: true, save: "idle" });
    });
  }, [remote.data, remote.error, kind]);
  const persist = useCallback((step, data) => {
    prefs.setJSON(`gofix_draft_${kind}`, { step, data, updated_at: new Date().toISOString() });
    setState((s) => ({ ...s, save: "saving" }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onboardingService.saveDraft(kind, step, data)
      .then(() => setState((s) => ({ ...s, save: "saved" }))).catch(() => setState((s) => ({ ...s, save: "error" }))), 1200);
  }, [kind]);
  const update = (patch) => setState((s) => { const data = { ...s.data, ...patch }; persist(s.step, data); return { ...s, data }; });
  const goTo = (step) => setState((s) => { persist(step, s.data); return { ...s, step }; });
  const flush = async () => { clearTimeout(timer.current); await onboardingService.saveDraft(kind, state.step, state.data); };
  return { ...state, update, goTo, flush, error: remote.error, clear: () => prefs.del(`gofix_draft_${kind}`) };
}

function Grid({ items, value, onChange, multiple, color }) {
  const loc = useLocalized();
  const sel = multiple ? value || [] : value;
  return (
    <Row gap={8} wrap>
      {items.map((it) => {
        const on = multiple ? sel.includes(it.key) : sel === it.key;
        return <Chip key={it.key} label={it.label || loc(it)} selected={on} color={color} onPress={() => onChange(multiple ? (on ? sel.filter((x) => x !== it.key) : [...sel, it.key]) : it.key)} testID={`opt-${it.key}`} />;
      })}
    </Row>
  );
}

export default function Onboarding() {
  const { kind } = useLocalSearchParams();
  const { c } = useTheme();
  const { t, te } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const { setUser } = useAuth();
  const draft = useDraft(kind);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState(null);
  const [other, setOther] = useState({ open: false, name: "", desc: "" });
  const d = draft.data;
  const pro = kind === "professional";
  const fams = useQuery({ queryKey: ["families"], queryFn: catalogService.families, staleTime: 300_000, enabled: pro });
  const cats = useQuery({ queryKey: ["cats", d.family_key], queryFn: () => catalogService.categories({ family_key: d.family_key }), enabled: pro && Boolean(d.family_key) });
  const roles = useQuery({ queryKey: ["roles", d.family_key], queryFn: () => catalogService.roles(d.family_key), enabled: pro && Boolean(d.family_key) });
  const specs = useQuery({ queryKey: ["specs", d.category_key], queryFn: () => catalogService.specialties(d.category_key), enabled: pro && Boolean(d.category_key) && d.category_key !== OTHER });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: catalogService.subjects, staleTime: 300_000, enabled: !pro });
  const levels = useQuery({ queryKey: ["levels"], queryFn: catalogService.levels, staleTime: 300_000, enabled: !pro });
  const plans = useQuery({ queryKey: ["plans"], queryFn: billingService.plans, staleTime: 60_000 });

  if (!["professional", "teacher"].includes(kind)) return <Redirect href="/onboarding" />;
  if (["role_conflict", "profile_exists"].includes(errorCode(draft.error))) return <Redirect href="/dashboard" />;
  if (!draft.ready) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><Loading /></SafeAreaView>;

  const step = draft.step;
  const priceKey = pro ? "price_hint_da" : "price_hint_da_hour";
  const next = () => {
    const e = validate(kind, step, d);
    setErrors(e);
    if (e.length) return toast(t("onboarding.fixErrors"), "error");
    draft.goTo(Math.min(TOTAL, step + 1));
  };
  const media = async (m) => {
    const asset = await pickImage(m === "photo" ? [1, 1] : [3, 1]);
    if (!asset) return;
    setBusy(m);
    try {
      const r = m === "photo" ? await onboardingService.uploadPhoto(asset) : await onboardingService.uploadCover(asset);
      draft.update(m === "photo" ? { photo_key: r.photo_key, photo_thumb_key: r.photo_thumb_key } : { cover_key: r.cover_key, cover_thumb_key: r.cover_thumb_key });
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(null); }
  };
  const doc = async (type) => {
    const asset = await pickDocument();
    if (!asset) return;
    setBusy(type);
    try {
      const r = await onboardingService.uploadDocument(type, asset);
      draft.update({ documents: [...(d.documents || []).filter((x) => (x.type || x) !== type), r] });
      toast(t("onboardingx.docUploaded"));
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(null); }
  };
  const sendOther = async () => {
    try {
      const r = await onboardingService.requestCategory({ family_key: d.family_key, name: other.name.trim(), description: other.desc.trim() });
      draft.update({ category_key: OTHER, category_request_id: r.id, other_category_name: other.name.trim(), specialty_keys: [] });
      setOther({ ...other, open: false });
      toast(t("onboardingx.otherSentToast"));
    } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  const submit = async () => {
    const all = [1, 2, 3, 4, 7].flatMap((s) => validate(kind, s, d));
    setErrors(all);
    if (all.length) return toast(t("onboarding.fixErrors"), "error");
    setBusy("submit");
    try {
      await draft.flush();
      const res = await onboardingService.submit(kind);
      await draft.clear();
      setUser(res.user);
      setDone({ plan: d.chosen_plan && d.chosen_plan !== "professional_free" ? d.chosen_plan : null });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.code === "draft_incomplete") setErrors(detail.fields);
      toast(te(errorCode(err)), "error");
    } finally { setBusy(null); }
  };

  if (done) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: "center", gap: 14 }}>
      <View style={{ alignItems: "center", gap: 12 }}><Rocket size={56} color={BRAND.pink} /><Txt variant="h1" center>{t("onboarding.doneTitle")}</Txt>
        <Txt muted center>{t("onboarding.doneText")}</Txt><Row gap={6}><CheckCircle2 size={16} color={BRAND.orange} /><Txt weight={700} color={BRAND.orange}>{t("onboarding.status.pending")}</Txt></Row></View>
      {done.plan && <Btn variant="gradient" title={t("onboardingx.continueToPay")} onPress={() => router.replace(`/pricing?audience=professional&plan=${done.plan}`)} />}
      <Btn variant={done.plan ? "outline" : "gradient"} title={t("nav.dashboard")} onPress={() => router.replace("/dashboard")} />
    </SafeAreaView>
  );

  const labels = t("onboarding.steps")[kind];
  const SaveIcon = draft.save === "error" ? CloudOff : Cloud;
  const fieldErr = errors.length ? errors.map((e) => t(`onboarding.fields.${e}`)).join(" · ") : null;
  const docs = (d.documents || []).map((x) => (typeof x === "string" ? { type: x, status: "declared" } : x));

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={t(`onboarding.${kind}.title`)} right={<Row gap={4} style={{ paddingHorizontal: 8 }}><SaveIcon size={14} color={c.muted} /><Txt variant="tiny" muted>{t(`onboarding.save.${draft.save}`)}</Txt></Row>} />
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Row style={{ justifyContent: "space-between" }}><Txt variant="tiny" weight={700}>{t("onboarding.stepOf", { step, total: TOTAL })} · {labels[step - 1]}</Txt><Txt variant="tiny" weight={700} color={BRAND.electric}>{Math.round(step / TOTAL * 100)}%</Txt></Row>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.cardAlt, marginTop: 6, overflow: "hidden" }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: TOTAL, now: step }}>
          <View style={{ width: `${(step / TOTAL) * 100}%`, height: "100%", backgroundColor: BRAND.pink }} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
            <Txt variant="h2">{t(`onboarding.${kind}.s1Title`)}</Txt><Txt variant="small" muted>{t("onboarding.s1Hint")}</Txt>
            <Field label={t("onboarding.displayName")} hint={t("onboarding.displayNameHint")}><Input value={d.display_name || ""} onChangeText={(v) => draft.update({ display_name: v })} maxLength={80} testID="ob-name" /></Field>
            <Field label={t("onboarding.experience")}><Input value={String(d.experience_years ?? "")} onChangeText={(v) => draft.update({ experience_years: v.replace(/\D/g, "") })} keyboardType="number-pad" ltr /></Field>
            <Field label={t("onboarding.bio")} hint={`${t("onboarding.bioHint")} (${(d.bio || "").length}/1500)`}><Input multiline value={d.bio || ""} onChangeText={(v) => draft.update({ bio: v })} maxLength={1500} placeholder={t(`onboarding.${kind}.bioPh`)} testID="ob-bio" /></Field>
          </>
        )}
        {step === 2 && pro && (
          <>
            <Txt variant="h2">{t("onboarding.professional.s2Title")}</Txt><Txt variant="small" muted>{t("onboarding.professional.s2Hint")}</Txt>
            <Txt variant="label">{t("onboarding.family")}</Txt>
            <Grid items={(fams.data || []).filter((f) => f.key !== "academy")} value={d.family_key} color={BRAND.pink}
              onChange={(k) => draft.update({ family_key: k, category_key: null, specialty_keys: [], category_request_id: null })} />
            {d.family_key && (
              <>
                <Txt variant="label">{t("onboarding.category")}</Txt>
                <Grid items={cats.data || []} value={d.category_key} onChange={(k) => draft.update({ category_key: k, specialty_keys: [], category_request_id: null })} />
                {d.category_request_id ? <Card style={{ borderColor: alpha(BRAND.orange, 0.5) }}><Txt variant="small">{t("onboardingx.otherSent", { name: d.other_category_name })}</Txt></Card> : (
                  other.open ? (
                    <Card style={{ gap: 8 }}>
                      <Txt weight={700}>{t("onboardingx.otherTitle")}</Txt>
                      <Input value={other.name} onChangeText={(v) => setOther({ ...other, name: v })} placeholder={t("onboardingx.otherName")} maxLength={80} />
                      <Input value={other.desc} onChangeText={(v) => setOther({ ...other, desc: v })} placeholder={t("onboardingx.otherDesc")} maxLength={500} />
                      <Btn small variant="outline" title={t("onboardingx.otherSend")} disabled={other.name.trim().length < 2} onPress={sendOther} />
                      <Txt variant="tiny" muted>{t("onboardingx.otherHint")}</Txt>
                    </Card>
                  ) : <Btn small variant="outline" icon={PlusCircle} title={t("onboardingx.other")} onPress={() => setOther({ ...other, open: true })} />
                )}
              </>
            )}
          </>
        )}
        {step === 2 && !pro && (
          <>
            <Txt variant="h2">{t("onboarding.teacher.s2Title")}</Txt><Txt variant="small" muted>{t("onboarding.teacher.s2Hint")}</Txt>
            <Grid items={subjects.data || []} multiple color={BRAND.pink} value={(d.subjects || []).map((s) => s.subject_key)}
              onChange={(ks) => draft.update({ subjects: ks.map((k) => (d.subjects || []).find((s) => s.subject_key === k) || { subject_key: k, level_keys: [] }) })} />
            {(d.subjects || []).map((s) => (
              <Card key={s.subject_key} style={{ gap: 8 }}>
                <Txt weight={700}>{loc(subjects.data?.find((x) => x.key === s.subject_key))} — {t("onboarding.levels")}</Txt>
                <Grid items={levels.data || []} multiple value={s.level_keys} onChange={(lv) => draft.update({ subjects: d.subjects.map((x) => (x.subject_key === s.subject_key ? { ...x, level_keys: lv } : x)) })} />
              </Card>
            ))}
          </>
        )}
        {step === 3 && pro && (
          <>
            <Txt variant="h2">{t("onboarding.professional.s3Title")}</Txt><Txt variant="small" muted>{t("onboarding.professional.s3Hint")}</Txt>
            <Txt variant="label">{t("onboarding.role")}</Txt>
            <Grid items={roles.data || []} value={d.role_key} color={BRAND.orange} onChange={(k) => draft.update({ role_key: k })} />
            <Txt variant="label">{t("onboarding.specialties")} <Txt variant="small" muted>({t("common.optional")})</Txt></Txt>
            {specs.data?.length ? <Grid items={specs.data} multiple value={d.specialty_keys} onChange={(v) => draft.update({ specialty_keys: v })} /> : <Txt variant="small" muted>{t("onboarding.noSpecialties")}</Txt>}
          </>
        )}
        {step === 3 && !pro && (
          <>
            <Txt variant="h2">{t("onboarding.teacher.s3Title")}</Txt><Txt variant="small" muted>{t("onboarding.teacher.s3Hint")}</Txt>
            <Txt variant="label">{t("onboarding.format")}</Txt>
            <Grid items={["home", "online", "center"].map((k) => ({ key: k, label: t(`onboarding.formats.${k}`) }))} multiple color={BRAND.orange} value={d.formats} onChange={(v) => draft.update({ formats: v })} />
            <Txt variant="label">{t("onboarding.teachingLangs")}</Txt>
            <Grid items={["fr", "ar", "en"].map((k) => ({ key: k, label: t(`onboarding.langs.${k}`) }))} multiple value={d.teaching_languages || ["fr", "ar"]} onChange={(v) => draft.update({ teaching_languages: v })} />
          </>
        )}
        {step === 4 && (
          <>
            <Txt variant="h2">{t("onboarding.s4Title")}</Txt>
            <Txt variant="small" muted>{!pro && d.formats?.length === 1 && d.formats[0] === "online" ? t("onboarding.s4OnlineHint") : t("onboarding.s4Hint")}</Txt>
            <ZonesEditor zones={d.zones || []} onChange={(z) => draft.update({ zones: z })} />
          </>
        )}
        {step === 5 && (
          <>
            <Txt variant="h2">{t("onboarding.s5Title")}</Txt><Txt variant="small" muted>{t("onboarding.s5Hint")}</Txt>
            <Field label={t(`onboarding.${kind}.price`)} hint={t("onboarding.priceHint")}><Input value={d[priceKey] != null ? String(d[priceKey]) : ""} onChangeText={(v) => draft.update({ [priceKey]: v === "" ? null : Number(v.replace(/\D/g, "")) })} keyboardType="number-pad" ltr /></Field>
            <Txt variant="label">{t("onboarding.availability")}</Txt>
            <AvailabilityEditor slots={d.slots || []} onChange={(s) => draft.update({ slots: s })} />
          </>
        )}
        {step === 6 && (
          <>
            <Txt variant="h2">{t("onboarding.s6Title")}</Txt><Txt variant="small" muted>{t("onboarding.s6Hint")}</Txt>
            <MediaEditor value={d} name={d.display_name} busy={busy} onPhoto={() => media("photo")} onCover={() => media("cover")}
              onRemove={() => draft.update({ photo_key: null, photo_thumb_key: null })} />
            <Txt variant="label">{t("onboarding.documents")}</Txt>
            <Txt variant="tiny" muted>{t("onboarding.documentsHint")}</Txt>
            {DOCS[kind].map((type) => <DocRow key={type} label={t(`onboarding.docs.${type}`)} status={docs.find((x) => x.type === type)?.key ? "submitted" : null} busy={busy === type} onUpload={() => doc(type)} />)}
          </>
        )}
        {step === 7 && (
          <>
            <Txt variant="h2">{t("onboarding.s7Title")}</Txt><Txt variant="small" muted>{t("onboarding.s7Hint")}</Txt>
            <Card style={{ gap: 6 }}>
              {[[t("onboarding.displayName"), d.display_name, 1], [t("onboarding.bio"), d.bio, 1],
                pro ? [t("onboarding.category"), d.category_key === OTHER ? `${d.other_category_name} (${t("onboardingx.otherPending")})` : d.category_key, 2]
                  : [t("onboarding.subjects"), (d.subjects || []).map((s) => loc(subjects.data?.find((x) => x.key === s.subject_key))).join(", "), 2],
                [t("onboarding.s4Title"), (d.zones || []).map((z) => `W${z.wilaya_code} (${z.radius_km} km)`).join(", "), 4],
                [t(`onboarding.${kind}.price`), d[priceKey] != null ? formatDA(d[priceKey]) : t("onboarding.onQuote"), 5],
                [t("onboarding.documents"), docs.map((x) => `${t(`onboarding.docs.${x.type}`)}${x.key ? " ✓" : ""}`).join(", ") || t("onboarding.noneDeclared"), 6]].map(([label, value, s]) => (
                <Row key={label} gap={8} style={{ alignItems: "flex-start", borderBottomWidth: 1, borderColor: c.border, paddingVertical: 6 }}>
                  <View style={{ flex: 1 }}><Txt variant="tiny" muted>{label}</Txt><Txt variant="small" color={value ? c.text : "#F87171"} numberOfLines={3}>{value || t("onboarding.missing")}</Txt></View>
                  <Btn small variant="ghost" title={t("onboarding.edit")} onPress={() => draft.goTo(s)} />
                </Row>
              ))}
            </Card>
            <Txt weight={800}>{t("onboardingx.planTitle")}</Txt>
            <Txt variant="tiny" muted>{t("onboardingx.planHint")}</Txt>
            <Row gap={8} wrap>{(plans.data || []).filter((p) => p.audience === "professional").map((p) => (
              <Chip key={p.key} label={`${p.name_fr} · ${p.tier === "free" ? t("pricing.free") : p.price_da ? formatDA(p.price_da) : t("pricing.tbd")}`}
                selected={(d.chosen_plan || "professional_free") === p.key} color={BRAND.pink} onPress={() => draft.update({ chosen_plan: p.key })} />
            ))}</Row>
            <CheckRow checked={Boolean(d.accept_charter)} onChange={(v) => draft.update({ accept_charter: v })} testID="ob-charter">
              <Txt variant="small">{t("onboarding.acceptCharter")} <Txt variant="small" color={BRAND.electric} onPress={() => router.push("/legal/cgu")}>{t("auth.terms")}</Txt>.</Txt>
            </CheckRow>
            <Txt variant="tiny" muted>{t("onboarding.pendingNotice")}</Txt>
          </>
        )}
        {fieldErr && <Txt variant="small" color="#F87171" accessibilityLiveRegion="polite">{fieldErr}</Txt>}
      </ScrollView>
      <Row gap={10} style={{ padding: 12, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
        <Btn variant="outline" title={t("common.back")} disabled={step === 1} onPress={() => { setErrors([]); draft.goTo(Math.max(1, step - 1)); }} style={{ flex: 1 }} />
        {step < TOTAL ? <Btn variant="gradient" title={t("onboarding.next")} onPress={next} style={{ flex: 1.4 }} testID="ob-next" />
          : <Btn variant="gradient" icon={Rocket} title={t("onboarding.submit")} loading={busy === "submit"} onPress={submit} style={{ flex: 1.4 }} testID="ob-submit" />}
      </Row>
    </SafeAreaView>
  );
}
