import type { FluxDocument } from "./ast.js";
export type RuntimeOptions = {
    clock?: "manual" | "internal";
    timerOverrideMs?: number | null;
    onEvent?: (event: RuntimeEvent) => void;
};
export type RuntimeSnapshot = {
    docstep: number;
    params: Record<string, number>;
    grids: Array<{
        name: string;
        rows: number;
        cols: number;
        cells: Array<{
            id: string;
            row: number;
            col: number;
            tags: string[];
            content: string;
            dynamic: number;
        }>;
    }>;
};
export type RuntimeEvent = {
    kind: "docstep";
    docstep: number;
    timestamp: number;
} | {
    kind: "cellChanged";
    docstep: number;
    grid: string;
    cellId: string;
    prevContent: string;
    nextContent: string;
    dynamic: number;
} | {
    kind: "materialTrigger";
    docstep: number;
    grid: string;
    cellId: string;
    materialKey: string;
    dynamic: number;
    params: Record<string, number>;
};
export interface Runtime {
    getSnapshot(): RuntimeSnapshot;
    stepDocstep(): {
        snapshot: RuntimeSnapshot;
        events: RuntimeEvent[];
    };
    start(): void;
    stop(): void;
    isRunning(): boolean;
    setParam(name: string, value: number): void;
}
export declare function createRuntime(doc: FluxDocument, options?: RuntimeOptions): Runtime;
export type RuntimeCellState = {
    id: string;
    tags: string[];
    content: string;
    dynamic: number;
};
export interface DocstepIntervalHint {
    millis: number;
    source?: string;
}
export declare function getDocstepIntervalHint(doc: FluxDocument): DocstepIntervalHint | null;
//# sourceMappingURL=runtime.d.ts.map