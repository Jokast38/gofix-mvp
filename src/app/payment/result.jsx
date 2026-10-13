import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react-native";
import { billingService } from "@/api/services";
import { useI18n } from "@/i18n";
import { formatDA, formatDate } from "@/lib/format";
import { BRAND } from "@/theme";
import { Btn, Loading, Screen, Txt } from "@/ui";

// Return screen (also opened by the deep link gofix://payment/result?order=…): ALWAYS asks the server, never trusts the URL.
export default function PaymentResult() {
  const { order } = useLocalSearchParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tries, setTries] = useState(0);
  const { data, refetch } = useQuery({ queryKey: ["order-confirm", order], queryFn: () => billingService.confirm(order), enabled: Boolean(order) });
  const status = data?.status;
  useEffect(() => {
    if ((status === "pending" || status === "processing") && tries < 5) {
      const id = setTimeout(() => { setTries((n) => n + 1); refetch(); }, 3000);
      return () => clearTimeout(id);
    }
    if (status === "paid") ["billing-me", "provider-me", "plans"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    return undefined;
  }, [status, tries, refetch, qc]);
  if (!data) return <Screen><View style={{ marginTop: 80 }}><Loading /><Txt center>{t("payment.processing")}</Txt></View></Screen>;
  const ok = status === "paid";
  const Icon = ok ? CheckCircle2 : status === "failed" || status === "cancelled" ? XCircle : Clock;
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 12, marginTop: 60 }} testID="payment-result">
        <Icon size={64} color={ok ? BRAND.electric : status === "failed" || status === "cancelled" ? "#F87171" : BRAND.orange} />
        <Txt variant="h2" center>{t(`payment.status.${status}`)}</Txt>
        <Txt muted center>{ok && data.subscription ? t("payment.paidText", { plan: data.plan_name, date: formatDate(data.subscription.ends_at) }) : t(`payment.text.${status}`)}</Txt>
        <Txt variant="tiny" muted>{t("payment.order", { n: data.order_number })} · {formatDA(data.amount_da)}</Txt>
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 20 }}>
          {ok ? (
            <>
              <Btn variant="gradient" title={t("payment.continue")} onPress={() => router.replace(data.audience === "professional" ? "/dashboard" : "/(tabs)/search")} testID="payment-continue" />
              <Btn variant="outline" title={t("billing.title")} onPress={() => router.replace("/billing")} />
            </>
          ) : <Btn variant="gradient" title={t("payment.retry")} onPress={() => router.replace("/pricing")} />}
        </View>
      </View>
    </Screen>
  );
}
