import { View } from "react-native";
import { BadgeCheck, ShieldCheck, Star } from "lucide-react-native";
import { useI18n, useLocalized } from "@/i18n";
import { formatDate } from "@/lib/format";
import { alpha, BRAND, useTheme } from "@/theme";
import { Avatar, Card, Row, Txt } from "@/ui";

function Badge({ ok, label, color = BRAND.electric, icon: Icon = BadgeCheck }) {
  const { c } = useTheme();
  return (
    <Row gap={4} style={{ borderWidth: 1, borderColor: ok ? alpha(color, 0.6) : c.border, backgroundColor: ok ? alpha(color, 0.12) : "transparent",
      borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      {ok ? <Icon size={13} color={color} /> : null}
      <Txt variant="tiny" weight={700} muted={!ok}>{label}</Txt>
    </Row>
  );
}

/** Public passport content (also the pro's preview): only what the API's allow-list returns. */
export function PassportCard({ data }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const loc = useLocalized();
  const trade = data.trade ? loc(data.trade) : (data.subjects || []).map((s) => loc(s)).join(", ");
  return (
    <Card style={{ gap: 12 }} testID="passport-card">
      <Row gap={12}>
        <Avatar thumbKey={data.photo_thumb_key} name={data.name} size={64} />
        <View style={{ flex: 1 }}>
          <Txt variant="h3" auto numberOfLines={1}>{data.name}</Txt>
          <Txt weight={700} color={BRAND.electric} numberOfLines={1}>{trade}</Txt>
          {data.wilayas?.length ? <Txt variant="tiny" muted numberOfLines={1}>{data.wilayas.map((w) => loc(w)).join(", ")}</Txt> : null}
        </View>
      </Row>
      <Row gap={6} wrap>
        <Badge ok={data.identity_verified} label={t(data.identity_verified ? "passport.public.identity" : "passport.public.identityNo")} />
        {data.profile_verified ? <Badge ok label={t("passport.public.profileVerified")} /> : null}
        {data.trust_score != null ? <Badge ok icon={ShieldCheck} color={BRAND.violet} label={`${t("passport.public.trust")} ⁦${data.trust_score}/100⁩`} /> : null}
        {data.rating ? <Badge ok icon={Star} color={BRAND.orange} label={`⁦${t("passport.public.rating", { avg: data.rating.avg, n: data.rating.count })}⁩`} /> : null}
      </Row>
      {data.skills?.length ? (
        <View style={{ gap: 6 }}>
          <Txt weight={800}>{t("passport.public.skills")}</Txt>
          {data.skills.map((s) => (
            <Row key={s.label} style={{ justifyContent: "space-between", borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Txt variant="small" auto style={{ flex: 1 }}>{s.label}</Txt>
              <Txt variant="tiny" weight={700} color={s.verified ? BRAND.electric : undefined} muted={!s.verified}>{t(s.verified ? "passport.verified" : "passport.declared")}</Txt>
            </Row>
          ))}
        </View>
      ) : null}
      {data.credentials?.length ? (
        <View style={{ gap: 6 }}>
          <Txt weight={800}>{t("passport.public.credentials")}</Txt>
          <Row gap={6} wrap>{data.credentials.map((x) => <Badge key={x.type} ok={x.verified} label={`${t(`passport.creds.${x.type}`)} · ${t(x.verified ? "passport.verified" : "passport.declared")}`} />)}</Row>
        </View>
      ) : null}
      <Txt variant="tiny" muted>{t("passport.public.legend")}</Txt>
      <Txt variant="tiny" muted>
        {data.member_since ? t("passport.public.memberSince", { date: formatDate(data.member_since) }) : ""}
        {data.updated_at ? ` · ${t("passport.public.updated", { date: formatDate(data.updated_at) })}` : ""}
      </Txt>
    </Card>
  );
}
