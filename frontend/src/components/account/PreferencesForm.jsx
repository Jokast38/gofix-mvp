import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, LocateFixed, Trash2 } from "lucide-react";
import { Avatar } from "@/components/catalog/Cards";
import { Field } from "@/components/common/PageSkeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useWilayas } from "@/hooks/usePublic";
import { LANGUAGES, useI18n, useLocalized } from "@/i18n";
import { userService } from "@/services/authService";
import { detectWilaya } from "@/lib/geo";
import { errorCode, formatPhone } from "@/lib/format";
import { ui } from "@/lib/ui";

const plainPhone = (p) => (p ? formatPhone(p).replace(/[⁦⁩]/g, "") : "");

/** Optional profile photo, for every account (clients included). */
export function ProfilePhoto() {
  const { t, te } = useI18n();
  const { user, setUser } = useAuth();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    setBusy(true);
    try {
      setUser(await fn());
      toast.success(ok);
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) run(() => userService.uploadPhoto(file), t("accountEdit.photoSaved"));
  };
  return (
    <div className="flex items-center gap-4" data-testid="account-photo-block">
      <Avatar photoKey={user.photo_key} thumbKey={user.photo_thumb_key} name={user.full_name} size="h-20 w-20 text-2xl" color="var(--brand-electric)" large />
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} data-testid="account-photo-input" />
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${ui.btnOutline} min-h-[40px]`} data-testid="account-photo-button">
          <Camera size={16} aria-hidden="true" />{user.photo_key ? t("accountEdit.changePhoto") : t("accountEdit.addPhoto")}
        </button>
        {user.photo_key && (
          <button type="button" onClick={() => run(userService.deletePhoto, t("accountEdit.photoRemoved"))} disabled={busy} className={`${ui.btnGhost} min-h-[40px]`}
            data-testid="account-photo-remove">
            <Trash2 size={16} aria-hidden="true" />{t("accountEdit.removePhoto")}
          </button>
        )}
      </div>
    </div>
  );
}

export function PreferencesForm() {
  const { t, te, setLang } = useI18n();
  const loc = useLocalized();
  const { user, setUser } = useAuth();
  const { data: wilayas = [] } = useWilayas();
  const [f, setF] = useState({ full_name: user.full_name, email: user.email || "", phone: plainPhone(user.phone), wilaya_code: user.wilaya_code || "",
    preferred_language: user.preferred_language, week_start: user.week_start });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const detect = async () => {
    setLocating(true);
    const res = await detectWilaya();
    setLocating(false);
    if (res.wilaya) {
      setF((s) => ({ ...s, wilaya_code: res.wilaya.code }));
      toast.success(t("geoloc.found", { name: loc(res.wilaya) }));
    } else toast.error(te(res.error));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const patch = { full_name: f.full_name, preferred_language: f.preferred_language, week_start: f.week_start };
      if (f.email.trim() && f.email.trim().toLowerCase() !== (user.email || "")) patch.email = f.email.trim();
      if (f.phone.trim() && f.phone.trim() !== plainPhone(user.phone)) patch.phone = f.phone.trim();
      if (f.wilaya_code) patch.wilaya_code = Number(f.wilaya_code);
      const u = await userService.update(patch);
      setUser(u);
      setLang(u.preferred_language);
      toast.success(t("account.saved"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gf-card p-5 sm:p-6 mt-6" aria-labelledby="prefs-title">
      <h2 id="prefs-title" className="text-lg font-bold">{t("accountEdit.title")}</h2>
      <div className="mt-4"><ProfilePhoto /></div>
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field id="pref-name" label={t("auth.fullName")}>
            <input id="pref-name" value={f.full_name} onChange={set("full_name")} minLength={2} maxLength={80} className={ui.input} data-testid="prefs-name-input" />
          </Field>
        </div>
        <Field id="pref-email" label={t("accountEdit.email")}>
          <input id="pref-email" type="email" dir="ltr" value={f.email} onChange={set("email")} autoComplete="email" className={ui.input} data-testid="prefs-email-input" />
        </Field>
        <Field id="pref-phone" label={t("accountEdit.phone")}>
          <input id="pref-phone" type="tel" dir="ltr" value={f.phone} onChange={set("phone")} autoComplete="tel" className={ui.input} data-testid="prefs-phone-input" />
          <p className="mt-1 text-xs text-muted-foreground">{t("accountEdit.phoneNote")}</p>
        </Field>
        <div className="md:col-span-2">
          <Field id="pref-wilaya" label={t("accountEdit.wilaya")}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select id="pref-wilaya" value={f.wilaya_code} onChange={set("wilaya_code")} className={ui.input} data-testid="prefs-wilaya-select">
                <option value="">{t("accountEdit.wilayaPh")}</option>
                {wilayas.map((w) => <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, "0")} – ${loc(w)}`}</option>)}
              </select>
              <button type="button" onClick={detect} disabled={locating} className={`${ui.btnOutline} shrink-0`} data-testid="prefs-detect-wilaya">
                <LocateFixed size={16} aria-hidden="true" />{locating ? t("geoloc.detecting") : t("geoloc.detect")}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("geoloc.why")}</p>
          </Field>
        </div>
        <Field id="pref-lang" label={t("prefs.language")}>
          <select id="pref-lang" value={f.preferred_language} onChange={set("preferred_language")} className={ui.input} data-testid="prefs-language-select">
            {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field id="pref-week" label={t("account.weekStart")}>
          <select id="pref-week" value={f.week_start} onChange={set("week_start")} className={ui.input} data-testid="prefs-weekstart-select">
            <option value="saturday">{t("account.saturday")}</option>
            <option value="sunday">{t("account.sunday")}</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <button type="submit" disabled={busy} className={`${ui.btnPrimary} w-full sm:w-auto`} data-testid="prefs-save-button">
            {busy ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </form>
    </section>
  );
}
