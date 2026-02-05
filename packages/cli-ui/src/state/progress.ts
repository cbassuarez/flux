import { useCallback, useRef, useState } from "react";

export type ProgressPhase = "typeset" | "render" | "write file";

export type ProgressState = {
  label: string;
  phase: ProgressPhase;
  percent: number;
};

const PHASES: ProgressPhase[] = ["typeset", "render", "write file"];

export function useProgress() {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(null);
  }, []);

  const start = useCallback((label: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    startTimeRef.current = Date.now();
    setProgress({ label, phase: PHASES[0], percent: 0 });
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const total = 6000;
      const ratio = Math.min(elapsed / total, 0.95);
      const phaseIndex = Math.min(PHASES.length - 1, Math.floor(ratio * PHASES.length));
      const percent = Math.round(ratio * 100);
      setProgress({ label, phase: PHASES[phaseIndex], percent });
    }, 120);
  }, []);

  return { progress, start, stop };
}
