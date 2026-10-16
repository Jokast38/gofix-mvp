import { CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Logo } from "@/components/brand/Logo";
import { StoreButtons, useStoreLinks } from "@/components/common/StoreButtons";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

export default function AppLanding() {
  const { t } = useI18n();
  const { appStore, playStore } = useStoreLinks();
  const live = Boolean(appStore || playStore);
  return (
    <div className={`${ui.container} py-12 max-w-3xl text-center`} data-testid="app-landing-page">
      <Logo size="lg" className="mb-6" />
      <PageHeader eyebrow={t(live ? "appLanding.eyebrowLive" : "appLanding.eyebrow")} title={t("appLanding.title")}
        subtitle={t(live ? "appLanding.subtitleLive" : "appLanding.subtitle")} />
      <ul className="flex flex-wrap justify-center gap-4 mb-8">
        {t("appLanding.features").map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm font-semibold"><CircleCheck size={18} strokeWidth={1.5} className="text-brand-electric" />{f}</li>
        ))}
      </ul>
      <StoreButtons className="justify-center" />
      <p className="mt-6 text-sm text-muted-foreground">{t("appLanding.install")}</p>
    </div>
  );
}
