import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { socialService } from "@/services/marketplaceService";

export function NotificationsBell() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: socialService.notifications, refetchInterval: 60_000 });
  const unread = data?.unread || 0;
  const markAll = async () => {
    await socialService.readAll();
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  return (
    <Popover onOpenChange={(o) => !o && unread && markAll()}>
      <PopoverTrigger asChild>
        <button type="button" className={`${ui.btnGhost} relative`} aria-label={t("notif.title")} data-testid="header-notifications">
          <Bell size={20} strokeWidth={1.5} />
          {unread > 0 && <span className="absolute top-1.5 end-1.5 min-w-[18px] h-[18px] rounded-full gf-gradient-bg text-[10px] font-extrabold grid place-items-center px-1" data-testid="notif-count">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="notif-panel">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-extrabold text-sm">{t("notif.title")}</p>
          {unread > 0 && <button type="button" onClick={markAll} className="text-xs underline">{t("notif.markAll")}</button>}
        </div>
        <ul className="max-h-80 overflow-y-auto divide-y divide-border">
          {!data?.items?.length ? <li className="p-4 text-sm text-muted-foreground">{t("notif.empty")}</li> : data.items.map((n) => (
            <li key={n.id} className={n.read ? "" : "bg-secondary/60"}>
              <Link to={n.link || "/account"} className="block px-4 py-3 hover:bg-secondary">
                <p className="text-sm font-bold">{n.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(n.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
