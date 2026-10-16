import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/publicService";
import { useI18n } from "@/i18n";
import { errorCode, formatDate, formatPhone } from "@/lib/format";
import { ui } from "@/lib/ui";

const ROLES = ["client", "professional", "teacher", "student"];

function StatusDialog({ target, onClose }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const next = target?.status === "suspended" ? "active" : "suspended";
  const submit = async (e) => {
    e.preventDefault();
    try {
      await adminService.setUserStatus(target.id, next, reason);
      toast.success(t("admin.saved"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-xl" data-testid="admin-status-dialog">
        <DialogHeader><DialogTitle>{t("admin.users.reasonTitle")} — {target?.full_name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.users.reasonPh")} minLength={3} maxLength={300}
            className={`${ui.input} min-h-[100px] py-3`} data-testid="admin-status-reason-input" />
          <button type="submit" disabled={reason.trim().length < 3} className={next === "suspended" ? ui.btnDanger : ui.btnPrimary} data-testid="admin-status-confirm">
            {t(next === "suspended" ? "admin.users.suspend" : "admin.users.activate")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUsers() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ["admin-users", q, role, page], queryFn: () => adminService.users({ q, role, page }) });
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 20));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("admin.users.search")} className={ui.input} data-testid="admin-users-search" />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={`${ui.input} sm:w-56`} data-testid="admin-users-role-filter">
          <option value="">{t("admin.users.allRoles")}</option>
          {ROLES.map((r) => <option key={r} value={r}>{t(`account.modes.${r}`)}</option>)}
        </select>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="admin-users-total">{t("admin.users.total", { n: data?.total ?? 0 })}</p>
      {isLoading ? <Skeleton className="h-48 rounded-xl" /> : !data?.items.length ? (
        <p className="gf-card p-6 text-center text-muted-foreground">{t("admin.users.empty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="admin-users-list">
          {data.items.map((u) => (
            <li key={u.id} className="gf-card p-4 flex items-start justify-between gap-3" data-testid={`admin-user-${u.id}`}>
              <div className="min-w-0">
                <p className="font-bold truncate">{u.full_name}</p>
                <p className="text-xs text-muted-foreground truncate" dir="ltr">{u.email} {u.phone && `· ${formatPhone(u.phone)}`}</p>
                <p className="mt-1 text-xs">{u.roles.map((r) => t(`account.modes.${r}`)).join(", ")}{u.admin_role && ` · ${u.admin_role}`}</p>
                <p className="text-xs text-muted-foreground">{t("admin.users.created")} {formatDate(u.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-xs font-bold ${u.status === "active" ? "text-brand-electric" : "text-destructive"}`}>{t(`admin.users.${u.status}`)}</span>
                {!u.admin_role && (
                  <button type="button" onClick={() => setTarget(u)} className={`${ui.btnOutline} min-h-[36px] text-xs px-3`} data-testid={`admin-user-toggle-${u.id}`}>
                    {t(u.status === "suspended" ? "admin.users.activate" : "admin.users.suspend")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={ui.btnOutline} data-testid="admin-users-prev">{t("admin.users.prev")}</button>
        <span className="self-center text-sm">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className={ui.btnOutline} data-testid="admin-users-next">{t("admin.users.next")}</button>
      </div>
      <StatusDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
