import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Keyboard, Loader2, Mic, RotateCcw, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useConfig, useWilayas } from "@/hooks/usePublic";
import { useI18n, useLocalized } from "@/i18n";
import { errorCode } from "@/lib/format";
import { ui } from "@/lib/ui";
import { marketplaceService, voiceService } from "@/services/marketplaceService";

// GOFIX VOICE on the web: the browser's own speech recognition (Chrome, Edge, Safari). GoFix only receives the text.
const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const MAX_S = 30;
const LANGS = ["fr-FR", "ar-DZ", "ar-SA", "en-US"];
const DEFAULT_LANG = { fr: "fr-FR", ar: "ar-DZ", en: "en-US" };
const MATCH_KEY = "gofix_match_draft";
const EMPTY = { category_key: "", description: "", when: "week", wilaya_code: "", commune: "", radius_km: 10, gps: null, selected: [], names: {} };
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** Microphone button for the search bar. */
export function VoiceMicButton({ className = "" }) {
  const { t } = useI18n();
  const { flag } = useConfig();
  const [open, setOpen] = useState(false);
  if (!flag("voice")) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("voice.mic")} data-testid="search-voice"
        className={`grid place-items-center h-10 w-10 rounded-full text-muted-foreground hover:bg-secondary ${className}`}>
        <Mic size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && <VoiceDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** Dictation: consent -> listening (30 s max) -> editable text -> summary to check -> AI MATCH. onDone(draft) when used inside /match. */
export function VoiceDialog({ onClose, onDone }) {
  const { t, te, lang: uiLang } = useI18n();
  const loc = useLocalized();
  const nav = useNavigate();
  const [stage, setStage] = useState(store.get("gofix_voice_consent") === "1" ? "ready" : "consent");
  const [locale, setLocale] = useState(() => (LANGS.includes(store.get("gofix_voice_lang")) ? store.get("gofix_voice_lang") : DEFAULT_LANG[uiLang] || "fr-FR"));
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState(Recognition ? null : "unsupported");
  const [elapsed, setElapsed] = useState(0);
  const [intent, setIntent] = useState(null);
  const [fix, setFix] = useState({});
  const rec = useRef(null);
  const finalText = useRef("");
  const started = useRef(0);
  const cats = useQuery({ queryKey: ["cats-all"], queryFn: () => marketplaceService.categories(), staleTime: 300_000 });
  const { data: wilayas = [] } = useWilayas();

  useEffect(() => () => rec.current?.abort(), []);
  useEffect(() => {
    if (stage !== "listening") return undefined;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setElapsed(s);
      if (s >= MAX_S) rec.current?.stop();
    }, 250);
    return () => clearInterval(id);
  }, [stage]);

  const start = () => {
    if (!Recognition) return setError("unsupported");
    setError(null);
    finalText.current = "";
    setHeard("");
    setElapsed(0);
    const r = new Recognition();
    r.lang = locale;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) finalText.current = `${finalText.current} ${e.results[i][0].transcript}`.trim();
        else interim += e.results[i][0].transcript;
      }
      setHeard(`${finalText.current} ${interim}`.trim());
    };
    r.onerror = (e) => e.error !== "aborted" && setError(e.error === "service-not-allowed" ? "not-allowed" : e.error);
    r.onend = () => {
      const said = finalText.current.trim();
      if (said) { setText(said); setHeard(said); setStage("review"); } else setStage((s) => (s === "listening" ? "ready" : s));
    };
    rec.current = r;
    started.current = Date.now();
    setStage("listening");
    try { r.start(); } catch { setError("generic"); setStage("ready"); }
    return undefined;
  };

  const analyse = async () => {
    setStage("analysing");
    try {
      const out = await voiceService.analyse({ text: text.trim(), locale, engine: "web", duration_s: elapsed || null, kind: "professional" });
      setIntent(out);
      setFix({ category_key: out.category_key || "", wilaya_code: out.wilaya_code || "", commune: out.commune || "",
        when: out.urgency === "high" || out.when?.day === "today" ? "today" : "week" });
      setStage("summary");
    } catch (err) {
      toast.error(te(errorCode(err)));
      setStage("review");
    }
  };

  const confirm = () => {
    voiceService.confirm(intent.intent_id, { category_key: fix.category_key || null, wilaya_code: fix.wilaya_code ? Number(fix.wilaya_code) : null,
      commune: fix.commune || null, urgency: fix.when === "today" ? "high" : "normal", text_edited: text.trim() !== heard.trim() }).catch(() => null);
    const description = text.trim().length >= 10 ? text.trim() : "";
    const step = !fix.category_key ? "service" : !description ? "need" : !fix.wilaya_code ? "place" : "results";
    const draft = { ...EMPTY, category_key: fix.category_key, description, when: fix.when, wilaya_code: fix.wilaya_code ? Number(fix.wilaya_code) : "", commune: fix.commune || "" };
    onClose();
    if (onDone) return onDone(draft, step);
    try { sessionStorage.setItem(MATCH_KEY, JSON.stringify(draft)); } catch { /* private mode */ }
    nav(`/match?step=${step}`);
    return undefined;
  };

  const keyboard = () => { onClose(); if (!onDone) nav("/match"); };
  const errKey = error && (["not-allowed", "no-speech", "network", "language-not-supported", "unsupported"].includes(error) ? error : "generic");
  const listening = stage === "listening";

  let body;
  if (stage === "consent") body = (
    <div className="space-y-3" data-testid="voice-consent">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-electric/15 text-brand-electric"><Mic size={30} aria-hidden="true" /></span>
      <ul className="space-y-2 text-sm text-muted-foreground">{["consent1", "consent2", "consent3"].map((k) => <li key={k}>• {t(`voice.${k}`)}</li>)}</ul>
      <button type="button" onClick={() => { store.set("gofix_voice_consent", "1"); setStage("ready"); }} className={`${ui.btnGradient} w-full`} data-testid="voice-accept">
        <Mic size={16} aria-hidden="true" />{t("voice.accept")}</button>
      <button type="button" onClick={keyboard} className={`${ui.btnGhost} w-full`}><Keyboard size={16} aria-hidden="true" />{t("voice.keyboard")}</button>
    </div>
  );
  else if (stage === "ready" || listening) body = (
    <div className="space-y-3">
      <p className={ui.label}>{t("voice.lang")}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {LANGS.map((l) => (
          <button key={l} type="button" disabled={listening} aria-pressed={locale === l} onClick={() => { setLocale(l); store.set("gofix_voice_lang", l); }}
            className={`shrink-0 rounded-full border px-3 min-h-[40px] text-sm font-bold ${locale === l ? "border-transparent gf-gradient-bg text-[#070911]" : "border-border"}`}>{t(`voice.langs.${l}`)}</button>
        ))}
      </div>
      {locale === "ar-DZ" && <p className="text-xs text-brand-orange">{t("voice.darijaBeta")}</p>}
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <button type="button" onClick={listening ? () => rec.current?.stop() : start} disabled={error === "unsupported"} data-testid={listening ? "voice-stop" : "voice-start"}
          aria-label={listening ? t("voice.stop") : t("voice.mic")}
          className={`grid h-20 w-20 place-items-center rounded-full text-[#070911] disabled:opacity-40 ${listening ? "bg-brand-pink animate-pulse" : "bg-brand-electric"}`}>
          {listening ? <Square size={28} aria-hidden="true" /> : <Mic size={32} aria-hidden="true" />}
        </button>
        <p className="font-extrabold">{listening ? t("voice.listening") : t("voice.tapToTalk")}</p>
        <p className="text-sm text-muted-foreground">{t("voice.listeningHint")}</p>
        <p className="text-xs text-muted-foreground" aria-live="polite">{listening ? t("voice.timer", { s: elapsed }) : t("voice.example")}</p>
      </div>
      {heard && <p className="rounded-xl bg-secondary p-3 text-sm" dir="auto">{heard}</p>}
      {errKey && <p className="rounded-xl bg-brand-orange/10 p-3 text-sm" role="alert" data-testid="voice-error">{t(errKey === "unsupported" ? "voice.unsupported" : `voice.errors.${errKey}`)}</p>}
      {listening ? <button type="button" onClick={() => { rec.current?.abort(); setStage("ready"); }} className={`${ui.btnOutline} w-full`}><X size={16} aria-hidden="true" />{t("voice.cancel")}</button>
        : <button type="button" onClick={keyboard} className={`${ui.btnGhost} w-full`} data-testid="voice-keyboard"><Keyboard size={16} aria-hidden="true" />{t("voice.keyboard")}</button>}
    </div>
  );
  else if (stage === "review") body = (
    <div className="space-y-3" data-testid="voice-review">
      <p className="text-sm text-muted-foreground">{t("voice.reviewHint")}</p>
      <textarea rows={4} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className={`${ui.input} py-3`} dir="auto" aria-label={t("voice.review")} data-testid="voice-text" />
      <button type="button" onClick={analyse} disabled={text.trim().length < 2} className={`${ui.btnGradient} w-full`} data-testid="voice-continue">{t("voice.continue")}</button>
      <button type="button" onClick={() => { setText(""); setStage("ready"); }} className={`${ui.btnOutline} w-full`}><RotateCcw size={16} aria-hidden="true" />{t("voice.again")}</button>
    </div>
  );
  else if (stage === "analysing") body = <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 size={18} className="animate-spin" aria-hidden="true" />{t("voice.analysing")}</p>;
  else body = (
    <div className="space-y-3" data-testid="voice-summary">
      <p className="rounded-xl bg-secondary p-3 text-sm" dir="auto">« {text.trim()} »</p>
      <label className="block text-sm font-semibold">{t("voice.trade")}
        <select value={fix.category_key} onChange={(e) => setFix({ ...fix, category_key: e.target.value })} className={`${ui.input} mt-1`} data-testid="voice-trade">
          <option value="">—</option>
          {(cats.data || []).filter((x) => x.key !== "private_tutoring").map((x) => <option key={x.key} value={x.key}>{loc(x)}</option>)}
        </select>
        {!fix.category_key && <span className="mt-1 block text-xs text-brand-orange">{t("voice.missingTrade")}</span>}
      </label>
      <label className="block text-sm font-semibold">{t("voice.place")}
        <select value={fix.wilaya_code} onChange={(e) => setFix({ ...fix, wilaya_code: e.target.value, commune: "" })} className={`${ui.input} mt-1`} data-testid="voice-wilaya">
          <option value="">—</option>
          {wilayas.map((w) => <option key={w.code} value={w.code}>{`${String(w.code).padStart(2, "0")} – ${loc(w)}`}</option>)}
        </select>
        {!fix.wilaya_code && <span className="mt-1 block text-xs text-brand-orange">{t("voice.missingPlace")}</span>}
      </label>
      {fix.commune && <p className="text-xs text-muted-foreground">{t("voice.commune")} : {fix.commune}</p>}
      <p className={ui.label}>{t("aimatch.whenTitle")}</p>
      <div className="flex flex-wrap gap-2">
        {["today", "week", "flexible"].map((w) => (
          <button key={w} type="button" aria-pressed={fix.when === w} onClick={() => setFix({ ...fix, when: w })}
            className={`rounded-full border px-3 min-h-[40px] text-sm font-bold ${fix.when === w ? "border-transparent bg-brand-pink/20" : "border-border"}`}>{t(`aimatch.when.${w}`)}</button>
        ))}
      </div>
      <button type="button" onClick={confirm} className={`${ui.btnGradient} w-full`} data-testid="voice-confirm">{t("voice.confirm")}</button>
      <button type="button" onClick={() => setStage("review")} className={`${ui.btnGhost} w-full`}>{t("voice.editText")}</button>
      <p className="text-xs text-muted-foreground">{t("voice.validateNote")}</p>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { rec.current?.abort(); onClose(); } }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl w-[calc(100vw-32px)] max-w-md" data-testid="voice-dialog">
        <DialogTitle className="text-lg font-extrabold">{stage === "summary" ? t("voice.summary") : stage === "review" ? t("voice.review") : t("voice.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("voice.listeningHint")}</DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}
