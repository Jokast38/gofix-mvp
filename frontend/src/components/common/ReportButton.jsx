import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";
import { requestService } from "@/services/marketplaceService";

const REASONS = ["fake_profile", "inappropriate", "fraud", "harassment", "spam", "other"];

export function ReportButton({ targetType, targetId, compact = false, open: openProp, onOpenChange, hideTrigger = false }) {
  const { t, te } = useI18n();
  const { user } = useAuth();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [reason, setReason] = useState("fake_profile");
  const [details, setDetails] = useState("");
  if (!user) return null;

  const send = async (e) => {
    e.preventDefault();
    try {
      await requestService.report({ target_type: targetType, target_id: targetId, reason, details });
      toast.success(t("report.sent"));
      setOpen(false);
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };

  return (
    <>
      {!hideTrigger && <button type="button" onClick={() => setOpen(true)} data-testid={`report-${targetType}`}
        className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive ${compact ? "" : "min-h-[44px] px-2"}`}>
        <Flag size={14} aria-hidden="true" />{t("report.button")}
      </button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="report-dialog">
          <DialogHeader>
            <DialogTitle>{t("report.title")}</DialogTitle>
            <DialogDescription>{t("report.hint")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={send} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} data-testid={`report-reason-${r}`}
                  className={`rounded-xl border px-3 min-h-[44px] text-xs font-bold text-start ${reason === r ? "border-destructive bg-destructive/10" : "border-border"}`}>{t(`report.reasons.${r}`)}</button>
              ))}
            </div>
            <textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("report.detailsPh")}
              className={`${ui.input} py-3`} data-testid="report-details" />
            <button type="submit" className={`${ui.btnDanger} w-full`} data-testid="report-submit">{t("report.send")}</button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
