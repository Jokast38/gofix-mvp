import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/publicService";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";

// Settings edited here (and hidden from the generic Settings tab). Shown in the legal pages, the app and on invoices.
export const COMPANY_GROUPS = [
  { key: "identity", fields: ["company_name", "company_capital", "company_rc", "company_nif", "company_nis", "company_tax_article", "company_address", "publication_director"] },
  { key: "contact", fields: ["contact_email", "abuse_email", "contact_phone"] },
  { key: "legal", fields: ["hosting_provider", "anpdp_declaration", "legal_version", "legal_effective_date"] },
];
export const COMPANY_KEYS = [...COMPANY_GROUPS.flatMap((g) => g.fields), "legal_reviewed"];

/** Super-admin: company identity and legal notices (RC, NIF, address, contacts...). Empty fields show "[à compléter]". */
export function AdminCompany({ canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-settings"], queryFn: adminService.settings });
  const byKey = useMemo(() => Object.fromEntries(data.map((s) => [s.key, s])), [data]);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(Object.fromEntries(COMPANY_KEYS.filter((k) => byKey[k]).map((k) => [k, byKey[k].value]))); }, [byKey]);
  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const changed = COMPANY_KEYS.filter((k) => byKey[k] && form[k] !== byKey[k].value);
  const missing = COMPANY_GROUPS.flatMap((g) => g.fields).filter((k) => byKey[k] && !String(form[k] ?? "").trim());
  const save = async () => {
    setBusy(true);
    try {
      for (const k of changed) await adminService.setSetting(k, typeof byKey[k].value === "string" ? String(form[k]).trim() : form[k]);
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      toast.success(t("admin.saved"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-company">
      <p className="text-sm text-muted-foreground">{t("adminCompany.hint")}</p>
      <p className={`rounded-xl border p-3 text-sm ${missing.length ? "border-brand-orange/50 text-brand-orange" : "border-emerald-500/40 text-emerald-500"}`} data-testid="admin-company-status">
        {missing.length ? t("adminCompany.missing", { n: missing.length }) : t("adminCompany.complete")}
      </p>
      {COMPANY_GROUPS.map((g) => (
        <section key={g.key} className="gf-card p-4 md:p-6">
          <h2 className="mb-4 text-lg font-bold">{t(`adminCompany.groups.${g.key}`)}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {g.fields.filter((k) => byKey[k]).map((k) => (
              <label key={k} className={k === "company_address" ? "md:col-span-2" : ""}>
                <span className={ui.label}>{byKey[k].description}</span>
                <input value={form[k] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} disabled={!canEdit}
                  dir={/(email|phone|rc|nif|nis)$/.test(k) ? "ltr" : undefined} className={ui.input} data-testid={`company-${k}`} />
              </label>
            ))}
          </div>
        </section>
      ))}
      {byKey.legal_reviewed && (
        <label className="gf-card flex items-start gap-3 p-4 text-sm">
          <input type="checkbox" checked={Boolean(form.legal_reviewed)} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, legal_reviewed: e.target.checked }))}
            className="mt-1 h-5 w-5" data-testid="company-legal_reviewed" />
          <span><b>{t("adminCompany.reviewed")}</b><br /><span className="text-muted-foreground">{t("adminCompany.reviewedHint")}</span></span>
        </label>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {canEdit && (
          <button type="button" onClick={save} disabled={busy || !changed.length} className={`${ui.btnPrimary} w-full sm:w-auto`} data-testid="company-save">
            {busy ? t("common.loading") : t("common.save")}
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {["mentions", "cgu", "cgv", "privacy"].map((s) => (
            <Link key={s} to={`/legal/${s}`} target="_blank" className={`${ui.btnGhost} text-sm`}><ExternalLink size={14} aria-hidden="true" />{t(`legal.${s}.title`)}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
