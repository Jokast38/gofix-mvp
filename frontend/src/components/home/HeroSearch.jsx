import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search } from "lucide-react";
import { useI18n, useLocalized } from "@/i18n";
import { useWilayas } from "@/hooks/usePublic";
import { ui } from "@/lib/ui";

export function HeroSearch() {
  const { t } = useI18n();
  const loc = useLocalized();
  const navigate = useNavigate();
  const { data: wilayas = [] } = useWilayas();
  const [q, setQ] = useState("");
  const [wilaya, setWilaya] = useState("");

  const go = (query) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (wilaya) p.set("wilaya", wilaya);
    navigate(`/search?${p.toString()}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <form role="search" onSubmit={(e) => { e.preventDefault(); go(q.trim()); }}
        className="gf-card p-2 flex flex-col sm:flex-row gap-2" data-testid="home-search-form">
        <label className="relative flex-1">
          <span className="sr-only">{t("home.searchPlaceholder")}</span>
          <Search size={20} strokeWidth={1.5} className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("home.searchPlaceholder")}
            className={`${ui.input} ps-11 border-transparent bg-transparent`} data-testid="home-search-input" maxLength={80} />
        </label>
        <label className="relative sm:w-48">
          <span className="sr-only">{t("home.wilayaLabel")}</span>
          <MapPin size={18} strokeWidth={1.5} className="absolute top-1/2 -translate-y-1/2 start-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <select value={wilaya} onChange={(e) => setWilaya(e.target.value)} data-testid="home-wilaya-select"
            className={`${ui.input} ps-10 appearance-none cursor-pointer`}>
            <option value="">{t("home.wilayaAll")}</option>
            {wilayas.map((w) => (
              <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, "0")} – ${loc(w)}`}</option>
            ))}
          </select>
        </label>
        <button type="submit" className={ui.btnPrimary} data-testid="home-search-submit">{t("home.searchBtn")}</button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("home.popular")}</span>
        {t("home.popularItems").map((p, i) => (
          <button key={p} type="button" onClick={() => go(p)} data-testid={`home-popular-${i}`}
            className="rounded-full border border-border bg-secondary/60 px-3 min-h-[36px] text-xs font-semibold hover:border-brand-electric/60 transition-colors">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
