import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/AuthParts";
import { FormError } from "@/components/common/PageSkeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { userService } from "@/services/authService";
import { tokenStore } from "@/lib/api";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";

export function PrivacyActions() {
  const { t, te } = useI18n();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    try {
      const data = await userService.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "gofix-mes-donnees.json" });
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("account.exportDone"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };

  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await userService.deleteAccount(password);
      tokenStore.clear();
      setUser(false);
      toast.success(t("account.deleted"));
      navigate("/", { replace: true });
    } catch (err) {
      setError(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gf-card p-5 sm:p-6 mt-6" aria-labelledby="privacy-title">
      <h2 id="privacy-title" className="text-lg font-bold">{t("account.privacyTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("account.privacyText")}</p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <button type="button" className={ui.btnOutline} onClick={exportData} data-testid="account-export-button">
          <Download size={18} strokeWidth={1.5} />{t("account.exportBtn")}
        </button>
        <button type="button" className={`${ui.btnOutline} text-destructive border-destructive/40`} onClick={() => setOpen(true)} data-testid="account-delete-button">
          <Trash2 size={18} strokeWidth={1.5} />{t("account.deleteBtn")}
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl" data-testid="account-delete-dialog">
          <DialogHeader>
            <DialogTitle>{t("account.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("account.deleteText")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={remove} className="space-y-4">
            <label htmlFor="del-pw" className={ui.label}>{t("account.deletePassword")}</label>
            <PasswordInput id="del-pw" value={password} onChange={(e) => setPassword(e.target.value)} testId="account-delete-password-input" />
            <FormError message={error} testId="account-delete-error" />
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button type="button" className={ui.btnOutline} onClick={() => setOpen(false)} data-testid="account-delete-cancel">{t("common.cancel")}</button>
              <button type="submit" disabled={busy || !password} className={ui.btnDanger} data-testid="account-delete-confirm">{t("account.deleteConfirm")}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
