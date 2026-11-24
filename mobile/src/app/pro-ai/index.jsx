import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { AgendaTab, AssistantTab, FollowupsTab, HomeTab, LeadsTab, QuotesTab, SettingsTab } from "@/components/proai";
import { useConfig } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { Card, Chip, Screen, TopBar, Txt } from "@/ui";

const PANES = { home: HomeTab, leads: LeadsTab, quotes: QuotesTab, followups: FollowupsTab, agenda: AgendaTab, assistant: AssistantTab, settings: SettingsTab };

/** GOFIX PRO AI: the pro's commercial space (requests, quotes, follow-ups, calendar, figures, writing assistant). */
export default function ProAi() {
  const { t } = useI18n();
  const { flag } = useConfig();
  const qc = useQueryClient();
  const params = useLocalSearchParams();
  const tab = PANES[params.tab] ? params.tab : "home";
  const Pane = PANES[tab];
  const refresh = () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("proai") });
  return (
    <Screen padded={false} refreshing={false} onRefresh={refresh}>
      <TopBar title="GOFIX PRO AI" />
      <View style={{ padding: 16, paddingBottom: 32, gap: 12 }} testID="proai-page">
        <Txt variant="h2">{t("proai.title")}</Txt>
        <Txt variant="small" muted>{t("proai.subtitle")}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {Object.keys(PANES).map((k) => (
            <Chip key={k} label={t(`proai.tabs.${k}`)} selected={tab === k} onPress={() => router.setParams({ tab: k, lead: undefined })} testID={`proai-tab-${k}`} />
          ))}
        </ScrollView>
        {flag("pro_ai") ? <Pane initialLead={params.lead ? String(params.lead) : ""} /> : <Card><Txt variant="small">{t("errors.feature_disabled")}</Txt></Card>}
      </View>
    </Screen>
  );
}
