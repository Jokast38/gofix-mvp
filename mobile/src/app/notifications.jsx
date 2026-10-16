import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react-native";
import { socialService } from "@/api/services";
import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { alpha, BRAND, useTheme } from "@/theme";
import { Empty, Loading, Screen, TopBar, Txt } from "@/ui";

// Web links from notifications -> app routes (same paths except a few web-only pages).
const toRoute = (link) => (!link ? "/(tabs)/account" : link.startsWith("/account/billing") ? "/billing" : link.startsWith("/account") ? "/(tabs)/account" : link);

export default function Notifications() {
  const { c } = useTheme();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["notifications"], queryFn: socialService.notifications });
  useEffect(() => () => { socialService.readAll().then(() => qc.invalidateQueries({ queryKey: ["notifications"] })).catch(() => {}); }, [qc]);
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching} padded={false}>
      <TopBar title={t("notif.title")} />
      {isLoading ? <Loading /> : !data?.items?.length ? <Empty icon={Bell} text={t("notif.empty")} /> : data.items.map((n) => (
        <Pressable key={n.id} onPress={() => router.push(toRoute(n.link))} accessibilityRole="button"
          style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border, backgroundColor: n.read ? "transparent" : alpha(BRAND.electric, 0.07) }, pressed && { opacity: 0.7 }]}>
          <View style={{ gap: 2 }}>
            <Txt weight={700}>{n.title}</Txt>
            <Txt variant="small" muted numberOfLines={3}>{n.body}</Txt>
            <Txt variant="tiny" muted>{formatDateTime(n.created_at)}</Txt>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
