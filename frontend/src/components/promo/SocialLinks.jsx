import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { SOCIAL_KEYS } from "@/services/promoService";

// Simplified brand marks (24x24), drawn here: the icon set used by the site has no brand logos.
const MARKS = {
  facebook: { color: "#1877F2", el: (
    <><circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M13.2 21v-7h2.3l.4-2.8h-2.7V9.5c0-.8.3-1.4 1.4-1.4H16V5.6c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.1H8V14h2.4v7z" fill="#fff" /></>) },
  instagram: { color: "#E1306C", el: (
    <><rect x="3" y="3" width="18" height="18" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" /></>) },
  tiktok: { color: "#25F4EE", el: (
    <path d="M14.5 3v11.4a3.4 3.4 0 1 1-2.9-3.4M14.5 3c.4 2.5 2.1 4.2 4.7 4.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />) },
  youtube: { color: "#FF0000", el: (
    <><rect x="2" y="5" width="20" height="14" rx="4.5" fill="currentColor" /><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff" /></>) },
  linkedin: { color: "#0A66C2", el: (
    <><rect x="2.5" y="2.5" width="19" height="19" rx="3.5" fill="currentColor" />
      <rect x="6.3" y="10" width="2.4" height="7.6" fill="#fff" /><circle cx="7.5" cy="7.1" r="1.4" fill="#fff" />
      <path d="M10.9 10h2.3v1.1c.4-.7 1.3-1.3 2.5-1.3 2.1 0 2.6 1.3 2.6 3.2v4.6H16v-4.1c0-1-.2-1.7-1.2-1.7s-1.5.7-1.5 1.7v4.1h-2.4z" fill="#fff" /></>) },
  x: { color: "currentColor", el: (
    <path d="M4 4l6.6 8.8L4.3 20h1.8l5.4-6.1 4.5 6.1H20l-6.9-9.3L19 4h-1.8l-5 5.6L8.1 4z" fill="currentColor" />) },
};

export function BrandMark({ name, size = 20 }) {
  const m = MARKS[name];
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ color: m.color }}>{m.el}</svg>;
}

/** GoFix social networks, set in the back-office (Admin → Communication). Renders nothing while no link is set. */
export function SocialLinks({ className = "", title = true }) {
  const { t } = useI18n();
  const { settings = {} } = useConfig();
  const links = SOCIAL_KEYS.map((k) => ({ k, url: settings[`social_${k}_url`] })).filter((l) => l.url);
  if (!links.length) return null;
  return (
    <div className={className} data-testid="social-links">
      {title && <p className="text-sm font-bold mb-2">{t("promo.followUs")}</p>}
      <ul className="flex flex-wrap gap-2">
        {links.map(({ k, url }) => (
          <li key={k}>
            <a href={url} target="_blank" rel="noopener noreferrer" aria-label={t(`promo.social.${k}`)} title={t(`promo.social.${k}`)} data-testid={`social-${k}`}
              className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card hover:border-brand-electric/60 transition-colors">
              <BrandMark name={k} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
