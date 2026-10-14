import { useCallback, useEffect, useState } from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Bell, Bot, CalendarClock, ChevronRight, CircleHelp, ClipboardList, FileText, Heart, LayoutDashboard, LogOut, Mail, MapPin, Pencil, Receipt, Rocket, Shield } from "lucide-react-native";
import { API_ORIGIN, errorCode } from "@/api/client";
import { userService } from "@/api/services";
import { isProvider, useAuth, useWilayas } from "@/hooks/auth";
import { needsManualRestart, useI18n, useLocalized } from "@/i18n";
import { formatPhone, ltr } from "@/lib/format";
import { BRAND, useTheme } from "@/theme";
import { LanguageFlags } from "@/ui/Flags";
import { AccountEditor } from "@/components/AccountEditor";
import { enablePush, openSystemSettings, pushStatus, pushSupported } from "@/lib/push";
import { Avatar, Btn, Card, Chip, confirm, Empty, Field, Input, Row, Screen, Section, Sheet, Txt, useToast } from "@/ui";

/** Push notifications on this phone: status + enable (or open the system settings when blocked). */
function PushRow() {
  const { t } = useI18n();
  const { c } = useTheme();
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const refresh = useCallback(() => { pushStatus().then(setStatus); }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);
  if (!status || status === "unsupported") return null;
  const act = async () => {
    if (status === "denied") return openSystemSettings();
    const res = await enablePush();
    setStatus(res.status);
    if (res.status === "granted") toast(res.error ? t("notifPush.tokenLater") : t("notifPush.enabled"));
    else if (res.status === "denied") toast(t("notifPush.deniedHelp"), "error");
    return undefined;
  };
  return (
    <Card style={{ marginBottom: 12 }} testID="push-row">
      <Row gap={12}>
        <Bell size={20} color={BRAND.electric} />
        <View style={{ flex: 1 }}>
          <Txt weight={700}>{t("notifPush.rowTitle")}</Txt>
          <Txt variant="small" color={status === "granted" ? BRAND.electric : c.muted}>{t(`notifPush.status.${status}`)}</Txt>
        </View>
        {status !== "granted" && <Btn small variant="outline" title={status === "denied" ? t("notifPush.openSettings") : t("notifPush.enable")} onPress={act} testID="push-row-action" />}
      </Row>
      {status === "denied" && <Txt variant="tiny" muted style={{ marginTop: 8 }}>{t("notifPush.deniedHelp")}</Txt>}
    </Card>
  );
}

function LinkRow({ icon: Icon, label, to, onPress, testID }) {
  const { c } = useTheme();
  const { rtl } = useI18n();
  return (
    <Pressable onPress={onPress || (() => router.push(to))} accessibilityRole="button" testID={testID}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, paddingHorizontal: 14 }, pressed && { backgroundColor: c.cardAlt }]}>
      <Icon size={20} color={BRAND.electric} />
      <Txt weight={600} style={{ flex: 1 }}>{label}</Txt>
      <ChevronRight size={18} color={c.muted} style={rtl ? { transform: [{ scaleX: -1 }] } : undefined} />
    </Pressable>
  );
}

function Group({ children }) {
  const { c } = useTheme();
  return <Card style={{ padding: 0, overflow: "hidden" }}>{children.filter(Boolean).map((ch, i) => <View key={i} style={i ? { borderTopWidth: 1, borderColor: c.border } : null}>{ch}</View>)}</Card>;
}

async function shareText(name, content) {
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    a.download = name;
    a.click();
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
}

export default function Account() {
  const { t, te } = useI18n();
  const { name: themeName, setTheme } = useTheme();
  const toast = useToast();
  const { user, setUser, logout } = useAuth();
  const [del, setDel] = useState(false);
  const [pw, setPw] = useState("");
  const [edit, setEdit] = useState(false);
  const loc = useLocalized();
  const { data: wilayas = [] } = useWilayas();

  if (!user) {
    return (
      <Screen>
        <Txt variant="h1">{t("account.title")}</Txt>
        <Empty icon={Shield} text={t("catalog.blurNotice")} action={<View style={{ gap: 10, width: "100%" }}>
          <Btn variant="gradient" title={t("nav.login")} onPress={() => router.push("/login")} />
          <Btn variant="outline" title={t("nav.register")} onPress={() => router.push("/register")} />
        </View>} />
        <Group>{[
          <LinkRow key="f" icon={CircleHelp} label={t("nav.faq")} to="/faq" />,
          <LinkRow key="c" icon={Mail} label={t("nav.contact")} to="/contact" />,
          <LinkRow key="l" icon={FileText} label={t("footer.legalTitle")} to="/legal/mentions" />,
        ]}</Group>
        <Prefs themeName={themeName} setTheme={setTheme} />
      </Screen>
    );
  }
  const provider = isProvider(user);
  const update = async (patch) => {
    try { setUser(await userService.update(patch)); toast(t("account.saved")); } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  const switchMode = async (mode) => {
    try { setUser(await userService.setMode(mode)); } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  const exportData = async () => {
    try { await shareText(`gofix-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await userService.exportData(), null, 2)); toast(t("mobile.exportShared")); }
    catch (err) { toast(te(errorCode(err)), "error"); }
  };
  const deleteAccount = async () => {
    try { await userService.deleteAccount(pw); setDel(false); await logout(); toast(t("account.deleted")); router.replace("/"); } catch (err) { toast(te(errorCode(err)), "error"); }
  };
  const onLogout = async () => {
    if (await confirm(t("nav.logout"), "", t("common.confirm"), t("common.cancel"))) { await logout(); router.replace("/"); }
  };

  return (
    <Screen>
      <Txt variant="h1">{t("account.title")}</Txt>
      <Card style={{ marginTop: 12 }} testID="account-card">
        <Row gap={14} style={{ alignItems: "center" }}>
          <Avatar photoKey={user.photo_key} thumbKey={user.photo_thumb_key} name={user.full_name} size={64} ring large color={BRAND.electric} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="h3" numberOfLines={1}>{user.full_name}</Txt>
            <Txt variant="small" muted numberOfLines={1}>{ltr(user.email)}</Txt>
            {user.phone ? <Txt variant="small" muted>{formatPhone(user.phone)}</Txt> : null}
            {user.wilaya_code ? (
              <Row gap={4}><MapPin size={12} color={BRAND.electric} />
                <Txt variant="tiny" muted>{loc(wilayas.find((w) => w.code === user.wilaya_code)) || user.wilaya_code}</Txt></Row>
            ) : null}
          </View>
        </Row>
        <Btn small variant="outline" icon={Pencil} title={t("accountEdit.edit")} onPress={() => setEdit(true)} style={{ marginTop: 12 }} testID="account-edit" />
      </Card>
      <AccountEditor visible={edit} onClose={() => setEdit(false)} />

      <Section title={t("nav.account")}>
        <Group>{[
          provider ? <LinkRow key="d" icon={LayoutDashboard} label={t("account.links.dashboard")} to="/dashboard" testID="link-dashboard" />
            : <LinkRow key="b" icon={Rocket} label={t("appHome.talentTitle")} to="/onboarding" testID="link-onboarding" />,
          <LinkRow key="j" icon={CalendarClock} label={t("account.links.jobs")} to="/jobs" testID="link-jobs" />,
          <LinkRow key="r" icon={ClipboardList} label={t("account.links.requests")} to="/requests" />,
          <LinkRow key="f" icon={Heart} label={t("account.links.favorites")} to="/favorites" />,
          <LinkRow key="n" icon={Bell} label={t("mobile.notifications")} to="/notifications" />,
          <LinkRow key="bi" icon={Receipt} label={t("account.links.billing")} to="/billing" testID="link-billing" />,
        ]}</Group>
      </Section>

      {user.roles.length > 1 && (
        <Section title={t("account.modeTitle")}>
          <Txt variant="small" muted style={{ marginBottom: 8 }}>{t("account.modeHint")}</Txt>
          <Row gap={8} wrap>{user.roles.map((r) => <Chip key={r} label={t(`account.modes.${r}`)} selected={user.active_mode === r} onPress={() => switchMode(r)} />)}</Row>
        </Section>
      )}

      {pushSupported() && <Section title={t("mobile.notifications")}><PushRow /></Section>}
      <Prefs themeName={themeName} setTheme={setTheme} weekStart={user.week_start} onWeekStart={(v) => update({ week_start: v })} />

      <Section title={t("mobile.more")}>
        <Group>{[
          <LinkRow key="a" icon={Bot} label={t("mobile.assistant")} to="/assistant" />,
          <LinkRow key="f" icon={CircleHelp} label={t("nav.faq")} to="/faq" />,
          <LinkRow key="c" icon={Mail} label={t("nav.contact")} to="/contact" />,
          <LinkRow key="l" icon={FileText} label={t("footer.legalTitle")} to="/legal/mentions" />,
        ]}</Group>
        {user.admin_role && <Txt variant="small" muted style={{ marginTop: 10 }}>{t("mobile.adminOnWeb")}</Txt>}
      </Section>

      <Section title={t("account.privacyTitle")}>
        <Txt variant="small" muted style={{ marginBottom: 10 }}>{t("account.privacyText")}</Txt>
        <View style={{ gap: 10 }}>
          <Btn variant="outline" title={t("account.exportBtn")} onPress={exportData} />
          <Btn variant="danger" title={t("account.deleteBtn")} onPress={() => setDel(true)} />
        </View>
      </Section>

      <Btn variant="outline" icon={LogOut} title={t("nav.logout")} onPress={onLogout} style={{ marginTop: 24 }} testID="logout" />
      <Txt variant="tiny" muted center style={{ marginTop: 16 }}>{t("mobile.version", { v: Constants.expoConfig?.version })} · {t("mobile.apiServer", { url: API_ORIGIN })}</Txt>

      <Sheet visible={del} onClose={() => setDel(false)} title={t("account.deleteTitle")}>
        <Txt variant="small" muted style={{ marginBottom: 10 }}>{t("account.deleteText")}</Txt>
        <Field label={t("account.deletePassword")}><Input value={pw} onChangeText={setPw} secureTextEntry ltr /></Field>
        <Btn variant="danger" title={t("account.deleteConfirm")} disabled={!pw} onPress={deleteAccount} />
      </Sheet>
    </Screen>
  );
}

function Prefs({ themeName, setTheme, weekStart, onWeekStart }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <Section title={t("account.prefsTitle")}>
      <Txt variant="label" style={{ marginBottom: 6 }}>{t("prefs.language")}</Txt>
      <View style={{ marginBottom: 12 }}>
        <LanguageFlags labels onBeforeChange={(code) => code === "ar" && !needsManualRestart && toast(t("mobile.languageReload"))} />
      </View>
      <Txt variant="label" style={{ marginBottom: 6 }}>{t("prefs.toggleTheme")}</Txt>
      <Row gap={8} style={{ marginBottom: 12 }}>
        <Chip label={t("prefs.dark")} selected={themeName === "dark"} onPress={() => setTheme("dark")} />
        <Chip label={t("prefs.light")} selected={themeName === "light"} onPress={() => setTheme("light")} />
      </Row>
      {onWeekStart && (
        <>
          <Txt variant="label" style={{ marginBottom: 6 }}>{t("account.weekStart")}</Txt>
          <Row gap={8}>
            <Chip label={t("account.saturday")} selected={weekStart === "saturday"} onPress={() => onWeekStart("saturday")} />
            <Chip label={t("account.sunday")} selected={weekStart === "sunday"} onPress={() => onWeekStart("sunday")} />
          </Row>
        </>
      )}
    </Section>
  );
}
