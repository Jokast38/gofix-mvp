import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { Check, CreditCard, ShieldCheck } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { billingService } from "@/api/services";
import { isProvider, useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { formatDA, formatDate } from "@/lib/format";
import { BRAND } from "@/theme";
import { Btn, Card, Chip, Loading, Row, Screen, TopBar, Txt, useToast } from "@/ui";

const AUDIENCES = ["client", "professional", "student"];

export default function Pricing() {
  const { t, te, lang } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [audience, setAudience] = useState(params.audience || (isProvider(user) ? "professional" : user?.roles?.includes("student") ? "student" : "client"));
  const [busy, setBusy] = useState(null);
  const plans = useQuery({ queryKey: ["plans"], queryFn: billingService.plans, staleTime: 60_000 });
  const billing = useQuery({ queryKey: ["billing-me"], queryFn: billingService.me, enabled: Boolean(user) });
  const items = (plans.data || []).filter((p) => p.audience === audience);

  const buy = async (plan) => {
    if (!user) return router.push("/login");
    setBusy(plan.key);
    try {
      const order = await billingService.order(plan.key);
      if (order.redirect_url.includes("/payment/mock")) {
        router.push(`/payment/mock?orderId=${encodeURIComponent(order.gateway_order_id)}&order=${order.order_number}`);
      } else {
        // Hosted SATIM page (CIB / Edahabia). The server callback redirects to gofix://payment/result?order=…
        toast(t("mobile.paymentBrowser"));
        const res = await WebBrowser.openAuthSessionAsync(order.redirect_url, Linking.createURL("payment/result"));
        const number = res.type === "success" ? Linking.parse(res.url).queryParams?.order || order.order_number : order.order_number;
        router.push(`/payment/result?order=${number}`); // the result screen always asks the server
      }
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(null); }
  };

  return (
    <Screen>
      <TopBar title={t("pricing.title")} />
      <Txt variant="small" muted style={{ marginVertical: 12 }}>{t("pricing.subtitle")}</Txt>
      <Row gap={8} wrap style={{ marginBottom: 14 }}>{AUDIENCES.map((a) => <Chip key={a} label={t(`pricing.audiences.${a}`)} selected={audience === a} onPress={() => setAudience(a)} testID={`aud-${a}`} />)}</Row>
      {plans.isLoading ? <Loading /> : items.map((p) => {
        const active = billing.data?.subscriptions?.find((s) => s.plan_key === p.key);
        const paid = p.tier !== "free" && p.price_da;
        return (
          <Card key={p.key} glow={p.tier === "premium" || p.key === params.plan} style={{ marginBottom: 12, gap: 8 }} testID={`plan-${p.key}`}>
            <Txt variant="h2">{lang === "ar" ? p.name_ar || p.name_fr : p.name_fr}</Txt>
            <Txt variant="h1">{p.tier === "free" ? t("pricing.free") : p.price_da ? formatDA(p.price_da) : t("pricing.tbd")}
              {paid ? <Txt variant="small" muted> {t("pricing.per", { days: p.duration_days })}</Txt> : null}</Txt>
            {(p.perks_fr || []).map((perk) => <Row key={perk} gap={8} style={{ alignItems: "flex-start" }}><Check size={16} color={BRAND.electric} /><Txt variant="small" style={{ flex: 1 }}>{perk}</Txt></Row>)}
            {active && <Txt variant="small" weight={700} color={BRAND.electric}>{t("pricing.activeUntil", { date: formatDate(active.ends_at) })}</Txt>}
            {paid ? <Btn variant={p.tier === "premium" ? "gradient" : "primary"} icon={CreditCard} title={active ? t("pricing.renew") : t("pricing.choose")}
              loading={busy === p.key} disabled={Boolean(busy)} onPress={() => buy(p)} testID={`buy-${p.key}`} /> : null}
          </Card>
        );
      })}
      <Card style={{ flexDirection: "row", gap: 10 }}>
        <ShieldCheck size={22} color={BRAND.electric} />
        <View style={{ flex: 1 }}><Txt variant="small" weight={700}>{t("pricing.secure")}</Txt><Txt variant="tiny" muted>{t("pricing.noAutoRenew")}</Txt></View>
      </Card>
    </Screen>
  );
}
