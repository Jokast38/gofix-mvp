import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { TestRun } from "@/components/edu";
import { useI18n } from "@/i18n";
import { Screen, TopBar } from "@/ui";

export default function EduTest() {
  const { key } = useLocalSearchParams();
  const { t } = useI18n();
  const [run, setRun] = useState(0);
  return (
    <Screen padded={false}>
      <TopBar title={t("edu.title")} />
      <View style={{ padding: 16, paddingBottom: 32 }}>
        <TestRun key={`${key}-${run}`} testKey={String(key)} onRetry={() => setRun((n) => n + 1)} />
      </View>
    </Screen>
  );
}
