import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/publicService";
import { useI18n } from "@/i18n";

const KEYS = ["users_total", "clients", "professionals", "teachers", "students", "suspended", "open_tickets"];

export function AdminStats() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: adminService.stats });
  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  const max = Math.max(1, ...(data?.signups_by_day || []).map((d) => d.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {KEYS.map((k) => (
          <div key={k} className="gf-card p-4" data-testid={`admin-stat-${k}`}>
            <p className="text-xs text-muted-foreground">{t(`admin.stats.${k}`)}</p>
            <p className="mt-1 text-2xl font-extrabold">{data?.[k] ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="gf-card p-5" data-testid="admin-signups-chart">
        <h3 className="font-bold">{t("admin.stats.signups")}</h3>
        {data?.signups_by_day?.length ? (
          <ul className="mt-4 space-y-2">
            {data.signups_by_day.map((d) => (
              <li key={d.date} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-muted-foreground" dir="ltr">{d.date.split("-").reverse().join("/")}</span>
                <span className="h-3 rounded-full bg-primary" style={{ width: `${(d.count / max) * 100}%`, minWidth: 6 }} />
                <span className="font-bold">{d.count}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted-foreground">{t("admin.stats.noSignups")}</p>}
      </div>
    </div>
  );
}
