import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react-native";
import { jobService } from "@/api/services";
import { JobCard } from "@/components/actions";
import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { Btn, Card, Empty, Loading, Row, Screen, Section, TopBar, Txt } from "@/ui";

export default function JobDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["jobs", "one", id], queryFn: () => jobService.get(id) });
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <TopBar title={t("jobs.title")} />
      {isLoading ? <Loading /> : !data ? <Empty text={t("notFound.title")} /> : (
        <View style={{ gap: 12, marginTop: 12 }}>
          <JobCard job={data} compact />
          <Btn variant="outline" icon={MessageCircle} title={t("requests.openConversation")} onPress={() => router.push(`/messages/${data.conversation_id}`)} />
          {data.history?.length > 0 && (
            <Section title={t("jobs.history")}>
              <Card style={{ gap: 8 }}>
                {data.history.map((h, i) => (
                  <Row key={i} style={{ justifyContent: "space-between", alignItems: "flex-start" }} gap={8}>
                    <Txt variant="small" style={{ flex: 1 }}>{t(`jobs.status.${h.status}`)}{h.reason ? ` — ${h.reason}` : ""}</Txt>
                    <Txt variant="tiny" muted>{t(`jobs.by.${h.by}`)} · {formatDateTime(h.at)}</Txt>
                  </Row>
                ))}
              </Card>
            </Section>
          )}
        </View>
      )}
    </Screen>
  );
}
