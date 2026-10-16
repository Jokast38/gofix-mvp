import { useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Search } from "lucide-react-native";
import { socialService } from "@/api/services";
import { useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { daysAgo, formatDate, formatTime } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { Avatar, Btn, Empty, Loading, Row, Screen, Txt } from "@/ui";

export default function Messages() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["conversations"], queryFn: socialService.conversations, enabled: Boolean(user), refetchInterval: 20_000 });
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = data?.items || [];
    return s ? all.filter((x) => `${x.other.name} ${x.last_message?.body || ""}`.toLowerCase().includes(s)) : all;
  }, [data, q]);
  const when = (d) => (daysAgo(d) <= 0 ? formatTime(d) : daysAgo(d) === 1 ? t("messages.yesterday") : formatDate(d));

  if (!user) return <Screen><Txt variant="h1">{t("messages.title")}</Txt><Empty icon={MessageCircle} text={t("catalog.blurNotice")} action={<Btn title={t("nav.login")} onPress={() => router.push("/login")} />} /></Screen>;
  return (
    <Screen scroll={false} padded={false}>
      <Txt variant="h1" style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>{t("messages.title")}</Txt>
      {data?.items?.length > 0 && (
        <Row style={{ marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: c.input, borderRadius: 999, paddingHorizontal: 14, backgroundColor: c.cardAlt }}>
          <Search size={16} color={c.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder={t("messages.search")} placeholderTextColor={c.muted} style={{ flex: 1, minHeight: 44, color: c.text, marginHorizontal: 8 }} />
        </Row>
      )}
      <FlatList data={items} keyExtractor={(x) => x.id} refreshing={isRefetching} onRefresh={refetch}
        ListEmptyComponent={isLoading ? <Loading /> : <Empty icon={MessageCircle} text={q ? t("messages.noResults") : t("messages.empty")}
          action={!q && <Btn small variant="gradient" title={t("catalog.publishRequest")} onPress={() => router.push("/requests?new=1")} />} />}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border, marginStart: 76 }} />}
        renderItem={({ item }) => {
          const unread = item.unread > 0;
          const mine = item.last_message && item.last_message.sender_id !== item.other.id;
          return (
            <Pressable onPress={() => router.push(`/messages/${item.id}`)} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 76, paddingVertical: 10 }, pressed && { backgroundColor: c.cardAlt }]}
              accessibilityRole="button" testID={`conv-${item.id}`}>
              <Avatar thumbKey={item.other.photo_thumb_key} name={item.other.name} size={48} color={item.role === "provider" ? BRAND.orange : BRAND.electric} />
              <View style={{ flex: 1, gap: 1 }}>
                <Row style={{ justifyContent: "space-between" }} gap={8}>
                  <Txt weight={unread ? 800 : 700} numberOfLines={1} style={{ flex: 1 }}>{item.other.name}</Txt>
                  <Txt variant="tiny" color={unread ? BRAND.electric : c.muted} weight={unread ? 700 : 400}>{item.last_message?.at ? when(item.last_message.at) : ""}</Txt>
                </Row>
                <Txt variant="tiny" muted>{item.role === "provider" ? t("messages.roles.client") : t(`messages.roles.${item.kind === "teacher" ? "teacher" : "professional"}`)}</Txt>
                <Row gap={8}>
                  <Txt variant="small" numberOfLines={1} color={unread ? c.text : c.muted} weight={unread ? 700 : 400} style={{ flex: 1 }}>
                    {mine ? `${t("messages.you")} : ` : ""}{item.last_message?.body || "…"}
                  </Txt>
                  {unread && <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: BRAND.pink, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                    <Txt variant="tiny" weight={800} color={BRAND.night}>{item.unread > 99 ? "99+" : item.unread}</Txt></View>}
                </Row>
              </View>
            </Pressable>
          );
        }} />
    </Screen>
  );
}
