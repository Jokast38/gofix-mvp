// Guided tours in the app: a spotlight moves from element to element with an explanation card that slides along.
// Screens wrap their key elements in <TourTarget id="…"> and call useScreenTour("appSearch") ; each tour starts once
// automatically (first visit of the screen) and can be replayed from Account → "Visites guidées".
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { prefs } from "@/api/storage";
import { isProvider, useAuth } from "@/hooks/auth";
import { useI18n } from "@/i18n";
import { BRAND, useTheme } from "@/theme";
import { Btn, Row, Txt } from "@/ui";

const DONE_KEY = "gofix_tours_done";
const PAD = 6;
const TAB_BAR = 64;

export const APP_TOURS = [
  { id: "appWelcome", route: "/", steps: [
    { key: "intro" }, { key: "language", target: "home-flags" }, { key: "search", target: "home-search" }, { key: "tiles", target: "home-tiles" },
    { key: "tabbar", target: "@tabbar" }, { key: "publish", target: "tab-center" }, { key: "end" },
  ] },
  { id: "appSearch", route: "/search", steps: [
    { key: "input", target: "catalog-search" }, { key: "nearMe", target: "near-me" }, { key: "filters", target: "catalog-filters" },
  ] },
  { id: "appAccount", route: "/account", when: (u) => Boolean(u), steps: [
    { key: "profile", target: "account-card" }, { key: "links", target: "account-links" }, { key: "tours", target: "account-tours" },
  ] },
  { id: "appDashboard", route: "/dashboard", when: (u) => isProvider(u), steps: [
    { key: "tabs", target: "dash-tabs" }, { key: "content", target: "dash-content" },
  ] },
];

const TourCtx = createContext(null);

async function doneList() {
  const raw = await prefs.get(DONE_KEY);
  if (raw === "all") return "all";
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

export function TourProvider({ children }) {
  const { user } = useAuth();
  const refs = useRef(new Map());
  const pending = useRef(null);
  const [active, setActive] = useState(null); // { tour, index }
  const activeRef = useRef(null);
  const doneMem = useRef(new Set()); // immediate, so a screen re-focus never restarts a tour that just ended
  useEffect(() => { activeRef.current = active; }, [active]);

  const register = useCallback((id, ref) => { refs.current.set(id, ref); return () => { if (refs.current.get(id) === ref) refs.current.delete(id); }; }, []);
  const markDone = useCallback(async (id) => {
    doneMem.current.add(id);
    const d = await doneList();
    if (d !== "all" && !d.includes(id)) await prefs.set(DONE_KEY, JSON.stringify([...d, id]));
  }, []);

  const launch = useCallback((tour) => {
    // Keep the steps whose target is mounted (or special/centred ones).
    if (activeRef.current) return;
    const steps = tour.steps.filter((s) => !s.target || s.target.startsWith("@") || refs.current.get(s.target)?.current);
    if (steps.length) setActive({ tour: { ...tour, steps }, index: 0 });
  }, []);

  const screenFocused = useCallback(async (id) => {
    const tour = APP_TOURS.find((x) => x.id === id);
    if (!tour || activeRef.current) return undefined;
    const forced = pending.current === id;
    if (!forced) {
      if (user === null || (tour.when && !tour.when(user)) || doneMem.current.has(id)) return undefined;
      const d = await doneList();
      if (d === "all" || d.includes(id)) return undefined;
    }
    pending.current = null;
    // Let the screen lay out and load its data: wait until the targets are mounted (max ~6 s).
    let tries = 0;
    const targets = tour.steps.filter((s) => s.target && !s.target.startsWith("@"));
    const timer = setInterval(() => {
      tries += 1;
      if (targets.every((s) => refs.current.get(s.target)?.current) || tries > 15) {
        clearInterval(timer);
        launch(tour);
      }
    }, 400);
    return () => clearInterval(timer);
  }, [launch, user]);

  const start = useCallback((id) => {
    const tour = APP_TOURS.find((x) => x.id === id);
    if (!tour) return;
    pending.current = id;
    router.navigate(tour.route);
    setTimeout(() => { if (pending.current === id) { pending.current = null; launch(tour); } }, 1400); // already on that screen
  }, [launch]);

  const close = useCallback(() => { if (active) markDone(active.tour.id); setActive(null); }, [active, markDone]);
  const next = useCallback(() => {
    if (!active) return;
    if (active.index >= active.tour.steps.length - 1) { close(); return; }
    setActive({ ...active, index: active.index + 1 });
  }, [active, close]);
  const prev = useCallback(() => active && active.index > 0 && setActive({ ...active, index: active.index - 1 }), [active]);

  const value = useMemo(() => ({ register, screenFocused, start }), [register, screenFocused, start]);
  return (
    <TourCtx.Provider value={value}>
      {children}
      {active && <TourOverlay tour={active.tour} index={active.index} refs={refs} onNext={next} onPrev={prev} onClose={close} />}
    </TourCtx.Provider>
  );
}

export const useTour = () => useContext(TourCtx);

/** Wrap an element so a tour step can point at it. */
export function TourTarget({ id, children, style }) {
  const ctx = useContext(TourCtx);
  const ref = useRef(null);
  useEffect(() => (ctx ? ctx.register(id, ref) : undefined), [ctx, id]);
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}

/** Start this screen's tour on its first visit (or when replayed from the Account screen). */
export function useScreenTour(id) {
  const ctx = useContext(TourCtx);
  useFocusEffect(useCallback(() => {
    let cleanup;
    ctx?.screenFocused(id).then((c) => { cleanup = c; });
    return () => cleanup?.();
  }, [ctx, id]));
}

function TourOverlay({ tour, index, refs, onNext, onPrev, onClose }) {
  const { t } = useI18n();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = Dimensions.get("window");
  const step = tour.steps[index];
  const anim = useRef({ x: new Animated.Value(W / 2), y: new Animated.Value(H / 2), w: new Animated.Value(0), h: new Animated.Value(0), top: new Animated.Value(H / 2) }).current;
  const [rect, setRect] = useState(null);
  const [cardH, setCardH] = useState(190);

  useEffect(() => {
    let alive = true;
    const apply = (r) => {
      if (!alive) return;
      setRect(r);
      const target = r ? { x: r.x - PAD, y: r.y - PAD, w: r.w + PAD * 2, h: r.h + PAD * 2 } : { x: W / 2, y: H / 2, w: 0, h: 0 };
      const below = r && r.y + r.h + PAD + 14 + cardH < H - insets.bottom - 8;
      const top = !r ? (H - cardH) / 2 : below ? r.y + r.h + PAD + 14 : Math.max(insets.top + 8, r.y - PAD - 14 - cardH);
      const cfg = { duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false };
      Animated.parallel([
        Animated.timing(anim.x, { ...cfg, toValue: target.x }), Animated.timing(anim.y, { ...cfg, toValue: target.y }),
        Animated.timing(anim.w, { ...cfg, toValue: target.w }), Animated.timing(anim.h, { ...cfg, toValue: target.h }),
        Animated.timing(anim.top, { ...cfg, toValue: top }),
      ]).start();
    };
    if (!step.target) apply(null);
    else if (step.target === "@tabbar") apply({ x: 0, y: H - TAB_BAR - insets.bottom, w: W, h: TAB_BAR + insets.bottom });
    else {
      const node = refs.current.get(step.target)?.current;
      if (!node) apply(null);
      else node.measureInWindow((x, y, w, h) => apply(w ? { x, y, w, h } : null));
    }
    return () => { alive = false; };
  }, [step, cardH, W, H, insets, anim, refs]);

  const dim = "rgba(5,7,15,0.72)";
  const right = Animated.add(anim.x, anim.w);
  const bottom = Animated.add(anim.y, anim.h);
  const base = `tour.${tour.id}.steps.${step.key}`;
  const last = index === tour.steps.length - 1;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }} testID="tour-overlay">
        {/* Four dimmed panels around the moving spotlight */}
        <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, height: anim.y, backgroundColor: dim }} />
        <Animated.View style={{ position: "absolute", left: 0, right: 0, top: bottom, bottom: 0, backgroundColor: dim }} />
        <Animated.View style={{ position: "absolute", left: 0, width: anim.x, top: anim.y, height: anim.h, backgroundColor: dim }} />
        <Animated.View style={{ position: "absolute", left: right, right: 0, top: anim.y, height: anim.h, backgroundColor: dim }} />
        {rect && <Animated.View pointerEvents="none" style={{ position: "absolute", left: anim.x, top: anim.y, width: anim.w, height: anim.h, borderRadius: 14, borderWidth: 2, borderColor: BRAND.electric }} />}
        <Animated.View onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))} accessibilityViewIsModal
          style={{ position: "absolute", left: 16, right: 16, top: anim.top, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16,
            shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, elevation: 12 }} testID="tour-card">
          <Row gap={8} style={{ alignItems: "flex-start" }}>
            <Txt variant="h3" style={{ flex: 1 }}>{t(`${base}.title`)}</Txt>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("tour.skip")} hitSlop={10} testID="tour-close"
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", marginTop: -6, marginEnd: -6 }}>
              <X size={18} color={c.muted} />
            </Pressable>
          </Row>
          <Txt variant="small" muted style={{ marginTop: 4 }}>{t(`${base}.text`)}</Txt>
          <Row gap={5} style={{ marginTop: 12, alignItems: "center" }}>
            {tour.steps.map((s, i) => <View key={s.key} style={{ height: 6, width: i === index ? 18 : 6, borderRadius: 3, backgroundColor: i === index ? BRAND.electric : c.border }} />)}
            <View style={{ flex: 1 }} />
            <Txt variant="tiny" muted>{`⁦${index + 1} / ${tour.steps.length}⁩`}</Txt>
          </Row>
          <Row gap={8} style={{ marginTop: 12 }}>
            {index > 0 && <Btn small variant="outline" title={t("tour.prev")} onPress={onPrev} style={{ flex: 1 }} testID="tour-prev" />}
            <Btn small title={last ? t("tour.done") : t("tour.next")} onPress={onNext} style={{ flex: 1 }} testID="tour-next" />
          </Row>
        </Animated.View>
      </View>
    </Modal>
  );
}
