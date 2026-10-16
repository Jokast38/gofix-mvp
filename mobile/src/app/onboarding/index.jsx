import { View } from "react-native";
import { Redirect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Wrench } from "lucide-react-native";
import { onboardingService } from "@/api/services";
import { useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { alpha, BRAND } from "@/theme";
import { Card, Loading, Row, Screen, TopBar, Txt } from "@/ui";

export default function ChooseKind() {
  const { t } = useI18n();
  const { user } = useAuth();
  const status = useQuery({ queryKey: ["onboarding-status"], queryFn: onboardingService.status, enabled: Boolean(user) });
  if (user && (status.data?.professional || status.data?.teacher)) return <Redirect href="/dashboard" />;
  if (user === null || (user && status.isLoading)) return <Screen><Loading /></Screen>;
  const draft = status.data?.drafts?.[0];
  const opts = [{ kind: "professional", icon: Wrench, color: BRAND.pink }, { kind: "teacher", icon: GraduationCap, color: BRAND.electric }];
  return (
    <Screen>
      <TopBar title={t("onboarding.eyebrow")} />
      <Txt variant="h1" center style={{ marginTop: 16 }}>{t("onboarding.chooseTitle")}</Txt>
      <Txt muted center style={{ marginVertical: 10 }}>{t("onboarding.chooseHint")}</Txt>
      {draft && <Card glow onPress={() => router.push(`/onboarding/${draft.kind}`)} style={{ marginBottom: 12 }}><Txt weight={800}>{t("account.resumeDraft")}</Txt><Txt variant="small" muted>{t("onboarding.stepOf", { step: draft.step, total: 7 })}</Txt></Card>}
      <View style={{ gap: 12 }}>
        {opts.map(({ kind, icon: Icon, color }) => (
          <Card key={kind} onPress={() => router.push(user ? `/onboarding/${kind}` : "/register")} testID={`choose-${kind}`}>
            <Row gap={14}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: alpha(color, 0.15), alignItems: "center", justifyContent: "center" }}><Icon size={28} color={color} /></View>
              <View style={{ flex: 1 }}><Txt variant="h3">{t(`onboarding.${kind}.title`)}</Txt><Txt variant="small" muted>{t(`onboarding.${kind}.desc`)}</Txt></View>
            </Row>
          </Card>
        ))}
      </View>
      {!user && <Txt variant="tiny" muted center style={{ marginTop: 16 }}>{t("onboarding.needAccount")}</Txt>}
    </Screen>
  );
}
