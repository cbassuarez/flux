import { ProgressState } from "../state/progress.js";
export declare function DoctorScreen({ width, docPath, summary, logs, logsOpen, progress, onToggleLogs, onRun, debug, }: {
    width: number;
    docPath: string | null;
    summary: string;
    logs: string[];
    logsOpen: boolean;
    progress: ProgressState | null;
    onToggleLogs: () => void;
    onRun: () => void;
    debug?: boolean;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DoctorScreen.d.ts.map