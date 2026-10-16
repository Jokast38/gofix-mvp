import { useState } from "react";
import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { publicService } from "@/api/services";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";
import { Card, Loading, Screen, Section, TopBar, Txt } from "@/ui";

export default function Faq() {
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["faq", lang], queryFn: () => publicService.faq(lang) });
  const groups = data.reduce((acc, e) => ({ ...acc, [e.category]: [...(acc[e.category] || []), e] }), {});
  return (
    <Screen>
      <TopBar title={t("faq.title")} />
      <Txt variant="small" muted style={{ marginTop: 12 }}>{t("faq.subtitle")}</Txt>
      {isLoading ? <Loading /> : Object.entries(groups).map(([cat, items]) => (
        <Section key={cat} title={t(`faq.categories.${cat}`) === `faq.categories.${cat}` ? cat : t(`faq.categories.${cat}`)}>
          <Card style={{ padding: 0 }}>
            {items.map((e, i) => {
              const isOpen = open === e.id;
              const Icon = isOpen ? ChevronUp : ChevronDown;
              return (
                <View key={e.id} style={{ borderTopWidth: i ? 1 : 0, borderColor: c.border }}>
                  <Pressable onPress={() => setOpen(isOpen ? null : e.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Txt weight={700} style={{ flex: 1 }}>{(lang === "ar" && e.question_ar) || e.question_fr}</Txt>
                    <Icon size={18} color={c.muted} />
                  </Pressable>
                  {isOpen && <Txt variant="small" style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{(lang === "ar" && e.answer_ar) || e.answer_fr}</Txt>}
                </View>
              );
            })}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
