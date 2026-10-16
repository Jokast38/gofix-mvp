import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, UserRound } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { chatbotService } from "@/api/services";
import { useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { isValidDzPhone } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { Btn, Card, Field, Input, Row, TopBar, Txt, useToast } from "@/ui";

function Bubble({ from, children }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: from === "user" ? "flex-end" : "flex-start", marginTop: 6 }}>
      <View style={{ maxWidth: "86%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: from === "user" ? BRAND.electric : c.cardAlt }}>
        <Txt auto color={from === "user" ? BRAND.night : c.text}>{children}</Txt>
      </View>
    </View>
  );
}

// Same assistant as the web bubble: FAQ only (+ optional LLM rephrasing server-side), never invents, hands off to a human.
export default function Assistant() {
  const { c } = useTheme();
  const { t, te, lang } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const scroller = useRef(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [handoff, setHandoff] = useState(null);
  const [h, setH] = useState({ name: user?.full_name || "", contact: user?.phone || user?.email || "" });
  const push = (m) => setMsgs((x) => [...x, m]);
  const ask = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    push({ from: "user", text: q });
    setBusy(true);
    try {
      const r = await chatbotService.ask(q, lang);
      push({ from: "bot", text: r.answered ? r.answer : t("chatbot.noAnswer"), suggestions: r.suggestions, handoff: !r.answered, question: q });
    } catch { push({ from: "bot", text: t("errors.network"), handoff: true, question: q }); } finally { setBusy(false); }
  };
  const open = async (s) => {
    push({ from: "user", text: s.question });
    try { push({ from: "bot", text: (await chatbotService.entry(s.id, lang)).answer }); } catch { /* ignore */ }
  };
  const sendHandoff = async () => {
    const contact = h.contact.trim();
    const phone = isValidDzPhone(contact);
    if (!user && !phone && !contact.includes("@")) return toast(t("chatbot.contactInvalid"), "error");
    try {
      await chatbotService.handoff({ name: h.name.trim(), message: handoff, ...(contact ? (phone ? { phone: contact } : { email: contact }) : {}) });
      setHandoff(null);
      push({ from: "bot", text: t("chatbot.handoffDone") });
    } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar title={t("chatbot.title")} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={{ padding: 14 }} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
          <Bubble from="bot">{t("chatbot.hello")}</Bubble>
          {msgs.map((m, i) => (
            <View key={i}>
              <Bubble from={m.from}>{m.text}</Bubble>
              {m.suggestions?.length > 0 && (
                <View style={{ marginTop: 6, gap: 6 }}>
                  <Txt variant="tiny" muted>{t("chatbot.suggestions")}</Txt>
                  {m.suggestions.map((s) => (
                    <Pressable key={s.id} onPress={() => open(s)} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, minHeight: 40, justifyContent: "center", alignSelf: "flex-start" }}>
                      <Txt variant="small">{s.question}</Txt>
                    </Pressable>
                  ))}
                </View>
              )}
              {m.handoff && !handoff && (
                <Btn small variant="outline" icon={UserRound} title={t("chatbot.handoff")} onPress={() => setHandoff(m.question)} style={{ alignSelf: "flex-start", marginTop: 8 }} />
              )}
            </View>
          ))}
          {handoff && (
            <Card style={{ marginTop: 10 }}>
              <Txt weight={700} style={{ marginBottom: 8 }}>{t("chatbot.handoffTitle")}</Txt>
              <Field label={t("contact.name")}><Input value={h.name} onChangeText={(v) => setH({ ...h, name: v })} /></Field>
              <Field label={t("chatbot.contactPh")}><Input value={h.contact} onChangeText={(v) => setH({ ...h, contact: v })} ltr /></Field>
              <Btn title={t("chatbot.handoffSend")} onPress={sendHandoff} disabled={h.name.trim().length < 2} />
            </Card>
          )}
          {busy && <Txt variant="tiny" muted style={{ marginTop: 6 }}>{t("chatbot.typing")}</Txt>}
        </ScrollView>
        <Txt variant="tiny" muted style={{ paddingHorizontal: 14 }}>{t("chatbot.disclaimer")}</Txt>
        <Row gap={8} style={{ padding: 10, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
          <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => ask(input)} placeholder={t("chatbot.placeholder")} placeholderTextColor={c.muted} maxLength={500}
            returnKeyType="send" style={{ flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: c.input, paddingHorizontal: 16, color: c.text, fontSize: 16 }} testID="bot-input" />
          <Pressable onPress={() => ask(input)} disabled={!input.trim() || busy} accessibilityRole="button" accessibilityLabel={t("messages.send")}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: BRAND.pink, alignItems: "center", justifyContent: "center", opacity: input.trim() ? 1 : 0.4 }}>
            <Send size={20} color={BRAND.night} />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
