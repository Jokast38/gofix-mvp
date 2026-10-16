import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/catalog/Cards";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { errorCode, formatDA, formatDateTime } from "@/lib/format";
import { ui } from "@/lib/ui";
import { adminOpsService, adminTaxonomyService, trustService } from "@/services/marketplaceService";
import { CategoryRequests } from "./AdminModeration";

const STATUSES = ["pending", "verified", "unverified", "rejected"];

// Private verification documents: opened through the admin API (each access is audited), never via a public URL.
function Documents({ kind, profile, canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const docs = profile.documents || [];
  if (!docs.length) return null;
  const view = async (d) => {
    try {
      const blob = await adminOpsService.documentBlob(kind, profile.id, d.index);
      window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  const decide = async (d, status, fake = false) => {
    try {
      await adminOpsService.decideDocument(kind, profile.id, d.index, { status, fake, reason: fake ? t("adminx.fakeDoc") : "" });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success(t("admin.saved"));
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <ul className="mt-2 flex flex-wrap gap-2" data-testid={`validation-docs-${profile.id}`}>
      {docs.map((d) => (
        <li key={d.index} className="inline-flex items-center gap-1.5 rounded-full border border-border ps-3 pe-1 py-1 text-xs">
          <span className="font-semibold">{t(`onboarding.docs.${d.type}`)}</span>
          <span className="text-muted-foreground">· {t(`dashboard.docStatus.${d.status}`)}</span>
          {d.has_file && <button type="button" onClick={() => view(d)} className="rounded-full p-1.5 hover:bg-secondary" aria-label={t("adminx.viewDoc")}><Eye size={14} /></button>}
          {canEdit && d.has_file && d.status !== "validated" && <button type="button" onClick={() => decide(d, "validated")} className="rounded-full p-1.5 hover:bg-secondary text-brand-electric" aria-label={t("admin.validation.approve")}><CheckCircle2 size={14} /></button>}
          {canEdit && d.has_file && d.status !== "rejected" && <button type="button" onClick={() => decide(d, "rejected")} className="rounded-full p-1.5 hover:bg-secondary text-destructive" aria-label={t("admin.validation.reject")}><XCircle size={14} /></button>}
          {canEdit && d.has_file && d.status !== "rejected" && <button type="button" onClick={() => window.confirm(t("adminx.fakeDocConfirm")) && decide(d, "rejected", true)} className="rounded-full px-2 py-1 text-[10px] font-bold hover:bg-secondary text-destructive" data-testid="doc-fake">{t("adminx.fakeDoc")}</button>}
        </li>
      ))}
    </ul>
  );
}

export function AdminValidation({ canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const [kind, setKind] = useState("professional");
  const [status, setStatus] = useState("pending");
  const [reason, setReason] = useState({});
  const { data, isLoading } = useQuery({ queryKey: ["admin-profiles", kind, status], queryFn: () => adminTaxonomyService.profiles({ kind, status }) });

  const recompute = async (id) => {
    const reason = window.prompt(t("adminx.recomputeReason"));
    if (!reason || reason.trim().length < 3) return;
    try {
      const r = await trustService.adminRecompute(kind, id, reason.trim());
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success(t("adminx.recomputed", { before: r.before ?? "—", after: r.after }));
    } catch (err) { toast.error(te(errorCode(err))); }
  };

  const decide = async (id, s) => {
    try {
      await adminTaxonomyService.verify(kind, id, s, reason[id] || "");
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(t("admin.saved"));
    } catch (err) { toast.error(te(errorCode(err))); }
  };

  return (
    <div data-testid="admin-validation">
      <p className="text-sm text-muted-foreground mb-4">{t("admin.validation.hint")}</p>
      <CategoryRequests canEdit={canEdit} />
      <div className="flex flex-wrap gap-2 mb-4">
        {["professional", "teacher"].map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} data-testid={`validation-kind-${k}`}
            className={`rounded-full border px-4 min-h-[40px] text-sm font-bold ${kind === k ? "border-brand-pink bg-brand-pink/15" : "border-border"}`}>{t(`onboarding.${k}.title`)}</button>
        ))}
        <span className="w-px bg-border mx-1" />
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s} data-testid={`validation-status-${s}`}
            className={`rounded-full border px-4 min-h-[40px] text-sm font-bold ${status === s ? "border-brand-electric bg-brand-electric/15" : "border-border"}`}>{t(`onboarding.status.${s}`)}</button>
        ))}
      </div>
      {isLoading ? <Skeleton className="h-48 rounded-xl" /> : data?.items.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground" data-testid="validation-empty">{t("admin.validation.empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {data?.items.map((p) => (
            <li key={p.id} className="gf-card p-4" data-testid={`validation-row-${p.id}`}>
              <div className="flex items-start gap-3">
                <Avatar photoKey={p.photo_key} thumbKey={p.photo_thumb_key} name={p.display_name} color="var(--brand-electric)" />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{p.display_name} <span className="text-xs font-normal text-muted-foreground">· {p.category_key || (p.subjects || []).map((s) => s.subject_key).join(", ")}</span></p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{p.user?.email} · {p.user?.phone}</p>
                  <p className="mt-1 text-sm">{p.bio}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("catalog.experience")} : {p.experience_years} {t("catalog.years")} · {(p.zones || []).map((z) => `W${z.wilaya_code} (${z.radius_km} km)`).join(", ")}
                    {p.price_hint_da != null && ` · ${formatDA(p.price_hint_da)}`}{p.price_hint_da_hour != null && ` · ${formatDA(p.price_hint_da_hour)}/h`}
                    {" · "}{formatDateTime(p.updated_at)}
                  </p>
                  {p.verification_reason && <p className="mt-1 text-xs italic">{p.verification_reason}</p>}
                  <Documents kind={kind} profile={p} canEdit={canEdit} />
                  <p className="mt-1 text-xs">{t("catalog.trust")} : <b>{p.trust_score ?? "—"}</b> · {p.trust_status ? t(`trust.status.${p.trust_status}`) : ""}
                    {canEdit && <button type="button" onClick={() => recompute(p.id)} className="ms-2 underline font-semibold min-h-[32px]" data-testid={`trust-recompute-${p.id}`}>{t("adminx.recompute")}</button>}</p>
                </div>
              </div>
              {canEdit && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input value={reason[p.id] || ""} onChange={(e) => setReason({ ...reason, [p.id]: e.target.value })} placeholder={t("admin.validation.reasonPh")} className={`${ui.input} min-h-[40px] flex-1`} data-testid={`validation-reason-${p.id}`} />
                  {status !== "verified" && <button type="button" onClick={() => decide(p.id, "verified")} className={`${ui.btnPrimary} min-h-[40px]`} data-testid={`validation-approve-${p.id}`}><CheckCircle2 size={16} />{t("admin.validation.approve")}</button>}
                  {status !== "rejected" && <button type="button" onClick={() => decide(p.id, "rejected")} className={`${ui.btnDanger} min-h-[40px]`} data-testid={`validation-reject-${p.id}`}><XCircle size={16} />{t("admin.validation.reject")}</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
