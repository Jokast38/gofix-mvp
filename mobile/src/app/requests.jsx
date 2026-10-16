import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, MessageCircle, Plus } from "lucide-react-native";
import { catalogService, requestService } from "@/api/services";
import { RequestSheet } from "@/components/actions";
import { useAuth } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { Avatar, Btn, Card, Empty, IconBtn, Loading, Pill, Row, Screen, TopBar, Txt } from "@/ui";

const STATUS_COLOR = { sent: BRAND.violet, seen: BRAND.blue, accepted: BRAND.electric, refused: "#F87171" };

export default function Requests() {
  const { c } = useTheme();
  const { t } = useI18n();
  const loc = useLocalized();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (params.new === "1" && user) setOpen(true); }, [params.new, user]);
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["my-requests"], queryFn: requestService.mine, enabled: Boolean(user), refetchInterval: 30_000 });
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => catalogService.categories(), staleTime: 300_000 });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: catalogService.subjects, staleTime: 300_000 });
  if (user === false) return <Redirect href="/login" />;
  const label = (r) => (r.kind === "teacher" ? loc(subjects.data?.find((s) => s.key === r.subject_key)) : loc(cats.data?.find((x) => x.key === r.category_key))) || "—";
  const kind = user?.roles?.includes("student") ? "teacher" : "professional";

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching} padded={false}>
      <TopBar title={t("requests.title")} right={<IconBtn onPress={() => setOpen(true)} label={t("requests.new")} testID="requests-new"><Plus size={22} color={BRAND.pink} /></IconBtn>} />
      <View style={{ padding: 16, gap: 12 }}>
        <Txt variant="small" muted>{t("requests.subtitle")}</Txt>
        {isLoading ? <Loading /> : !data?.items?.length ? (
          <Empty icon={ClipboardList} text={t("requests.empty")} action={<Btn variant="gradient" title={t("requests.new")} onPress={() => setOpen(true)} />} />
        ) : data.items.map((r) => (
          <Card key={r.id} testID={`request-${r.id}`}>
            <Row style={{ justifyContent: "space-between" }}><Txt weight={800}>{label(r)}</Txt>{r.status === "closed" && <Txt variant="tiny" muted>{t("requests.closed")}</Txt>}</Row>
            <Txt variant="tiny" muted>{formatDateTime(r.created_at)} · {t(`requests.modes.${r.mode}`)}</Txt>
            <Txt variant="small" auto numberOfLines={3} style={{ marginTop: 6 }}>{r.message}</Txt>
            <View style={{ marginTop: 10, gap: 4 }}>
              {r.recipients.map((x, i) => (
                <Row key={x.profile_id} gap={10} style={{ minHeight: 48, borderTopWidth: 1, borderColor: c.border, paddingTop: 6 }}>
                  <Avatar thumbKey={x.photo_thumb_key} name={x.display_name} size={38} blurred={!x.display_name} />
                  <Txt variant="small" weight={600} numberOfLines={1} style={{ flex: 1 }}>{x.display_name || t("requests.hiddenProvider", { n: i + 1 })}</Txt>
                  <Pill label={t(`requests.status.${x.status}`)} color={STATUS_COLOR[x.status]} />
                  {x.status === "accepted" && x.conversation_id && <IconBtn onPress={() => router.push(`/messages/${x.conversation_id}`)} label={t("requests.openConversation")}><MessageCircle size={20} color={BRAND.electric} /></IconBtn>}
                </Row>
              ))}
            </View>
          </Card>
        ))}
        <Txt variant="tiny" muted center>{t("requests.reviewHint")} <Txt variant="tiny" color={BRAND.electric} onPress={() => router.push("/jobs")}>{t("jobs.title")}</Txt></Txt>
      </View>
      <RequestSheet visible={open} onClose={() => setOpen(false)} kind={kind} />
    </Screen>
  );
}
