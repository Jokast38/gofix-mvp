import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useI18n, useLocalized } from "@/i18n";
import { ui } from "@/lib/ui";

export function Choice({ selected, onClick, children, testId, color = "var(--brand-electric)" }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} data-testid={testId}
      className={`relative min-h-[48px] rounded-xl border px-3 py-2 text-sm font-semibold text-start transition-colors ${selected ? "bg-secondary" : "border-border hover:bg-secondary/60"}`}
      style={selected ? { borderColor: color, boxShadow: `0 0 14px color-mix(in srgb, ${color} 30%, transparent)` } : undefined}>
      {children}
      {selected && <Check size={16} strokeWidth={2.5} className="absolute top-2 end-2" style={{ color }} aria-hidden="true" />}
    </button>
  );
}

export function ChoiceGrid({ items, value, onChange, multiple = false, testPrefix, cols = "grid-cols-2", color }) {
  const loc = useLocalized();
  const sel = multiple ? value || [] : value;
  const toggle = (k) => {
    if (!multiple) return onChange(k);
    onChange(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]);
  };
  return (
    <div className={`grid ${cols} gap-2`}>
      {items.map((it) => (
        <Choice key={it.key} selected={multiple ? sel.includes(it.key) : sel === it.key} onClick={() => toggle(it.key)}
          testId={`${testPrefix}-${it.key}`} color={color}>{loc(it)}</Choice>
      ))}
    </div>
  );
}

export function StepTitle({ title, hint }) {
  return (
    <header className="mb-5">
      <h2 className="text-xl sm:text-2xl font-extrabold" data-testid="onboarding-step-title">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </header>
  );
}

export function Textarea({ id, value, onChange, max = 1500, testId, placeholder }) {
  return (
    <div>
      <textarea id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} maxLength={max} rows={5} placeholder={placeholder}
        className={`${ui.input} py-3 resize-y min-h-[120px]`} data-testid={testId} />
      <p className="mt-1 text-end text-xs text-muted-foreground">{(value || "").length}/{max}</p>
    </div>
  );
}

export function useList(key, fn, enabled = true) {
  return useQuery({ queryKey: key, queryFn: fn, staleTime: 300_000, enabled });
}

export function ProgressBar({ step, total, labels }) {
  const { t } = useI18n();
  const pct = Math.round((step / total) * 100);
  return (
    <div className="mb-6" data-testid="onboarding-progress">
      <div className="flex items-center justify-between text-xs font-bold mb-2">
        <span>{t("onboarding.stepOf", { step, total })}</span>
        <span className="text-brand-electric" data-testid="onboarding-progress-pct">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full gf-gradient-bg transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-3 hidden sm:grid grid-cols-7 gap-1 text-[10px] text-muted-foreground">
        {labels.map((l, i) => (
          <li key={l} className={`text-center truncate ${i + 1 === step ? "text-foreground font-bold" : i + 1 < step ? "text-brand-electric" : ""}`}>{l}</li>
        ))}
      </ol>
    </div>
  );
}
