import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { errorCode, formatDA, formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { adminOpsService } from "@/services/marketplaceService";

function PlanRow({ p, canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({});
  useEffect(() => setF({ name_fr: p.name_fr, name_ar: p.name_ar || "", price_da: p.price_da ?? "", duration_days: p.duration_days, perks: (p.perks_fr || []).join("\n"), active: p.active }), [p]);
  const save = async () => {
    try {
      await adminOpsService.patchPlan(p.key, { name_fr: f.name_fr, name_ar: f.name_ar, duration_days: Number(f.duration_days), active: f.active,
        perks_fr: f.perks.split("\n").map((x) => x.trim()).filter(Boolean), ...(f.price_da === "" ? {} : { price_da: Number(f.price_da) }) });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success(t("admin.saved"));
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <li className="gf-card p-4 space-y-2" data-testid={`admin-plan-${p.key}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-bold" dir="ltr">{p.key}</p>
        <label className="flex items-center gap-2 text-xs">{t("adminx.active")}<Switch checked={Boolean(f.active)} disabled={!canEdit} onCheckedChange={(v) => setF({ ...f, active: v })} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={f.name_fr || ""} disabled={!canEdit} onChange={(e) => setF({ ...f, name_fr: e.target.value })} className={`${ui.input} min-h-[40px]`} aria-label={t("admin.taxonomy.nameFr")} />
        <input value={f.name_ar || ""} disabled={!canEdit} onChange={(e) => setF({ ...f, name_ar: e.target.value })} dir="rtl" className={`${ui.input} min-h-[40px]`} aria-label={t("admin.taxonomy.nameAr")} />
        <label className="text-xs">{t("adminx.price")}<input type="number" min={0} value={f.price_da} disabled={!canEdit || p.tier === "free"} onChange={(e) => setF({ ...f, price_da: e.target.value })} className={`${ui.input} min-h-[40px]`} /></label>
        <label className="text-xs">{t("adminx.duration")}<input type="number" min={1} value={f.duration_days || ""} disabled={!canEdit} onChange={(e) => setF({ ...f, duration_days: e.target.value })} className={`${ui.input} min-h-[40px]`} /></label>
      </div>
      <textarea rows={3} value={f.perks || ""} disabled={!canEdit} onChange={(e) => setF({ ...f, perks: e.target.value })} className={`${ui.input} py-2 text-sm`} aria-label={t("adminx.perks")} />
      {canEdit && <button type="button" onClick={save} className={`${ui.btnPrimary} min-h-[40px]`}>{t("common.save")}</button>}
    </li>
  );
}

function MatrixRow({ row, fields, canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState(row);
  useEffect(() => setF(row), [row]);
  const toggleField = (k) => setF({ ...f, visible_fields: f.visible_fields.includes(k) ? f.visible_fields.filter((x) => x !== k) : [...f.visible_fields, k] });
  const save = async () => {
    try {
      const { audience, plan_key, ...body } = f;
      await adminOpsService.putMatrix(row.plan_key, { ...body, monthly_views_limit: body.monthly_views_limit === "" || body.monthly_views_limit == null ? null : Number(body.monthly_views_limit) });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success(t("admin.saved"));
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <li className="gf-card p-4" data-testid={`admin-matrix-${row.plan_key}`}>
      <p className="font-extrabold mb-2">{row.plan_key.toUpperCase()}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm mb-3">
        {["blurred", "direct_contact", "can_message", "can_request"].map((k) => (
          <label key={k} className="flex items-center gap-2"><Switch checked={Boolean(f[k])} disabled={!canEdit} onCheckedChange={(v) => setF({ ...f, [k]: v })} />{t(`adminx.matrix.${k}`)}</label>
        ))}
        <label className="flex items-center gap-2">{t("adminx.matrix.views")}
          <input type="number" min={0} value={f.monthly_views_limit ?? ""} placeholder="∞" disabled={!canEdit} onChange={(e) => setF({ ...f, monthly_views_limit: e.target.value })} className={`${ui.input} min-h-[36px] w-24`} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((k) => (
          <button key={k} type="button" disabled={!canEdit} aria-pressed={f.visible_fields.includes(k)} onClick={() => toggleField(k)}
            className={`rounded-full border px-2.5 min-h-[32px] text-xs font-semibold ${f.visible_fields.includes(k) ? "border-brand-electric bg-brand-electric/15" : "border-border text-muted-foreground"}`}>{k}</button>
        ))}
      </div>
      {canEdit && <button type="button" onClick={save} className={`${ui.btnPrimary} min-h-[40px] mt-3`}>{t("common.save")}</button>}
    </li>
  );
}

export function AdminPlans({ canEdit }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["admin-plans"], queryFn: adminOpsService.plans });
  if (isLoading || !data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6" data-testid="admin-plans">
      <p className="text-sm text-muted-foreground">{t("adminx.plansHint")}</p>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{data.plans.map((p) => <PlanRow key={p.key} p={p} canEdit={canEdit} />)}</ul>
      <h3 className="font-extrabold">{t("adminx.matrixTitle")}</h3>
      <p className="text-sm text-muted-foreground -mt-4">{t("adminx.matrixHint")}</p>
      <ul className="grid gap-3">{data.matrix.map((r) => <MatrixRow key={r.plan_key} row={r} fields={data.fields} canEdit={canEdit} />)}</ul>
    </div>
  );
}

export function AdminPayments() {
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-payments", status], queryFn: () => adminOpsService.payments({ status }) });
  return (
    <div data-testid="admin-payments">
      <div className="flex flex-wrap gap-2 mb-4">
        {["", "pending", "paid", "failed", "cancelled", "expired"].map((s) => (
          <button key={s || "all"} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
            className={`rounded-full border px-4 min-h-[40px] text-sm font-bold ${status === s ? "border-brand-electric bg-brand-electric/15" : "border-border"}`}>{s ? t(`payment.status.${s}`) : t("adminx.all")}</button>
        ))}
      </div>
      {isLoading ? <Skeleton className="h-40 rounded-xl" /> : (
        <>
          <p className="text-sm mb-3">{t("adminx.revenueTotal", { amount: formatDA(data.revenue_da), n: data.total })}</p>
          <div className="gf-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-start text-xs text-muted-foreground">{["order", "user", "plan", "amount", "status", "date"].map((k) => <th key={k} className="p-3 text-start">{t(`adminx.cols.${k}`)}</th>)}</tr></thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs" dir="ltr">{o.order_number}</td>
                    <td className="p-3">{o.user?.full_name}<br /><span className="text-xs text-muted-foreground">{o.user?.email}</span></td>
                    <td className="p-3">{o.plan_name}</td>
                    <td className="p-3 whitespace-nowrap">{formatDA(o.amount_da)}</td>
                    <td className="p-3">{t(`payment.status.${o.status}`)}</td>
                    <td className="p-3 text-xs whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
