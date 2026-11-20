import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, GraduationCap, Info, Sparkles, X } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { catalogService, eduService } from "@/api/services";
import { useConfig } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { formatDA } from "@/lib/format";
import { alpha, BRAND, RADIUS, useTheme } from "@/theme";
import { Btn, Card, Loading, Row, Section, Txt } from "@/ui";
import { ProfileCard } from "./catalog";

export const BAND_COLOR = { very_good: BRAND.electric, satisfactory: BRAND.violet, fragile: BRAND.orange, to_strengthen: BRAND.pink };

/** Readable names: subjects and test keys (class-1AP-3, lang-fr-2, express-1AP, higher-info_l1, import-1AM). */
export function useEduLabels() {
  const { t } = useI18n();
  const subject = (s) => {
    const v = t(`edu.subjects.${s}`);
    return v.startsWith("edu.") ? s : v;
  };
  const test = (key) => {
    const [kind, ...rest] = key.split("-");
    if (kind === "class") return `${rest[0]} · ${t("edu.testN", { n: rest[1] })}`;
    if (kind === "lang") return `${t(`edu.langs.${rest[0]}`)} · ${t("edu.levelN", { n: rest[1] })}`;
    if (kind === "express") return `${rest[0]} · ${t("edu.express")}`;
    if (kind === "higher") return t(`edu.tracks.${rest.join("-")}`);
    if (kind === "import") return `${rest.join("-")} · ${t("edu.imported")}`;
    return key;
  };
  return { subject, test };
}

/** Entry card on the home and academy screens. */
export function EduCta({ style }) {
  const { t } = useI18n();
  const { flag } = useConfig();
  if (!flag("edu_ai")) return null;
  return (
    <Card glow onPress={() => router.push("/edu")} testID="edu-cta" style={[{ flexDirection: "row", gap: 12, alignItems: "center" }, style]}>
      <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: alpha(BRAND.violet, 0.15), alignItems: "center", justifyContent: "center" }}>
        <GraduationCap size={24} color={BRAND.violet} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight={800}>{t("edu.cta.title")}</Txt>
        <Txt variant="tiny" muted>{t("edu.cta.text")}</Txt>
      </View>
    </Card>
  );
}

function Notice({ children, color }) {
  const { c } = useTheme();
  return (
    <Row gap={6} style={{ alignItems: "flex-start", marginTop: 8 }}>
      <Info size={14} color={color || c.muted} style={{ marginTop: 2 }} />
      <Txt variant="tiny" color={color} muted={!color} style={{ flex: 1 }}>{children}</Txt>
    </Row>
  );
}

export function Disclaimer() {
  const { t } = useI18n();
  return <Notice>{t("edu.disclaimer")}</Notice>;
}

function QuestionFlow({ attempt, onDone }) {
  const { c } = useTheme();
  const { t, te, lang, rtl } = useI18n();
  const label = useEduLabels();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const qs = attempt.questions;
  const q = qs[i];
  const done = qs.every((x) => answers[x.key] != null);
  const answered = Object.keys(answers).length;
  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await eduService.finish(attempt.id, answers, attempt.token));
    } catch (err) {
      setError(te(errorCode(err)));
      setBusy(false);
    }
  };
  const choose = (idx) => {
    setAnswers((a) => ({ ...a, [q.key]: idx }));
    if (i < qs.length - 1) setTimeout(() => setI((n) => Math.min(n + 1, qs.length - 1)), 250);
  };
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  return (
    <View testID="edu-flow">
      <Txt variant="tiny" weight={800} color={BRAND.violet}>{label.test(attempt.test_key)}</Txt>
      {attempt.draft && <Notice color={BRAND.orange}>{t("edu.draft")}</Notice>}
      {q.lang !== lang && <Notice>{t("edu.contentLang", { lang: t(`edu.langs.${q.lang}`) })}</Notice>}
      <Row style={{ justifyContent: "space-between", marginTop: 14 }}>
        <Txt weight={800} testID="edu-progress">{t("edu.question", { i: i + 1, n: qs.length })}</Txt>
        <Txt variant="tiny" muted>{label.subject(q.subject)}</Txt>
      </Row>
      <View style={{ height: 8, borderRadius: 999, backgroundColor: c.border, marginTop: 8, overflow: "hidden" }}>
        <View style={{ height: 8, width: `${(answered / qs.length) * 100}%`, backgroundColor: BRAND.violet }} />
      </View>
      <Card style={{ marginTop: 14, gap: 10 }}>
        <Txt variant="h3" auto testID="edu-question">{q.question}</Txt>
        {q.options.map((o, idx) => {
          const on = answers[q.key] === idx;
          return (
            <Pressable key={idx} onPress={() => choose(idx)} testID={`edu-option-${idx}`} accessibilityRole="radio" accessibilityState={{ checked: on }}
              style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: RADIUS,
                borderWidth: 1, borderColor: on ? BRAND.violet : c.border, backgroundColor: on ? alpha(BRAND.violet, 0.15) : "transparent" }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1,
                borderColor: on ? BRAND.violet : c.border, backgroundColor: on ? BRAND.violet : "transparent" }}>
                <Txt variant="tiny" weight={800} color={on ? "#fff" : c.text}>{"ABCD"[idx]}</Txt>
              </View>
              <Txt weight={600} auto style={{ flex: 1 }}>{o}</Txt>
            </Pressable>
          );
        })}
      </Card>
      <Row style={{ justifyContent: "space-between", marginTop: 14 }}>
        <Btn small variant="outline" icon={Prev} title={t("edu.prev")} disabled={i === 0} onPress={() => setI(i - 1)} testID="edu-prev" />
        {i < qs.length - 1
          ? <Btn small variant="outline" icon={Next} title={t("edu.next")} onPress={() => setI(i + 1)} testID="edu-next" />
          : <Btn small variant="gradient" title={t("edu.finish")} disabled={!done} loading={busy} onPress={finish} testID="edu-finish" />}
      </Row>
      {!done && i === qs.length - 1 && <Notice>{t("edu.answerAll")}</Notice>}
      {error && <Txt variant="small" color={c.danger} style={{ marginTop: 8 }}>{error}</Txt>}
      <Row gap={6} wrap style={{ justifyContent: "center", marginTop: 16 }}>
        {qs.map((x, n) => (
          <Pressable key={x.key} onPress={() => setI(n)} accessibilityRole="button" accessibilityLabel={String(n + 1)}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1,
              borderColor: n === i ? BRAND.violet : c.border, backgroundColor: answers[x.key] != null ? alpha(BRAND.violet, 0.15) : "transparent" }}>
            <Txt variant="small" weight={700}>{n + 1}</Txt>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

function Teachers({ rec }) {
  const { t } = useI18n();
  const label = useEduLabels();
  const query = { subject_key: rec.subject_key, level_key: rec.level_key, sort: "rating", page_size: 3 };
  const { data, isLoading } = useQuery({ queryKey: ["edu-teachers", query], queryFn: () => catalogService.teachers(query) });
  return (
    <Section title={t("edu.teachersTitle", { subject: label.subject(rec.subject_key) })}>
      <View style={{ gap: 10 }} testID="edu-teachers">
        {isLoading ? <Loading /> : (data?.items || []).map((x, i) => <ProfileCard key={x.id} item={{ kind: "teacher", ...x }} index={i} />)}
        {!isLoading && !data?.items?.length && <Txt variant="small" muted>{t("edu.noTeacher")}</Txt>}
        <Btn small variant="outline" title={t("edu.teachersAll")} onPress={() => router.push({ pathname: "/academy", params: { subject_key: rec.subject_key, ...(rec.level_key && { level_key: rec.level_key }) } })} />
      </View>
    </Section>
  );
}

export function ResultView({ result, onRetry }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { settings } = useConfig();
  const label = useEduLabels();
  const color = BAND_COLOR[result.band];
  const price = settings.plan_price_student_student_pass;
  return (
    <View testID="edu-result">
      <Txt variant="tiny" weight={800} color={BRAND.violet}>{label.test(result.test_key)}</Txt>
      <Card style={{ marginTop: 10, flexDirection: "row", gap: 14, alignItems: "center" }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: color, alignItems: "center", justifyContent: "center" }}>
          <Txt variant="h2" color={color} testID="edu-score">{`⁦${result.score}%⁩`}</Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="h3" color={color} testID="edu-band">{t(`edu.bands.${result.band}`)}</Txt>
          <Txt variant="small" weight={700}>{t("edu.score", { correct: result.correct, total: result.total })}</Txt>
          <Txt variant="small">{t(result.passed ? "edu.passed" : "edu.failed")}</Txt>
        </View>
      </Card>
      <Disclaimer />

      {result.saved ? <Txt variant="small" weight={700} color={BRAND.electric} style={{ marginTop: 10 }} testID="edu-saved">{t("edu.saved")}</Txt> : (
        <Card style={{ marginTop: 12, gap: 6, borderColor: alpha(BRAND.orange, 0.5) }} testID="edu-visitor">
          <Txt weight={800}>{t("edu.visitorTitle")}</Txt>
          <Txt variant="small" muted>{t("edu.visitorText")}</Txt>
          <Btn small title={t("edu.visitorCta")} onPress={() => router.push("/register")} testID="edu-visitor-cta" />
        </Card>
      )}

      <View style={{ gap: 8, marginTop: 14 }}>
        {result.next_test_key && <Btn variant="gradient" title={t("edu.nextTest")} onPress={() => router.replace(`/edu/${result.next_test_key}`)} testID="edu-next-test" />}
        <Btn variant="outline" title={t("edu.retry")} onPress={onRetry || (() => router.push(`/edu/${result.test_key}`))} testID="edu-retry" />
        <Btn variant="ghost" title={t("edu.backToTests")} onPress={() => router.push("/edu")} />
      </View>

      {!result.student_pass && (
        <Card glow style={{ marginTop: 16, gap: 6 }} testID="edu-pass">
          <Row gap={8}><Sparkles size={18} color={BRAND.violet} /><Txt weight={800} style={{ flex: 1 }}>{t("edu.passTitle")}</Txt></Row>
          <Txt variant="small" muted>{t("edu.passText")}</Txt>
          {price ? <Txt weight={800}>{t("edu.passPrice", { price: formatDA(price).replace(" DA", "") })}</Txt> : null}
          <Btn small variant="gradient" title={t("edu.passCta")} onPress={() => router.push({ pathname: "/pricing", params: { audience: "student" } })} testID="edu-pass-cta" />
        </Card>
      )}

      {result.recommendation && <Teachers rec={result.recommendation} />}

      <Section title={t("edu.bySubject")}>
        <View style={{ gap: 8 }}>
          {result.subjects.map((s) => (
            <Card key={s.subject} style={{ gap: 6 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt weight={700}>{label.subject(s.subject)}</Txt>
                <Txt variant="small" muted>{`⁦${s.correct}/${s.total}${s.pct != null ? ` · ${s.pct}%` : ""}⁩`}</Txt>
              </Row>
              {s.pct == null ? <Txt variant="tiny" muted>{t("edu.insufficient")}</Txt> : (
                <View style={{ height: 8, borderRadius: 999, backgroundColor: c.border, overflow: "hidden" }}>
                  <View style={{ height: 8, width: `${s.pct}%`, backgroundColor: BRAND.violet }} />
                </View>
              )}
            </Card>
          ))}
        </View>
      </Section>

      <Section title={t("edu.corrections")}>
        <View style={{ gap: 10 }} testID="edu-corrections">
          {result.corrections.map((x, n) => (
            <Card key={x.key} style={{ gap: 4 }}>
              <Row gap={6} style={{ alignItems: "flex-start" }}>
                {x.ok ? <Check size={18} color={BRAND.electric} /> : <X size={18} color={c.danger} />}
                <Txt weight={700} auto style={{ flex: 1 }}>{`${n + 1}. ${x.question}`}</Txt>
              </Row>
              {!x.ok && <Txt variant="small"><Txt variant="small" muted>{t("edu.yourAnswer")} : </Txt><Txt variant="small" weight={700} color={c.danger}>{x.chosen == null ? t("edu.noAnswer") : x.options[x.chosen]}</Txt></Txt>}
              <Txt variant="small"><Txt variant="small" muted>{t("edu.rightAnswer")} : </Txt><Txt variant="small" weight={700}>{x.options[x.correct]}</Txt></Txt>
              {x.explanation ? <Txt variant="tiny" muted auto>{x.explanation}</Txt> : null}
            </Card>
          ))}
        </View>
      </Section>
    </View>
  );
}

/** Starts one attempt (once, even if the effect runs twice), then shows the questions and the result. */
export function TestRun({ testKey, onRetry }) {
  const { t, te } = useI18n();
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    eduService.start(testKey).then(setAttempt).catch((err) => setError(te(errorCode(err))));
  }, [testKey, te]);
  if (error) {
    return (
      <Card style={{ gap: 10 }} testID="edu-error">
        <Txt variant="small">{error}</Txt>
        <Btn small variant="outline" title={t("edu.backToTests")} onPress={() => router.replace("/edu")} />
      </Card>
    );
  }
  if (result) return <ResultView result={result} onRetry={onRetry} />;
  if (!attempt) return <Loading />;
  return <QuestionFlow attempt={attempt} onDone={setResult} />;
}
