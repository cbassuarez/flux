import type { FluxDocument } from "./ast.js";
export interface RuntimeCellState {
    id: string;
    tags: string[];
    content: string;
    dynamic: number;
}
export interface RuntimeGridSnapshot {
    name: string;
    rows: number;
    cols: number;
    cells: RuntimeCellState[];
}
export interface RuntimeSnapshot {
    docstep: number;
    params: Record<string, number>;
    grids: RuntimeGridSnapshot[];
}
export interface RuntimeOptions {
    seed?: number;
}
export interface FluxRuntime {
    /** Return the original parsed IR (whatever parseDocument returns). */
    getDocument(): FluxDocument;
    /** Get the current docstep index (starting at 0). */
    getDocstep(): number;
    /** Get a deep-cloned snapshot of the current runtime state. */
    getSnapshot(): RuntimeSnapshot;
    /** Advance the document by one docstep, applying all docstep rules. */
    stepDocstep(): RuntimeSnapshot;
    /** Get current param values. */
    getParams(): Record<string, number>;
    /** Set one or more param values. Unknown names are ignored or rejected. */
    setParams(values: Record<string, number>): void;
    /** Convenience: set a single param. */
    setParam(name: string, value: number): void;
}
export interface CreateRuntimeOptions extends RuntimeOptions {
}
export declare function createRuntime(doc: FluxDocument, options?: CreateRuntimeOptions): FluxRuntime;
export interface DocstepIntervalHint {
    millis: number;
    source?: string;
}
export declare function getDocstepIntervalHint(doc: FluxDocument): DocstepIntervalHint | null;
//# sourceMappingURL=runtime.d.ts.map