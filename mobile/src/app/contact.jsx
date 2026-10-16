import { useState } from "react";
import { errorCode } from "@/api/client";
import { publicService } from "@/api/services";
import { useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { cleanPhone, isValidDzPhone } from "@/lib/format";
import { Btn, Field, Input, Screen, TopBar, Txt, useToast } from "@/ui";

export default function Contact() {
  const { t, te } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.full_name || "", email: user?.email || "", phone: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const send = async () => {
    if (!f.email && !f.phone) return toast(t("contact.needContact"), "error");
    if (f.phone && !isValidDzPhone(f.phone)) return toast(te("phone_invalid"), "error");
    setBusy(true);
    try {
      await publicService.contact({ ...f, email: f.email || null, phone: f.phone ? cleanPhone(f.phone) : null });
      toast(t("contact.sent"));
      setF({ ...f, subject: "", message: "" });
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(false); }
  };
  return (
    <Screen keyboard>
      <TopBar title={t("contact.title")} />
      <Txt variant="small" muted style={{ marginVertical: 12 }}>{t("contact.subtitle")}</Txt>
      <Field label={t("contact.name")}><Input value={f.name} onChangeText={set("name")} /></Field>
      <Field label={t("contact.email")}><Input value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" ltr /></Field>
      <Field label={t("contact.phone")}><Input value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder={t("auth.phonePh")} ltr /></Field>
      <Field label={t("contact.subject")}><Input value={f.subject} onChangeText={set("subject")} maxLength={120} /></Field>
      <Field label={t("contact.message")}><Input multiline value={f.message} onChangeText={set("message")} maxLength={3000} /></Field>
      <Btn variant="gradient" title={t("contact.send")} loading={busy} disabled={f.name.length < 2 || f.subject.length < 2 || f.message.length < 10} onPress={send} />
    </Screen>
  );
}
