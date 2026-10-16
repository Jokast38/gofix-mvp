import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { formatDA } from "@/lib/format";
import { adminDisputeService, adminOpsService } from "@/services/marketplaceService";
import { formatDateTime } from "@/lib/format";
import { AdminStats } from "./AdminStats";

function Bar({ label, value, max, suffix = "", testId }) {
  return (
    <li className="flex items-center gap-3 text-xs" data-testid={testId}>
      <span className="w-28 shrink-0 text-muted-foreground truncate">{label}</span>
      <span className="h-3 rounded-full bg-primary" style={{ width: `${max ? (value / max) * 100 : 0}%`, minWidth: 4 }} />
      <span className="font-bold whitespace-nowrap">{value}{suffix}</span>
    </li>
  );
}

function Card({ title, children, testId }) {
  return <section className="gf-card p-5" data-testid={testId}><h3 className="font-bold mb-3">{title}</h3>{children}</section>;
}

function MatchResults() {
  const { t } = useI18n();
  const { data = [] } = useQuery({ queryKey: ["admin-match-results"], queryFn: adminDisputeService.matchResults });
  return (
    <Card title={t("adminx.matchResults")} testId="admin-match-results">
      {!data.length ? <p className="text-sm text-muted-foreground">—</p> : (
        <ul className="space-y-3 text-xs">
          {data.slice(0, 8).map((m) => (
            <li key={m.id} className="rounded-xl border border-border p-3">
              <p className="font-bold">{formatDateTime(m.created_at)} · {m.source} · {m.kind} · <span dir="ltr">{m.formula_version}</span></p>
              <p className="text-muted-foreground">{t("adminx.matchCtx", { n: m.candidate_count, ms: m.latency_ms })} {Object.entries(m.context || {}).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" · ")}</p>
              <ol className="mt-1 space-y-0.5">
                {m.results.slice(0, 3).map((r) => <li key={r.profile_id}>#{r.rank} {r.name} — <b>{r.score}</b> · {r.reasons.map((x) => x.code).join(", ")}</li>)}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AdminDashboard() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminOpsService.dashboard, refetchInterval: 60_000 });
  return (
    <div className="space-y-6">
      <AdminStats />
      {isLoading || !data ? <Skeleton className="h-64 rounded-xl" /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="admin-queues">
            {Object.entries(data.queues).map(([k, v]) => (
              <div key={k} className="gf-card p-4"><p className="text-xs text-muted-foreground">{t(`adminx.queues.${k}`)}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {["professional", "teacher"].map((kind) => {
              const steps = data.funnel[kind];
              const max = Math.max(1, ...steps.map((s) => s.reached));
              return (
                <Card key={kind} title={t("adminx.funnel", { kind: t(`onboarding.${kind}.title`) })} testId={`admin-funnel-${kind}`}>
                  <ul className="space-y-2">
                    {steps.map((s) => (
                      <li key={s.step} className="flex items-center gap-3 text-xs">
                        <span className="w-24 shrink-0 text-muted-foreground">{s.step === 8 ? t("adminx.submitted") : t("onboarding.stepOf", { step: s.step, total: 7 })}</span>
                        <span className="h-3 rounded-full bg-primary" style={{ width: `${(s.reached / max) * 100}%`, minWidth: 4 }} />
                        <span className="font-bold">{s.reached}</span>
                        {s.drop_rate != null && s.drop_rate > 0 && <span className="text-destructive">−{Math.round(s.drop_rate * 100)} %</span>}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
            <Card title={t("adminx.requests")} testId="admin-requests">
              <p className="text-sm mb-3">{t("adminx.requestsTotal", { n: data.requests.total, m: data.requests.last_30d })}</p>
              <ul className="space-y-2">
                {Object.entries(data.requests.by_status).map(([k, v]) => <Bar key={k} label={t(`requests.status.${k}`)} value={v} max={Math.max(...Object.values(data.requests.by_status))} />)}
              </ul>
            </Card>
            <Card title={t("adminx.revenue")} testId="admin-revenue">
              <p className="text-2xl font-extrabold">{formatDA(data.revenue.total_da)}</p>
              <p className="text-xs text-muted-foreground mb-3">{t("adminx.revenue30", { amount: formatDA(data.revenue.last_30d_da) })}</p>
              <ul className="space-y-2">
                {data.revenue.by_month.map((m) => <Bar key={m.month} label={m.month} value={m.amount_da} max={Math.max(...data.revenue.by_month.map((x) => x.amount_da))} suffix=" DA" />)}
              </ul>
            </Card>
            <Card title={t("adminx.subscriptions")} testId="admin-subscriptions">
              {!data.subscriptions.length ? <p className="text-sm text-muted-foreground">—</p> : (
                <ul className="space-y-2">
                  {data.subscriptions.map((s) => <Bar key={`${s.audience}-${s.tier}`} label={`${t(`pricing.audiences.${s.audience}`)} · ${s.tier}`} value={s.count} max={Math.max(...data.subscriptions.map((x) => x.count))} />)}
                </ul>
              )}
            </Card>
            <Card title={t("adminx.matching")} testId="admin-matching">
              <p className="text-sm">{t("adminx.matchingSummary", { imp: data.matching.impressions, c: data.matching.contacts_after_display, rate: Math.round(data.matching.contact_rate * 100) })}</p>
              <ul className="mt-3 space-y-1 text-xs">
                {data.matching.by_position.map((p) => (
                  <li key={p.position} className="flex justify-between"><span>{t("adminx.position", { n: p.position })}</span><span className="font-bold">{p.contacts}/{p.impressions}</span></li>
                ))}
              </ul>
            </Card>
            <MatchResults />
          </div>
        </>
      )}
    </div>
  );
}
