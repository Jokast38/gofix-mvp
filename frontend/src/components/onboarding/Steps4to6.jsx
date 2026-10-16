import { useRef, useState } from "react";
import { Camera, CircleAlert, FileCheck, FileUp, ImagePlus, Loader2, MapPin, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/PageSkeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useWilayas } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { fileUrl, marketplaceService, onboardingService } from "@/services/marketplaceService";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";
import { ChoiceGrid, StepTitle, useList } from "./Parts";

// Step 4 — zones (wilaya + communes + radius)
export function StepZones({ d, update, kind }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const { data: wilayas = [] } = useWilayas();
  const [code, setCode] = useState("");
  const zones = d.zones || [];
  const communes = useList(["communes", code], () => marketplaceService.communes(Number(code)), Boolean(code));
  const onlineOnly = kind === "teacher" && d.formats?.length === 1 && d.formats[0] === "online";
  const zone = zones.find((z) => z.wilaya_code === Number(code));
  const setZone = (patch) => update({ zones: zones.map((z) => (z.wilaya_code === Number(code) ? { ...z, ...patch } : z)) });
  const addWilaya = (c) => {
    setCode(c);
    if (c && !zones.find((z) => z.wilaya_code === Number(c))) update({ zones: [...zones, { wilaya_code: Number(c), commune_names: [], radius_km: 10 }] });
  };
  return (
    <>
      <StepTitle title={t("onboarding.s4Title")} hint={onlineOnly ? t("onboarding.s4OnlineHint") : t("onboarding.s4Hint")} />
      <Field id="ob-wilaya" label={t("home.wilayaLabel")}>
        <select id="ob-wilaya" value={code} onChange={(e) => addWilaya(e.target.value)} className={`${ui.input} appearance-none`} data-testid="onboarding-wilaya-select">
          <option value="">{t("onboarding.pickWilaya")}</option>
          {wilayas.map((w) => <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, "0")} – ${loc(w)}`}</option>)}
        </select>
      </Field>
      {zone && (
        <div className="mt-4 space-y-4 rounded-xl border border-border p-4" data-testid="onboarding-zone-editor">
          <div>
            <p className={ui.label}>{t("onboarding.communes")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span></p>
            <div className="flex flex-wrap gap-2">
              {(communes.data || []).map((c) => {
                const on = zone.commune_names.includes(c.name_fr);
                return (
                  <button key={c.name_fr} type="button" aria-pressed={on} data-testid={`onboarding-commune-${c.name_fr}`}
                    onClick={() => setZone({ commune_names: on ? zone.commune_names.filter((n) => n !== c.name_fr) : [...zone.commune_names, c.name_fr] })}
                    className={`rounded-full border px-3 min-h-[36px] text-xs font-semibold transition-colors ${on ? "border-brand-electric bg-brand-electric/15" : "border-border"}`}>{loc(c)}</button>
                );
              })}
            </div>
          </div>
          <Field id="ob-radius" label={`${t("onboarding.radius")} : ${zone.radius_km} km`}>
            <input id="ob-radius" type="range" min={2} max={60} step={1} value={zone.radius_km} onChange={(e) => setZone({ radius_km: Number(e.target.value) })} className="w-full accent-[#00d1ff]" data-testid="onboarding-radius" />
          </Field>
        </div>
      )}
      <ul className="mt-5 flex flex-wrap gap-2" data-testid="onboarding-zones-list">
        {zones.map((z) => {
          const w = wilayas.find((x) => x.code === z.wilaya_code);
          return (
            <li key={z.wilaya_code} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${Number(code) === z.wilaya_code ? "border-brand-electric" : "border-border"}`}>
              <MapPin size={14} strokeWidth={1.6} className="text-brand-pink" aria-hidden="true" />
              <button type="button" onClick={() => setCode(String(z.wilaya_code))}>{loc(w)} · {z.radius_km} km{z.commune_names.length ? ` · ${z.commune_names.length}` : ""}</button>
              <button type="button" aria-label={t("common.close")} onClick={() => { update({ zones: zones.filter((x) => x.wilaya_code !== z.wilaya_code) }); if (Number(code) === z.wilaya_code) setCode(""); }} data-testid={`onboarding-zone-remove-${z.wilaya_code}`} className="ms-1 text-muted-foreground hover:text-destructive"><X size={14} /></button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// Step 5 — pricing + availability
const DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
const SLOTS = ["morning", "afternoon", "evening"];
export function StepPricing({ d, update, kind }) {
  const { t } = useI18n();
  const priceKey = kind === "teacher" ? "price_hint_da_hour" : "price_hint_da";
  const slots = d.slots || [];
  const has = (day, s) => slots.some((x) => x.day === day && x.slot === s);
  const toggle = (day, s) => update({ slots: has(day, s) ? slots.filter((x) => !(x.day === day && x.slot === s)) : [...slots, { day, slot: s }] });
  return (
    <>
      <StepTitle title={t("onboarding.s5Title")} hint={t("onboarding.s5Hint")} />
      <Field id="ob-price" label={t(`onboarding.${kind}.price`)} hint={t("onboarding.priceHint")}>
        <div className="relative">
          <input id="ob-price" type="number" min={0} step={100} inputMode="numeric" value={d[priceKey] ?? ""} onChange={(e) => update({ [priceKey]: e.target.value === "" ? null : Number(e.target.value) })}
            className={`${ui.input} pe-14`} dir="ltr" data-testid="onboarding-price" />
          <span className="absolute top-1/2 -translate-y-1/2 end-4 text-sm font-bold text-muted-foreground">DA</span>
        </div>
      </Field>
      <p className={`${ui.label} mt-6`}>{t("onboarding.availability")}</p>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs" data-testid="onboarding-availability">
          <thead><tr><th className="text-start p-1" />{SLOTS.map((s) => <th key={s} className="p-1 font-semibold text-muted-foreground">{t(`onboarding.slots.${s}`)}</th>)}</tr></thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day}>
                <td className="p-1 font-bold">{t(`onboarding.days.${day}`)}</td>
                {SLOTS.map((s) => (
                  <td key={s} className="p-1 text-center">
                    <button type="button" aria-pressed={has(day, s)} onClick={() => toggle(day, s)} data-testid={`onboarding-slot-${day}-${s}`}
                      className={`h-9 w-full rounded-lg border transition-colors ${has(day, s) ? "bg-brand-electric/20 border-brand-electric" : "border-border hover:bg-secondary"}`} aria-label={`${day} ${s}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Step 6 — photo + documents (declared)
export function StepMedia({ d, update, kind }) {
  const { t, te } = useI18n();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const coverInput = useRef(null);
  const [docBusy, setDocBusy] = useState(null);
  const docs = (d.documents || []).map((x) => (typeof x === "string" ? { type: x, status: "declared" } : x));
  const required = kind === "teacher" ? ["id_card", "diploma"] : ["id_card", "trade_register"];
  const docOf = (k) => docs.find((x) => x.type === k);
  const toggleDoc = (k) => update({ documents: docOf(k) ? docs.filter((x) => x.type !== k) : [...docs, { type: k, status: "declared" }] });
  const onDoc = async (k, file) => {
    if (!file) return;
    setDocBusy(k);
    try {
      const { data } = await onboardingService.uploadDocument(k, file);
      update({ documents: [...docs.filter((x) => x.type !== k), data] });
      toast.success(t("onboardingx.docUploaded"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setDocBusy(null);
    }
  };
  const onCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { data } = await onboardingService.uploadCover(file);
      update({ cover_key: data.cover_key, cover_thumb_key: data.cover_thumb_key });
      toast.success(t("onboardingx.coverOk"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { data } = await onboardingService.uploadPhoto(file);
      update({ photo_key: data.photo_key, photo_thumb_key: data.photo_thumb_key });
      toast.success(t("onboarding.photoOk"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };
  return (
    <>
      <StepTitle title={t("onboarding.s6Title")} hint={t("onboarding.s6Hint")} />
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 rounded-full border border-border bg-secondary overflow-hidden grid place-items-center" data-testid="onboarding-photo-preview">
          {d.photo_key ? <img src={fileUrl(d.photo_key)} alt="" className="h-full w-full object-cover" /> : <Camera size={30} strokeWidth={1.4} className="text-muted-foreground" />}
        </div>
        <div className="space-y-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} data-testid="onboarding-photo-input" />
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className={ui.btnOutline} data-testid="onboarding-photo-button">
            <Camera size={16} strokeWidth={1.6} />{busy ? t("common.loading") : d.photo_key ? t("onboarding.changePhoto") : t("onboarding.addPhoto")}
          </button>
          {d.photo_key && <button type="button" onClick={() => update({ photo_key: null, photo_thumb_key: null })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive" data-testid="onboarding-photo-remove"><Trash2 size={14} />{t("onboarding.removePhoto")}</button>}
          <p className="text-xs text-muted-foreground">{t("onboarding.photoRule")}</p>
        </div>
      </div>
      <p className={`${ui.label} mt-6`}>{t("onboardingx.cover")}</p>
      <div className="relative h-24 rounded-xl border border-border overflow-hidden bg-secondary grid place-items-center" data-testid="onboarding-cover-preview">
        {d.cover_key ? <img src={fileUrl(d.cover_thumb_key || d.cover_key)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <ImagePlus size={28} strokeWidth={1.4} className="text-muted-foreground" />}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onCover} data-testid="onboarding-cover-input" />
        <button type="button" onClick={() => coverInput.current?.click()} disabled={busy} className={ui.btnOutline} data-testid="onboarding-cover-button"><ImagePlus size={16} />{d.cover_key ? t("onboardingx.coverChange") : t("onboardingx.coverAdd")}</button>
        {d.cover_key && <button type="button" onClick={() => update({ cover_key: null, cover_thumb_key: null })} className="text-xs text-muted-foreground hover:text-destructive">{t("onboarding.removePhoto")}</button>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("onboardingx.coverHint")}</p>
      <p className={`${ui.label} mt-6`}>{t("onboarding.documents")}</p>
      <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1"><CircleAlert size={14} className="mt-0.5 shrink-0" />{t("onboarding.documentsHint")}</p>
      <div className="space-y-2">
        {required.map((k) => {
          const doc = docOf(k);
          return (
            <div key={k} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm min-h-[48px]">
              <Checkbox checked={Boolean(doc)} onCheckedChange={() => toggleDoc(k)} className="h-5 w-5" data-testid={`onboarding-doc-${k}`} aria-label={t(`onboarding.docs.${k}`)} />
              <FileCheck size={18} strokeWidth={1.6} className="text-brand-electric" aria-hidden="true" />
              <span className="font-semibold flex-1 min-w-[120px]">{t(`onboarding.docs.${k}`)}</span>
              {doc?.key ? <span className="text-xs font-bold text-brand-electric" data-testid={`onboarding-doc-uploaded-${k}`}>{t("onboardingx.docSent")}</span> : null}
              <label className={`${ui.btnOutline} min-h-[40px] px-3 text-xs cursor-pointer`}>
                {docBusy === k ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}{t("onboardingx.docUpload")}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { onDoc(k, e.target.files?.[0]); e.target.value = ""; }} data-testid={`onboarding-doc-file-${k}`} />
              </label>
            </div>
          );
        })}
      </div>
    </>
  );
}
