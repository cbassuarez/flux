export type ProgressPhase = "typeset" | "render" | "write file";
export type ProgressState = {
    label: string;
    phase: ProgressPhase;
    percent: number;
};
export declare function useProgress(): {
    progress: ProgressState | null;
    start: (label: string) => void;
    stop: () => void;
};
//# sourceMappingURL=progress.d.ts.map