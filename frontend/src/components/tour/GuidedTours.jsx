import { Compass, Play } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { TOURS } from "./tours";
import { useTour } from "./TourProvider";

/** "Visites guidées": replay any tour available to this user (opens the right screen first). */
export function GuidedTours() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { start } = useTour();
  const tours = TOURS.filter((tour) => tour.route && (!tour.when || tour.when({ user })));
  return (
    <section className="gf-card p-5 sm:p-6 mt-6" aria-labelledby="tours-title" data-testid="guided-tours">
      <h2 id="tours-title" className="flex items-center gap-2 text-lg font-bold"><Compass size={20} className="text-brand-electric" aria-hidden="true" />{t("tour.menuTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("tour.menuText")}</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {tours.map((tour) => (
          <li key={tour.id}>
            <button type="button" onClick={() => start(tour.id)} className="flex w-full items-center gap-3 rounded-xl border border-border px-4 min-h-[52px] text-start hover:bg-secondary/60"
              data-testid={`tour-start-${tour.id}`}>
              <Play size={16} className="shrink-0 text-brand-electric" aria-hidden="true" />
              <span className="font-semibold">{t(`tour.${tour.id}.name`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
