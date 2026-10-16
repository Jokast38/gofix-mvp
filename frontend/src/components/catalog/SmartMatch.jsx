import { useQuery } from "@tanstack/react-query";
import { AlarmClock, CalendarDays, MapPin, MonitorSmartphone, Sparkles, Tag, TriangleAlert, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWilayas } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { marketplaceService, matchService } from "@/services/marketplaceService";
import { ProCard, TeacherCard } from "./Cards";

function Chip({ icon: Icon, children, onRemove, testId }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-electric/50 bg-brand-electric/10 ps-3 pe-1 min-h-[34px] text-xs font-bold" data-testid={testId}>
      <Icon size={13} aria-hidden="true" />{children}
      {onRemove && <button type="button" onClick={onRemove} className="grid place-items-center h-7 w-7 rounded-full hover:bg-secondary" aria-label="×"><X size={13} /></button>}
    </span>
  );
}

// "Nous avons compris : …" — what AI MATCH extracted from free text (GF1-001), plus missing fields to ask for.
export function IntentChips({ intent, kind }) {
  const { t } = useI18n();
  const loc = useLocalized();
  const { data: wilayas = [] } = useWilayas();
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => marketplaceService.categories(), staleTime: 300_000, enabled: kind === "professional" });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: marketplaceService.subjects, staleTime: 300_000, enabled: kind === "teacher" });
  if (!intent) return null;
  const w = wilayas.find((x) => x.code === intent.wilaya_code);
  const when = intent.when || {};
  return (
    <div className="gf-card p-4" data-testid="intent-chips">
      <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><Sparkles size={14} className="text-brand-electric" />{t("match.understood")}</p>
      <div className="flex flex-wrap gap-2">
        {intent.category_key && <Chip icon={Tag} testId="intent-category">{loc(cats.data?.find((c) => c.key === intent.category_key)) || intent.category_key}</Chip>}
        {intent.subject_key && <Chip icon={Tag} testId="intent-subject">{loc(subjects.data?.find((s) => s.key === intent.subject_key)) || intent.subject_key}{intent.grade ? ` · ${intent.grade}` : ""}</Chip>}
        {(w || intent.commune) && <Chip icon={MapPin} testId="intent-place">{[intent.commune, loc(w)].filter(Boolean).join(", ")}</Chip>}
        {intent.urgency === "high" && <Chip icon={AlarmClock} testId="intent-urgent">{t("match.urgent")}</Chip>}
        {(when.day || when.slot) && <Chip icon={CalendarDays} testId="intent-when">{[when.day && t(`match.days.${when.day}`), when.slot && t(`onboarding.slots.${when.slot}`)].filter(Boolean).join(" · ")}</Chip>}
        {intent.mode && <Chip icon={MonitorSmartphone} testId="intent-mode">{t(`onboarding.formats.${intent.mode}`)}</Chip>}
      </div>
      {intent.missing?.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-brand-orange" data-testid="intent-missing">
          <TriangleAlert size={14} className="shrink-0 mt-0.5" />{t("match.missing", { fields: intent.missing.map((f) => t(`match.fields.${f}`)).join(", ") })}
        </p>
      )}
    </div>
  );
}

/** Free-text recommendations block: top 3–5 + alternatives. Returns the parsed intent through onIntent. */
export function SmartMatch({ text, kind, onIntent }) {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["smart-match", text, kind, lang], enabled: Boolean(text),
    queryFn: async () => {
      try {
        const r = await matchService.recommend({ text, kind });
        onIntent?.(r.intent || {}, r.kind);
        return r;
      } catch (err) {
        onIntent?.({}, kind); // never block the page: fall back to the keyword list
        throw err;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
  if (!text) return null;
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;
  if (!data) return null;
  const Card = (data.kind || kind) === "teacher" ? TeacherCard : ProCard;
  return (
    <section className="space-y-3" data-testid="smart-match">
      <IntentChips intent={data.intent} kind={data.kind || kind} />
      {data.items.length > 0 && (
        <>
          <h2 className="text-base font-extrabold flex items-center gap-2"><Sparkles size={18} className="text-brand-pink" />{t("match.bestFor")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((x, i) => (Card === TeacherCard ? <TeacherCard key={x.id} tch={x} index={i} /> : <ProCard key={x.id} p={x} index={i} />))}
          </div>
          {data.alternatives.length > 0 && (
            <details className="gf-card p-3">
              <summary className="cursor-pointer text-sm font-bold min-h-[36px] flex items-center">{t("match.alternatives", { n: data.alternatives.length })}</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.alternatives.map((x, i) => (Card === TeacherCard ? <TeacherCard key={x.id} tch={x} index={i + 5} /> : <ProCard key={x.id} p={x} index={i + 5} />))}
              </div>
            </details>
          )}
        </>
      )}
      {data.items.length === 0 && !data.missing?.length && <p className="text-sm text-muted-foreground" data-testid="smart-empty">{t("match.noneNearby")}</p>}
    </section>
  );
}
