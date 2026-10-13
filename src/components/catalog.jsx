import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, BadgeCheck, CalendarDays, Camera, GraduationCap, Info, Lock, MapPin, Mic, MonitorSmartphone, QrCode, ShieldCheck,
  ShieldQuestion, Sparkles, Star, Tag, TriangleAlert } from "lucide-react-native";
import { catalogService, matchService } from "@/api/services";
import { useWilayas } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { formatDA } from "@/lib/format";
import { alpha, BRAND, neonFor, RADIUS, useTheme } from "@/theme";
import { Avatar, Btn, Card, Cover, Loading, Pill, Row, Sheet, Txt } from "@/ui";

export function Rating({ avg, count, bucket }) {
  const { t } = useI18n();
  if (bucket) return <Row gap={4}><Star size={13} color={BRAND.orange} fill={BRAND.orange} /><Txt variant="tiny" weight={700} color={BRAND.orange}>{t("catalog.ratingBucket", { b: bucket })}</Txt></Row>;
  if (!count) return null;
  return <Row gap={4}><Star size={13} color={BRAND.orange} fill={BRAND.orange} /><Txt variant="tiny" weight={700} color={BRAND.orange}>{Number(avg).toFixed(1)}</Txt><Txt variant="tiny" muted>({count})</Txt></Row>;
}

const TRUST_COLOR = { excellent: BRAND.electric, established: BRAND.violet, insufficient: BRAND.orange };

export function TrustBadge({ status, score, compact }) {
  const { t } = useI18n();
  if (!status) return null;
  const c = TRUST_COLOR[status] || BRAND.orange;
  const Icon = status === "insufficient" ? ShieldQuestion : ShieldCheck;
  return (
    <Row gap={4} style={{ borderWidth: 1, borderColor: alpha(c, 0.5), borderRadius: 999, paddingHorizontal: compact ? 6 : 10, paddingVertical: compact ? 1 : 4 }}>
      <Icon size={compact ? 11 : 13} color={c} />
      <Txt variant="tiny" weight={700} color={c}>{t(`trust.status.${status}`)}{score != null ? ` · ${score}` : ""}</Txt>
    </Row>
  );
}

export function TrustSubscores({ subscores }) {
  const { c } = useTheme();
  const { t } = useI18n();
  if (!subscores) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {["identity", "reactivity", "satisfaction", "reliability"].map((k) => {
        const v = subscores[k];
        return (
          <View key={k} style={{ width: "47%", flexGrow: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10 }}>
            <Row style={{ justifyContent: "space-between" }}><Txt variant="tiny" muted>{t(`trust.subs.${k}`)}</Txt><Txt variant="small" weight={800}>{v == null ? "—" : v}</Txt></Row>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.cardAlt, marginTop: 8, overflow: "hidden" }}>
              {v != null && <View style={{ width: `${v}%`, height: "100%", backgroundColor: BRAND.electric }} />}
            </View>
            {v == null && <Txt variant="tiny" muted style={{ marginTop: 4 }}>{t("trust.noData")}</Txt>}
          </View>
        );
      })}
    </View>
  );
}

function WhySheet({ match, profileId, visible, onClose }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({ queryKey: ["why", match?.match_result_id, profileId], enabled: visible && Boolean(match?.match_result_id),
    queryFn: () => matchService.explanation(match.match_result_id, profileId) });
  const r = data?.results?.[0];
  return (
    <Sheet visible={visible} onClose={onClose} title={t("match.whyTitle")}>
      <Txt muted style={{ marginBottom: 10 }}>{match?.explanation}</Txt>
      {isLoading ? <Loading /> : error || !r ? <Txt muted>{t("match.whyUnavailable")}</Txt> : (
        <View style={{ gap: 10, paddingBottom: 8 }}>
          <Txt variant="h1">{r.score}<Txt muted>/100</Txt></Txt>
          {r.components.map((x) => (
            <View key={x.criterion}>
              <Row style={{ justifyContent: "space-between" }}><Txt variant="small">{t(`match.criteria.${x.criterion}`)}</Txt><Txt variant="small" weight={700} color={x.contribution < 0 ? "#F87171" : c.text}>{x.contribution > 0 ? "+" : ""}{x.contribution}</Txt></Row>
              {x.contribution > 0 && <View style={{ height: 5, borderRadius: 3, backgroundColor: c.cardAlt, marginTop: 4 }}><View style={{ width: `${Math.min(100, x.value * 100)}%`, height: "100%", backgroundColor: BRAND.pink, borderRadius: 3 }} /></View>}
            </View>
          ))}
          <Txt variant="tiny" muted>{t("match.formula", { v: data.formula_version })}</Txt>
        </View>
      )}
    </Sheet>
  );
}

function MatchInfo({ item }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!item.match?.top || !item.match.explanation) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Txt variant="tiny" color={BRAND.electric}>« {item.match.explanation} »</Txt>
      {item.match.match_result_id && (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={{ minHeight: 32, justifyContent: "center", alignSelf: "flex-start" }}>
          <Row gap={4}><Info size={13} color={BRAND.electric} /><Txt variant="tiny" weight={700} color={BRAND.electric} style={{ textDecorationLine: "underline" }}>{t("match.why")}</Txt></Row>
        </Pressable>
      )}
      <WhySheet match={item.match} profileId={item.id} visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** Professional or teacher card: cover band + thumbnail (initials if no photo, lock if masked by the server). */
export function ProfileCard({ item, index = 0, selectable, selected, onSelect }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const loc = useLocalized();
  const color = neonFor(index + (item.kind === "teacher" ? 1 : 0));
  const teacher = item.kind === "teacher";
  const open = () => {
    if (item.match?.match_result_id) matchService.feedback(item.match.match_result_id, item.id, "click");
    router.push(`/${teacher ? "teacher" : "pro"}/${item.id}`);
  };
  const price = teacher ? item.price_hint_da_hour : item.price_hint_da;
  return (
    <Card onPress={open} style={{ padding: 0, overflow: "hidden", borderColor: selected ? BRAND.pink : c.border }} testID={`card-${item.id}`}>
      <View>
        <Cover coverKey={item.cover_key} thumbKey={item.cover_thumb_key} blurred={item.blurred} color={color} />
        {item.match?.top && (
          <View style={{ position: "absolute", top: 8, end: 8, backgroundColor: BRAND.pink, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, flexDirection: "row", gap: 4, alignItems: "center" }}>
            <Sparkles size={12} color={BRAND.night} /><Txt variant="tiny" weight={800} color={BRAND.night}>{t("catalog.topMatch")}</Txt>
          </View>
        )}
        {selectable && (
          <Pressable onPress={onSelect} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(selected) }} hitSlop={8}
            style={{ position: "absolute", top: 8, start: 8, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center",
              backgroundColor: selected ? BRAND.pink : alpha(c.card, 0.9), borderWidth: 1, borderColor: selected ? BRAND.pink : c.border }}>
            <Txt variant="tiny" weight={800} color={selected ? BRAND.night : c.text}>{selected ? t("catalog.selected") : t("catalog.select")}</Txt>
          </Pressable>
        )}
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, marginTop: -28 }}>
        <Row gap={10} style={{ alignItems: "flex-end" }}>
          <Avatar photoKey={item.photo_key} thumbKey={item.photo_thumb_key} name={item.display_name} blurred={item.blurred} color={color} ring />
          <View style={{ flex: 1, paddingBottom: 2 }}>
            <Row gap={6}>
              {item.blurred || !item.display_name
                ? <View style={{ height: 14, width: 110, borderRadius: 7, backgroundColor: c.cardAlt }} accessibilityLabel={t("catalog.hiddenName")} />
                : <Txt weight={800} numberOfLines={1} style={{ flexShrink: 1 }}>{item.display_name}</Txt>}
              {item.verification_status === "verified" && <BadgeCheck size={16} color={BRAND.electric} />}
            </Row>
            <Txt variant="tiny" weight={700} color={color} numberOfLines={1}>
              {teacher ? (item.subjects_full || []).map((s) => loc(s)).join(" · ") : loc(item.category)}
            </Txt>
          </View>
        </Row>
        <Row gap={4} style={{ marginTop: 8 }}>
          <MapPin size={12} color={c.muted} />
          <Txt variant="tiny" muted numberOfLines={1} style={{ flex: 1 }}>
            {teacher && item.formats?.length ? `${item.formats.map((f) => t(`onboarding.formats.${f}`)).join(" · ")} · ` : ""}{(item.wilayas || []).map((w) => loc(w)).join(", ")}
          </Txt>
        </Row>
        <Row style={{ marginTop: 6, justifyContent: "space-between" }}>
          <Row gap={8}><Rating avg={item.rating_avg} count={item.rating_count} bucket={item.rating_bucket} /><TrustBadge status={item.trust_status} score={item.trust_score} compact /></Row>
          {price != null && <Txt variant="tiny" weight={800}>{teacher ? `${formatDA(price)} / ${t("catalog.hour")}` : `${t("catalog.from")} ${formatDA(price)}`}</Txt>}
        </Row>
        <MatchInfo item={item} />
      </View>
    </Card>
  );
}

export function BlurNotice({ loggedIn }) {
  const { t } = useI18n();
  return (
    <Card glow style={{ gap: 10 }}>
      <Row gap={10}><Lock size={20} color={BRAND.pink} /><Txt variant="small" style={{ flex: 1 }}>{loggedIn ? t("catalog.blurNoticeFree") : t("catalog.blurNotice")}</Txt></Row>
      <Row gap={8}>
        {!loggedIn && <Btn small variant="outline" title={t("nav.login")} onPress={() => router.push("/login")} style={{ flex: 1 }} />}
        <Btn small variant="gradient" title={t("catalog.unlock")} onPress={() => router.push("/pricing")} style={{ flex: 1 }} testID="unlock" />
      </Row>
    </Card>
  );
}

function IChip({ icon: Icon, children }) {
  return (
    <Row gap={5} style={{ borderWidth: 1, borderColor: alpha(BRAND.electric, 0.5), backgroundColor: alpha(BRAND.electric, 0.1), borderRadius: 999, paddingHorizontal: 10, minHeight: 32 }}>
      <Icon size={13} color={BRAND.electric} /><Txt variant="tiny" weight={700}>{children}</Txt>
    </Row>
  );
}

/** "Nous avons compris" — fields extracted by AI MATCH from the free text, and what is missing. */
export function IntentChips({ intent, kind }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const { data: wilayas = [] } = useWilayas();
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => catalogService.categories(), staleTime: 300_000, enabled: kind === "professional" });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: catalogService.subjects, staleTime: 300_000, enabled: kind === "teacher" });
  if (!intent) return null;
  const w = wilayas.find((x) => x.code === intent.wilaya_code);
  const when = intent.when || {};
  return (
    <Card style={{ gap: 8 }} testID="intent-chips">
      <Row gap={6}><Sparkles size={14} color={BRAND.electric} /><Txt variant="tiny" weight={700} muted>{t("match.understood")}</Txt></Row>
      <Row gap={6} wrap>
        {intent.category_key && <IChip icon={Tag}>{loc(cats.data?.find((x) => x.key === intent.category_key)) || intent.category_key}</IChip>}
        {intent.subject_key && <IChip icon={Tag}>{loc(subjects.data?.find((x) => x.key === intent.subject_key)) || intent.subject_key}{intent.grade ? ` · ${intent.grade}` : ""}</IChip>}
        {(w || intent.commune) && <IChip icon={MapPin}>{[intent.commune, loc(w)].filter(Boolean).join(", ")}</IChip>}
        {intent.urgency === "high" && <IChip icon={AlarmClock}>{t("match.urgent")}</IChip>}
        {(when.day || when.slot) && <IChip icon={CalendarDays}>{[when.day && t(`match.days.${when.day}`), when.slot && t(`onboarding.slots.${when.slot}`)].filter(Boolean).join(" · ")}</IChip>}
        {intent.mode && <IChip icon={MonitorSmartphone}>{t(`onboarding.formats.${intent.mode}`)}</IChip>}
      </Row>
      {intent.missing?.length > 0 && (
        <Row gap={6} style={{ alignItems: "flex-start" }}><TriangleAlert size={14} color={BRAND.orange} /><Txt variant="tiny" color={BRAND.orange} style={{ flex: 1 }}>
          {t("match.missing", { fields: intent.missing.map((f) => t(`match.fields.${f}`)).join(", ") })}</Txt></Row>
      )}
    </Card>
  );
}

export const UPCOMING = [
  { key: "voice", icon: Mic, color: BRAND.orange }, { key: "vision", icon: Camera, color: BRAND.pink },
  { key: "edu_ai", icon: GraduationCap, color: BRAND.violet }, { key: "pro_ai", icon: Sparkles, color: BRAND.electric },
  { key: "passport", icon: QrCode, color: BRAND.pink },
];

/** Roadmap innovations: shown as "coming soon" only (feature flags off, no behaviour). */
export function Upcoming({ keys }) {
  const { t } = useI18n();
  const items = keys ? UPCOMING.filter((u) => keys.includes(u.key)) : UPCOMING;
  return (
    <View style={{ gap: 10 }}>
      {items.map(({ key, icon: Icon, color }) => (
        <Card key={key} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ width: 44, height: 44, borderRadius: RADIUS - 2, backgroundColor: alpha(color, 0.15), alignItems: "center", justifyContent: "center" }}><Icon size={22} color={color} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Row gap={8} wrap><Txt weight={800}>{t(`upcoming.${key}.title`)}</Txt><Pill label={t("upcoming.soon")} color={BRAND.orange} /></Row>
            <Txt variant="small" muted>{t(`upcoming.${key}.text`)}</Txt>
          </View>
        </Card>
      ))}
    </View>
  );
}
