import { Pressable, View } from "react-native";
import { router, Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { House, LayoutDashboard, MessageCircle, Plus, Search, UserRound } from "lucide-react-native";
import { socialService } from "@/api/services";
import { isProvider, useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { BRAND, useTheme } from "@/theme";
import { TourTarget } from "@/components/tour";

function CenterButton() {
  const { user } = useAuth();
  const { t } = useI18n();
  const provider = isProvider(user);
  const go = () => router.push(!user ? "/login" : provider ? "/dashboard" : "/requests?new=1");
  const Icon = provider ? LayoutDashboard : Plus;
  return (
    <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={provider ? t("tabs.pro") : t("tabs.publish")} testID="tab-center"
      style={{ top: -14, alignItems: "center", justifyContent: "center", width: 64 }}>
      <LinearGradient colors={BRAND.gradient} locations={BRAND.gradientStops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", shadowColor: BRAND.pink, shadowOpacity: 0.5, shadowRadius: 12, elevation: 6 }}>
        <Icon size={24} color={BRAND.night} strokeWidth={2.4} />
      </LinearGradient>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const unread = useQuery({ queryKey: ["conversations"], queryFn: socialService.conversations, enabled: Boolean(user), refetchInterval: 30_000 });
  const unreadCount = (unread.data?.items || []).reduce((n, x) => n + (x.unread || 0), 0);
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: BRAND.electric, tabBarInactiveTintColor: c.muted,
      tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, minHeight: 64, paddingTop: 6 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarIcon: ({ color }) => <House size={22} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: t("tabs.search"), tabBarIcon: ({ color }) => <Search size={22} color={color} /> }} />
      <Tabs.Screen name="publish" options={{ title: "", tabBarButton: () => <View style={{ flex: 1, alignItems: "center" }}><TourTarget id="tab-center"><CenterButton /></TourTarget></View> }} />
      <Tabs.Screen name="messages" options={{ title: t("tabs.messages"), tabBarBadge: unreadCount || undefined, tabBarBadgeStyle: { backgroundColor: BRAND.pink, color: BRAND.night },
        tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: t("tabs.account"), tabBarIcon: ({ color }) => <UserRound size={22} color={color} /> }} />
    </Tabs>
  );
}
