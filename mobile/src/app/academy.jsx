import { SafeAreaView } from "react-native-safe-area-context";
import { CatalogScreen } from "@/components/CatalogScreen";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";
import { TopBar } from "@/ui";

export default function Academy() {
  const { c } = useTheme();
  const { t } = useI18n();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={t("appHome.academy")} />
      <CatalogScreen kind="teacher" />
    </SafeAreaView>
  );
}
