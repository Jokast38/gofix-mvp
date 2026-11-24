import { useEffect, useRef, useState } from "react";
import { Linking, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Keyboard, Mic, RotateCcw, Square, X } from "lucide-react-native";
import { errorCode } from "@/api/client";
import { catalogService, voiceService } from "@/api/services";
import { useConfig, useWilayas } from "@/hooks/auth";
import { useI18n, useLocalized } from "@/i18n";
import { matchDraft } from "@/lib/matchDraft";
import { prefs } from "@/api/storage";
import { alpha, BRAND, useTheme } from "@/theme";
import { Btn, Card, Chip, Field, IconBtn, Input, Loading, Row, SelectField, Sheet, Txt, useToast } from "@/ui";

// The native module only exists in app builds that include it: an older APK (or Expo Go) must not crash,
// the microphone then simply falls back to the keyboard.
let SR = null;
try {
  SR = require("expo-speech-recognition");
} catch {
  SR = null;
}
const speech = SR?.ExpoSpeechRecognitionModule || null;

const MAX_S = 30;
const LANGS = ["fr-FR", "ar-DZ", "ar-SA", "en-US"];
const DEFAULT_LANG = { fr: "fr-FR", ar: "ar-DZ", en: "en-US" };
const CONSENT_KEY = "gofix_voice_consent";
const LANG_KEY = "gofix_voice_lang";

function available() {
  try {
    return Boolean(speech && speech.isRecognitionAvailable());
  } catch {
    return false;
  }
}

/** Microphone button for the search bars: opens the dictation sheet (or a "coming soon" toast if the flag is off). */
export function VoiceMic({ size = 20, color, testID = "voice-mic" }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { flag } = useConfig();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconBtn onPress={() => (flag("voice") ? setOpen(true) : toast(t("upcoming.toast.voice")))} label={t("voice.mic")} testID={testID}>
        <Mic size={size} color={color || c.muted} />
      </IconBtn>
      {open ? <VoiceSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Dictation: consent -> listening (30 s max) -> editable text -> summary to check -> AI MATCH. The keyboard stays available. */
export function VoiceSheet({ onClose, onDone }) {
  const { c } = useTheme();
  const { t, te, lang: uiLang } = useI18n();
  const loc = useLocalized();
  const toast = useToast();
  const [stage, setStage] = useState("loading"); // loading | consent | ready | listening | review | analysing | summary
  const [locale, setLocale] = useState(DEFAULT_LANG[uiLang] || "fr-FR");
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(0);
  const [onDevice, setOnDevice] = useState(false);
  const [intent, setIntent] = useState(null);
  const [fix, setFix] = useState({});
  const started = useRef(0);
  const finalText = useRef("");
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => catalogService.categories(), staleTime: 300_000 });
  const { data: wilayas = [] } = useWilayas();

  useEffect(() => {
    (async () => {
      const [consent, saved] = await Promise.all([prefs.get(CONSENT_KEY), prefs.get(LANG_KEY)]);
      if (saved && LANGS.includes(saved)) setLocale(saved);
      setStage(consent === "1" ? "ready" : "consent");
    })();
  }, []);

  // Recognition events (subscribed for the whole life of the sheet).
  useEffect(() => {
    if (!speech) return undefined;
    const subs = [
      speech.addListener("result", (e) => {
        const tr = e.results?.[0]?.transcript || "";
        if (e.isFinal) finalText.current = `${finalText.current} ${tr}`.trim();
        setHeard(e.isFinal ? finalText.current : `${finalText.current} ${tr}`.trim());
      }),
      speech.addListener("error", (e) => {
        if (e.error !== "aborted") setError(e.error || "generic");
      }),
      speech.addListener("volumechange", (e) => setVolume(Math.max(0, e.value || 0))),
      speech.addListener("end", () => {
        const said = finalText.current.trim();
        setHeard(said);
        if (said) {
          setText(said);
          setStage("review");
        } else {
          setStage((s) => (s === "listening" ? "ready" : s));
        }
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      try { speech.abort(); } catch { /* not listening */ }
    };
  }, []);

  // 30-second limit and elapsed time while listening.
  useEffect(() => {
    if (stage !== "listening") return undefined;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setElapsed(s);
      if (s >= MAX_S) try { speech.stop(); } catch { /* already stopped */ }
    }, 250);
    return () => clearInterval(id);
  }, [stage]);

  const start = async () => {
    setError(null);
    if (!available()) { setError("unavailable"); return; }
    const perm = await speech.requestPermissionsAsync();
    if (!perm.granted) { setError("not-allowed"); return; }
    let local = false;
    try {
      // Prefer recognition on the phone itself (no network) when the language pack is installed.
      if (Platform.OS !== "web" && speech.supportsOnDeviceRecognition()) {
        const { installedLocales = [] } = await speech.getSupportedLocales({});
        local = installedLocales.some((l) => l.toLowerCase() === locale.toLowerCase());
      }
    } catch { local = false; }
    setOnDevice(local);
    finalText.current = "";
    setHeard("");
    setElapsed(0);
    started.current = Date.now();
    setStage("listening");
    try {
      speech.start({ lang: locale, interimResults: true, continuous: false, requiresOnDeviceRecognition: local, addsPunctuation: local,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 200 }, androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2500 } });
    } catch {
      setError("generic");
      setStage("ready");
    }
  };

  const accept = async () => {
    await prefs.set(CONSENT_KEY, "1");
    setStage("ready");
  };

  const pickLang = (l) => {
    setLocale(l);
    prefs.set(LANG_KEY, l);
  };

  const analyse = async () => {
    setStage("analysing");
    try {
      const out = await voiceService.analyse({ text: text.trim(), locale, engine: onDevice ? "on_device" : Platform.OS === "web" ? "web" : "device",
        duration_s: elapsed || null, kind: "professional" });
      setIntent(out);
      setFix({ category_key: out.category_key || "", wilaya_code: out.wilaya_code || "", commune: out.commune || "",
        when: out.urgency === "high" || out.when?.day === "today" ? "today" : "week" });
      setStage("summary");
    } catch (err) {
      toast(te(errorCode(err)), "error");
      setStage("review");
    }
  };

  const confirm = async () => {
    const body = { category_key: fix.category_key || null, wilaya_code: fix.wilaya_code ? Number(fix.wilaya_code) : null, commune: fix.commune || null,
      urgency: fix.when === "today" ? "high" : "normal", text_edited: text.trim() !== heard.trim() };
    voiceService.confirm(intent.intent_id, body).catch(() => null); // quality measurement only: never blocks the search
    const description = text.trim().length >= 10 ? text.trim() : "";
    const step = !fix.category_key ? "service" : !description ? "need" : !fix.wilaya_code ? "place" : "results";
    const next = matchDraft.set({ ...matchDraft.reset(), category_key: fix.category_key, description, when: fix.when, wilaya_code: fix.wilaya_code ? Number(fix.wilaya_code) : "",
      commune: fix.commune || "", step });
    onClose();
    if (onDone) onDone(next);
    else router.push("/match");
  };

  const keyboard = () => {
    onClose();
    if (!onDone) router.push("/match");
  };

  const errBox = error ? (
    <View style={{ backgroundColor: alpha(BRAND.orange, 0.12), borderRadius: 12, padding: 10, gap: 8 }} testID="voice-error">
      <Txt variant="small">{t(`voice.errors.${["not-allowed", "no-speech", "network", "language-not-supported", "unavailable"].includes(error) ? error : "generic"}`)}</Txt>
      {error === "not-allowed" && Platform.OS !== "web" ? <Btn small variant="outline" title={t("voice.settings")} onPress={() => Linking.openSettings()} /> : null}
    </View>
  ) : null;

  let body;
  if (stage === "loading") body = <Loading />;
  else if (stage === "consent") body = (
    <View style={{ gap: 10 }} testID="voice-consent">
      <View style={{ alignSelf: "center", width: 64, height: 64, borderRadius: 32, backgroundColor: alpha(BRAND.electric, 0.15), alignItems: "center", justifyContent: "center" }}>
        <Mic size={30} color={BRAND.electric} />
      </View>
      <Txt variant="h3" center>{t("voice.consentTitle")}</Txt>
      {["consent1", "consent2", "consent3"].map((k) => <Txt key={k} variant="small" muted>• {t(`voice.${k}`)}</Txt>)}
      <Btn variant="gradient" icon={Mic} title={t("voice.accept")} onPress={accept} testID="voice-accept" />
      <Btn variant="ghost" icon={Keyboard} title={t("voice.keyboard")} onPress={keyboard} />
    </View>
  );
  else if (stage === "ready" || stage === "listening") {
    const listening = stage === "listening";
    body = (
      <View style={{ gap: 12 }}>
        <Txt variant="label">{t("voice.lang")}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {LANGS.map((l) => <Chip key={l} label={t(`voice.langs.${l}`)} selected={locale === l} onPress={() => !listening && pickLang(l)} testID={`voice-lang-${l}`} />)}
        </ScrollView>
        {locale === "ar-DZ" ? <Txt variant="tiny" color={BRAND.orange}>{t("voice.darijaBeta")}</Txt> : null}
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 96 + (listening ? Math.min(volume, 10) * 3 : 0), height: 96 + (listening ? Math.min(volume, 10) * 3 : 0), borderRadius: 999,
            backgroundColor: alpha(listening ? BRAND.pink : BRAND.electric, 0.15), alignItems: "center", justifyContent: "center" }}>
            <IconBtn label={listening ? t("voice.stop") : t("voice.mic")} onPress={listening ? () => speech.stop() : start} testID={listening ? "voice-stop" : "voice-start"}
              style={{ width: 76, height: 76, backgroundColor: listening ? BRAND.pink : BRAND.electric }}>
              {listening ? <Square size={28} color={BRAND.night} /> : <Mic size={32} color={BRAND.night} />}
            </IconBtn>
          </View>
          <Txt weight={800}>{listening ? t("voice.listening") : t("voice.tapToTalk")}</Txt>
          <Txt variant="small" muted center>{t("voice.listeningHint")}</Txt>
          {listening ? <Txt variant="tiny" muted>{t("voice.timer", { s: elapsed })}{onDevice ? ` · ${t("voice.onDevice")}` : ""}</Txt>
            : <Txt variant="tiny" muted center>{t("voice.example")}</Txt>}
        </View>
        {heard ? <Card style={{ padding: 12 }}><Txt auto>{heard}</Txt></Card> : null}
        {errBox}
        {listening ? <Btn variant="outline" icon={X} title={t("voice.cancel")} onPress={() => { speech.abort(); setStage("ready"); }} testID="voice-cancel" />
          : <Btn variant="ghost" icon={Keyboard} title={t("voice.keyboard")} onPress={keyboard} testID="voice-keyboard" />}
      </View>
    );
  } else if (stage === "review") body = (
    <View style={{ gap: 10 }} testID="voice-review">
      <Txt variant="h3">{t("voice.review")}</Txt>
      <Txt variant="small" muted>{t("voice.reviewHint")}</Txt>
      <Input multiline value={text} onChangeText={setText} maxLength={500} style={{ minHeight: 110 }} testID="voice-text" />
      <Btn variant="gradient" title={t("voice.continue")} disabled={text.trim().length < 2} onPress={analyse} testID="voice-continue" />
      <Btn variant="outline" icon={RotateCcw} title={t("voice.again")} onPress={() => { setText(""); setStage("ready"); }} />
    </View>
  );
  else if (stage === "analysing") body = <View style={{ gap: 10, paddingVertical: 20 }}><Loading /><Txt center muted>{t("voice.analysing")}</Txt></View>;
  else body = (
    <View style={{ gap: 10 }} testID="voice-summary">
      <Txt variant="h3">{t("voice.summary")}</Txt>
      <Card style={{ padding: 12 }}><Txt variant="small" auto>« {text.trim()} »</Txt></Card>
      <Field label={t("voice.trade")} hint={!fix.category_key ? t("voice.missingTrade") : null}>
        <SelectField label={t("voice.trade")} value={fix.category_key} onChange={(v) => setFix({ ...fix, category_key: v })} testID="voice-trade"
          options={(cats.data || []).filter((x) => x.key !== "private_tutoring").map((x) => ({ value: x.key, label: loc(x) }))} />
      </Field>
      <Field label={t("voice.place")} hint={!fix.wilaya_code ? t("voice.missingPlace") : null}>
        <SelectField label={t("voice.place")} value={fix.wilaya_code} onChange={(v) => setFix({ ...fix, wilaya_code: v, commune: "" })} testID="voice-wilaya"
          options={wilayas.map((w) => ({ value: w.code, label: `${String(w.code).padStart(2, "0")} · ${loc(w)}` }))} />
      </Field>
      {fix.commune ? <Txt variant="tiny" muted>{t("voice.commune")} : {fix.commune}</Txt> : null}
      <Txt variant="label">{t("aimatch.whenTitle")}</Txt>
      <Row gap={8} wrap>{["today", "week", "flexible"].map((w) => <Chip key={w} label={t(`aimatch.when.${w}`)} selected={fix.when === w} color={BRAND.pink} onPress={() => setFix({ ...fix, when: w })} />)}</Row>
      <Btn variant="gradient" title={t("voice.confirm")} onPress={confirm} testID="voice-confirm" />
      <Btn variant="ghost" title={t("voice.editText")} onPress={() => setStage("review")} />
      <Txt variant="tiny" muted>{t("voice.validateNote")}</Txt>
    </View>
  );

  return (
    <Sheet visible onClose={() => { try { speech?.abort(); } catch { /* idle */ } onClose(); }} title={t("voice.title")} full>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }} style={{ backgroundColor: c.card }}>{body}</ScrollView>
    </Sheet>
  );
}
