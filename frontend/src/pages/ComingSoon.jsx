import { Link, useSearchParams } from "react-router-dom";
import { Hourglass } from "lucide-react";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

export default function ComingSoon({ feature }) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const q = params.get("q");
  return (
    <div className={`${ui.container} py-16 max-w-xl text-center`} data-testid={`coming-soon-${feature}`}>
      <span className="mx-auto grid place-items-center h-16 w-16 rounded-2xl bg-brand-electric/10 text-brand-electric">
        <Hourglass size={30} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="gf-eyebrow mt-6">{t("comingSoon.title")}</p>
      <h1 className="mt-2 text-3xl font-extrabold">{t(`comingSoon.features.${feature}`)}</h1>
      <p className="mt-3 text-muted-foreground">{t("comingSoon.text")}</p>
      {q && <p className="mt-2 text-sm" data-testid="coming-soon-query">{t("comingSoon.query", { q })}</p>}
      <Link to="/" className={`${ui.btnPrimary} mt-8`} data-testid="coming-soon-back">{t("comingSoon.back")}</Link>
    </div>
  );
}
