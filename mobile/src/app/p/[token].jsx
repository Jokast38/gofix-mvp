import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldOff } from "lucide-react-native";
import { passportService } from "@/api/services";
import { PassportCard } from "@/components/passport";
import { useI18n } from "@/i18n";
import { Btn, Card, Loading, Screen, TopBar, Txt } from "@/ui";

/** Public passport opened from a QR code or a shared link (no account needed). */
export default function PublicPassport() {
  const { token } = useLocalSearchParams();
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({ queryKey: ["passport-public", token], queryFn: () => passportService.view(String(token)), retry: false });
  const open = () => router.push(`/${data.kind === "teacher" ? "teacher" : "pro"}/${data.profile_id}`);
  return (
    <Screen padded={false}>
      <TopBar title={t("passport.public.eyebrow")} />
      <View style={{ padding: 16, paddingBottom: 32, gap: 12 }} testID="passport-public">
        {isLoading ? <Loading /> : error ? (
          <Card style={{ alignItems: "center", gap: 8, paddingVertical: 24 }} testID="passport-not-found">
            <ShieldOff size={36} color="#8a8fa3" />
            <Txt weight={800} center>{t("passport.public.notFound")}</Txt>
            <Txt variant="small" muted center>{t("passport.public.notFoundHint")}</Txt>
            <Btn small variant="outline" title={t("passport.public.home")} onPress={() => router.replace("/")} />
          </Card>
        ) : (
          <>
            <PassportCard data={data} />
            <Btn variant="gradient" title={t("passport.public.quote")} onPress={open} testID="passport-quote" />
            <Btn variant="outline" title={t("passport.public.openProfile")} onPress={open} />
          </>
        )}
      </View>
    </Screen>
  );
}
