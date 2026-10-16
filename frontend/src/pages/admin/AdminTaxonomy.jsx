import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";
import { adminTaxonomyService } from "@/services/marketplaceService";

const KINDS = ["families", "categories", "roles", "specialties", "subjects", "levels"];
const PARENT = { categories: ["families", "family_key"], specialties: ["categories", "category_key"] };

function Row({ kind, item, canEdit, onChange }) {
  const { t, te } = useI18n();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name_fr: item.name_fr, name_ar: item.name_ar || "", icon: item.icon || "" });
  const save = async () => {
    try {
      await adminTaxonomyService.patch(kind, item.key, f);
      setEdit(false);
      onChange();
      toast.success(t("admin.saved"));
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  const toggle = async (v) => {
    try { await adminTaxonomyService.patch(kind, item.key, { active: v }); onChange(); } catch (err) { toast.error(te(errorCode(err))); }
  };
  const remove = async () => {
    if (!window.confirm(t("admin.taxonomy.confirmDelete"))) return;
    try { await adminTaxonomyService.remove(kind, item.key); onChange(); } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <li className={`gf-card p-3 flex flex-wrap items-center gap-3 ${item.active === false ? "opacity-60" : ""}`} data-testid={`tax-row-${item.key}`}>
      <code className="text-[11px] text-muted-foreground w-32 truncate" dir="ltr">{item.key}</code>
      {edit ? (
        <>
          <input value={f.name_fr} onChange={(e) => setF({ ...f, name_fr: e.target.value })} className={`${ui.input} min-h-[40px] flex-1 min-w-[140px]`} data-testid={`tax-edit-fr-${item.key}`} />
          <input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} dir="rtl" className={`${ui.input} min-h-[40px] flex-1 min-w-[140px]`} data-testid={`tax-edit-ar-${item.key}`} />
          {["families", "categories"].includes(kind) && <input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} placeholder="icon" className={`${ui.input} min-h-[40px] w-28`} dir="ltr" />}
          <button type="button" onClick={save} className={`${ui.btnPrimary} min-h-[40px] px-4`} data-testid={`tax-save-${item.key}`}>{t("common.save")}</button>
          <button type="button" onClick={() => setEdit(false)} className={`${ui.btnGhost} min-h-[40px]`}>{t("common.cancel")}</button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => canEdit && setEdit(true)} className="flex-1 text-start min-w-[140px]" data-testid={`tax-name-${item.key}`}>
            <span className="font-bold text-sm">{item.name_fr}</span>
            <span className="block text-xs text-muted-foreground" dir="rtl">{item.name_ar}</span>
          </button>
          {item.family_key && <span className="text-[11px] rounded-full border border-border px-2 py-0.5">{item.family_key}</span>}
          {item.category_key && <span className="text-[11px] rounded-full border border-border px-2 py-0.5">{item.category_key}</span>}
          <Switch checked={item.active !== false} disabled={!canEdit} onCheckedChange={toggle} aria-label={item.key} data-testid={`tax-active-${item.key}`} />
          {canEdit && <button type="button" onClick={remove} className="text-muted-foreground hover:text-destructive" aria-label={t("admin.taxonomy.delete")} data-testid={`tax-delete-${item.key}`}><Trash2 size={16} /></button>}
        </>
      )}
    </li>
  );
}

function AddForm({ kind, parents, onDone }) {
  const { t, te } = useI18n();
  const [f, setF] = useState({ key: "", name_fr: "", name_ar: "", parent: "" });
  const parentField = PARENT[kind]?.[1];
  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { key: f.key.trim().toLowerCase(), name_fr: f.name_fr, name_ar: f.name_ar, order: 999 };
      if (parentField) body[parentField] = f.parent;
      if (kind === "roles") body.family_keys = ["home_services", "building", "auto_moto", "beauty", "tech", "food", "transport", "wellness", "events"];
      await adminTaxonomyService.create(kind, body);
      setF({ key: "", name_fr: "", name_ar: "", parent: "" });
      onDone();
      toast.success(t("admin.saved"));
    } catch (err) { toast.error(te(errorCode(err))); }
  };
  return (
    <form onSubmit={submit} className="gf-gradient-border rounded-xl p-3 grid gap-2 sm:grid-cols-[150px_1fr_1fr_auto_auto]" data-testid="tax-add-form">
      <input required value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} placeholder="key_snake" pattern="[a-z0-9_]{2,40}" dir="ltr" className={`${ui.input} min-h-[40px]`} data-testid="tax-add-key" />
      <input required value={f.name_fr} onChange={(e) => setF({ ...f, name_fr: e.target.value })} placeholder={t("admin.taxonomy.nameFr")} className={`${ui.input} min-h-[40px]`} data-testid="tax-add-fr" />
      <input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} placeholder={t("admin.taxonomy.nameAr")} dir="rtl" className={`${ui.input} min-h-[40px]`} data-testid="tax-add-ar" />
      {parentField ? (
        <select required value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })} className={`${ui.input} min-h-[40px] appearance-none`} data-testid="tax-add-parent">
          <option value="">{t("admin.taxonomy.parent")}</option>
          {parents.map((p) => <option key={p.key} value={p.key}>{p.name_fr}</option>)}
        </select>
      ) : <span />}
      <button type="submit" className={`${ui.btnGradient} min-h-[40px] px-4`} data-testid="tax-add-submit"><Plus size={16} />{t("admin.taxonomy.add")}</button>
    </form>
  );
}

export function AdminTaxonomy({ canEdit }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [kind, setKind] = useState("categories");
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-tax", kind], queryFn: () => adminTaxonomyService.list(kind) });
  const parentKind = PARENT[kind]?.[0];
  const parents = useQuery({ queryKey: ["admin-tax", parentKind], queryFn: () => adminTaxonomyService.list(parentKind), enabled: Boolean(parentKind) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-tax"] }); qc.invalidateQueries({ queryKey: ["home-cats"] }); qc.invalidateQueries({ queryKey: ["cats-all"] }); };

  return (
    <div data-testid="admin-taxonomy">
      <p className="text-sm text-muted-foreground mb-4">{t("admin.taxonomy.hint")}</p>
      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        {KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} data-testid={`tax-kind-${k}`}
            className={`rounded-full border px-4 min-h-[40px] text-sm font-bold transition-colors ${kind === k ? "border-brand-electric bg-brand-electric/15" : "border-border"}`}>{t(`admin.taxonomy.kinds.${k}`)} <span className="text-muted-foreground font-normal">{kind === k ? `(${data.length})` : ""}</span></button>
        ))}
      </div>
      {canEdit && <div className="mb-4"><AddForm kind={kind} parents={parents.data || []} onDone={refresh} /></div>}
      {isLoading ? <Skeleton className="h-48 rounded-xl" /> : (
        <ul className="grid gap-2">{data.map((it) => <Row key={it.key} kind={kind} item={it} canEdit={canEdit} onChange={refresh} />)}</ul>
      )}
    </div>
  );
}
