import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpen, Cake, Camera, Car, ChefHat, Droplets, Globe, Lock, Mic, Package, Rocket, Scissors, Search, ShoppingBasket, Target, Wrench, Zap } from "lucide-react-native";
import { catalogService, socialService } from "@/api/services";
import { Upcoming } from "@/components/catalog";
import { isProvider, useAuth } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { alpha, BRAND, neonFor, useTheme } from "@/theme";
import { Card, IconBtn, Row, Screen, Section, Txt, useToast } from "@/ui";
import { LanguageFlags } from "@/ui/Flags";
import { TourTarget, useScreenTour } from "@/components/tour";
import { BannerSlot, GoFixSeries, Highlights } from "@/components/promo";

const logo = require("../../../assets/brand/gofix-logo.png");
// Explicit imports keep the bundle small (no "import *" of the whole icon set).
const ICONS = { droplets: Droplets, zap: Zap, scissors: Scissors, lock: Lock, car: Car, cake: Cake, "shopping-basket": ShoppingBasket,
  package: Package, "book-open": BookOpen, globe: Globe, "chef-hat": ChefHat, target: Target, wrench: Wrench };

function Tile({ cat, index, onPress }) {
  const { c } = useTheme();
  const loc = useLocalized();
  const color = neonFor(index);
  const Icon = ICONS[cat.icon] || Wrench;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={loc(cat)} testID={`tile-${cat.key}`}
      style={({ pressed }) => [{ width: "23%", aspectRatio: 0.92, borderRadius: 16, borderWidth: 1, borderColor: alpha(color, 0.55),
        backgroundColor: c.card, alignItems: "center", justifyContent: "center", gap: 6, padding: 4 }, pressed && { opacity: 0.8 }]}>
      <Icon size={24} color={color} strokeWidth={1.6} />
      <Txt variant="tiny" weight={700} center numberOfLines={2}>{loc(cat)}</Txt>
    </Pressable>
  );
}

export default function Home() {
  useScreenTour("appWelcome");
  const { c } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const services = useQuery({ queryKey: ["home-cats", "services"], queryFn: () => catalogService.categories({ home_section: "services" }), staleTime: 300_000 });
  const academy = useQuery({ queryKey: ["home-cats", "academy"], queryFn: () => catalogService.categories({ home_section: "academy" }), staleTime: 300_000 });
  const notif = useQuery({ queryKey: ["notifications"], queryFn: socialService.notifications, enabled: Boolean(user), refetchInterval: 60_000 });
  const go = () => q.trim() && router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  const provider = isProvider(user);

  return (
    <Screen onRefresh={() => { services.refetch(); academy.refetch(); }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Image source={logo} style={{ width: 96, height: 46 }} contentFit="contain" accessibilityLabel="GoFix" />
        <View style={{ flex: 1 }} />
        <TourTarget id="home-flags"><LanguageFlags compact /></TourTarget>
        <View style={{ width: 6 }} />
        {user ? (
          <IconBtn onPress={() => router.push("/notifications")} label={t("notif.title")} badge={notif.data?.unread}><Bell size={22} color={c.text} /></IconBtn>
        ) : (
          <Pressable onPress={() => router.push("/login")} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.primary, justifyContent: "center" }}>
            <Txt weight={700} color={c.onPrimary}>{t("nav.login")}</Txt>
          </Pressable>
        )}
      </Row>
      <Txt variant="small" muted style={{ marginTop: 6 }}>{user ? t("appHome.hello", { name: user.full_name.split(" ")[0] }) : t("home.subtitle")}</Txt>

      <TourTarget id="home-search">
      <Row style={{ marginTop: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 999, paddingStart: 14, paddingEnd: 4, minHeight: 52 }}>
        <Search size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={go} returnKeyType="search" placeholder={t("match.placeholder")} placeholderTextColor={c.muted}
          style={{ flex: 1, color: c.text, fontSize: 15, marginHorizontal: 8, minHeight: 48 }} testID="home-search" accessibilityLabel={t("home.searchBtn")} />
        <IconBtn onPress={() => toast(t("upcoming.toast.voice"))} label={t("upcoming.voice.title")}><Mic size={20} color={c.muted} /></IconBtn>
        <IconBtn onPress={() => toast(t("upcoming.toast.vision"))} label={t("upcoming.vision.title")}><Camera size={20} color={c.muted} /></IconBtn>
      </Row>
      </TourTarget>

      <Section title={t("appHome.services")} right={<Pressable onPress={() => router.push("/search")} style={{ minHeight: 44, justifyContent: "center" }}><Txt variant="small" muted>{t("common.seeAll")} ›</Txt></Pressable>}>
        <TourTarget id="home-tiles" style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
          {(services.data || []).slice(0, 8).map((cat, i) => <Tile key={cat.key} cat={cat} index={i} onPress={() => router.push(`/search?category_key=${cat.key}`)} />)}
        </TourTarget>
      </Section>
      <BannerSlot placement="home" />
      <Section title={t("appHome.academy")} right={<Pressable onPress={() => router.push("/academy")} style={{ minHeight: 44, justifyContent: "center" }}><Txt variant="small" muted>{t("common.seeAll")} ›</Txt></Pressable>}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
          {(academy.data || []).slice(0, 4).map((cat, i) => <Tile key={cat.key} cat={cat} index={i + 1} onPress={() => router.push(cat.key === "private_tutoring" ? "/academy" : `/search?category_key=${cat.key}`)} />)}
        </View>
      </Section>

      <Highlights />

      <Card glow style={{ marginTop: 22, flexDirection: "row", gap: 12, alignItems: "center" }} onPress={() => router.push(provider ? "/dashboard" : "/onboarding")} testID="talent-banner">
        <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: alpha(BRAND.pink, 0.15), alignItems: "center", justifyContent: "center" }}><Rocket size={24} color={BRAND.pink} /></View>
        <View style={{ flex: 1 }}>
          <Txt weight={800}>{provider ? t("appHome.myActivity") : t("appHome.talentTitle")}</Txt>
          <Txt variant="tiny" muted>{provider ? t("appHome.myActivityText") : t("appHome.talentText")}</Txt>
        </View>
      </Card>

      <GoFixSeries />
      <Section title={t("upcoming.title")}><Txt variant="small" muted style={{ marginBottom: 10 }}>{t("upcoming.subtitle")}</Txt><Upcoming /></Section>
    </Screen>
  );
}
