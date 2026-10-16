import { useState } from "react";
import { toast } from "sonner";
import { Field, FormError, PageHeader } from "@/components/common/PageSkeleton";
import { useI18n } from "@/i18n";
import { publicService } from "@/services/publicService";
import { errorCode, isValidDzPhone } from "@/lib/format";
import { ui } from "@/lib/ui";

const INITIAL = { name: "", email: "", phone: "", subject: "", message: "" };

export default function Contact() {
  const { t, te } = useI18n();
  const [f, setF] = useState(INITIAL);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!f.email && !f.phone) return setError(t("contact.needContact"));
    if (f.phone && !isValidDzPhone(f.phone)) return setError(te("phone_invalid"));
    setBusy(true);
    try {
      await publicService.contact({ ...f, email: f.email || null, phone: f.phone || null });
      toast.success(t("contact.sent"));
      setF(INITIAL);
    } catch (err) {
      setError(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${ui.container} py-10 max-w-2xl`} data-testid="contact-page">
      <PageHeader title={t("contact.title")} subtitle={t("contact.subtitle")} />
      <form onSubmit={submit} className="gf-card p-5 sm:p-6 grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <Field id="c-name" label={t("contact.name")}>
            <input id="c-name" value={f.name} onChange={set("name")} required minLength={2} maxLength={80} className={ui.input} data-testid="contact-name-input" />
          </Field>
        </div>
        <Field id="c-email" label={t("contact.email")}>
          <input id="c-email" type="email" dir="ltr" value={f.email} onChange={set("email")} className={ui.input} data-testid="contact-email-input" />
        </Field>
        <Field id="c-phone" label={t("contact.phone")}>
          <input id="c-phone" type="tel" dir="ltr" value={f.phone} onChange={set("phone")} className={ui.input} placeholder={t("auth.phonePh")} data-testid="contact-phone-input" />
        </Field>
        <div className="sm:col-span-2">
          <Field id="c-subject" label={t("contact.subject")}>
            <input id="c-subject" value={f.subject} onChange={set("subject")} required maxLength={120} className={ui.input} data-testid="contact-subject-input" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="c-message" label={t("contact.message")}>
            <textarea id="c-message" value={f.message} onChange={set("message")} required minLength={10} maxLength={3000}
              className={`${ui.input} min-h-[140px] py-3`} data-testid="contact-message-input" />
          </Field>
        </div>
        <div className="sm:col-span-2 space-y-3">
          <FormError message={error} testId="contact-error" />
          <button type="submit" disabled={busy || f.name.length < 2 || f.message.length < 10 || f.subject.length < 2}
            className={`${ui.btnPrimary} w-full sm:w-auto`} data-testid="contact-submit-button">
            {busy ? t("common.loading") : t("contact.send")}
          </button>
        </div>
      </form>
    </div>
  );
}
