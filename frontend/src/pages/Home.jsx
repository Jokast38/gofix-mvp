import { Link } from "react-router-dom";
import { BadgeCheck, Headset, ShieldCheck, Smartphone, Star } from "lucide-react";
import { HeroSearch } from "@/components/home/HeroSearch";
import { RocketTitle } from "@/components/home/RocketTitle";
import { Universes } from "@/components/home/Universes";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { StoreButtons, useStoreLinks } from "@/components/common/StoreButtons";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";
import AppHome from "./AppHome";
import { UpcomingSection } from "@/components/home/Upcoming";
import { BannerSlot } from "@/components/promo/BannerSlot";
import { GoFixSeries } from "@/components/promo/GoFixSeries";
import { Highlights } from "@/components/promo/Highlights";

const TRUST_ICONS = [BadgeCheck, Star, ShieldCheck, Headset];

function TrustRow() {
  const { t } = useI18n();
  return (
    <ul className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-border pt-8" data-testid="home-trust-row">
      {t("home.trust").map((it, i) => {
        const Icon = TRUST_ICONS[i];
        return (
          <li key={it.t} className="flex flex-col items-center text-center gap-1">
            <Icon size={24} strokeWidth={1.5} className="text-brand-electric" aria-hidden="true" />
            <span className="text-sm font-bold">{it.t}</span>
            <span className="text-xs text-muted-foreground">{it.s}</span>
          </li>
        );
      })}
    </ul>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  return (
    <section className={`${ui.container} py-16`} aria-labelledby="how-title">
      <p className="gf-eyebrow text-center">{t("home.howEyebrow")}</p>
      <h2 id="how-title" className="mt-2 text-center text-2xl sm:text-3xl font-extrabold">{t("home.howTitle")}</h2>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t("home.steps").map((s, i) => (
          <li key={s.t} className="gf-card p-5" data-testid={`home-step-${i + 1}`}>
            <span className="grid place-items-center h-10 w-10 rounded-full border border-brand-electric/40 text-brand-electric font-extrabold">{i + 1}</span>
            <h3 className="mt-4 text-lg font-bold">{s.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Landing() {
  const { t } = useI18n();
  const { appStore, playStore } = useStoreLinks();
  return (
    <div data-testid="home-page">
      <section className={`${ui.container} pt-10 sm:pt-16 pb-8 text-center`}>
        <span className="inline-block rounded-full border border-brand-electric/30 bg-brand-electric/10 px-4 py-1.5 gf-eyebrow gf-fade-up">{t("home.badge")}</span>
        <div className="mt-5 gf-fade-up">
          <RocketTitle className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight">
            {t("home.titleStart")}<span className="gf-gradient-text">{t("home.titleHighlight")}</span>
          </RocketTitle>
        </div>
        <p className="mt-5 mx-auto max-w-2xl text-sm sm:text-lg text-muted-foreground gf-fade-up">{t("home.subtitle")}</p>
        <div className="mt-8 gf-fade-up"><HeroSearch /></div>
        <div className="mt-6 flex flex-wrap justify-center gap-3 gf-fade-up">
          <Link to="/register" className={ui.btnGradient} data-testid="home-cta-start">{t("home.ctaStart")}</Link>
          <Link to="/pro/join" className={ui.btnOutline} data-testid="home-cta-pro">{t("nav.becomePro")}</Link>
        </div>
        <TrustRow />
      </section>

      <section className={`${ui.container} py-12`} aria-labelledby="worlds-title">
        <p className="gf-eyebrow text-center">{t("home.worldsEyebrow")}</p>
        <h2 id="worlds-title" className="mt-2 text-center text-2xl sm:text-3xl font-extrabold uppercase tracking-wide">{t("home.worldsTitle")}</h2>
        <p className="mt-3 mx-auto max-w-2xl text-center text-sm sm:text-base text-muted-foreground">{t("home.worldsSubtitle")}</p>
        <div className="mt-10"><Universes /></div>
      </section>

      <div className={`${ui.container} pb-4`}><BannerSlot placement="home" /></div>
      <div className={`${ui.container} py-8`}><Highlights /></div>

      <HowItWorks />
      <div className={`${ui.container} pb-12`}><GoFixSeries /></div>
      <div className={`${ui.container} pb-12`}><UpcomingSection /></div>

      <section className={ui.container}>
        <div className="gf-card p-6 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6" data-testid="home-app-teaser">
          <div className="flex items-center gap-4">
            <span className="grid place-items-center h-14 w-14 rounded-2xl bg-brand-violet/15 text-brand-violet"><Smartphone size={28} strokeWidth={1.5} /></span>
            <div>
              <p className="gf-eyebrow">{t(appStore || playStore ? "homeApp.eyebrowLive" : "home.appEyebrow")}</p>
              <h2 className="text-xl sm:text-2xl font-extrabold">{t("home.appTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("home.appText")}</p>
            </div>
          </div>
          {appStore || playStore
            ? <StoreButtons onlyAvailable className="w-full sm:w-auto" />
            : <Link to="/app" className={ui.btnOutline} data-testid="home-app-cta">{t("home.appCta")}</Link>}
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  if (user === null) return <PageSkeleton />;
  return user ? <AppHome /> : <Landing />;
}
