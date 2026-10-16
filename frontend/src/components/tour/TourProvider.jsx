import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useI18n } from "@/i18n";
import { ui } from "@/lib/ui";
import { TOURS, tourFor } from "./tours";

const DONE_KEY = "gofix_tours_done";
const TourCtx = createContext(null);
const PAD = 8;
const GAP = 14;

const readDone = () => {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    return raw === "all" ? "all" : JSON.parse(raw || "[]");
  } catch {
    return [];
  }
};
const isDone = (id) => { const d = readDone(); return d === "all" || d.includes(id); };
const markDone = (id) => {
  const d = readDone();
  if (d === "all" || d.includes(id)) return;
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...d, id])); } catch { /* private mode */ }
};

/** First visible element among the candidates (phone and desktop layouts differ). */
function findTarget(candidates = []) {
  for (const c of candidates) {
    const sel = c.startsWith("[") ? c : `[data-testid="${c}"]`;
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}

function Overlay({ tour, index, onNext, onPrev, onClose }) {
  const { t, lang } = useI18n();
  const step = tour.steps[index];
  const [rect, setRect] = useState(null);
  const [box, setBox] = useState({ top: 0, left: 0, below: true });
  const card = useRef(null);
  const nextBtn = useRef(null);

  const measure = useCallback(() => {
    const el = step.target ? findTarget(step.target) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    const el = step.target ? findTarget(step.target) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    measure();
    const timer = setTimeout(measure, 380); // after the smooth scroll
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { clearTimeout(timer); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [measure, step]);

  // Dialog placement: below the target if there is room, else above; always inside the screen (16 px gutters).
  useLayoutEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = card.current ? card.current.offsetHeight : 180;
    const w = Math.min(360, vw - 32);
    if (!rect) return setBox({ top: Math.max(16, (vh - h) / 2), left: (vw - w) / 2, width: w, center: true });
    const below = rect.bottom + GAP + h < vh - 8 || rect.top - GAP - h < 8;
    const top = below ? Math.min(rect.bottom + PAD + GAP, vh - h - 8) : Math.max(8, rect.top - PAD - GAP - h);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - w / 2), vw - w - 16);
    const arrow = Math.min(Math.max(20, rect.left + rect.width / 2 - left), w - 20);
    return setBox({ top, left, width: w, below, arrow });
  }, [rect, index]);

  useEffect(() => { nextBtn.current?.focus(); }, [index]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      const fwd = lang === "ar" ? "ArrowLeft" : "ArrowRight";
      const back = lang === "ar" ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd) onNext();
      if (e.key === back && index > 0) onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, lang, onClose, onNext, onPrev]);

  const base = `tour.${tour.id}.steps.${step.key}`;
  const last = index === tour.steps.length - 1;
  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="tour-title" data-testid="tour-overlay">
      {rect ? (
        <div className="pointer-events-none fixed rounded-2xl ring-2 ring-brand-electric transition-all duration-300 ease-out"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 9999px rgba(5,7,15,0.72)" }} />
      ) : <div className="fixed inset-0 bg-[rgba(5,7,15,0.72)] transition-opacity" />}
      <div ref={card} className="fixed gf-card p-4 shadow-2xl transition-all duration-300 ease-out" data-testid="tour-card"
        style={{ top: box.top, left: box.left, width: box.width }}>
        {!box.center && rect && (
          <span aria-hidden="true" className="absolute h-3 w-3 rotate-45 bg-card border-border"
            style={{ left: box.arrow - 6, ...(box.below ? { top: -7, borderTopWidth: 1, borderLeftWidth: 1 } : { bottom: -7, borderBottomWidth: 1, borderRightWidth: 1 }) }} />
        )}
        <div className="flex items-start justify-between gap-3">
          <h2 id="tour-title" className="text-base font-extrabold">{t(`${base}.title`)}</h2>
          <button type="button" onClick={onClose} className="-m-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label={t("tour.skip")} data-testid="tour-close"><X size={18} /></button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t(`${base}.text`)}</p>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {tour.steps.map((s, i) => <span key={s.key} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand-electric" : "w-1.5 bg-border"}`} />)}
          <span className="ms-auto text-xs text-muted-foreground" dir="ltr">{index + 1} / {tour.steps.length}</span>
        </div>
        <div className="mt-3 flex gap-2">
          {index > 0 && <button type="button" onClick={onPrev} className={`${ui.btnOutline} min-h-[40px] flex-1`} data-testid="tour-prev">{t("tour.prev")}</button>}
          <button ref={nextBtn} type="button" onClick={onNext} className={`${ui.btnPrimary} min-h-[40px] flex-1`} data-testid="tour-next">{last ? t("tour.done") : t("tour.next")}</button>
        </div>
      </div>
    </div>
  );
}

/** Guided tours: auto-start once per screen (first visit), replayable from "Visites guidées". */
export function TourProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState(null); // { tour, steps, index }
  const pending = useRef(null);

  const launch = useCallback((tour) => {
    const steps = tour.steps.filter((s) => !s.target || findTarget(s.target));
    if (steps.length) setActive({ tour: { ...tour, steps }, index: 0 });
  }, []);

  // Waits for the screen's elements (data loading) before starting.
  const launchWhenReady = useCallback((tour) => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const ready = tour.steps.filter((s) => s.target && findTarget(s.target)).length;
      if (ready >= Math.min(2, tour.steps.filter((s) => s.target).length) || tries > 25) {
        clearInterval(timer);
        launch(tour);
      }
    }, 300);
    return () => clearInterval(timer);
  }, [launch]);

  useEffect(() => {
    if (user === null) return undefined; // auth still loading
    if (pending.current && pending.current.path.test(location.pathname)) {
      const tour = pending.current;
      pending.current = null;
      return launchWhenReady(tour);
    }
    if (active) return undefined;
    const tour = tourFor(location.pathname, { user });
    if (!tour || isDone(tour.id)) return undefined;
    let cancel = () => {};
    const delay = setTimeout(() => { cancel = launchWhenReady(tour); }, 1200);
    return () => { clearTimeout(delay); cancel(); };
  }, [location.pathname, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    if (active) markDone(active.tour.id);
    setActive(null);
  }, [active]);

  const start = useCallback((id) => {
    const tour = TOURS.find((x) => x.id === id);
    if (!tour) return;
    setActive(null);
    if (tour.path.test(location.pathname)) launchWhenReady(tour);
    else if (tour.route) { pending.current = tour; navigate(tour.route); }
  }, [location.pathname, navigate, launchWhenReady]);

  const next = useCallback(() => setActive((a) => {
    if (!a) return a;
    if (a.index >= a.tour.steps.length - 1) { markDone(a.tour.id); return null; }
    return { ...a, index: a.index + 1 };
  }), []);
  const prev = useCallback(() => setActive((a) => (a && a.index > 0 ? { ...a, index: a.index - 1 } : a)), []);

  return (
    <TourCtx.Provider value={{ start, active: Boolean(active) }}>
      {children}
      {active && <Overlay tour={active.tour} index={active.index} onNext={next} onPrev={prev} onClose={close} />}
    </TourCtx.Provider>
  );
}

export const useTour = () => useContext(TourCtx);
