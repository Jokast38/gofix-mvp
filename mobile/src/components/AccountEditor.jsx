import { useEffect, useState } from "react";
import { View } from "react-native";
import { Camera, LocateFixed, Trash2 } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { userService } from "@/api/services";
import { pickImage } from "@/components/editors";
import { useAuth, useWilayas } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { detectWilaya } from "@/lib/location";
import { formatPhone } from "@/lib/format";
import { BRAND } from "@/theme";
import { Avatar, Btn, Field, Input, Row, SelectField, Sheet, Txt, useToast } from "@/ui";

const fromUser = (u) => ({ full_name: u.full_name || "", email: u.email || "", phone: u.phone ? formatPhone(u.phone).replace(/[⁦⁩]/g, "") : "",
  wilaya_code: u.wilaya_code || "" });

/** Wilaya picker with an optional "detect my wilaya" button (position used once, never stored). */
export function WilayaPicker({ value, onChange, label, testID, placeholder }) {
  const { t, te } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const { data: wilayas = [] } = useWilayas();
  const [busy, setBusy] = useState(false);
  const detect = async () => {
    setBusy(true);
    const res = await detectWilaya();
    setBusy(false);
    if (res.wilaya) {
      onChange(res.wilaya.code);
      toast(t("geoloc.found", { name: loc(res.wilaya) }));
    } else toast(te(res.error), "error");
  };
  return (
    <Field label={label} hint={t("geoloc.why")}>
      <SelectField label={label} value={value} onChange={onChange} placeholder={placeholder || t("home.wilayaAll")} testID={testID}
        options={wilayas.map((w) => ({ value: w.code, label: `${String(w.code).padStart(2, "0")} – ${loc(w)}` }))} />
      <Btn small variant="outline" icon={LocateFixed} loading={busy} title={busy ? t("geoloc.detecting") : t("geoloc.detect")} onPress={detect}
        style={{ marginTop: 8, alignSelf: "flex-start" }} testID="detect-wilaya" />
    </Field>
  );
}

/** "My profile" sheet: optional photo (any account), name, e-mail, phone, wilaya. */
export function AccountEditor({ visible, onClose }) {
  const { t, te } = useI18n();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const [f, setF] = useState(() => fromUser(user));
  const [busy, setBusy] = useState(null);
  useEffect(() => { if (visible) setF(fromUser(user)); }, [visible, user]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const run = async (name, fn, ok) => {
    setBusy(name);
    try { setUser(await fn()); if (ok) toast(ok); return true; } catch (err) { toast(te(errorCode(err)), "error"); return false; } finally { setBusy(null); }
  };
  const choosePhoto = async () => {
    const asset = await pickImage([1, 1]);
    if (asset) await run("photo", () => userService.uploadPhoto(asset), t("accountEdit.photoSaved"));
  };
  const save = async () => {
    const before = fromUser(user);
    const patch = {};
    if (f.full_name.trim() !== before.full_name) patch.full_name = f.full_name.trim();
    if (f.email.trim() && f.email.trim().toLowerCase() !== (user.email || "")) patch.email = f.email.trim();
    if (f.phone.trim() && f.phone !== before.phone) patch.phone = f.phone.trim();
    if (f.wilaya_code && Number(f.wilaya_code) !== user.wilaya_code) patch.wilaya_code = Number(f.wilaya_code);
    if (!Object.keys(patch).length) return onClose();
    if (await run("save", () => userService.update(patch), t("accountEdit.saved"))) onClose();
  };

  if (!user) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title={t("accountEdit.title")} full>
      <Field label={t("accountEdit.photo")}>
        <Row gap={14} style={{ alignItems: "center" }}>
          <Avatar photoKey={user.photo_key} thumbKey={user.photo_thumb_key} name={user.full_name} size={76} ring large color={BRAND.electric} />
          <View style={{ flex: 1, gap: 8 }}>
            <Btn small variant="outline" icon={Camera} loading={busy === "photo"} title={user.photo_key ? t("accountEdit.changePhoto") : t("accountEdit.addPhoto")}
              onPress={choosePhoto} testID="account-photo" />
            {user.photo_key && <Btn small variant="ghost" icon={Trash2} loading={busy === "rmphoto"} title={t("accountEdit.removePhoto")}
              onPress={() => run("rmphoto", userService.deletePhoto, t("accountEdit.photoRemoved"))} />}
          </View>
        </Row>
      </Field>
      <Field label={t("accountEdit.name")}><Input value={f.full_name} onChangeText={set("full_name")} maxLength={80} autoComplete="name" testID="account-name" /></Field>
      <Field label={t("accountEdit.email")}><Input value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" ltr testID="account-email" /></Field>
      <Field label={t("accountEdit.phone")} hint={t("accountEdit.phoneNote")}>
        <Input value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" autoComplete="tel" ltr testID="account-phone" />
      </Field>
      <WilayaPicker label={t("accountEdit.wilaya")} placeholder={t("accountEdit.wilayaPh")} value={f.wilaya_code} onChange={set("wilaya_code")} testID="account-wilaya" />
      <Btn variant="gradient" title={t("accountEdit.save")} loading={busy === "save"} onPress={save} style={{ marginTop: 8 }} testID="account-save" />
    </Sheet>
  );
}
