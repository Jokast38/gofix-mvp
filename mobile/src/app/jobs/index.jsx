import { useQueryClient } from "@tanstack/react-query";
import { JobsList } from "@/components/JobsList";
import { useI18n } from "@/i18n";
import { Screen, TopBar, Txt } from "@/ui";

export default function Jobs() {
  const { t } = useI18n();
  const qc = useQueryClient();
  return (
    <Screen onRefresh={() => qc.invalidateQueries({ queryKey: ["jobs"] })}>
      <TopBar title={t("jobs.title")} />
      <Txt variant="small" muted style={{ marginVertical: 12 }}>{t("jobs.subtitle")}</Txt>
      <JobsList />
    </Screen>
  );
}
