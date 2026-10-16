import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { ProCard, TeacherCard } from "@/components/catalog/Cards";
import { PageHeader } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";
import { socialService } from "@/services/marketplaceService";

export default function Favorites() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ["favorites"], queryFn: socialService.favorites });
  return (
    <div className={`${ui.container} py-6 sm:py-10`} data-testid="favorites-page">
      <PageHeader title={t("favorites.title")} />
      {isLoading ? <Skeleton className="h-48 rounded-xl" /> : !data?.items.length ? (
        <div className="py-14 text-center text-muted-foreground" data-testid="favorites-empty">
          <Heart size={36} strokeWidth={1.4} className="mx-auto mb-3" />
          <p>{t("favorites.empty")}</p>
          <Link to="/search" className={`${ui.btnOutline} mt-4`}>{t("nav.search")}</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((x, i) => (x.kind === "teacher" ? <TeacherCard key={x.id} tch={x} index={i} /> : <ProCard key={x.id} p={x} index={i} />))}
        </div>
      )}
    </div>
  );
}
