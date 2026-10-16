import { Platform, View } from "react-native";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { useQuery } from "@tanstack/react-query";
import { Download, Receipt } from "lucide-react-native";
import { errorCode, session } from "@/api/client";
import { billingService } from "@/api/services";
import { useI18n } from "@/i18n";
import { formatDA, formatDate, formatDateTime } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { Btn, Card, IconBtn, Loading, Row, Screen, Section, TopBar, Txt, useToast } from "@/ui";

async function downloadInvoice(number) {
  const url = billingService.invoiceUrl(number);
  const headers = { Authorization: `Bearer ${session.access}` };
  if (Platform.OS === "web") {
    const blob = await (await fetch(url, { headers })).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${number}.pdf`;
    a.click();
    return;
  }
  const dest = new File(Paths.cache, `${number}.pdf`);
  if (dest.exists) dest.delete();
  const file = await File.createDownloadTask(url, dest, { headers }).downloadAsync();
  if (file) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}

export default function Billing() {
  const { c } = useTheme();
  const { t, te } = useI18n();
  const toast = useToast();
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["billing-me"], queryFn: billingService.me });
  const dl = async (n) => { try { await downloadInvoice(n); toast(t("mobile.invoiceShared")); } catch (err) { toast(te(errorCode(err)), "error"); } };
  const subs = data?.subscriptions || [];
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <TopBar title={t("billing.title")} />
      {isLoading ? <Loading /> : (
        <>
          <Section title={t("billing.current")}>
            <Card style={{ gap: 10 }}>
              {subs.length ? subs.map((s) => (
                <Row key={s.id} style={{ justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Txt weight={700}>{t(`pricing.audiences.${s.audience}`)} · {s.tier === "student_pass" ? t("pricing.studentPass") : s.tier.toUpperCase()}</Txt>
                    <Txt variant="tiny" muted>{t("billing.until", { date: formatDate(s.ends_at) })}</Txt>
                  </View>
                  <Btn small variant="outline" title={t("pricing.renew")} onPress={() => router.push(`/pricing?audience=${s.audience}`)} />
                </Row>
              )) : <><Txt variant="small" muted>{t("billing.none")}</Txt><Btn small variant="gradient" title={t("billing.seePlans")} onPress={() => router.push("/pricing")} /></>}
              <Txt variant="tiny" muted>{t("pricing.noAutoRenew")}</Txt>
            </Card>
          </Section>
          <Section title={t("billing.invoices")}>
            <Card style={{ padding: 0 }}>
              {!data?.invoices?.length ? <Txt variant="small" muted style={{ padding: 14 }}>{t("billing.noInvoices")}</Txt> : data.invoices.map((i, k) => (
                <Row key={i.number} gap={10} style={{ padding: 12, borderTopWidth: k ? 1 : 0, borderColor: c.border }}>
                  <Receipt size={18} color={BRAND.electric} />
                  <View style={{ flex: 1 }}><Txt variant="small" weight={700}>{i.number}</Txt><Txt variant="tiny" muted numberOfLines={1}>{i.plan_name} · {formatDate(i.paid_at)}</Txt></View>
                  <Txt variant="small" weight={700}>{formatDA(i.amount_da)}</Txt>
                  <IconBtn onPress={() => dl(i.number)} label={t("billing.download")} testID={`dl-${i.number}`}><Download size={20} color={c.text} /></IconBtn>
                </Row>
              ))}
            </Card>
          </Section>
          <Section title={t("billing.orders")}>
            <Card style={{ padding: 0 }}>
              {!data?.orders?.length ? <Txt variant="small" muted style={{ padding: 14 }}>{t("billing.noOrders")}</Txt> : data.orders.map((o, k) => (
                <Row key={o.order_number} gap={10} style={{ padding: 12, borderTopWidth: k ? 1 : 0, borderColor: c.border }}>
                  <View style={{ flex: 1 }}><Txt variant="small" weight={600}>{o.plan_name} · {formatDA(o.amount_da)}</Txt><Txt variant="tiny" muted>{o.order_number} · {formatDateTime(o.created_at)}</Txt></View>
                  <Txt variant="tiny" weight={700}>{t(`payment.status.${o.status}`)}</Txt>
                </Row>
              ))}
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}
