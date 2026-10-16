import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { errorCode, formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { adminDisputeService, adminOpsService } from "@/services/marketplaceService";

function StatusFilter({ value, onChange, options }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {options.map((s) => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(s)}
          className={`rounded-full border px-4 min-h-[40px] text-sm font-bold ${value === s ? "border-brand-electric bg-brand-electric/15" : "border-border"}`}>{t(`adminx.status.${s}`)}</button>
      ))}
    </div>
  );
}

function useAction(keys) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  return async (fn) => {
    try {
      await fn();
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      toast.success(t("admin.saved"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };
}

export function AdminReports({ canEdit }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("open");
  const [note, setNote] = useState({});
  const act = useAction(["admin-reports"]);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-reports", status], queryFn: () => adminOpsService.reports(status) });
  return (
    <div data-testid="admin-reports">
      <p className="text-sm text-muted-foreground mb-4">{t("adminx.reportsHint")}</p>
      <StatusFilter value={status} onChange={setStatus} options={["open", "actioned", "dismissed"]} />
      {isLoading ? <Skeleton className="h-40 rounded-xl" /> : !data.length ? <p className="py-10 text-center text-muted-foreground">{t("admin.validation.empty")}</p> : (
        <ul className="grid gap-3">
          {data.map((r) => (
            <li key={r.id} className="gf-card p-4" data-testid={`report-row-${r.id}`}>
              <p className="font-bold">{t(`report.reasons.${r.reason}`)} · <span className="text-xs font-normal text-muted-foreground">{r.target_type} · {formatDateTime(r.created_at)}</span></p>
              <p className="text-sm mt-1">{t("adminx.target")} : <b>{r.target?.label || r.target_id}</b></p>
              {r.details && <p className="text-sm mt-1 italic">« {r.details} »</p>}
              <p className="text-xs text-muted-foreground mt-1">{t("adminx.reporter")} : {r.reporter?.name} ({r.reporter?.email})</p>
              {r.note && <p className="text-xs mt-1">{t("adminx.note")} : {r.note}</p>}
              {canEdit && status === "open" && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input value={note[r.id] || ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} placeholder={t("adminx.notePh")} className={`${ui.input} min-h-[40px] flex-1`} />
                  <button type="button" onClick={() => act(() => adminOpsService.decideReport(r.id, { status: "dismissed", note: note[r.id] || "" }))} className={`${ui.btnOutline} min-h-[40px]`}>{t("adminx.dismiss")}</button>
                  <button type="button" onClick={() => act(() => adminOpsService.decideReport(r.id, { status: "actioned", note: note[r.id] || "" }))} className={`${ui.btnPrimary} min-h-[40px]`} data-testid={`report-action-${r.id}`}>{t("adminx.confirm")}</button>
                  <button type="button" onClick={() => act(() => adminOpsService.decideReport(r.id, { status: "actioned", note: note[r.id] || "", suspend_user: true }))} className={`${ui.btnDanger} min-h-[40px]`}>{t("adminx.suspend")}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminTrust({ canEdit }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("open");
  const [note, setNote] = useState({});
  const act = useAction(["admin-contests"]);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-contests", status], queryFn: () => adminOpsService.contests(status) });
  return (
    <div data-testid="admin-trust">
      <p className="text-sm text-muted-foreground mb-4">{t("adminx.contestsHint")}</p>
      <StatusFilter value={status} onChange={setStatus} options={["open", "accepted", "rejected"]} />
      {isLoading ? <Skeleton className="h-40 rounded-xl" /> : !data.length ? <p className="py-10 text-center text-muted-foreground">{t("admin.validation.empty")}</p> : (
        <ul className="grid gap-3">
          {data.map((c) => (
            <li key={c.id} className="gf-card p-4">
              <p className="font-bold">{c.display_name} <span className="text-xs font-normal text-muted-foreground">· {t("catalog.trust")} {c.score_at_contest}/100 · {formatDateTime(c.created_at)}</span></p>
              <p className="text-sm mt-1">{c.message}</p>
              {c.note && <p className="text-xs mt-1">{t("adminx.note")} : {c.note}</p>}
              {canEdit && status === "open" && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input value={note[c.id] || ""} onChange={(e) => setNote({ ...note, [c.id]: e.target.value })} placeholder={t("adminx.notePhRequired")} className={`${ui.input} min-h-[40px] flex-1`} />
                  <button type="button" disabled={(note[c.id] || "").length < 3} onClick={() => act(() => adminOpsService.decideContest(c.id, { status: "rejected", note: note[c.id] }))} className={`${ui.btnOutline} min-h-[40px]`}>{t("admin.validation.reject")}</button>
                  <button type="button" disabled={(note[c.id] || "").length < 3} onClick={() => act(() => adminOpsService.decideContest(c.id, { status: "accepted", note: note[c.id] }))} className={`${ui.btnPrimary} min-h-[40px]`}>{t("adminx.acceptRecompute")}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CategoryRequests({ canEdit }) {
  const { t } = useI18n();
  const [form, setForm] = useState({});
  const act = useAction(["admin-catreq"]);
  const { data = [] } = useQuery({ queryKey: ["admin-catreq"], queryFn: () => adminOpsService.categoryRequests("pending") });
  if (!data.length) return null;
  return (
    <section className="gf-card p-4 mb-6" data-testid="admin-category-requests">
      <h3 className="font-bold mb-3">{t("adminx.categoryRequests")}</h3>
      <ul className="grid gap-3">
        {data.map((c) => {
          const f = form[c.id] || { key: "", name_fr: c.name, name_ar: "" };
          const setF = (patch) => setForm({ ...form, [c.id]: { ...f, ...patch } });
          return (
            <li key={c.id} className="rounded-xl border border-border p-3">
              <p className="font-bold">{c.name} <span className="text-xs font-normal text-muted-foreground">· {c.family_key} · {c.user?.full_name}</span></p>
              {c.description && <p className="text-sm">{c.description}</p>}
              {canEdit && (
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
                  <input value={f.key} onChange={(e) => setF({ key: e.target.value })} placeholder="key_categorie" dir="ltr" className={`${ui.input} min-h-[40px] font-mono text-sm`} />
                  <input value={f.name_fr} onChange={(e) => setF({ name_fr: e.target.value })} placeholder={t("admin.taxonomy.nameFr")} className={`${ui.input} min-h-[40px]`} />
                  <input value={f.name_ar} onChange={(e) => setF({ name_ar: e.target.value })} placeholder={t("admin.taxonomy.nameAr")} dir="rtl" className={`${ui.input} min-h-[40px]`} />
                  <button type="button" onClick={() => act(() => adminOpsService.decideCategory(c.id, { status: "rejected" }))} className={`${ui.btnOutline} min-h-[40px]`}>{t("admin.validation.reject")}</button>
                  <button type="button" onClick={() => act(() => adminOpsService.decideCategory(c.id, { status: "approved", ...f }))} className={`${ui.btnPrimary} min-h-[40px]`}>{t("admin.validation.approve")}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AdminTickets({ canEdit }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("open");
  const act = useAction(["admin-tickets"]);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-tickets", status], queryFn: () => adminOpsService.tickets(status) });
  return (
    <div data-testid="admin-tickets">
      <StatusFilter value={status} onChange={setStatus} options={["open", "closed"]} />
      {isLoading ? <Skeleton className="h-40 rounded-xl" /> : !data.length ? <p className="py-10 text-center text-muted-foreground">{t("admin.validation.empty")}</p> : (
        <ul className="grid gap-3">
          {data.map((tk) => (
            <li key={tk.id} className="gf-card p-4">
              <p className="font-bold">{tk.subject} <span className="text-xs font-normal text-muted-foreground">· {tk.source} · {formatDateTime(tk.created_at)}</span></p>
              <p className="text-xs text-muted-foreground" dir="ltr">{tk.name} · {tk.email || ""} {tk.phone || ""}</p>
              <p className="text-sm mt-1 whitespace-pre-line">{tk.message}</p>
              {canEdit && (
                <button type="button" onClick={() => act(() => adminOpsService.patchTicket(tk.id, { status: status === "open" ? "closed" : "open" }))} className={`${ui.btnOutline} min-h-[40px] mt-3`}>
                  {status === "open" ? t("adminx.close") : t("adminx.reopen")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


export function AdminDisputes({ canEdit }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("open");
  const [note, setNote] = useState({});
  const act = useAction(["admin-disputes"]);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-disputes", status], queryFn: () => adminDisputeService.list(status) });
  return (
    <div data-testid="admin-disputes">
      <p className="text-sm text-muted-foreground mb-4">{t("adminx.disputesHint")}</p>
      <StatusFilter value={status} onChange={setStatus} options={["open", "resolved_client", "resolved_provider"]} />
      {isLoading ? <Skeleton className="h-40 rounded-xl" /> : !data.length ? <p className="py-10 text-center text-muted-foreground">{t("admin.validation.empty")}</p> : (
        <ul className="grid gap-3">
          {data.map((j) => (
            <li key={j.id} className="gf-card p-4" data-testid={`dispute-row-${j.id}`}>
              <p className="font-bold">{j.provider_display_name} ↔ {j.client?.name} <span className="text-xs font-normal text-muted-foreground">· {formatDateTime(j.scheduled_at)}</span></p>
              <p className="text-sm mt-1"><b>{t(`jobs.by.${j.dispute?.opened_by}`)}</b> : {j.dispute?.reason}</p>
              {j.dispute?.note && <p className="text-xs mt-1">{t("adminx.note")} : {j.dispute.note}</p>}
              <ol className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                {(j.history || []).map((h, i) => <li key={i}>{formatDateTime(h.at)} · {t(`jobs.status.${h.status}`)} · {t(`jobs.by.${h.by}`)}{h.reason ? ` — ${h.reason}` : ""}</li>)}
              </ol>
              {canEdit && status === "open" && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input value={note[j.id] || ""} onChange={(e) => setNote({ ...note, [j.id]: e.target.value })} placeholder={t("adminx.notePhRequired")} className={`${ui.input} min-h-[44px] flex-1`} />
                  <button type="button" disabled={(note[j.id] || "").length < 3} onClick={() => act(() => adminDisputeService.resolve(j.id, "resolved_provider", note[j.id]))} className={`${ui.btnOutline} min-h-[44px]`}>{t("adminx.favourProvider")}</button>
                  <button type="button" disabled={(note[j.id] || "").length < 3} onClick={() => act(() => adminDisputeService.resolve(j.id, "resolved_client", note[j.id]))} className={`${ui.btnPrimary} min-h-[44px]`} data-testid={`dispute-client-${j.id}`}>{t("adminx.favourClient")}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
