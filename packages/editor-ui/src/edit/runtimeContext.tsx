import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type EditorRuntimeMode = "edit" | "playback";
export type EditorTimeRate = 0.25 | 0.5 | 1 | 2;

export type EditorRuntimeState = {
  seed: number;
  timeSec: number;
  docstep: number;
  mode: EditorRuntimeMode;
  timeRate: EditorTimeRate;
  autoDocstep: boolean;
  reducedMotion: boolean;
  isPlaying: boolean;
};

export type EditorRuntimeActions = {
  setSeed: (seed: number) => void;
  setTimeSec: (timeSec: number) => void;
  setDocstep: (docstep: number) => void;
  setMode: (mode: EditorRuntimeMode) => void;
  setTimeRate: (rate: EditorTimeRate) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setAutoDocstep: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  resetTimeAnchor: () => void;
};

export type EditorRuntimeStore = {
  state: EditorRuntimeState;
  actions: EditorRuntimeActions;
};

const EditorRuntimeContext = createContext<EditorRuntimeStore | null>(null);

export function useEditorRuntime(): EditorRuntimeStore {
  const ctx = useContext(EditorRuntimeContext);
  if (!ctx) {
    throw new Error("useEditorRuntime must be used within EditorRuntimeProvider");
  }
  return ctx;
}

export function EditorRuntimeProvider({ value, children }: { value: EditorRuntimeStore; children: ReactNode }) {
  return <EditorRuntimeContext.Provider value={value}>{children}</EditorRuntimeContext.Provider>;
}

export function useEditorRuntimeState(initial: { seed: number; timeSec: number; docstep: number }): EditorRuntimeStore {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState<EditorRuntimeState>(() => ({
    seed: initial.seed,
    timeSec: initial.timeSec,
    docstep: initial.docstep,
    mode: "edit",
    timeRate: 1,
    autoDocstep: false,
    reducedMotion: prefersReducedMotion,
    isPlaying: false,
  }));

  const timeRef = useRef(state.timeSec);
  const rateRef = useRef(state.timeRate);
  const autoDocstepRef = useRef(state.autoDocstep);
  const playingRef = useRef(state.isPlaying);
  const modeRef = useRef(state.mode);
  const anchorRef = useRef({ baseTimeSec: state.timeSec, startNow: 0 });

  useEffect(() => {
    timeRef.current = state.timeSec;
  }, [state.timeSec]);

  useEffect(() => {
    rateRef.current = state.timeRate;
  }, [state.timeRate]);

  useEffect(() => {
    autoDocstepRef.current = state.autoDocstep;
  }, [state.autoDocstep]);

  useEffect(() => {
    playingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  useEffect(() => {
    modeRef.current = state.mode;
  }, [state.mode]);

  useEffect(() => {
    setState((prev) => ({ ...prev, reducedMotion: prefersReducedMotion }));
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (playingRef.current) return;
    setState((prev) => {
      if (prev.seed === initial.seed && prev.timeSec === initial.timeSec && prev.docstep === initial.docstep) return prev;
      return {
        ...prev,
        seed: initial.seed,
        timeSec: initial.timeSec,
        docstep: initial.docstep,
      };
    });
    timeRef.current = initial.timeSec;
  }, [initial.docstep, initial.seed, initial.timeSec]);

  const resetTimeAnchor = useCallback(() => {
    anchorRef.current = { baseTimeSec: timeRef.current, startNow: performance.now() };
  }, []);

  const setSeed = useCallback((seed: number) => {
    setState((prev) => ({ ...prev, seed }));
  }, []);

  const setTimeSec = useCallback((timeSec: number) => {
    const next = Number.isFinite(timeSec) ? timeSec : 0;
    timeRef.current = next;
    if (modeRef.current === "playback" && playingRef.current) {
      anchorRef.current = { baseTimeSec: next, startNow: performance.now() };
    }
    setState((prev) => ({
      ...prev,
      timeSec: next,
      docstep: prev.autoDocstep ? Math.floor(next) : prev.docstep,
    }));
  }, []);

  const setDocstep = useCallback((docstep: number) => {
    const next = Number.isFinite(docstep) ? Math.floor(docstep) : 0;
    setState((prev) => ({ ...prev, docstep: next }));
  }, []);

  const setMode = useCallback((mode: EditorRuntimeMode) => {
    setState((prev) => {
      if (prev.mode === mode) return prev;
      return {
        ...prev,
        mode,
        isPlaying: mode === "playback" ? true : false,
      };
    });
  }, []);

  const setTimeRate = useCallback((rate: EditorTimeRate) => {
    setState((prev) => ({ ...prev, timeRate: rate }));
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    setState((prev) => ({ ...prev, isPlaying: playing }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const setAutoDocstep = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      autoDocstep: enabled,
      docstep: enabled ? Math.floor(prev.timeSec) : prev.docstep,
    }));
  }, []);

  const setReducedMotion = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, reducedMotion: enabled }));
  }, []);

  useEffect(() => {
    if (state.mode !== "playback" || !state.isPlaying) return;
    resetTimeAnchor();
    let rafId = 0;

    const tick = () => {
      const { baseTimeSec, startNow } = anchorRef.current;
      const nextTime = baseTimeSec + ((performance.now() - startNow) * rateRef.current) / 1000;
      timeRef.current = nextTime;
      setState((prev) => ({
        ...prev,
        timeSec: nextTime,
        docstep: autoDocstepRef.current ? Math.floor(nextTime) : prev.docstep,
      }));
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [resetTimeAnchor, state.isPlaying, state.mode]);

  const store = useMemo<EditorRuntimeStore>(
    () => ({
      state,
      actions: {
        setSeed,
        setTimeSec,
        setDocstep,
        setMode,
        setTimeRate,
        togglePlay,
        setPlaying,
        setAutoDocstep,
        setReducedMotion,
        resetTimeAnchor,
      },
    }),
    [
      resetTimeAnchor,
      setAutoDocstep,
      setDocstep,
      setMode,
      setPlaying,
      setReducedMotion,
      setSeed,
      setTimeRate,
      setTimeSec,
      state,
      togglePlay,
    ],
  );

  return store;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return reduced;
}
