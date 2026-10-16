import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useConfig } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { alpha, BRAND, useTheme } from "@/theme";
import { Card, Chip, Row, Screen, Section, TopBar, Txt } from "@/ui";

const SLUGS = ["mentions", "cgu", "cgv", "privacy"];

/** Replaces {company_rc}-style fields with the back-office values; empty ones are shown as "[à compléter]". */
function Filled({ text, settings, missing, variant = "small", muted }) {
  const parts = String(text).split(/(\{\w+\})/g);
  return (
    <Txt variant={variant} muted={muted}>
      {parts.map((part, i) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return part;
        const value = settings[m[1]];
        return value ? String(value) : <Txt key={i} variant={variant} weight={700} color={BRAND.orange}>[{missing}]</Txt>;
      })}
    </Txt>
  );
}

export default function Legal() {
  const { slug } = useLocalSearchParams();
  const { t } = useI18n();
  const { c } = useTheme();
  const { settings = {} } = useConfig();
  const key = SLUGS.includes(slug) ? slug : "mentions";
  const page = t(`legal.${key}`);
  const missing = t("legal.missing");
  const fill = (text, props) => <Filled text={text} settings={settings} missing={missing} {...props} />;
  return (
    <Screen>
      <TopBar title={page.title} />
      <Row gap={8} wrap style={{ marginTop: 12 }}>
        {SLUGS.map((s) => <Chip key={s} label={t(`legal.${s}`).title} selected={s === key} onPress={() => router.setParams({ slug: s })} />)}
      </Row>
      <View style={{ marginTop: 10 }}>{fill(t("legal.version"), { variant: "tiny", muted: true })}</View>
      {!settings.legal_reviewed && (
        <Card style={{ marginTop: 12, borderColor: BRAND.orange, backgroundColor: alpha(BRAND.orange, 0.06) }}><Txt variant="small">{t("legal.disclaimer")}</Txt></Card>
      )}
      {(page.sections || []).map((sec) => (
        <Section key={sec.h} title={sec.h}>
          <View style={{ gap: 8 }}>
            {sec.table && sec.table.rows.map((r) => (
              <Card key={r[0]} style={{ padding: 12, gap: 2 }}>
                <Txt variant="small" weight={800}>{r[0]}</Txt>
                {r.slice(1).map((cell, i) => (
                  <Txt key={i} variant="small" muted><Txt variant="small" weight={700} color={c.text}>{sec.table.head[i + 1]} : </Txt>{cell}</Txt>
                ))}
              </Card>
            ))}
            {[].concat(sec.p || []).map((p) => <View key={p.slice(0, 40)}>{fill(p)}</View>)}
            {sec.items && sec.items.map((it) => (
              <Row key={it} gap={8} style={{ alignItems: "flex-start" }}>
                <Txt variant="small" color={BRAND.electric}>•</Txt>
                <View style={{ flex: 1 }}>{fill(it)}</View>
              </Row>
            ))}
          </View>
        </Section>
      ))}
    </Screen>
  );
}
