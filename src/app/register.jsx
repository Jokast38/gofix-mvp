import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { errorCode } from "@/api/client";
import { useAuth, useConfig } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { cleanPhone, isValidDzPhone, isValidPassword } from "@/lib/format";
import { alpha, BRAND } from "@/theme";
import { Btn, Card, Chip, Field, Input, Row, Screen, TopBar, Txt, useToast } from "@/ui";
import { CheckRow } from "@/ui/CheckRow";

const TYPES = ["client", "student", "professional", "teacher"];

export default function Register() {
  const { t, te, lang } = useI18n();
  const toast = useToast();
  const { register } = useAuth();
  const { settings } = useConfig();
  const [f, setF] = useState({ full_name: "", email: "", phone: "", password: "", account_type: "client", birth_year: "",
    guardian_name: "", guardian_phone: "", guardian_consent: false, accept_terms: false, accept_privacy: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const threshold = settings.minor_age_threshold || 18;
  const isMinor = f.account_type === "student" && f.birth_year && new Date().getFullYear() - Number(f.birth_year) < threshold;

  const submit = async () => {
    const e = {};
    if (f.full_name.trim().length < 2) e.full_name = te("name_short");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = te("email_invalid");
    if (!isValidDzPhone(f.phone)) e.phone = te("phone_invalid");
    if (!isValidPassword(f.password)) e.password = te("password_weak");
    if (isMinor && !(f.guardian_consent && f.guardian_name && isValidDzPhone(f.guardian_phone))) e.guardian = te("guardian_consent_required");
    if (!(f.accept_terms && f.accept_privacy)) e.consent = te("consent_required");
    setErrors(e);
    if (Object.keys(e).length) return toast(t("onboarding.fixErrors"), "error");
    setBusy(true);
    try {
      await register({ ...f, phone: cleanPhone(f.phone), email: f.email.trim().toLowerCase(), preferred_language: lang,
        birth_year: f.birth_year ? Number(f.birth_year) : null, guardian_name: isMinor ? f.guardian_name : null, guardian_phone: isMinor ? cleanPhone(f.guardian_phone) : null });
      toast(t("auth.welcome", { name: f.full_name.split(" ")[0] }));
      router.replace(["professional", "teacher"].includes(f.account_type) ? `/onboarding/${f.account_type}` : "/");
    } catch (err) { toast(te(errorCode(err)), "error"); } finally { setBusy(false); }
  };

  return (
    <Screen keyboard>
      <TopBar title={t("auth.registerTitle")} />
      <Txt muted style={{ marginVertical: 12 }}>{t("auth.registerSubtitle")}</Txt>
      <Txt variant="label" style={{ marginBottom: 8 }}>{t("auth.accountType")}</Txt>
      <Row gap={8} wrap style={{ marginBottom: 16 }}>{TYPES.map((k) => <Chip key={k} label={t(`auth.types.${k}`)} selected={f.account_type === k} onPress={() => set("account_type")(k)} testID={`type-${k}`} />)}</Row>
      <Field label={t("auth.fullName")} error={errors.full_name}><Input value={f.full_name} onChangeText={set("full_name")} autoComplete="name" testID="reg-name" /></Field>
      <Field label={t("auth.email")} error={errors.email}><Input value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" ltr testID="reg-email" /></Field>
      <Field label={t("auth.phone")} hint={t("auth.phoneHint")} error={errors.phone}><Input value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" placeholder={t("auth.phonePh")} ltr testID="reg-phone" /></Field>
      <Field label={t("auth.password")} hint={t("auth.passwordRule")} error={errors.password}><Input value={f.password} onChangeText={set("password")} secureTextEntry autoComplete="new-password" ltr testID="reg-password" /></Field>
      {f.account_type === "student" && (
        <>
          <Field label={`${t("auth.birthYear")} (${t("common.optional")})`}><Input value={String(f.birth_year)} onChangeText={(v) => set("birth_year")(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" ltr /></Field>
          {isMinor && (
            <Card style={{ borderColor: alpha(BRAND.orange, 0.5), marginBottom: 14 }}>
              <Txt weight={700} style={{ marginBottom: 10 }}>{t("auth.minorTitle")}</Txt>
              <Field label={t("auth.guardianName")}><Input value={f.guardian_name} onChangeText={set("guardian_name")} /></Field>
              <Field label={t("auth.guardianPhone")}><Input value={f.guardian_phone} onChangeText={set("guardian_phone")} keyboardType="phone-pad" ltr /></Field>
              <CheckRow checked={f.guardian_consent} onChange={set("guardian_consent")}>{t("auth.guardianConsent")}</CheckRow>
              {errors.guardian && <Txt variant="small" color="#F87171">{errors.guardian}</Txt>}
            </Card>
          )}
        </>
      )}
      <CheckRow checked={f.accept_terms} onChange={set("accept_terms")} testID="reg-terms">
        <Txt variant="small">{t("auth.acceptTerms")} <Txt variant="small" color={BRAND.electric} onPress={() => router.push("/legal/cgu")}>{t("auth.terms")}</Txt></Txt>
      </CheckRow>
      <CheckRow checked={f.accept_privacy} onChange={set("accept_privacy")} testID="reg-privacy">
        <Txt variant="small">{t("auth.acceptPrivacy")} <Txt variant="small" color={BRAND.electric} onPress={() => router.push("/legal/privacy")}>{t("auth.privacy")}</Txt></Txt>
      </CheckRow>
      {errors.consent && <Txt variant="small" color="#F87171">{errors.consent}</Txt>}
      <Btn variant="gradient" title={t("auth.registerBtn")} onPress={submit} loading={busy} style={{ marginTop: 16 }} testID="reg-submit" />
      <Row gap={6} style={{ justifyContent: "center", marginTop: 16 }}>
        <Txt variant="small" muted>{t("auth.haveAccount")}</Txt>
        <Pressable onPress={() => router.replace("/login")} style={{ minHeight: 44, justifyContent: "center" }}><Txt variant="small" weight={700} color={BRAND.electric}>{t("auth.loginLink")}</Txt></Pressable>
      </Row>
      <View style={{ height: 24 }} />
    </Screen>
  );
}
