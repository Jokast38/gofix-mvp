import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Rocket, Search, SlidersHorizontal, Wrench } from "lucide-react";
import { CategoryTile, MoreTile } from "@/components/home/CategoryTile";
import { Logo } from "@/components/brand/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { marketplaceService } from "@/services/marketplaceService";
import { ui } from "@/lib/ui";
import { UpcomingSection } from "@/components/home/Upcoming";

function Section({ icon: Icon, color, title, seeAllTo, children, testId }) {
  const { t } = useI18n();
  return (
    <section className="mt-7" aria-label={title} data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm sm:text-base font-extrabold uppercase tracking-wider" style={{ color }}>
          <span className="grid place-items-center h-7 w-7 rounded-lg border" style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)` }}>
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          {title}
        </h2>
        <Link to={seeAllTo} className="inline-flex items-center min-h-[44px] px-2 -me-2 text-xs font-semibold text-muted-foreground hover:text-foreground" data-testid={`${testId}-see-all`}>{t("common.seeAll")} ›</Link>
      </div>
      {children}
    </section>
  );
}

function TileGrid({ section, to, moreTo }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["home-cats", section], queryFn: () => marketplaceService.categories({ home_section: section }), staleTime: 300_000 });
  if (isLoading) return <div className="grid grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}</div>;
  const cats = (data || []).slice(0, section === "services" ? 7 : 4);
  return (
    <div className="grid grid-cols-4 gap-3">
      {cats.map((c, i) => <CategoryTile key={c.key} cat={c} index={i} to={to(c)} />)}
      {section === "services" && <MoreTile to={moreTo} label={t("appHome.more")} index={cats.length} />}
    </div>
  );
}

export default function AppHome() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const isProvider = user.roles.includes("professional") || user.roles.includes("teacher");

  return (
    <div className={`${ui.container} max-w-2xl pt-4 pb-8`} data-testid="app-home">
      <div className="flex flex-col items-center text-center">
        <Logo size="lg" className="!p-0" />
        <p className="mt-3 text-sm text-muted-foreground" data-testid="app-home-greeting">{t("appHome.hello", { name: user.full_name.split(" ")[0] })}</p>
      </div>

      <form role="search" onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}
        className="mt-5 flex items-center gap-2 rounded-full border border-border bg-card/80 ps-4 pe-1.5 py-1.5 shadow-[0_0_24px_rgba(0,209,255,0.08)]" data-testid="app-home-search-form">
        <Search size={18} strokeWidth={1.6} className="text-muted-foreground shrink-0" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("appHome.searchPh")} maxLength={80}
          className="flex-1 min-w-0 bg-transparent min-h-[40px] text-sm focus:outline-none" data-testid="app-home-search-input" />
        <button type="submit" aria-label={t("home.searchBtn")} className="grid place-items-center h-10 w-10 rounded-full gf-gradient-bg" data-testid="app-home-search-submit">
          <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>

      <Section icon={Wrench} color="var(--brand-pink)" title={t("appHome.services")} seeAllTo="/search" testId="app-home-services">
        <TileGrid section="services" to={(c) => `/search?category_key=${c.key}`} moreTo="/search" />
      </Section>

      <Section icon={GraduationCap} color="var(--brand-electric)" title={t("appHome.academy")} seeAllTo="/academy" testId="app-home-academy">
        <TileGrid section="academy" to={(c) => (c.key === "private_tutoring" ? "/academy" : `/search?category_key=${c.key}`)} />
      </Section>

      <Link to={isProvider ? "/account" : "/pro/join"} data-testid="app-home-talent-banner"
        className="mt-8 flex items-center gap-4 rounded-2xl gf-gradient-border p-4 gf-pulse-glow hover:brightness-110 transition-[filter]">
        <span className="grid place-items-center h-12 w-12 rounded-xl bg-brand-pink/15 text-brand-pink shrink-0"><Rocket size={24} strokeWidth={1.6} aria-hidden="true" /></span>
        <span className="min-w-0">
          <span className="block font-extrabold">{isProvider ? t("appHome.myActivity") : t("appHome.talentTitle")}</span>
          <span className="block text-xs text-muted-foreground">{isProvider ? t("appHome.myActivityText") : t("appHome.talentText")}</span>
        </span>
      </Link>
      <UpcomingSection />
    </div>
  );
}
