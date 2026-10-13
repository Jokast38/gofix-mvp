import { useState } from "react";
import { Pressable, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { Camera, FileUp, ImagePlus, MapPin, Trash2, X } from "lucide-react-native";
import { publicService } from "@/api/services";
import { useWilayas } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { alpha, BRAND, useTheme } from "@/theme";
import { Avatar, Btn, Chip, Cover, IconBtn, Row, SelectField, Txt } from "@/ui";

export const DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
export const SLOTS = ["morning", "afternoon", "evening"];
const RADII = [5, 10, 20, 30, 50];

/** Wilayas + communes + radius (same data shape as the web: zones[{wilaya_code, commune_names[], radius_km}]). */
export function ZonesEditor({ zones = [], onChange }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const loc = useLocalized();
  const { data: wilayas = [] } = useWilayas();
  const [current, setCurrent] = useState(zones[0]?.wilaya_code || "");
  const zone = zones.find((z) => z.wilaya_code === Number(current));
  const communesQ = useQuery({ queryKey: ["communes", current], enabled: Boolean(current), staleTime: Infinity,
    queryFn: () => publicService.communes(Number(current)) });
  const add = (code) => {
    setCurrent(code);
    if (code && !zones.find((z) => z.wilaya_code === Number(code))) onChange([...zones, { wilaya_code: Number(code), commune_names: [], radius_km: 10 }]);
  };
  const setZone = (patch) => onChange(zones.map((z) => (z.wilaya_code === Number(current) ? { ...z, ...patch } : z)));
  return (
    <View style={{ gap: 12 }}>
      <SelectField label={t("home.wilayaLabel")} value="" onChange={add} placeholder={t("onboarding.pickWilaya")} allowClear={false}
        options={wilayas.map((w) => ({ value: w.code, label: `${String(w.code).padStart(2, "0")} – ${loc(w)}` }))} testID="zone-add" />
      <Row gap={8} wrap>
        {zones.map((z) => {
          const w = wilayas.find((x) => x.code === z.wilaya_code);
          const active = Number(current) === z.wilaya_code;
          return (
            <Row key={z.wilaya_code} gap={2} style={{ borderWidth: 1, borderColor: active ? BRAND.electric : c.border, borderRadius: 999, paddingStart: 10 }}>
              <Pressable onPress={() => setCurrent(z.wilaya_code)} style={{ minHeight: 40, justifyContent: "center", flexDirection: "row", alignItems: "center", gap: 4 }}>
                <MapPin size={13} color={BRAND.pink} /><Txt variant="small" weight={700}>{loc(w)} · {z.radius_km} km{z.commune_names.length ? ` · ${z.commune_names.length}` : ""}</Txt>
              </Pressable>
              <IconBtn onPress={() => { onChange(zones.filter((x) => x.wilaya_code !== z.wilaya_code)); if (active) setCurrent(""); }} label={t("common.close")} style={{ width: 40, height: 40 }}>
                <X size={15} color={c.muted} />
              </IconBtn>
            </Row>
          );
        })}
      </Row>
      {zone && (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, gap: 10 }}>
          <Txt variant="label">{t("onboarding.radius")}</Txt>
          <Row gap={8} wrap>{RADII.map((r) => <Chip key={r} label={`${r} km`} selected={zone.radius_km === r} onPress={() => setZone({ radius_km: r })} />)}</Row>
          {communesQ.data?.length > 0 && (
            <>
              <Txt variant="label">{t("onboarding.communes")} <Txt variant="small" muted>({t("common.optional")})</Txt></Txt>
              <Row gap={8} wrap>{communesQ.data.map((cm) => {
                const on = zone.commune_names.includes(cm.name_fr);
                return <Chip key={cm.name_fr} label={loc(cm)} selected={on} onPress={() => setZone({ commune_names: on ? zone.commune_names.filter((n) => n !== cm.name_fr) : [...zone.commune_names, cm.name_fr] })} />;
              })}</Row>
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** Weekly availability grid (day x slot), thumb-sized cells. */
export function AvailabilityEditor({ slots = [], onChange }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const has = (d, s) => slots.some((x) => x.day === d && x.slot === s);
  const toggle = (d, s) => onChange(has(d, s) ? slots.filter((x) => !(x.day === d && x.slot === s)) : [...slots, { day: d, slot: s }]);
  return (
    <View style={{ gap: 6 }}>
      <Row gap={6}><View style={{ width: 44 }} />{SLOTS.map((s) => <Txt key={s} variant="tiny" muted center style={{ flex: 1 }}>{t(`onboarding.slots.${s}`)}</Txt>)}</Row>
      {DAYS.map((d) => (
        <Row key={d} gap={6}>
          <Txt variant="small" weight={700} style={{ width: 44 }}>{t(`onboarding.days.${d}`)}</Txt>
          {SLOTS.map((s) => (
            <Pressable key={s} onPress={() => toggle(d, s)} accessibilityRole="checkbox" accessibilityState={{ checked: has(d, s) }} accessibilityLabel={`${d} ${s}`}
              style={{ flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: has(d, s) ? BRAND.electric : c.border, backgroundColor: has(d, s) ? alpha(BRAND.electric, 0.2) : "transparent" }} />
          ))}
        </Row>
      ))}
    </View>
  );
}

export async function pickImage(aspect) {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect, quality: 0.85 });
  return res.canceled ? null : res.assets[0];
}

export async function pickDocument() {
  const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true });
  return res.canceled ? null : res.assets[0];
}

/** Profile photo + cover pickers with live preview (thumbnail or initials). */
export function MediaEditor({ value, name, onPhoto, onCover, onRemove, busy }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: 14, overflow: "hidden" }}>
        <Cover coverKey={value.cover_key} thumbKey={value.cover_thumb_key} color={BRAND.pink} height={120} large />
        <View style={{ position: "absolute", bottom: 10, start: 12 }}>
          <Avatar photoKey={value.photo_key} thumbKey={value.photo_thumb_key} name={name} size={72} ring large />
        </View>
      </View>
      <Row gap={8} wrap>
        <Btn small variant="outline" icon={Camera} loading={busy === "photo"} title={value.photo_key ? t("dashboard.photoChange") : t("dashboard.photoAdd")} onPress={onPhoto} testID="pick-photo" />
        <Btn small variant="outline" icon={ImagePlus} loading={busy === "cover"} title={value.cover_key ? t("dashboard.coverChange") : t("dashboard.coverAdd")} onPress={onCover} testID="pick-cover" />
        {value.photo_key && onRemove && <Btn small variant="ghost" icon={Trash2} title={t("onboarding.removePhoto")} onPress={() => onRemove("photo")} />}
      </Row>
      <Txt variant="tiny" muted>{t("onboarding.photoRule")} · {t("onboardingx.coverHint")}</Txt>
    </View>
  );
}

export function DocRow({ label, status, onUpload, busy }) {
  const { c } = useTheme();
  const { t } = useI18n();
  return (
    <Row gap={10} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 10, minHeight: 56 }}>
      <Txt variant="small" weight={700} style={{ flex: 1 }}>{label}</Txt>
      {status ? <Txt variant="tiny" weight={700} color={status === "validated" ? BRAND.electric : status === "rejected" ? "#F87171" : BRAND.orange}>{t(`dashboard.docStatus.${status}`)}</Txt> : null}
      <Btn small variant="outline" icon={FileUp} title={t("dashboard.docUpload")} loading={busy} onPress={onUpload} />
    </Row>
  );
}
