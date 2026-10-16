import { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Eye, EyeOff, KeyRound, MessageSquareText } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { authService } from "@/api/services";
import { useAuth, useConfig } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { cleanPhone, isValidDzPhone } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { Btn, Chip, Field, IconBtn, Input, Row, Screen, Sheet, TopBar, Txt, useToast } from "@/ui";

const logo = require("../../assets/brand/gofix-logo.png");

export default function Login() {
  const { c } = useTheme();
  const { t, te } = useI18n();
  const toast = useToast();
  const { login, loginWithOtp } = useAuth();
  const { flag } = useConfig();
  const { from } = useLocalSearchParams();
  const [tab, setTab] = useState("password");
  const [f, setF] = useState({ identifier: "", password: "", phone: "", code: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const done = () => (from ? router.replace(from) : router.canGoBack() ? router.back() : router.replace("/"));

  const submit = async () => {
    setBusy(true);
    try {
      if (tab === "password") await login(f.identifier.trim(), f.password);
      else await loginWithOtp(cleanPhone(f.phone), f.code.trim());
      done();
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(false); }
  };
  const sendCode = async () => {
    if (!isValidDzPhone(f.phone)) return toast(te("phone_invalid"), "error");
    setBusy(true);
    try { await authService.requestOtp(cleanPhone(f.phone)); setSent(true); toast(t("auth.codeSent")); } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(false); }
  };
  const sendForgot = async () => {
    try { await authService.forgot(email.trim()); setForgot(false); toast(t("auth.forgotSent")); } catch (err) { toast(te(errorCode(err)), "error"); }
  };

  return (
    <Screen keyboard>
      <TopBar title={t("auth.loginTitle")} />
      <View style={{ alignItems: "center", marginVertical: 18 }}>
        <Image source={logo} style={{ width: 170, height: 80 }} contentFit="contain" accessibilityLabel="GoFix" />
        <Txt muted center style={{ marginTop: 6 }}>{t("auth.loginSubtitle")}</Txt>
      </View>
      {flag("auth_phone_otp") && (
        <Row gap={8} style={{ marginBottom: 16 }}>
          <Chip label={t("auth.passwordTab")} icon={KeyRound} selected={tab === "password"} onPress={() => setTab("password")} />
          <Chip label={t("auth.otpTab")} icon={MessageSquareText} selected={tab === "otp"} onPress={() => setTab("otp")} />
        </Row>
      )}
      {tab === "password" ? (
        <>
          <Field label={t("auth.identifier")}>
            <Input value={f.identifier} onChangeText={(v) => setF({ ...f, identifier: v })} autoCapitalize="none" autoComplete="username" keyboardType="email-address"
              placeholder={t("auth.identifierPh")} ltr testID="login-identifier" />
          </Field>
          <Field label={t("auth.password")}>
            <View>
              <Input value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry={!show} autoComplete="password" ltr style={{ paddingRight: 52 }} testID="login-password" />
              <IconBtn onPress={() => setShow(!show)} label={show ? t("auth.hidePassword") : t("auth.showPassword")} style={{ position: "absolute", right: 0, top: 0 }}>
                {show ? <EyeOff size={20} color={c.muted} /> : <Eye size={20} color={c.muted} />}
              </IconBtn>
            </View>
          </Field>
          <Pressable onPress={() => setForgot(true)} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-end" }}><Txt variant="small" color={BRAND.electric}>{t("auth.forgot")}</Txt></Pressable>
          <Btn variant="gradient" title={t("auth.loginBtn")} onPress={submit} loading={busy} disabled={!f.identifier || !f.password} testID="login-submit" />
        </>
      ) : (
        <>
          <Field label={t("auth.phone")} hint={t("auth.phoneHint")}>
            <Input value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" placeholder={t("auth.phonePh")} ltr />
          </Field>
          {sent && <Field label={t("auth.code")}><Input value={f.code} onChangeText={(v) => setF({ ...f, code: v.replace(/\D/g, "").slice(0, 6) })} keyboardType="number-pad" ltr autoComplete="one-time-code" /></Field>}
          {sent ? <Btn variant="gradient" title={t("auth.verifyCode")} onPress={submit} loading={busy} disabled={f.code.length !== 6} />
            : <Btn variant="gradient" title={t("auth.sendCode")} onPress={sendCode} loading={busy} />}
        </>
      )}
      <Row gap={6} style={{ justifyContent: "center", marginTop: 20 }}>
        <Txt variant="small" muted>{t("auth.noAccount")}</Txt>
        <Pressable onPress={() => router.push("/register")} style={{ minHeight: 44, justifyContent: "center" }}><Txt variant="small" weight={700} color={BRAND.electric}>{t("auth.registerLink")}</Txt></Pressable>
      </Row>
      <Sheet visible={forgot} onClose={() => setForgot(false)} title={t("auth.forgot")}>
        <Field label={t("auth.email")}><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" ltr /></Field>
        <Btn title={t("contact.send")} onPress={sendForgot} disabled={!email.includes("@")} />
      </Sheet>
    </Screen>
  );
}
