import { FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { SOCIAL_KEYS } from "@/services/promoService";

// Official brand logos (react-icons / Font Awesome 6 Brands) in their brand colours.
const MARKS = {
  facebook: { Icon: FaFacebook, color: "#1877F2" },
  instagram: { Icon: FaInstagram, color: "#E1306C" },
  tiktok: { Icon: FaTiktok, color: "currentColor" },
  youtube: { Icon: FaYoutube, color: "#FF0000" },
  linkedin: { Icon: FaLinkedin, color: "#0A66C2" },
  x: { Icon: FaXTwitter, color: "currentColor" },
};

export function BrandMark({ name, size = 20 }) {
  const { Icon, color } = MARKS[name];
  return <Icon size={size} color={color} aria-hidden="true" focusable="false" />;
}

/** GoFix social networks, links set in the back-office (Admin → Communication).
 * All six logos are always shown; a network without a link yet is dimmed and marked "Bientôt". */
export function SocialLinks({ className = "", title = true, compact = false }) {
  const { t } = useI18n();
  const { settings = {} } = useConfig();
  const base = `grid ${compact ? "h-10 w-10" : "h-11 w-11"} place-items-center rounded-full border border-border bg-card transition-colors`;
  return (
    <div className={className} data-testid="social-links">
      {title && <p className="text-sm font-bold mb-2">{t("promo.followUs")}</p>}
      <ul className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
        {SOCIAL_KEYS.map((k) => {
          const url = settings[`social_${k}_url`];
          const label = t(`promo.social.${k}`);
          return (
            <li key={k}>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} data-testid={`social-${k}`}
                  className={`${base} hover:border-brand-electric/60 hover:-translate-y-0.5`}>
                  <BrandMark name={k} size={compact ? 18 : 20} />
                </a>
              ) : (
                <span role="img" aria-label={`${label} – ${t("upcoming.soon")}`} title={`${label} – ${t("upcoming.soon")}`} data-testid={`social-${k}-soon`}
                  className={`${base} opacity-60 cursor-default`}>
                  <BrandMark name={k} size={compact ? 18 : 20} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
