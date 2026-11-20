import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { eduService } from "@/api/services";
import { BAND_COLOR, Disclaimer, useEduLabels } from "@/components/edu";
import { useAuth, useConfig } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { BRAND } from "@/theme";
import { Btn, Card, Chip, Empty, Loading, Row, Screen, Section, TopBar, Txt } from "@/ui";

const TABS = ["classes", "languages", "higher", "history"];
const CYCLES = ["primary", "middle", "secondary"];

function TestCard({ test, title, subtitle }) {
  const { t } = useI18n();
  return (
    <Card onPress={() => router.push(`/edu/${test.key}`)} testID={`edu-test-${test.key}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Txt weight={800} numberOfLines={1}>{title}</Txt>
        <Txt variant="tiny" muted>{subtitle ? `${subtitle} · ` : ""}{t("edu.questions", { n: test.count })}</Txt>
      </View>
      {test.best != null && <Txt variant="tiny" weight={800} color={BRAND.electric}>{t("edu.best", { pct: test.best })}</Txt>}
    </Card>
  );
}

function Classes({ classes }) {
  const { t } = useI18n();
  const label = useEduLabels();
  const [level, setLevel] = useState(classes[0]?.level);
  const current = classes.find((c) => c.level === level) || classes[0];
  if (!current) return null;
  return (
    <View>
      <Txt weight={700}>{t("edu.chooseClass")}</Txt>
      {CYCLES.map((cy) => {
        const list = classes.filter((c) => c.cycle === cy);
        return list.length ? (
          <View key={cy} style={{ marginTop: 10, gap: 6 }}>
            <Txt variant="tiny" muted>{t(`edu.cycles.${cy}`)}</Txt>
            <Row gap={6} wrap>{list.map((c) => <Chip key={c.level} label={c.level} selected={c.level === current.level} color={BRAND.violet} onPress={() => setLevel(c.level)} testID={`edu-class-${c.level}`} />)}</Row>
          </View>
        ) : null;
      })}
      <View style={{ gap: 10, marginTop: 16 }}>
        {current.tests.map((x) => <TestCard key={x.key} test={x} title={t("edu.testN", { n: x.number })} subtitle={t(`edu.levels.${x.number}`)} />)}
        {current.extra.map((x) => <TestCard key={x.key} test={x} title={label.test(x.key)} />)}
      </View>
    </View>
  );
}

function History() {
  const { t } = useI18n();
  const { user } = useAuth();
  const label = useEduLabels();
  const { data, isLoading } = useQuery({ queryKey: ["edu-history"], queryFn: eduService.history, enabled: Boolean(user) });
  if (!user) {
    return (
      <Card style={{ gap: 10 }} testID="edu-history-login">
        <Txt variant="small">{t("edu.historyLogin")}</Txt>
        <Btn small title={t("nav.login")} onPress={() => router.push("/login")} />
        <Btn small variant="outline" title={t("edu.visitorCta")} onPress={() => router.push("/register")} />
      </Card>
    );
  }
  if (isLoading) return <Loading />;
  if (!data?.length) return <Empty text={t("edu.historyEmpty")} />;
  return (
    <View style={{ gap: 10 }} testID="edu-history">
      {data.map((a) => (
        <Card key={a.id} onPress={() => router.push(`/edu/result/${a.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Txt weight={700} numberOfLines={1}>{label.test(a.test_key)}</Txt>
            <Txt variant="tiny" muted>{formatDate(a.finished_at)} · {t(`edu.bands.${a.band}`)}</Txt>
          </View>
          <Txt variant="h3" color={BAND_COLOR[a.band]}>{`\u2066${a.score}%\u2069`}</Txt>
        </Card>
      ))}
    </View>
  );
}

export default function EduHome() {
  const { t } = useI18n();
  const { flag } = useConfig();
  const label = useEduLabels();
  const [tab, setTab] = useState("classes");
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ["edu-catalog"], queryFn: eduService.catalog, enabled: flag("edu_ai") });
  return (
    <Screen padded={false} refreshing={isRefetching} onRefresh={refetch}>
      <TopBar title={t("edu.title")} />
      <View style={{ padding: 16, paddingBottom: 32 }} testID="edu-page">
        <Txt variant="small" muted>{t("edu.subtitle")}</Txt>
        {!flag("edu_ai") ? <Card style={{ marginTop: 12 }}><Txt variant="small">{t("errors.feature_disabled")}</Txt></Card> : (
          <>
            <Row gap={6} wrap style={{ marginTop: 12 }}>
              {TABS.map((k) => <Chip key={k} label={t(`edu.tabs.${k}`)} selected={tab === k} onPress={() => setTab(k)} testID={`edu-tab-${k}`} />)}
            </Row>
            <Disclaimer />
            <View style={{ marginTop: 14 }}>
              {tab === "history" ? <History /> : isLoading || !data ? <Loading /> :
                tab === "classes" ? <Classes classes={data.classes} /> :
                tab === "languages" ? (
                  data.languages.map((l) => (
                    <Section key={l.lang} title={t(`edu.langs.${l.lang}`)}>
                      <View style={{ gap: 10 }}>{l.tests.map((x) => <TestCard key={x.key} test={x} title={t("edu.levelN", { n: x.number })} subtitle={t(`edu.levels.${x.number}`)} />)}</View>
                    </Section>
                  ))
                ) : <View style={{ gap: 10 }}>{data.higher.map((x) => <TestCard key={x.key} test={x} title={label.test(x.key)} />)}</View>}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
