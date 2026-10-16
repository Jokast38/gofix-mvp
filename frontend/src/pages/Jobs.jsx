import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { PageHeader, PageSkeleton } from "@/components/common/PageSkeleton";
import { JobCard, JobsEmpty } from "@/components/jobs/Jobs";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";
import { jobService } from "@/services/marketplaceService";

const TABS = { upcoming: ["proposed", "scheduled", "disputed"], past: ["completed", "cancelled", "failed"] };

export function JobsList({ role }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("upcoming");
  const { data, isLoading } = useQuery({ queryKey: ["jobs", tab], queryFn: () => jobService.list({ status: TABS[tab].join(",") }), refetchInterval: 30_000 });
  const items = (data?.items || []).filter((j) => !role || j.role === role);
  const sorted = tab === "upcoming" ? [...items].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)) : items;
  return (
    <div>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1 mb-4" role="tablist">
        {Object.keys(TABS).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`jobs-tab-${k}`}
            className={`min-h-[44px] rounded-xl text-sm font-bold ${tab === k ? "bg-background shadow" : "text-muted-foreground"}`}>{t(`jobs.tabs.${k}`)}</button>
        ))}
      </div>
      {isLoading ? <Skeleton className="h-40 rounded-xl" /> : !sorted.length ? <JobsEmpty text={t(`jobs.empty.${tab}`)} /> : (
        <ul className="grid gap-3">{sorted.map((j) => <li key={j.id}><JobCard job={j} /></li>)}</ul>
      )}
    </div>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({ queryKey: ["jobs", "one", id], queryFn: () => jobService.get(id) });
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <div className={`${ui.container} py-16 text-center`}><p className="font-bold">{t("notFound.title")}</p></div>;
  return (
    <div className={`${ui.container} max-w-2xl py-6 sm:py-10`} data-testid="job-detail">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground min-h-[44px]"><ArrowLeft size={16} className="rtl:rotate-180" />{t("jobs.title")}</Link>
      <JobCard job={data} />
      <Link to={`/messages/${data.conversation_id}`} className={`${ui.btnOutline} w-full mt-4`}><MessageCircle size={18} />{t("requests.openConversation")}</Link>
      {data.history?.length > 0 && (
        <section className="gf-card p-4 mt-4">
          <h2 className="font-extrabold mb-2">{t("jobs.history")}</h2>
          <ol className="space-y-1.5 text-sm">
            {data.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{t(`jobs.status.${h.status}`, {})}{h.reason ? ` — ${h.reason}` : ""}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t(`jobs.by.${h.by}`)} · {new Date(h.at).toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" })}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default function Jobs() {
  const { t } = useI18n();
  return (
    <div className={`${ui.container} max-w-2xl py-6 sm:py-10`} data-testid="jobs-page">
      <PageHeader title={t("jobs.title")} subtitle={t("jobs.subtitle")} />
      <JobsList />
    </div>
  );
}
