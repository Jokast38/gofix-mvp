import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react-native";
import { socialService } from "@/api/services";
import { ProfileCard } from "@/components/catalog";
import { useI18n } from "@/i18n";
import { Empty, Loading, Screen, TopBar } from "@/ui";

export default function Favorites() {
  const { t } = useI18n();
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["favorites"], queryFn: socialService.favorites });
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <TopBar title={t("favorites.title")} />
      <View style={{ gap: 12, marginTop: 12 }}>
        {isLoading ? <Loading /> : !data?.items?.length ? <Empty icon={Heart} text={t("favorites.empty")} />
          : data.items.map((x, i) => <ProfileCard key={x.id} item={{ ...x, wilayas: x.wilayas || [] }} index={i} />)}
      </View>
    </Screen>
  );
}
