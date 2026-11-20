import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { errorCode } from "@/api/client";
import { eduService } from "@/api/services";
import { ResultView } from "@/components/edu";
import { useI18n } from "@/i18n";
import { Btn, Card, Loading, Screen, TopBar, Txt } from "@/ui";

export default function EduResult() {
  const { id } = useLocalSearchParams();
  const { t, te } = useI18n();
  const { data, error, isLoading } = useQuery({ queryKey: ["edu-attempt", id], queryFn: () => eduService.attempt(id), retry: false });
  return (
    <Screen padded={false}>
      <TopBar title={t("edu.resultTitle")} />
      <View style={{ padding: 16, paddingBottom: 32 }}>
        {isLoading ? <Loading /> : error ? (
          <Card style={{ gap: 10 }}><Txt variant="small">{te(errorCode(error))}</Txt><Btn small variant="outline" title={t("edu.backToTests")} onPress={() => router.replace("/edu")} /></Card>
        ) : <ResultView result={data} />}
      </View>
    </Screen>
  );
}
