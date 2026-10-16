import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className={`${ui.container} py-20 text-center`} data-testid="not-found-page">
      <p className="text-6xl font-extrabold gf-gradient-text">404</p>
      <h1 className="mt-4 text-2xl font-extrabold">{t("notFound.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("notFound.text")}</p>
      <Link to="/" className={`${ui.btnPrimary} mt-8`} data-testid="not-found-back">{t("notFound.back")}</Link>
    </div>
  );
}
