import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { onboardingService } from "@/services/marketplaceService";

const LOCAL = (kind) => `gofix_draft_${kind}`;

// Auto-saved draft: localStorage immediately, server debounced (1.2 s). Server copy wins when newer.
export function useDraft(kind) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({});
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const timer = useRef(null);
  const dirty = useRef(false);

  const remote = useQuery({ queryKey: ["draft", kind], queryFn: () => onboardingService.draft(kind), staleTime: 0 });

  useEffect(() => {
    if (!remote.data) return;
    const local = JSON.parse(localStorage.getItem(LOCAL(kind)) || "null");
    const useLocal = local && (!remote.data.updated_at || new Date(local.updated_at) > new Date(remote.data.updated_at));
    const src = useLocal ? local : remote.data;
    setStep(src.step || 1);
    setData(src.data || {});
    setReady(true);
  }, [remote.data, kind]);

  const persist = useCallback((s, d) => {
    const now = new Date().toISOString();
    localStorage.setItem(LOCAL(kind), JSON.stringify({ step: s, data: d, updated_at: now }));
    dirty.current = true;
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await onboardingService.saveDraft(kind, s, d);
        dirty.current = false;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1200);
  }, [kind]);

  const update = useCallback((patch) => {
    setData((d) => {
      const next = { ...d, ...(typeof patch === "function" ? patch(d) : patch) };
      persist(step, next);
      return next;
    });
  }, [persist, step]);

  const goTo = useCallback((s) => {
    setStep(s);
    setData((d) => { persist(s, d); return d; });
  }, [persist]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    await onboardingService.saveDraft(kind, step, data);
    dirty.current = false;
    setSaveState("saved");
  }, [kind, step, data]);

  const clear = useCallback(() => localStorage.removeItem(LOCAL(kind)), [kind]);

  return { step, data, ready, saveState, update, goTo, flush, clear, error: remote.error };
}
