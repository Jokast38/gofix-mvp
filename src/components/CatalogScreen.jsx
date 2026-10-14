import { useEffect, useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Camera, LocateFixed, Mic, Search, SearchX, Send, Sparkles, X } from "lucide-react-native";
import { catalogService, matchService } from "@/api/services";
import { useAuth, useConfig, useWilayas } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { detectWilaya } from "@/lib/location";
import { BRAND, useTheme } from "@/theme";
import { Btn, Card, Chip, Empty, IconBtn, Loading, Row, SelectField, Txt, useToast } from "@/ui";
import { RequestSheet } from "./actions";
import { BlurNotice, IntentChips, ProfileCard } from "./catalog";

const FORMATS = ["home", "online", "center"];

/** Services (kind=professional) and Academy (kind=teacher) catalogue, with AI MATCH free-text understanding. */
export function CatalogScreen({ kind }) {
  const { c } = useTheme();
  const { t, te, lang } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const { user } = useAuth();
  const { settings } = useConfig();
  const params = useLocalSearchParams();
  const teacher = kind === "teacher";
  const [draft, setDraft] = useState(params.q || "");
  const [text, setText] = useState(params.q || "");
  const [f, setF] = useState({ category_key: params.category_key || "", subject_key: params.subject_key || "", level_key: "", format: params.format || "", wilaya: params.wilaya || "" });
  const [selected, setSelected] = useState([]);
  const [sheet, setSheet] = useState(null);
  const { data: wilayas = [] } = useWilayas();
  const [locating, setLocating] = useState(false);
  const [nearWilaya, setNearWilaya] = useState(null);
  // Optional: the position is only turned into a wilaya filter (never stored).
  const nearMe = async () => {
    if (locating) return;
    setLocating(true);
    const res = await detectWilaya();
    setLocating(false);
    if (res.wilaya) {
      setNearWilaya(res.wilaya.code);
      setF((x) => ({ ...x, wilaya: res.wilaya.code }));
      toast(t("geoloc.found", { name: loc(res.wilaya) }));
    } else toast(te(res.error), "error");
  };
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => catalogService.categories(), staleTime: 300_000, enabled: !teacher });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: catalogService.subjects, staleTime: 300_000, enabled: teacher });
  const levels = useQuery({ queryKey: ["levels"], queryFn: catalogService.levels, staleTime: 300_000, enabled: teacher });
  useEffect(() => { if (params.q) { setDraft(params.q); setText(params.q); } }, [params.q]);

  // 1) AI MATCH: free text -> intent + top 3–5 with reasons
  const smart = useQuery({ queryKey: ["smart", kind, text, lang], enabled: Boolean(text), retry: false, staleTime: 60_000,
    queryFn: () => matchService.recommend({ text, kind }) });
  useEffect(() => {
    if (smart.data?.kind === "teacher" && !teacher) router.replace(`/academy?q=${encodeURIComponent(text)}`);
  }, [smart.data, teacher, text]);
  const intent = smart.data?.intent;
  const understood = teacher ? intent?.subject_key : intent?.category_key;

  // 2) full list, filtered by the understood intent (keyword search only as a fallback)
  const query = useMemo(() => {
    const base = teacher
      ? { subject_key: f.subject_key || (understood ? intent.subject_key : ""), level_key: f.level_key || intent?.level_key || "", format: f.format || intent?.mode || "" }
      : { category_key: f.category_key || (understood ? intent.category_key : "") };
    return { ...base, wilaya: f.wilaya || intent?.wilaya_code || "", q: text && !understood ? text : "", page_size: 12 };
  }, [f, intent, understood, text, teacher]);
  const list = useInfiniteQuery({
    queryKey: [kind, "list", query, Boolean(user)], enabled: !text || smart.isFetched,
    queryFn: ({ pageParam }) => (teacher ? catalogService.teachers : catalogService.pros)({ ...query, page: pageParam }),
    initialPageParam: 1, getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
  });
  const pages = list.data?.pages || [];
  const items = pages.flatMap((p) => p.items);
  const head = pages[0];
  const canSelect = teacher && Boolean(user) && head && !head.blurred;
  const max = settings.request_max_recipients || 5;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= max ? s : [...s, id]));
  const submitText = () => { setText(draft.trim()); setSelected([]); };

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <Txt variant="h1">{teacher ? t("catalog.teachersTitle") : t("catalog.prosTitle")}</Txt>
      <Row style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 999, paddingStart: 14, paddingEnd: 4, minHeight: 50 }}>
        <Search size={18} color={c.muted} />
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={submitText} returnKeyType="search" placeholder={t("match.placeholder")}
          placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, marginHorizontal: 8, minHeight: 46, fontSize: 15 }} testID="catalog-search" />
        {draft ? <IconBtn onPress={() => { setDraft(""); setText(""); }} label={t("common.close")}><X size={18} color={c.muted} /></IconBtn> : null}
        <IconBtn onPress={() => toast(t("upcoming.toast.voice"))} label={t("upcoming.voice.title")}><Mic size={19} color={c.muted} /></IconBtn>
        <IconBtn onPress={() => toast(t("upcoming.toast.vision"))} label={t("upcoming.vision.title")}><Camera size={19} color={c.muted} /></IconBtn>
      </Row>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <SelectField label={t("home.wilayaLabel")} value={f.wilaya} onChange={(v) => setF({ ...f, wilaya: v })} placeholder={t("home.wilayaAll")}
            options={wilayas.map((w) => ({ value: w.code, label: `${String(w.code).padStart(2, "0")} – ${loc(w)}` }))} testID="filter-wilaya" />
        </View>
        <View style={{ flex: 1 }}>
          {teacher
            ? <SelectField label={t("requests.subject")} value={f.subject_key} onChange={(v) => setF({ ...f, subject_key: v })} placeholder={t("catalog.allSubjects")}
                options={(subjects.data || []).map((x) => ({ value: x.key, label: loc(x) }))} />
            : <SelectField label={t("requests.category")} value={f.category_key} onChange={(v) => setF({ ...f, category_key: v })} placeholder={t("catalog.allCategories")}
                options={(cats.data || []).map((x) => ({ value: x.key, label: loc(x) }))} testID="filter-category" />}
        </View>
      </View>
      <Row gap={8} wrap>
        <Chip icon={LocateFixed} label={locating ? t("geoloc.detecting") : t("geoloc.nearMe")} selected={Boolean(f.wilaya) && f.wilaya === nearWilaya}
          onPress={nearMe} testID="near-me" />
      </Row>
      {teacher && (
        <FlatList horizontal data={[...FORMATS.map((k) => ({ k, type: "f" })), ...(levels.data || []).map((l) => ({ k: l.key, type: "l", l }))]} keyExtractor={(x) => x.type + x.k}
          showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => item.type === "f"
            ? <Chip label={t(`onboarding.formats.${item.k}`)} selected={f.format === item.k} color={BRAND.pink} onPress={() => setF({ ...f, format: f.format === item.k ? "" : item.k })} />
            : <Chip label={loc(item.l)} selected={f.level_key === item.k} onPress={() => setF({ ...f, level_key: f.level_key === item.k ? "" : item.k })} />} />
      )}

      {text ? (
        smart.isLoading ? <Loading /> : smart.data && (
          <View style={{ gap: 10 }}>
            <IntentChips intent={intent} kind={kind} />
            {smart.data.items.length > 0 && (
              <>
                <Row gap={6}><Sparkles size={18} color={BRAND.pink} /><Txt variant="h3">{t("match.bestFor")}</Txt></Row>
                {smart.data.items.map((x, i) => <ProfileCard key={x.id} item={x} index={i} />)}
              </>
            )}
            {smart.data.items.length === 0 && !smart.data.missing?.length && <Txt variant="small" muted>{t("match.noneNearby")}</Txt>}
            {understood && <Txt variant="h3" style={{ marginTop: 6 }}>{t("match.allResults")}</Txt>}
          </View>
        )
      ) : null}

      {head?.blurred && <BlurNotice loggedIn={Boolean(user)} />}
      {(!teacher || head?.blurred) && (
        <Card style={{ gap: 10 }}>
          <Txt variant="small">{teacher ? t("requests.barTeacher") : t("requests.bar")}</Txt>
          <Btn small icon={Send} title={user ? t("catalog.publishRequest") : t("nav.login")} onPress={() => (user ? setSheet("open") : router.push("/login"))} testID="publish-request" />
        </Card>
      )}
      {canSelect && <Txt variant="small" muted>{t("catalog.multiHint", { n: max })}</Txt>}
      {head?.views_limit ? <Txt variant="tiny" muted>{t("catalog.viewsUsed", { used: head.views_used ?? 0, limit: head.views_limit })}</Txt> : null}
      {head && <Txt variant="small" muted>{t("catalog.results", { n: head.total })}</Txt>}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList data={items} keyExtractor={(x) => x.id} ListHeaderComponent={header} contentContainerStyle={{ padding: 16, paddingBottom: selected.length ? 110 : 32, gap: 12 }}
        renderItem={({ item, index }) => <ProfileCard item={item} index={index} selectable={canSelect && !item.is_owner} selected={selected.includes(item.id)} onSelect={() => toggle(item.id)} />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()} onEndReachedThreshold={0.4}
        refreshing={list.isRefetching} onRefresh={() => list.refetch()} keyboardShouldPersistTaps="handled"
        ListEmptyComponent={list.isLoading ? <Loading /> : <Empty icon={SearchX} text={t("catalog.empty")} />}
        ListFooterComponent={list.isFetchingNextPage ? <Loading /> : null} />
      {selected.length > 0 && (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: c.card, borderRadius: 999, borderWidth: 1, borderColor: c.border,
          flexDirection: "row", alignItems: "center", paddingStart: 16, padding: 6, gap: 8 }}>
          <Txt weight={700} style={{ flex: 1 }}>{t("catalog.selectedN", { n: selected.length, max })}</Txt>
          <IconBtn onPress={() => setSelected([])} label={t("common.cancel")}><X size={18} color={c.text} /></IconBtn>
          <Btn small variant="gradient" icon={Send} title={t("catalog.sendToSelected", { n: selected.length })} onPress={() => setSheet("targeted")} testID="send-selected" />
        </View>
      )}
      <RequestSheet visible={sheet === "open"} onClose={() => setSheet(null)} kind={kind}
        defaults={{ category_key: f.category_key || intent?.category_key, subject_key: f.subject_key || intent?.subject_key, wilaya_code: f.wilaya || intent?.wilaya_code, message: text }} />
      <RequestSheet visible={sheet === "targeted"} onClose={() => setSheet(null)} kind="teacher" profileIds={selected}
        defaults={{ subject_key: f.subject_key || intent?.subject_key, level_key: f.level_key || intent?.level_key, format: f.format || intent?.mode }} />
    </View>
  );
}
