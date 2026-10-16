import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/publicService";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";

export function AdminFlags({ canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-flags"], queryFn: adminService.flags });

  const toggle = async (key, enabled) => {
    try {
      await adminService.setFlag(key, enabled);
      qc.invalidateQueries({ queryKey: ["admin-flags"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      toast.success(t("admin.saved"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">{t("admin.flags.hint")} {!canEdit && t("admin.flags.readOnly")}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {data.map((f) => (
          <li key={f.key} className="gf-card p-4 flex items-center justify-between gap-4" data-testid={`admin-flag-${f.key}`}>
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold" dir="ltr">{f.key}</p>
              <p className="text-xs text-muted-foreground">{f.description}</p>
              <span className={`mt-1 inline-block text-[11px] font-bold ${f.mvp ? "text-brand-electric" : "text-brand-orange"}`}>
                {f.mvp ? t("admin.flags.mvp") : t("admin.flags.future")}
              </span>
            </div>
            <Switch checked={f.enabled} disabled={!canEdit} onCheckedChange={(v) => toggle(f.key, v)}
              aria-label={f.key} data-testid={`admin-flag-switch-${f.key}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
