import { useState } from "react";
import { Switch, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare, X } from "lucide-react-native";
import { quoteService } from "@/api/services";
import { ErrorCard, QuoteDocument, useRun, useServiceLabel } from "@/components/proai";
import { useI18n } from "@/i18n";
import { BRAND } from "@/theme";
import { Btn, Card, confirm, Input, Loading, Row, Screen, Sheet, TopBar, Txt } from "@/ui";

/** A quote received by the client (from the conversation or a notification): accept, decline, mute follow-ups. */
export default function ClientQuote() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const run = useRun();
  const { service } = useServiceLabel();
  const qid = String(id);
  const { data: q, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["quote", qid], queryFn: () => quoteService.view(qid), retry: false });
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const act = async (key, fn, ok) => {
    setBusy(key);
    const out = await run(fn, ok);
    setBusy(null);
    if (out) qc.setQueryData(["quote", qid], (old) => ({ ...old, ...out }));
    return out;
  };
  const accept = async () => {
    if (await confirm(t("proai.client.accept"), t("proai.client.acceptConfirm"), t("proai.client.accept"), t("proai.cancel"))) {
      await act("accept", () => quoteService.accept(qid), t("proai.client.accepted"));
    }
  };

  let body;
  if (isLoading) body = <Loading />;
  else if (error) body = <ErrorCard error={error} onRetry={refetch} />;
  else body = (
    <View style={{ gap: 14 }}>
      <QuoteDocument q={q} serviceLabel={service(q)} />
      {q.role === "client" && q.status === "sent" ? (
        <Card style={{ gap: 10 }} testID="quote-answer">
          <Txt weight={800}>{t("proai.client.answer")}</Txt>
          <Btn variant="gradient" icon={Check} title={t("proai.client.accept")} loading={busy === "accept"} onPress={accept} testID="quote-accept" />
          <Btn variant="outline" icon={X} title={t("proai.client.reject")} disabled={Boolean(busy)} onPress={() => setRejecting(true)} testID="quote-reject" />
          <Txt variant="tiny" muted>{t("proai.client.acceptNote")}</Txt>
        </Card>
      ) : null}
      {q.role === "client" && q.conversation_id ? (
        <Card style={{ gap: 4 }} testID="quote-mute">
          <Row style={{ justifyContent: "space-between", minHeight: 44 }}>
            <Txt variant="small" style={{ flex: 1 }}>{t("proai.client.mute")}</Txt>
            <Switch value={Boolean(q.followups_muted)} trackColor={{ true: BRAND.electric }} accessibilityLabel={t("proai.client.mute")}
              onValueChange={(on) => act("mute", () => quoteService.muteFollowups(q.conversation_id, on).then((r) => ({ followups_muted: r.muted })), t("proai.saved"))} />
          </Row>
          <Txt variant="tiny" muted>{t("proai.client.muteHint")}</Txt>
        </Card>
      ) : null}
      {q.conversation_id ? <Btn variant="outline" icon={MessageSquare} title={t("proai.client.chat")} onPress={() => router.push(`/messages/${q.conversation_id}`)} /> : null}
      {q.role === "provider" ? <Btn variant="ghost" title={t("proai.client.proView")} onPress={() => router.push(`/pro-ai/quotes/${q.id}`)} /> : null}
    </View>
  );
  return (
    <Screen padded={false} refreshing={isRefetching} onRefresh={refetch}>
      <TopBar title={t("proai.quotes.document")} />
      <View style={{ padding: 16, paddingBottom: 32 }} testID="client-quote-page">{body}</View>
      <Sheet visible={rejecting} onClose={() => setRejecting(false)} title={t("proai.client.reject")}>
        <Txt variant="small" muted style={{ marginBottom: 8 }}>{t("proai.client.rejectReason")}</Txt>
        <Input multiline value={reason} onChangeText={setReason} maxLength={500} />
        <Btn variant="danger" title={t("proai.client.reject")} loading={busy === "reject"} style={{ marginTop: 12 }}
          onPress={async () => { if (await act("reject", () => quoteService.reject(qid, reason.trim()), t("proai.client.rejected"))) setRejecting(false); }} />
      </Sheet>
    </Screen>
  );
}
