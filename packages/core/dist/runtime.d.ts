import type { FluxDocument } from "./ast.js";
import type { RuntimeState } from "./runtime/model.js";
export interface RuntimeOptions {
    /**
     * Clock mode:
     * - "manual": docsteps are advanced only when the caller asks.
     * - "timer": internal timer drives docsteps based on a hint.
     */
    clock?: "manual" | "timer";
    /**
     * Optional fixed interval for "timer" mode in milliseconds.
     * If omitted, we derive from the document's runtime.docstepAdvance
     * via getDocstepIntervalHint.
     */
    docstepIntervalMs?: number;
    /**
     * Optional callback for each docstep.
     * This is primarily for embedders, but not required for CLI.
     */
    onDocstep?: (snapshot: RuntimeSnapshot) => void;
}
export interface RuntimeEvent {
    type: string;
    source?: string;
    location?: any;
    payload?: any;
    timestamp?: number;
}
/**
 * A lightweight, viewer-friendly snapshot of the runtime state,
 * suitable for UIs. This is not the same as RuntimeState; it's a
 * distilled view for rendering.
 */
export interface RuntimeCellSnapshot {
    id: string;
    tags: string[];
    content?: string;
    mediaId?: string;
    dynamic?: number;
    density?: number;
    salience?: number;
    numericFields?: Record<string, number>;
}
export interface RuntimeGridSnapshot {
    name: string;
    topology: import("./ast.js").Topology;
    rows?: number;
    cols?: number;
    cells: RuntimeCellSnapshot[];
}
export interface RuntimeSnapshot {
    docstep: number;
    params: Record<string, number | string | boolean>;
    grids: RuntimeGridSnapshot[];
}
export interface Runtime {
    /** The parsed document used to initialize the runtime. */
    readonly doc: FluxDocument;
    /** Underlying runtime state; mostly for internal or advanced use. */
    readonly state: RuntimeState;
    /** Current docstep (integer, starting at 0). */
    readonly docstep: number;
    /** Options used to create the runtime. */
    readonly options: RuntimeOptions;
    /**
     * Advance the document by one docstep. Returns the new snapshot.
     */
    step(): RuntimeSnapshot;
    /**
     * Reset to docstep 0 with a fresh RuntimeState.
     */
    reset(): RuntimeSnapshot;
    /**
     * Apply an event (input/transport/sensor). Implementation should
     * delegate to handleEvent(...) in the kernel.
     */
    applyEvent(event: RuntimeEvent): void;
    /**
     * Get a snapshot of the current runtime state without stepping.
     */
    snapshot(): RuntimeSnapshot;
    /**
     * If running in "timer" mode, start the internal timer.
     * No-op for "manual" mode.
     */
    start(): void;
    /**
     * Stop/pause the internal timer if active.
     */
    stop(): void;
}
export interface DocstepIntervalHint {
    /** If null, we couldn't derive a meaningful interval. */
    ms: number | null;
    /** Human-readable explanation; safe to show in UIs. */
    reason: string;
}
export declare function getDocstepIntervalHint(doc: FluxDocument, state: RuntimeState): DocstepIntervalHint;
export declare function createRuntime(doc: FluxDocument, options?: RuntimeOptions): Runtime;
//# sourceMappingURL=runtime.d.ts.map