import { useState } from "react";
import { Linking, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Flag, Heart, Lock, MessageCircle, Phone, Send, Sparkles, Star } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { catalogService, socialService } from "@/api/services";
import { useAuth } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { formatDA, formatDate, formatPhone } from "@/lib/format";
import { alpha, BRAND, useTheme } from "@/theme";
import { Avatar, Btn, Card, Cover, Empty, IconBtn, Input, Loading, Pill, Row, Screen, Section, Sheet, TopBar, Txt, useToast } from "@/ui";
import { ReportSheet, RequestSheet } from "./actions";
import { Rating, TrustBadge, TrustSubscores } from "./catalog";

const DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

function Stat({ label, value }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, alignItems: "center", backgroundColor: c.card }}>
      <Txt weight={800} center numberOfLines={1}>{value}</Txt>
      <Txt variant="tiny" muted center numberOfLines={2}>{label}</Txt>
    </View>
  );
}

function MessageSheet({ visible, onClose, kind, profileId, name }) {
  const { t, te } = useI18n();
  const toast = useToast();
  const [body, setBody] = useState("");
  const send = async () => {
    try {
      const conv = await socialService.start(kind, profileId, body.trim());
      onClose();
      router.push(`/messages/${conv.id}`);
    } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("messages.startTitle", { name })}>
      <Input multiline value={body} onChangeText={setBody} maxLength={2000} placeholder={t("messages.placeholder")} />
      <Btn variant="gradient" icon={Send} title={t("messages.send")} disabled={!body.trim()} onPress={send} style={{ marginTop: 12 }} />
    </Sheet>
  );
}

export function ProfileScreen({ kind }) {
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const { t, te } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const teacher = kind === "teacher";
  const [sheet, setSheet] = useState(null);
  const q = useQuery({ queryKey: [kind, id, Boolean(user)], queryFn: () => (teacher ? catalogService.teacher(id) : catalogService.pro(id)) });
  const favs = useQuery({ queryKey: ["favorites"], queryFn: socialService.favorites, enabled: Boolean(user) });
  const p = q.data;
  if (q.isLoading) return <Screen><TopBar title="" /><Loading /></Screen>;
  if (!p) return <Screen><TopBar title="" /><Empty text={t("notFound.title")} /></Screen>;

  const color = teacher ? BRAND.electric : BRAND.pink;
  const price = teacher ? p.price_hint_da_hour : p.price_hint_da;
  const isFav = favs.data?.ids?.includes(p.id);
  const toggleFav = async () => {
    try {
      if (isFav) await socialService.removeFavorite(p.id); else await socialService.addFavorite(kind, p.id);
      qc.invalidateQueries({ queryKey: ["favorites"] });
      toast(isFav ? t("favorites.removed") : t("favorites.added"));
    } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  const defaults = teacher ? { subject_key: p.subjects?.[0]?.subject_key } : { category_key: p.category_key };
  const slots = p.availability?.slots || [];

  return (
    <Screen padded={false} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <TopBar title={p.blurred ? t("catalog.hiddenName") : p.display_name}
        right={user && !p.is_owner && !p.blurred ? <IconBtn onPress={toggleFav} label={isFav ? t("favorites.remove") : t("favorites.add")} testID="fav">
          <Heart size={22} color={isFav ? BRAND.pink : c.text} fill={isFav ? BRAND.pink : "transparent"} /></IconBtn> : null} />
      <Cover coverKey={p.cover_key} thumbKey={p.cover_thumb_key} blurred={p.blurred} color={color} height={160} large />
      <View style={{ paddingHorizontal: 16, marginTop: -44 }}>
        <Row gap={12} style={{ alignItems: "flex-end" }}>
          <Avatar photoKey={p.photo_key} thumbKey={p.photo_thumb_key} name={p.display_name} blurred={p.blurred} size={88} color={color} ring large />
          <View style={{ flex: 1, paddingBottom: 4 }}>
            {p.blurred ? <Row gap={6}><Lock size={16} color={c.muted} /><Txt weight={800} muted>{t("catalog.hiddenName")}</Txt></Row>
              : <Row gap={6}><Txt variant="h2" numberOfLines={2} style={{ flexShrink: 1 }}>{p.display_name}</Txt>{p.verification_status === "verified" && <BadgeCheck size={20} color={BRAND.electric} />}</Row>}
            <Txt variant="small" weight={700} color={color}>{teacher ? t("onboarding.teacher.title") : `${loc(p.category)}${p.role ? ` · ${loc(p.role)}` : ""}`}</Txt>
          </View>
        </Row>
        <Txt variant="tiny" muted style={{ marginTop: 8 }}>{(p.wilayas || []).map((w) => `${loc(w)}${w.communes?.length ? ` (${w.communes.join(", ")})` : ""}`).join(" · ") || t("onboarding.formats.online")}</Txt>
        <Row gap={8} wrap style={{ marginTop: 8 }}>
          <Rating avg={p.rating_avg} count={p.rating_count} bucket={p.rating_bucket} />
          <Pill label={p.verification_status === "verified" ? t("catalog.verified") : t("catalog.unverified")} color={p.verification_status === "verified" ? BRAND.electric : BRAND.orange} />
          <TrustBadge status={p.trust_status} score={p.trust_score} />
        </Row>

        {p.quota_exceeded && (
          <Card style={{ marginTop: 12, borderColor: alpha(BRAND.orange, 0.6) }}>
            <Txt variant="small">{t("catalog.quotaExceeded", { limit: p.views_limit })}</Txt>
            <Btn small variant="gradient" title={t("catalog.upgrade")} onPress={() => router.push("/pricing")} style={{ marginTop: 8 }} />
          </Card>
        )}

        <Row gap={8} style={{ marginTop: 16 }}>
          <Stat label={t("catalog.experience")} value={p.experience_years != null ? `${p.experience_years} ${t("catalog.years")}` : "—"} />
          <Stat label={t("catalog.trust")} value={p.trust_score != null ? `${p.trust_score}/100` : p.trust_status ? t(`trust.status.${p.trust_status}`) : "—"} />
          <Stat label={teacher ? t("catalog.perHour") : t("catalog.from")} value={price != null ? formatDA(price) : p.blurred ? "—" : t("onboarding.onQuote")} />
        </Row>
        {p.trust_subscores && <Section title={t("trust.subsTitle")}><TrustSubscores subscores={p.trust_subscores} /><Txt variant="tiny" muted style={{ marginTop: 6 }}>{t("trust.disclaimerShort")}</Txt></Section>}

        <Section title={t("catalog.about")}>
          {p.blurred ? <Card><Row gap={8}><Lock size={16} color={c.muted} /><Txt variant="small" muted style={{ flex: 1 }}>{user ? t("catalog.blurNoticeFree") : t("catalog.blurNotice")}</Txt></Row></Card>
            : <Txt auto>{p.bio}</Txt>}
        </Section>

        {teacher ? (
          <Section title={t("onboarding.subjects")}>
            {(p.subjects_full || []).map((s) => (
              <View key={s.key} style={{ marginBottom: 8 }}>
                <Row gap={8} wrap>
                  <Txt weight={700}>{loc(s)}</Txt>
                  {s.rating?.count > 0 && <Row gap={3}><Star size={12} color={BRAND.orange} fill={BRAND.orange} /><Txt variant="tiny" weight={700} color={BRAND.orange}>{s.rating.avg} ({s.rating.count})</Txt></Row>}
                </Row>
                <Row gap={6} wrap style={{ marginTop: 4 }}>{s.levels.map((l) => <Pill key={l.key} label={loc(l)} color={BRAND.orange} />)}</Row>
              </View>
            ))}
            <Row gap={6} wrap>{(p.formats || []).map((f) => <Pill key={f} label={t(`onboarding.formats.${f}`)} color={BRAND.pink} />)}</Row>
          </Section>
        ) : p.specialties?.length > 0 && (
          <Section title={t("onboarding.specialties")}><Row gap={6} wrap>{p.specialties.map((s) => <Pill key={s.key} label={loc(s)} color={BRAND.violet} />)}</Row></Section>
        )}

        {!p.blurred && slots.length > 0 && (
          <Section title={t("onboarding.availability")}>
            <Row gap={6} wrap>{DAYS.filter((d) => slots.some((s) => s.day === d)).map((d) => (
              <Pill key={d} color={BRAND.violet} label={`${t(`onboarding.days.${d}`)} · ${slots.filter((s) => s.day === d).map((s) => t(`onboarding.slots.${s.slot}`)).join(", ")}`} />
            ))}</Row>
          </Section>
        )}

        {!p.blurred && (
          <Section title={t("catalog.reviews")}>
            {!p.reviews?.length ? <Txt variant="small" muted>{t("catalog.noReviews")}</Txt> : p.reviews.map((r) => (
              <Card key={r.id} style={{ marginBottom: 8 }}>
                <Row style={{ justifyContent: "space-between" }}><Txt variant="small" weight={700}>{r.author}</Txt>
                  <Row gap={3}><Star size={12} color={BRAND.orange} fill={BRAND.orange} /><Txt variant="tiny" weight={700} color={BRAND.orange}>{r.rating}/5</Txt></Row></Row>
                {r.subject_key && <Txt variant="tiny" color={BRAND.electric}>{loc(p.subjects_full?.find((s) => s.key === r.subject_key)) || r.subject_key}</Txt>}
                {r.comment ? <Txt variant="small" auto style={{ marginTop: 4 }}>{r.comment}</Txt> : null}
                <Txt variant="tiny" muted style={{ marginTop: 4 }}>{formatDate(r.created_at)}</Txt>
              </Card>
            ))}
          </Section>
        )}

        <View style={{ gap: 10, marginTop: 22, marginBottom: 32 }}>
          {p.phone && <Btn variant="outline" icon={Phone} title={formatPhone(p.phone)} onPress={() => Linking.openURL(`tel:${p.phone}`)} testID="call" />}
          {p.is_owner ? <Btn title={t("dashboard.title")} onPress={() => router.push("/dashboard")} />
            : !user ? <Btn variant="gradient" icon={Lock} title={t("catalog.loginToUnlock")} onPress={() => router.push("/login")} testID="login-unlock" />
              : p.blurred ? (
                <>
                  <Btn variant="gradient" icon={Sparkles} title={t("catalog.unlock")} onPress={() => router.push("/pricing")} testID="unlock" />
                  {p.can_request && <Btn variant="outline" icon={Send} title={t("catalog.publishRequest")} onPress={() => setSheet("open")} />}
                </>
              ) : (
                <>
                  {p.can_request && <Btn variant="gradient" icon={Send} title={t("catalog.sendRequest")} onPress={() => setSheet("request")} testID="send-request" />}
                  {p.can_contact && <Btn variant="outline" icon={MessageCircle} title={t("catalog.message")} onPress={() => setSheet("message")} testID="send-message" />}
                </>
              )}
          {user && !p.is_owner && <Btn variant="ghost" small icon={Flag} title={t("report.button")} onPress={() => setSheet("report")} />}
        </View>
      </View>
      <RequestSheet visible={sheet === "request"} onClose={() => setSheet(null)} kind={kind} profileIds={[p.id]} defaults={defaults} recipientLabel={p.display_name} />
      <RequestSheet visible={sheet === "open"} onClose={() => setSheet(null)} kind={kind} defaults={{ ...defaults, wilaya_code: p.wilayas?.[0]?.code }} />
      <MessageSheet visible={sheet === "message"} onClose={() => setSheet(null)} kind={kind} profileId={p.id} name={p.display_name} />
      <ReportSheet visible={sheet === "report"} onClose={() => setSheet(null)} targetType={kind} targetId={p.id} />
    </Screen>
  );
}
