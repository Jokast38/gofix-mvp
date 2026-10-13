import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { billingService } from "@/api/services";
import { useI18n } from "@/i18n";
import { formatDA } from "@/lib/format";
import { BRAND } from "@/theme";
import { Btn, Card, Loading, Screen, TopBar, Txt, useToast } from "@/ui";

// Development "hosted page" (PAYMENT_PROVIDER=mock): records the gateway outcome only.
// Activation still requires the server-side confirmation done by the result screen.
export default function PaymentMock() {
  const { orderId, order } = useLocalSearchParams();
  const { t, te } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["mock-order", orderId], queryFn: () => billingService.mockOrder(orderId) });
  const choose = async (outcome) => {
    setBusy(outcome);
    try { await billingService.simulate(orderId, outcome); router.replace(`/payment/result?order=${order}`); }
    catch (err) { toast(te(errorCode(err)), "error"); setBusy(null); }
  };
  return (
    <Screen>
      <TopBar title={t("payment.mockTitle")} />
      {isLoading || !data ? <Loading /> : (
        <Card style={{ marginTop: 16, gap: 10, alignItems: "center" }}>
          <CreditCard size={36} color={BRAND.electric} />
          <Txt variant="small" muted center>{t("payment.mockText")}</Txt>
          <Txt>{data.plan_name}</Txt>
          <Txt variant="h1">{formatDA(data.amount_da)}</Txt>
          <Txt variant="tiny" muted>{t("payment.order", { n: data.order_number })}</Txt>
          <Btn variant="gradient" title={t("payment.success")} loading={busy === "paid"} disabled={Boolean(busy)} onPress={() => choose("paid")} style={{ alignSelf: "stretch" }} testID="mock-paid" />
          <Btn variant="outline" title={t("payment.fail")} disabled={Boolean(busy)} onPress={() => choose("failed")} style={{ alignSelf: "stretch" }} />
          <Btn variant="ghost" title={t("payment.cancel")} disabled={Boolean(busy)} onPress={() => choose("cancelled")} style={{ alignSelf: "stretch" }} />
        </Card>
      )}
    </Screen>
  );
}
