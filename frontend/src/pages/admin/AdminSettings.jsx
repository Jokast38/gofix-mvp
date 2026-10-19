import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { adminService } from "@/services/publicService";
import { COMPANY_KEYS } from "./AdminCompany";
import { COMMUNICATION_KEYS } from "./AdminCommunication";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";

function parse(raw, sample) {
  if (typeof sample === "number") return Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  if (typeof sample === "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function SettingRow({ s, canEdit }) {
  const { t, te } = useI18n();
  const qc = useQueryClient();
  const initial = typeof s.value === "object" ? JSON.stringify(s.value) : String(s.value);
  const [raw, setRaw] = useState(initial);

  const save = async () => {
    const value = parse(raw, s.value);
    if (value === undefined) return toast.error(t("admin.settings.invalid"));
    try {
      await adminService.setSetting(s.key, value);
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      toast.success(t("admin.saved"));
    } catch (err) {
      toast.error(te(errorCode(err)));
    }
  };

  return (
    <li className="gf-card p-4" data-testid={`admin-setting-${s.key}`}>
      <p className="font-mono text-sm font-bold" dir="ltr">{s.key}</p>
      <p className="text-xs text-muted-foreground mb-3">{s.description}</p>
      <div className="flex gap-2">
        {s.options ? (
          <select value={raw} onChange={(e) => setRaw(e.target.value)} disabled={!canEdit} className={ui.input} data-testid={`admin-setting-input-${s.key}`}>
            {s.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input value={raw} onChange={(e) => setRaw(e.target.value)} disabled={!canEdit} dir="ltr" className={`${ui.input} font-mono text-sm`} data-testid={`admin-setting-input-${s.key}`} />
        )}
        {canEdit && (
          <button type="button" onClick={save} disabled={raw === initial} className={ui.btnPrimary} data-testid={`admin-setting-save-${s.key}`}>{t("common.save")}</button>
        )}
      </div>
    </li>
  );
}

export function AdminSettings({ canEdit }) {
  const { t } = useI18n();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-settings"], queryFn: adminService.settings });
  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">{t("admin.settings.hint")}</p>
      <ul className="grid gap-3 md:grid-cols-2">{data.filter((s) => !COMPANY_KEYS.includes(s.key) && !COMMUNICATION_KEYS.includes(s.key)).map((s) => <SettingRow key={s.key} s={s} canEdit={canEdit} />)}</ul>
    </div>
  );
}
