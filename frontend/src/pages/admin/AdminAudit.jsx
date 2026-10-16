import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/publicService";
import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";

async function downloadRegister() {
  const data = await adminService.processingRegister();
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  Object.assign(document.createElement("a"), { href: url, download: "gofix-registre-traitements.json" }).click();
  URL.revokeObjectURL(url);
}

export function AdminAudit() {
  const { t } = useI18n();
  const [action, setAction] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-audit", action], queryFn: () => adminService.auditLogs({ action }) });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={action} onChange={(e) => setAction(e.target.value)} placeholder={t("admin.audit.filter")} dir="ltr" className={ui.input} data-testid="admin-audit-filter" />
        <button type="button" onClick={downloadRegister} className={`${ui.btnOutline} shrink-0`} data-testid="admin-export-register">
          <Download size={18} strokeWidth={1.5} />{t("admin.exportRegister")}
        </button>
      </div>
      {isLoading ? <Skeleton className="h-48 rounded-xl" /> : !data?.items.length ? (
        <p className="gf-card p-6 text-center text-muted-foreground">{t("admin.audit.empty")}</p>
      ) : (
        <ul className="space-y-2" data-testid="admin-audit-list">
          {data.items.map((a) => (
            <li key={a.id} className="gf-card p-3 text-sm grid gap-1 sm:grid-cols-[180px_1fr_1fr]">
              <span className="text-xs text-muted-foreground" dir="ltr">{formatDateTime(a.created_at)}</span>
              <span className="font-mono font-bold" dir="ltr">{a.action}</span>
              <span className="text-xs text-muted-foreground truncate" dir="ltr">
                {a.actor_email || "—"} → {a.target_type}:{a.target_id} {Object.keys(a.meta || {}).length > 0 && JSON.stringify(a.meta)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
