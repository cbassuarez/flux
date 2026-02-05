import { ProgressState } from "../state/progress.js";
export declare function ExportScreen({ width, docPath, outputPath, progress, resultPath, actionIndex, onExport, onOpenFile, onReveal, onCopyPath, debug, }: {
    width: number;
    docPath: string | null;
    outputPath: string | null;
    progress: ProgressState | null;
    resultPath: string | null;
    actionIndex: number;
    onExport: () => void;
    onOpenFile: () => void;
    onReveal: () => void;
    onCopyPath: () => void;
    debug?: boolean;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ExportScreen.d.ts.map