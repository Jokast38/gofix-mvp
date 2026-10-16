import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, MessageCircle, Plus } from "lucide-react";
import { Avatar } from "@/components/catalog/Cards";
import { PageHeader } from "@/components/common/PageSkeleton";
import { RequestDialog } from "@/components/requests/RequestDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n, useLocalized } from "@/i18n";
import { formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { marketplaceService, requestService } from "@/services/marketplaceService";

export const STATUS_COLOR = { sent: "var(--brand-violet)", seen: "var(--brand-blue)", accepted: "var(--brand-electric)", refused: "hsl(var(--destructive))" };

export function StatusPill({ status }) {
  const { t } = useI18n();
  const c = STATUS_COLOR[status] || "var(--brand-orange)";
  return <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ color: c, borderColor: `color-mix(in srgb, ${c} 50%, transparent)` }} data-testid={`status-${status}`}>{t(`requests.status.${status}`)}</span>;
}

function Label({ r }) {
  const loc = useLocalized();
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => marketplaceService.categories(), staleTime: 300_000, enabled: r.kind === "professional" });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: marketplaceService.subjects, staleTime: 300_000, enabled: r.kind === "teacher" });
  const name = r.kind === "teacher" ? loc(subjects.data?.find((s) => s.key === r.subject_key)) : loc(cats.data?.find((c) => c.key === r.category_key));
  return <span>{name || "—"}</span>;
}

export default function Requests() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const { data, isLoading } = useQuery({ queryKey: ["my-requests"], queryFn: requestService.mine, refetchInterval: 30_000 });
  const newOpen = sp.get("new") === "1";
  const newKind = user?.roles?.includes("student") ? "teacher" : "professional";

  return (
    <div className={`${ui.container} max-w-3xl py-6 sm:py-10`} data-testid="requests-page">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title={t("requests.title")} subtitle={t("requests.subtitle")} />
        <button type="button" onClick={() => setSp({ new: "1" })} className={`${ui.btnGradient} shrink-0`} data-testid="requests-new"><Plus size={18} /><span className="hidden sm:inline">{t("requests.new")}</span></button>
      </div>
      {isLoading ? <Skeleton className="h-48 rounded-xl" /> : !data?.items.length ? (
        <div className="py-14 text-center text-muted-foreground" data-testid="requests-empty">
          <ClipboardList size={36} strokeWidth={1.4} className="mx-auto mb-3" /><p>{t("requests.empty")}</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {data.items.map((r) => (
            <li key={r.id} className="gf-card p-4" data-testid={`request-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold"><Label r={r} /></p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)} · {t(`requests.modes.${r.mode}`)}</p>
                </div>
                {r.status === "closed" && <span className="text-xs text-muted-foreground">{t("requests.closed")}</span>}
              </div>
              <p className="mt-2 text-sm whitespace-pre-line line-clamp-3">{r.message}</p>
              <ul className="mt-3 divide-y divide-border">
                {r.recipients.map((x, i) => (
                  <li key={x.profile_id} className="flex items-center gap-3 py-2.5">
                    <Avatar thumbKey={x.photo_thumb_key} name={x.display_name} size="h-10 w-10" color="var(--brand-electric)" blurred={!x.display_name} />
                    <span className="flex-1 min-w-0 text-sm font-semibold truncate">{x.display_name || t("requests.hiddenProvider", { n: i + 1 })}</span>
                    <StatusPill status={x.status} />
                    {x.status === "accepted" && x.conversation_id && (
                      <Link to={`/messages/${x.conversation_id}`} className={ui.btnGhost} aria-label={t("requests.openConversation")} data-testid="request-open-conversation"><MessageCircle size={18} /></Link>
                    )}

                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted-foreground text-center" data-testid="requests-review-hint">{t("requests.reviewHint")} <Link to="/jobs" className="underline font-semibold">{t("jobs.title")}</Link></p>
      <RequestDialog open={newOpen} onOpenChange={(o) => !o && setSp({})} kind={newKind} />
    </div>
  );
}
