import { Apple, Play } from "lucide-react";
import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

/** App Store / Google Play links from the back-office settings; "coming soon" (disabled) while a link is empty. */
export function useStoreLinks() {
  const { settings = {} } = useConfig();
  return { appStore: settings.app_store_url || "", playStore: settings.play_store_url || "" };
}

export function StoreButtons({ onlyAvailable = false, className = "" }) {
  const { t } = useI18n();
  const { appStore, playStore } = useStoreLinks();
  const stores = [
    { url: appStore, Icon: Apple, label: t(appStore ? "appLanding.appStoreGo" : "appLanding.appStore"), testId: "app-store-button" },
    { url: playStore, Icon: Play, label: t(playStore ? "appLanding.googlePlayGo" : "appLanding.googlePlay"), testId: "google-play-button" },
  ].filter((s) => s.url || !onlyAvailable);
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      {stores.map(({ url, Icon, label, testId }) => url ? (
        <a key={testId} href={url} target="_blank" rel="noopener noreferrer" className={ui.btnOutline} data-testid={testId}>
          <Icon size={20} strokeWidth={1.5} aria-hidden="true" />{label}
        </a>
      ) : (
        <button key={testId} type="button" disabled aria-disabled="true" className={`${ui.btnOutline} opacity-80`} data-testid={testId}>
          <Icon size={20} strokeWidth={1.5} aria-hidden="true" />{label}
        </button>
      ))}
    </div>
  );
}
