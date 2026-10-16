import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, MailCheck, MailWarning, ShieldCheck, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminService } from "@/services/publicService";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";

const STAFF_ROLES = ["moderator", "support", "super_admin"];
const ACCOUNT_TYPES = ["client", "student", "professional", "teacher"];
const EMPTY = { kind: "staff", full_name: "", email: "", phone: "", admin_role: "moderator", account_type: "client", preferred_language: "fr", send_invite: true };

function KindCard({ value, current, onSelect, icon: Icon, title, text }) {
  const active = value === current;
  return (
    <button type="button" onClick={() => onSelect(value)} aria-pressed={active} data-testid={`create-user-kind-${value}`}
      className={`gf-card w-full p-3 text-start ${active ? "ring-2 ring-primary" : ""}`}>
      <span className="flex items-center gap-2 font-bold"><Icon size={18} aria-hidden="true" />{title}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{text}</span>
    </button>
  );
}

/** Super-admin: create a back-office collaborator or a platform account. The temporary password is shown once. */
export function CreateUserDialog({ open, onClose }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setKind = (kind) => setForm((f) => ({ ...f, kind }));

  const close = () => { setForm(EMPTY); setResult(null); setCopied(false); onClose(); };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { phone, admin_role, account_type, ...rest } = form;
      const payload = { ...rest, phone: phone.trim() || null, ...(form.kind === "staff" ? { admin_role } : { account_type }) };
      setResult(await adminService.createUser(payload));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    const text = [t("usercreate.copyIntro"), `${t("usercreate.copyEmail")} : ${result.user.email}`,
      `${t("usercreate.copyPassword")} : ${result.temporary_password}`, `${window.location.origin}/login`].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast.error(t("usercreate.copyFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl" data-testid="create-user-dialog">
        <DialogHeader><DialogTitle>{t(result ? "usercreate.doneTitle" : "usercreate.title")}</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-4" data-testid="create-user-result">
            <p className="text-sm"><b>{result.user.full_name}</b> · <span dir="ltr">{result.user.email}</span></p>
            <div className={`flex gap-2 rounded-xl border p-3 text-sm ${result.invite_sent ? "border-border" : "border-amber-500/60"}`} data-testid="create-user-invite-status">
              {result.invite_sent ? <MailCheck className="shrink-0 text-emerald-500" size={18} aria-hidden="true" /> : <MailWarning className="shrink-0 text-amber-500" size={18} aria-hidden="true" />}
              <span>{t(result.invite_sent ? "usercreate.inviteSent" : form.send_invite ? "usercreate.inviteFailed" : "usercreate.noInvite")}</span>
            </div>
            <div>
              <p className={ui.label}>{t("usercreate.tempPassword")}</p>
              <p className="select-all rounded-xl bg-secondary px-3 py-2.5 font-mono text-base tracking-wide" dir="ltr" data-testid="create-user-temp-password">{result.temporary_password}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("usercreate.tempHint")}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={copy} className={`${ui.btnOutline} flex-1`} data-testid="create-user-copy">
                {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{t(copied ? "usercreate.copied" : "usercreate.copy")}
              </button>
              <button type="button" onClick={close} className={`${ui.btnPrimary} flex-1`} data-testid="create-user-close">{t("usercreate.close")}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <KindCard value="staff" current={form.kind} onSelect={setKind} icon={ShieldCheck} title={t("usercreate.kind.staff")} text={t("usercreate.kindText.staff")} />
              <KindCard value="client" current={form.kind} onSelect={setKind} icon={UserRound} title={t("usercreate.kind.client")} text={t("usercreate.kindText.client")} />
            </div>
            <div>
              <label className={ui.label} htmlFor="cu-name">{t("usercreate.fullName")}</label>
              <input id="cu-name" value={form.full_name} onChange={set("full_name")} required minLength={2} maxLength={80} autoComplete="off" className={ui.input} data-testid="create-user-name" />
            </div>
            <div>
              <label className={ui.label} htmlFor="cu-email">{t("usercreate.email")}</label>
              <input id="cu-email" type="email" value={form.email} onChange={set("email")} required dir="ltr" autoComplete="off" className={ui.input} data-testid="create-user-email" />
            </div>
            <div>
              <label className={ui.label} htmlFor="cu-phone">{t("usercreate.phone")}</label>
              <input id="cu-phone" type="tel" value={form.phone} onChange={set("phone")} dir="ltr" inputMode="tel" placeholder="05 xx xx xx xx" autoComplete="off" className={ui.input} data-testid="create-user-phone" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {form.kind === "staff" ? (
                <div>
                  <label className={ui.label} htmlFor="cu-role">{t("usercreate.adminRole")}</label>
                  <select id="cu-role" value={form.admin_role} onChange={set("admin_role")} className={ui.input} data-testid="create-user-admin-role">
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{t(`usercreate.roles.${r}`)}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={ui.label} htmlFor="cu-type">{t("usercreate.accountType")}</label>
                  <select id="cu-type" value={form.account_type} onChange={set("account_type")} className={ui.input} data-testid="create-user-account-type">
                    {ACCOUNT_TYPES.map((r) => <option key={r} value={r}>{t(`account.modes.${r}`)}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={ui.label} htmlFor="cu-lang">{t("usercreate.language")}</label>
                <select id="cu-lang" value={form.preferred_language} onChange={set("preferred_language")} className={ui.input} data-testid="create-user-language">
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
            {form.kind === "staff" && <p className="text-xs text-muted-foreground" data-testid="create-user-role-help">{t(`usercreate.roleHelp.${form.admin_role}`)}</p>}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={form.send_invite} onChange={set("send_invite")} className="mt-1 h-4 w-4" data-testid="create-user-invite" />
              <span>{t("usercreate.sendInvite")}</span>
            </label>
            <button type="submit" disabled={busy} className={`${ui.btnPrimary} w-full`} data-testid="create-user-submit">{t("usercreate.submit")}</button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
