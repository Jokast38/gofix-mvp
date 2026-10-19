// Promotion blocks of the app (same data as the web): sponsored banners, "Fixeur du mois" / best pros, "Série GoFix" (YouTube)
// and the social networks. Everything is set by the super-admin in the web back-office (Communication / Bannières pub).
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { BadgeCheck, Crown, MapPin, Medal, Play, Star, Trophy } from "lucide-react-native";
import { API_ORIGIN, fileUrl } from "@/api/client";
import { promoService } from "@/api/services";
import { useConfig } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { alpha, BRAND, neonFor, useTheme } from "@/theme";
import { Avatar, Row, Section, Txt, useToast } from "@/ui";

const SOCIAL_KEYS = ["facebook", "instagram", "tiktok", "youtube", "linkedin", "x"];
const ROTATE_MS = 7000;

export function youtubeId(url = "") {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// ---------- Brand marks: official logos (Font Awesome 6 Brands, bundled with Expo) ----------
const MARKS = { facebook: ["facebook", "#1877F2"], instagram: ["instagram", "#E1306C"], tiktok: ["tiktok", null],
  youtube: ["youtube", "#FF0000"], linkedin: ["linkedin", "#0A66C2"], x: ["x-twitter", null] };

export function BrandMark({ name, size = 20 }) {
  const { c } = useTheme();
  const [icon, color] = MARKS[name];
  return <FontAwesome6 brand name={icon} size={size} color={color || c.text} />;
}

/** GoFix social networks (Admin → Communication). All six logos are shown; one without a link yet is greyed out ("Bientôt"). */
export function SocialLinks({ style }) {
  const { t } = useI18n();
  const { c } = useTheme();
  const toast = useToast();
  const { settings = {} } = useConfig();
  return (
    <Section title={t("promo.followUs")} style={style}>
      <Row gap={8} wrap>
        {SOCIAL_KEYS.map((k) => {
          const url = settings[`social_${k}_url`];
          const label = t(`promo.social.${k}`);
          return (
            <Pressable key={k} onPress={() => (url ? Linking.openURL(url) : toast(`${label} – ${t("upcoming.soon")}`))}
              accessibilityRole={url ? "link" : "button"} accessibilityLabel={url ? label : `${label} – ${t("upcoming.soon")}`}
              accessibilityState={{ disabled: !url }} testID={url ? `social-${k}` : `social-${k}-soon`}
              style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.card,
                alignItems: "center", justifyContent: "center", opacity: url ? 1 : 0.6 }, pressed && { opacity: 0.6 }]}>
              <BrandMark name={k} size={20} />
            </Pressable>
          );
        })}
      </Row>
    </Section>
  );
}

// ---------- Sponsored banners ----------
/** Banners of a placement ("home", "search"). Always labelled "Sponsorisé"; GoFix pages open in the app, brand sites in the browser. */
export function BannerSlot({ placement = "home", style }) {
  const { t } = useI18n();
  const { c } = useTheme();
  const { data = [] } = useQuery({ queryKey: ["promos", placement], queryFn: () => promoService.banners(placement), staleTime: 5 * 60_000 });
  const [i, setI] = useState(0);
  useEffect(() => {
    if (data.length < 2) return undefined;
    const timer = setInterval(() => setI((x) => (x + 1) % data.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [data.length]);
  if (!data.length) return null;
  const b = data[i % data.length];
  const open = () => {
    if (b.internal_path) {
      promoService.countClick(b.id);
      router.push(b.internal_path);
    } else {
      Linking.openURL(`${API_ORIGIN}${b.click_url}`); // counted server-side, then redirected to the advertiser
    }
  };
  return (
    <View style={[{ marginTop: 20 }, style]} testID={`banner-slot-${placement}`}>
      <Pressable onPress={open} accessibilityRole="link" accessibilityLabel={`${t("promo.sponsored")} · ${b.alt}`} testID="banner-link"
        style={({ pressed }) => [{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.85 }]}>
        <Image source={{ uri: fileUrl(b.image_thumb_key || b.image_key) }} style={{ width: "100%", aspectRatio: 3 }} contentFit="cover" transition={250} />
        <View style={{ position: "absolute", top: 8, start: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Txt variant="tiny" weight={700} color="#FFFFFF">{`${t("promo.sponsored")} · ${b.advertiser}`}</Txt>
        </View>
      </Pressable>
      {data.length > 1 && (
        <Row gap={6} style={{ justifyContent: "center", marginTop: 6 }}>
          {data.map((x, k) => (
            <Pressable key={x.id} onPress={() => setI(k)} hitSlop={8} accessibilityLabel={t("promo.bannerN", { n: k + 1, total: data.length })}>
              <View style={{ height: 6, width: k === i % data.length ? 18 : 6, borderRadius: 3, backgroundColor: k === i % data.length ? BRAND.electric : c.border }} />
            </Pressable>
          ))}
        </Row>
      )}
    </View>
  );
}

// ---------- Fixeur du mois ----------
function monthLabel(period, lang) {
  const [y, m] = (period || "").split("-").map(Number);
  if (!y || !m) return "";
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-DZ" : "fr-FR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 15)));
  } catch {
    return `${String(m).padStart(2, "0")}/${y}`;
  }
}

function Stars({ avg, count, label }) {
  if (!count) return null;
  return (
    <Row gap={3}>
      <Star size={13} color={BRAND.orange} fill={BRAND.orange} />
      <Txt variant="tiny" weight={700} color={BRAND.orange}>{Number(avg).toFixed(1)}</Txt>
      <Txt variant="tiny" muted>({label || count})</Txt>
    </Row>
  );
}

function MiniCard({ p, index, rank }) {
  const { t } = useI18n();
  const { c } = useTheme();
  const loc = useLocalized();
  const name = p.display_name || loc(p.category);
  return (
    <Pressable onPress={() => router.push(`/pro/${p.id}`)} accessibilityRole="button" accessibilityLabel={name} testID="highlight-card"
      style={({ pressed }) => [{ width: 250, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1,
        borderColor: c.border, backgroundColor: c.card }, pressed && { opacity: 0.85 }]}>
      <View>
        <Avatar photoKey={p.photo_key} thumbKey={p.photo_thumb_key} name={name} size={46} color={neonFor(index)} />
        {rank ? (
          <View style={{ position: "absolute", top: -6, start: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND.pink, alignItems: "center", justifyContent: "center" }}>
            <Txt variant="tiny" weight={800} color="#FFFFFF">{rank}</Txt>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Row gap={4}>
          <Txt weight={700} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Txt>
          {p.verification_status === "verified" && <BadgeCheck size={14} color={BRAND.electric} />}
        </Row>
        <Txt variant="tiny" muted numberOfLines={1}>{[p.display_name ? loc(p.category) : "", p.wilaya ? loc(p.wilaya) : ""].filter(Boolean).join(" · ")}</Txt>
        <Stars avg={p.month?.avg ?? p.rating_avg} count={p.month?.count ?? p.rating_count} label={p.month ? t("promo.reviewsMonth", { n: p.month.count }) : null} />
      </View>
    </Pressable>
  );
}

function HRow({ title, icon: Icon, color, children }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Row gap={6} style={{ marginBottom: 10 }}><Icon size={16} color={color} /><Txt variant="small" weight={800} color={color}>{title}</Txt></Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingEnd: 16 }}>{children}</ScrollView>
    </View>
  );
}

/** "Fixeur du mois" + best of the month + best rated. */
export function Highlights() {
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const loc = useLocalized();
  const { data } = useQuery({ queryKey: ["highlights"], queryFn: promoService.highlights, staleTime: 10 * 60_000 });
  if (!data?.fixer && !data?.top_rated?.length) return null;
  const f = data.fixer;
  const month = monthLabel(data.period, lang);
  const fname = f && (f.display_name || loc(f.category));
  return (
    <View style={{ marginTop: 22 }} testID="highlights">
      {f && (
        <Pressable onPress={() => router.push(`/pro/${f.id}`)} accessibilityRole="button" accessibilityLabel={`${t("promo.fixerEyebrow", { month })} : ${fname}`} testID="fixer-of-month"
          style={({ pressed }) => [{ borderRadius: 18, borderWidth: 1.5, borderColor: alpha(BRAND.orange, 0.7), backgroundColor: c.card, padding: 14 }, pressed && { opacity: 0.9 }]}>
          <Row gap={6}><Trophy size={15} color={BRAND.orange} /><Txt variant="tiny" weight={800} color={BRAND.orange}>{t("promo.fixerEyebrow", { month }).toUpperCase()}</Txt></Row>
          <Row gap={12} style={{ marginTop: 10 }}>
            <View>
              <Avatar photoKey={f.photo_key} thumbKey={f.photo_thumb_key} name={fname} size={72} color={BRAND.orange} large ring />
              <View style={{ position: "absolute", bottom: -6, end: -6, width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND.orange, alignItems: "center", justifyContent: "center" }}>
                <Crown size={15} color={BRAND.night} />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Row gap={5}>
                <Txt variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{fname}</Txt>
                {f.verification_status === "verified" && <BadgeCheck size={18} color={BRAND.electric} />}
              </Row>
              <Row gap={4} wrap>
                {f.display_name ? <Txt variant="small" muted>{loc(f.category)}</Txt> : null}
                {f.wilaya ? <Row gap={2}><MapPin size={12} color={c.muted} /><Txt variant="small" muted>{loc(f.wilaya)}</Txt></Row> : null}
              </Row>
              {f.month && <Stars avg={f.month.avg} count={f.month.count} label={t("promo.reviewsMonth", { n: f.month.count })} />}
              <Stars avg={f.rating_avg} count={f.rating_count} label={t("promo.reviewsTotal", { n: f.rating_count })} />
            </View>
          </Row>
          <Txt variant="tiny" muted style={{ marginTop: 10 }}>{t(data.manual ? "promo.fixerManual" : "promo.fixerAuto")}</Txt>
        </Pressable>
      )}
      {data.best_of_month?.length > 0 && (
        <HRow title={t("promo.bestOfMonth", { month })} icon={Medal} color={BRAND.pink}>
          {data.best_of_month.map((p, i) => <MiniCard key={p.id} p={p} index={i} rank={i + 2} />)}
        </HRow>
      )}
      {data.top_rated?.length > 0 && (
        <HRow title={t("promo.topRated")} icon={Star} color={BRAND.electric}>
          {data.top_rated.map((p, i) => <MiniCard key={p.id} p={p} index={i + 3} />)}
        </HRow>
      )}
    </View>
  );
}

// ---------- Série GoFix (YouTube) ----------
/** Episodes open in the YouTube app / browser. Hidden while neither a channel nor an episode is set. */
export function GoFixSeries() {
  const { t } = useI18n();
  const { c } = useTheme();
  const { settings = {} } = useConfig();
  const channel = settings.social_youtube_url || "";
  const videos = (settings.youtube_videos || []).map((v) => ({ ...v, id: youtubeId(v.url) })).filter((v) => v.id);
  if (!channel && !videos.length) return null;
  return (
    <Section title={t("promo.seriesTitle")} testID="gofix-series"
      right={channel ? (
        <Pressable onPress={() => Linking.openURL(channel)} accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }} testID="series-channel">
          <Row gap={6}><BrandMark name="youtube" size={18} /><Txt variant="small" weight={700}>{t("promo.seriesChannel")}</Txt></Row>
        </Pressable>
      ) : null}>
      <Txt variant="small" muted style={{ marginBottom: 10 }}>{t("promo.seriesText")}</Txt>
      {videos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingEnd: 16 }}>
          {videos.map((v) => (
            <Pressable key={v.id + v.url} onPress={() => Linking.openURL(v.url)} accessibilityRole="link" accessibilityLabel={v.title || t("promo.seriesEpisode")} testID="series-video"
              style={({ pressed }) => [{ width: 240, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.card }, pressed && { opacity: 0.85 }]}>
              <View>
                <Image source={{ uri: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` }} style={{ width: "100%", aspectRatio: 16 / 9 }} contentFit="cover" />
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#FF0000", alignItems: "center", justifyContent: "center" }}>
                    <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                </View>
              </View>
              <Txt variant="small" weight={700} numberOfLines={2} style={{ padding: 10 }}>{v.title || t("promo.seriesEpisode")}</Txt>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Section>
  );
}
