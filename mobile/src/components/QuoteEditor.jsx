import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, MessageSquare, Plus, Send, Trash2, Wand2 } from "lucide-react-native";
import { proAiService } from "@/api/services";
import { ErrorCard, QuoteDocument, StatusPill, useRun, useServiceLabel } from "@/components/proai";
import { useI18n } from "@/i18n";
import { formatMinor } from "@/lib/format";
import { useTheme } from "@/theme";
import { Btn, Card, Chip, confirm, Field, IconBtn, Input, Loading, Row, Screen, TopBar, Txt } from "@/ui";

const num = (v) => Number(String(v).replace(",", "."));
const toMinor = (v) => Math.round(num(v) * 100);
const lineTotal = (l) => Math.round(num(l.qty) * toMinor(l.price));
const toLine = (it) => ({ label: it.label, qty: String(it.qty), price: String(it.unit_price_minor / 100) });
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Quote editor (draft), then preview + explicit send. quoteId for an existing quote, leadId for a new one. */
export function QuoteEditorScreen({ quoteId, leadId, initialStep = "edit" }) {
  const { t, lang } = useI18n();
  const { c } = useTheme();
  const qc = useQueryClient();
  const run = useRun();
  const { service } = useServiceLabel();
  const existing = useQuery({ queryKey: ["proai-quote", quoteId], queryFn: () => proAiService.quote(quoteId), enabled: Boolean(quoteId) });
  const settings = useQuery({ queryKey: ["proai-settings"], queryFn: proAiService.settings, enabled: !quoteId });
  const [form, setForm] = useState(null);
  const [key] = useState(newKey);
  const [step, setStep] = useState(initialStep);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const q = existing.data;
  const f = form || (q ? { lines: q.items.map(toLine), notes: q.notes, valid_days: q.valid_days }
    : { lines: [{ label: "", qty: "1", price: "" }], notes: settings.data?.default_notes || "", valid_days: settings.data?.quote_valid_days || 15 });
  // Functional updates: two quick edits in a row never overwrite each other.
  const set = (p) => setForm((prev) => { const b = prev || f; return { ...b, ...(typeof p === "function" ? p(b) : p) }; });
  const setLine = (i, p) => set((b) => ({ lines: b.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) }));
  const total = f.lines.reduce((s, l) => s + (lineTotal(l) || 0), 0);
  const valid = f.lines.every((l) => l.label.trim().length >= 2 && num(l.qty) > 0 && l.price !== "" && toMinor(l.price) >= 0);
  const editable = !quoteId || q?.status === "draft";

  const save = async (preview = false) => {
    const body = { items: f.lines.map((l) => ({ label: l.label.trim(), qty: num(l.qty), unit_price_minor: toMinor(l.price) })), notes: f.notes, valid_days: Number(f.valid_days) };
    setBusy("save");
    const out = await run(() => (quoteId ? proAiService.updateQuote(quoteId, body) : proAiService.createQuote({ ...body, lead_id: leadId, currency: "DZD" }, key)), t("proai.quotes.saved"));
    setBusy(null);
    if (!out) return null;
    qc.setQueryData(["proai-quote", out.id], out);
    qc.invalidateQueries({ queryKey: ["proai-lead", out.request_id] });
    setForm(null);
    if (!quoteId) router.replace(`/pro-ai/quotes/${out.id}${preview ? "?step=preview" : ""}`);
    else if (preview) setStep("preview");
    return out;
  };
  const send = async () => {
    setBusy("send");
    const out = await run(() => proAiService.sendQuote(quoteId, message), t("proai.quotes.sentOk"));
    setBusy(null);
    if (out) {
      qc.setQueryData(["proai-quote", quoteId], out);
      ["proai-leads", "proai-quotes", "proai-lead"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setStep("edit");
    }
  };
  const remove = async () => {
    if (!(await confirm(t("proai.quotes.delete"), t("proai.quotes.deleteConfirm"), t("proai.quotes.delete"), t("proai.cancel")))) return;
    if (await run(() => proAiService.deleteQuote(quoteId), t("proai.quotes.deleted"))) {
      qc.invalidateQueries({ queryKey: ["proai-lead", q.request_id] });
      router.back();
    }
  };

  let body;
  if (quoteId && existing.isLoading) body = <Loading />;
  else if (quoteId && existing.error) body = <ErrorCard error={existing.error} onRetry={existing.refetch} />;
  else if (!editable || step === "preview") body = (
    <View style={{ gap: 14 }}>
      <QuoteDocument q={q} serviceLabel={service(q)} />
      {editable ? (
        <Card style={{ gap: 10 }} testID="quote-send">
          <Txt weight={800}>{t("proai.quotes.sendTitle")}</Txt>
          <Txt variant="small">{t("proai.quotes.recipient", { name: q.client_name || "—" })}</Txt>
          <Field label={t("proai.quotes.message")}>
            <Input multiline value={message} onChangeText={setMessage} maxLength={2000} placeholder={t("proai.quotes.messagePh")} style={{ minHeight: 120 }} />
          </Field>
          <Btn small variant="ghost" icon={Wand2} title={t("proai.assistant.suggest")}
            onPress={async () => { const out = await run(() => proAiService.draft({ purpose: "quote_intro", quote_id: quoteId, lang })); if (out) setMessage(out.text); }} />
          <Btn variant="gradient" icon={Send} title={t("proai.quotes.confirmSend")} loading={busy === "send"} onPress={send} testID="quote-confirm-send" />
          <Btn small variant="outline" title={t("proai.quotes.edit")} onPress={() => setStep("edit")} />
          <Txt variant="tiny" muted>{t("proai.quotes.sendNote")}</Txt>
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {q.conversation_id ? <Btn small variant="outline" icon={MessageSquare} title={t("proai.leads.openChat")} onPress={() => router.push(`/messages/${q.conversation_id}`)} /> : null}
          {["sent", "expired"].includes(q.status) ? <Btn small variant="outline" icon={BellRing} title={t("proai.followups.title")} onPress={() => router.push("/pro-ai?tab=followups")} /> : null}
          <Btn small variant="ghost" title={t("proai.quotes.backLead")} onPress={() => router.push(`/pro-ai/leads/${q.request_id}`)} />
        </View>
      )}
    </View>
  );
  else body = (
    <Card style={{ gap: 12 }} testID="quote-editor">
      <Row style={{ justifyContent: "space-between" }}>
        <Txt variant="h3">{q ? q.ref : t("proai.quotes.new")}</Txt>
        <StatusPill status="draft" group="quoteStatus" />
      </Row>
      {f.lines.map((l, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 10, gap: 8 }} testID="quote-line">
          <Row gap={6}>
            <Input value={l.label} onChangeText={(v) => setLine(i, { label: v })} maxLength={120} placeholder={t("proai.quotes.labelPh")} style={{ flex: 1 }}
              accessibilityLabel={t("proai.quotes.label")} testID="quote-line-label" />
            {f.lines.length > 1 ? <IconBtn label={t("proai.quotes.removeLine")} onPress={() => set((b) => ({ lines: b.lines.filter((_, j) => j !== i) }))}><Trash2 size={18} color={c.muted} /></IconBtn> : null}
          </Row>
          <Row gap={8}>
            <View style={{ width: 92 }}>
              <Txt variant="tiny" weight={700} muted>{t("proai.quotes.qty")}</Txt>
              <Input value={l.qty} onChangeText={(v) => setLine(i, { qty: v.replace(/[^\d.,]/g, "") })} keyboardType="decimal-pad" ltr testID="quote-line-qty" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="tiny" weight={700} muted>{t("proai.quotes.unitPrice")}</Txt>
              <Input value={l.price} onChangeText={(v) => setLine(i, { price: v.replace(/[^\d.,]/g, "") })} keyboardType="decimal-pad" ltr placeholder="DA" testID="quote-line-price" />
            </View>
          </Row>
          <Txt variant="small" weight={700} style={{ textAlign: "right" }}>{formatMinor(lineTotal(l) || 0)}</Txt>
        </View>
      ))}
      {f.lines.length < 30 ? <Btn small variant="outline" icon={Plus} title={t("proai.quotes.addLine")} onPress={() => set((b) => ({ lines: [...b.lines, { label: "", qty: "1", price: "" }] }))} testID="quote-add-line" /> : null}
      <Row style={{ justifyContent: "space-between", backgroundColor: c.cardAlt, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Txt weight={800}>{t("proai.quotes.total")}</Txt>
        <Txt variant="h3" testID="quote-total">{formatMinor(total)}</Txt>
      </Row>
      <Txt variant="tiny" muted>{t("proai.quotes.serverTotal")}</Txt>
      <Field label={t("proai.quotes.notes")}><Input multiline value={f.notes} onChangeText={(v) => set({ notes: v })} maxLength={1000} placeholder={t("proai.quotes.notesPh")} /></Field>
      <Txt variant="label">{t("proai.quotes.validity")}</Txt>
      <Row gap={8} wrap>{[7, 15, 30, 60, 90].map((d) => <Chip key={d} label={t("proai.quotes.days", { n: d })} selected={Number(f.valid_days) === d} onPress={() => set({ valid_days: d })} />)}</Row>
      <Btn variant="gradient" title={t("proai.quotes.previewSend")} disabled={!valid} loading={busy === "save"}
        onPress={() => save(true)} testID="quote-preview" />
      <Btn small variant="outline" title={t("proai.quotes.saveDraft")} disabled={!valid || busy === "save"} onPress={() => save(false)} testID="quote-save" />
      {quoteId ? <Btn small variant="ghost" icon={Trash2} title={t("proai.quotes.delete")} onPress={remove} /> : null}
    </Card>
  );
  return (
    <Screen padded={false} keyboard>
      <TopBar title={t("proai.quotes.title")} />
      <View style={{ padding: 16, paddingBottom: 40 }} testID="proai-quote-page">{body}</View>
    </Screen>
  );
}
