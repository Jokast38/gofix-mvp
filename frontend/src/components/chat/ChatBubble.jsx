import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Loader2, MessageCircleQuestion, Send, UserRound, X } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useConfig } from "@/hooks/usePublic";
import { useI18n } from "@/i18n";
import { errorCode, isValidDzPhone } from "@/lib/format";
import { ui } from "@/lib/ui";
import { chatbotService } from "@/services/marketplaceService";

function Bubble({ from, children }) {
  return (
    <li className={`flex ${from === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line ${from === "user" ? "gf-gradient-bg rounded-ee-sm" : "bg-secondary rounded-es-sm"}`}>{children}</div>
    </li>
  );
}

function Handoff({ question, onDone }) {
  const { t, te } = useI18n();
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.full_name || "", contact: user?.phone || user?.email || "", message: question || "" });
  const [err, setErr] = useState("");
  const send = async (e) => {
    e.preventDefault();
    const contact = f.contact.trim();
    const isPhone = isValidDzPhone(contact);
    if (!user && !isPhone && !contact.includes("@")) return setErr(t("chatbot.contactInvalid"));
    try {
      await chatbotService.handoff({ name: f.name.trim(), message: f.message.trim(), ...(contact ? (isPhone ? { phone: contact } : { email: contact }) : {}) });
      onDone();
    } catch (ex) {
      setErr(te(errorCode(ex)));
    }
  };
  return (
    <form onSubmit={send} className="space-y-2 rounded-xl border border-border p-3" data-testid="chatbot-handoff-form">
      <p className="text-xs font-bold">{t("chatbot.handoffTitle")}</p>
      <input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("contact.name")} aria-label={t("contact.name")} className={`${ui.input} min-h-[40px] text-sm`} />
      <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder={t("chatbot.contactPh")} aria-label={t("chatbot.contactPh")} className={`${ui.input} min-h-[40px] text-sm`} dir="ltr" />
      <textarea required minLength={3} rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} aria-label={t("contact.message")} className={`${ui.input} py-2 text-sm`} />
      {err && <p className="text-xs text-destructive" role="alert">{err}</p>}
      <button type="submit" className={`${ui.btnPrimary} w-full min-h-[40px] text-sm`} data-testid="chatbot-handoff-send">{t("chatbot.handoffSend")}</button>
    </form>
  );
}

export function ChatBubble() {
  const { t, lang } = useI18n();
  const { flag } = useConfig();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [handoff, setHandoff] = useState(null);
  const end = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, handoff, open]);
  // Hidden inside a conversation: the composer owns the bottom of the screen.
  if (!flag("chatbot") || pathname.startsWith("/messages/")) return null;

  const ask = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setBusy(true);
    try {
      const r = await chatbotService.ask(q, lang);
      setMsgs((m) => [...m, { from: "bot", text: r.answered ? r.answer : t("chatbot.noAnswer"), suggestions: r.suggestions, handoff: !r.answered, question: q }]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: t("errors.network"), handoff: true, question: q }]);
    } finally {
      setBusy(false);
    }
  };
  const openEntry = async (s) => {
    setMsgs((m) => [...m, { from: "user", text: s.question }]);
    try {
      const e = await chatbotService.entry(s.id, lang);
      setMsgs((m) => [...m, { from: "bot", text: e.answer }]);
    } catch { /* ignore */ }
  };

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={t("chatbot.open")} data-testid="chatbot-open"
          className="fixed z-40 bottom-[84px] md:bottom-6 end-4 grid place-items-center h-14 w-14 rounded-full gf-gradient-bg shadow-[0_0_24px_rgba(255,61,190,0.45)] hover:brightness-110">
          <MessageCircleQuestion size={26} strokeWidth={1.8} />
        </button>
      )}
      {open && (
        <section role="dialog" aria-label={t("chatbot.title")} data-testid="chatbot-panel"
          className="fixed z-50 inset-x-2 bottom-2 md:inset-x-auto md:end-6 md:bottom-6 md:w-[380px] max-h-[80vh] flex flex-col gf-card shadow-2xl">
          <header className="flex items-center gap-2 p-3 border-b border-border">
            <span className="grid place-items-center h-9 w-9 rounded-full gf-gradient-bg"><Bot size={18} /></span>
            <div className="flex-1 min-w-0"><p className="font-extrabold text-sm">{t("chatbot.title")}</p><p className="text-[11px] text-muted-foreground">{t("chatbot.status")}</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className={ui.btnGhost} data-testid="chatbot-close"><X size={18} /></button>
          </header>
          <ol className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]" aria-live="polite" data-testid="chatbot-messages">
            <Bubble from="bot">{t("chatbot.hello")}</Bubble>
            {msgs.map((m, i) => (
              <li key={i} className="space-y-1.5">
                <ol><Bubble from={m.from}>{m.text}</Bubble></ol>
                {m.suggestions?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ps-1">
                    <span className="w-full text-[11px] text-muted-foreground">{t("chatbot.suggestions")}</span>
                    {m.suggestions.map((s) => <button key={s.id} type="button" onClick={() => openEntry(s)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-start hover:bg-secondary" data-testid="chatbot-suggestion">{s.question}</button>)}
                  </div>
                )}
                {m.handoff && handoff === null && (
                  <button type="button" onClick={() => setHandoff(m.question)} className="ms-1 inline-flex items-center gap-1 rounded-full border border-brand-pink/60 px-3 min-h-[36px] text-xs font-bold text-brand-pink" data-testid="chatbot-handoff">
                    <UserRound size={14} />{t("chatbot.handoff")}
                  </button>
                )}
              </li>
            ))}
            {handoff !== null && handoff !== true && <li><Handoff question={handoff} onDone={() => setHandoff(true)} /></li>}
            {handoff === true && <Bubble from="bot">{t("chatbot.handoffDone")}</Bubble>}
            {busy && <li className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 size={12} className="animate-spin" />{t("chatbot.typing")}</li>}
            <li ref={end} aria-hidden="true" />
          </ol>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 p-3 border-t border-border">
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder={t("chatbot.placeholder")} aria-label={t("chatbot.placeholder")}
              className={`${ui.input} min-h-[44px] text-sm`} data-testid="chatbot-input" />
            <button type="submit" disabled={!input.trim() || busy} aria-label={t("messages.send")} className={`${ui.btnGradient} px-3.5`} data-testid="chatbot-send"><Send size={18} /></button>
          </form>
          <p className="px-3 pb-2 text-[10px] text-muted-foreground">{t("chatbot.disclaimer")}</p>
        </section>
      )}
    </>
  );
}
