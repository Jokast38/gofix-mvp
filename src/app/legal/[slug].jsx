import { router, useLocalSearchParams } from "expo-router";
import { useI18n } from "@/i18n";
import { BRAND } from "@/theme";
import { Card, Chip, Row, Screen, Section, TopBar, Txt } from "@/ui";

const SLUGS = ["mentions", "cgu", "cgv", "privacy"];

export default function Legal() {
  const { slug } = useLocalSearchParams();
  const { t } = useI18n();
  const key = SLUGS.includes(slug) ? slug : "mentions";
  const page = t(`legal.${key}`);
  return (
    <Screen>
      <TopBar title={page.title} />
      <Row gap={8} wrap style={{ marginTop: 12 }}>{SLUGS.map((s) => <Chip key={s} label={t(`legal.${s}`).title} selected={s === key} onPress={() => router.setParams({ slug: s })} />)}</Row>
      <Card style={{ marginTop: 12, borderColor: BRAND.orange }}><Txt variant="small">{t("legal.disclaimer")}</Txt></Card>
      {(page.sections || []).map((sec) => <Section key={sec.h} title={sec.h}><Txt variant="small">{sec.p}</Txt></Section>)}
    </Screen>
  );
}
