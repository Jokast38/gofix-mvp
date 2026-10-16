import { Camera, GraduationCap, Mic, QrCode, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";

// Innovations planned in the roadmap (feature flags off, no behaviour yet): shown as "coming soon" only.
export const UPCOMING = [
  { key: "voice", icon: Mic, color: "var(--brand-orange)" },
  { key: "vision", icon: Camera, color: "var(--brand-pink)" },
  { key: "edu_ai", icon: GraduationCap, color: "var(--brand-violet)" },
  { key: "pro_ai", icon: Sparkles, color: "var(--brand-electric)" },
  { key: "passport", icon: QrCode, color: "var(--brand-pink)" },
];

function UpcomingCard({ item }) {
  const { t } = useI18n();
  const Icon = item.icon;
  return (
    <li className="gf-card p-4 flex items-start gap-3 min-w-0" data-testid={`upcoming-${item.key}`}>
      <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl" style={{ color: item.color, background: `color-mix(in srgb, ${item.color} 14%, transparent)` }}>
        <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold" dir="ltr">{t(`upcoming.${item.key}.title`)}</span>
          <span className="rounded-full bg-brand-orange/15 border border-brand-orange/50 px-2 py-0.5 text-[10px] font-extrabold text-brand-orange">{t("upcoming.soon")}</span>
        </span>
        <span className="block mt-1 text-xs text-muted-foreground">{t(`upcoming.${item.key}.text`)}</span>
      </span>
    </li>
  );
}

export function UpcomingSection() {
  const { t } = useI18n();
  return (
    <section className="mt-10" aria-labelledby="upcoming-title" data-testid="upcoming-section">
      <p className="gf-eyebrow">{t("upcoming.eyebrow")}</p>
      <h2 id="upcoming-title" className="mt-1 text-xl sm:text-2xl font-extrabold">{t("upcoming.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("upcoming.subtitle")}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{UPCOMING.map((u) => <UpcomingCard key={u.key} item={u} />)}</ul>
    </section>
  );
}

export function UpcomingTeaser({ keys }) {
  return <ul className="grid gap-3 sm:grid-cols-2" data-testid="upcoming-teaser">{UPCOMING.filter((u) => keys.includes(u.key)).map((u) => <UpcomingCard key={u.key} item={u} />)}</ul>;
}
