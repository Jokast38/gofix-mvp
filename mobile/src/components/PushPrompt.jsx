import { useEffect, useState } from "react";
import { View } from "react-native";
import { Bell, Check } from "lucide-react-native";
import { useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { enablePush, markAsked, pushStatus, pushSupported, syncPushToken, wasAsked } from "@/lib/push";
import { alpha, BRAND } from "@/theme";
import { Btn, Row, Sheet, Txt, useToast } from "@/ui";

/** Explains why GoFix sends notifications BEFORE the system permission dialog (shown once, after sign-in). */
export function PushPrompt() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const userId = user ? user.id : null;

  useEffect(() => {
    if (!userId || !pushSupported()) return undefined;
    let timer;
    (async () => {
      const status = await pushStatus();
      if (status === "granted") return syncPushToken();
      if (status === "undetermined" && !(await wasAsked())) timer = setTimeout(() => setVisible(true), 2500);
      return undefined;
    })();
    return () => clearTimeout(timer);
  }, [userId]);

  const accept = async () => {
    setVisible(false);
    const res = await enablePush();
    if (res.status === "granted") toast(res.error ? t("notifPush.tokenLater") : t("notifPush.enabled"));
  };
  const later = async () => { setVisible(false); await markAsked(); };

  return (
    <Sheet visible={visible} onClose={later} title={t("notifPush.title")}>
      <View style={{ alignItems: "center", marginBottom: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: alpha(BRAND.electric, 0.15), alignItems: "center", justifyContent: "center" }}>
          <Bell size={30} color={BRAND.electric} />
        </View>
      </View>
      <Txt style={{ marginBottom: 10 }}>{t("notifPush.text")}</Txt>
      <View style={{ gap: 8, marginBottom: 16 }}>
        {t("notifPush.items").map((item) => (
          <Row key={item} gap={8} style={{ alignItems: "flex-start" }}><Check size={18} color={BRAND.electric} /><Txt variant="small" style={{ flex: 1 }}>{item}</Txt></Row>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Btn variant="gradient" icon={Bell} title={t("notifPush.enable")} onPress={accept} testID="push-enable" />
        <Btn variant="ghost" title={t("notifPush.later")} onPress={later} testID="push-later" />
      </View>
      <Txt variant="tiny" muted center style={{ marginTop: 10 }}>{t("notifPush.note")}</Txt>
    </Sheet>
  );
}
