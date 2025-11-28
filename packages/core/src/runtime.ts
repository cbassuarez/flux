import type { FluxCell, FluxDocument, DocstepAdvanceTimer, TimerUnit } from "./ast.js";
import { initRuntimeState, runDocstepOnce, handleEvent } from "./runtime/kernel.js";
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

export function getDocstepIntervalHint(doc: FluxDocument, state: RuntimeState): DocstepIntervalHint {
  const spec = (doc.runtime?.docstepAdvance ?? []).find(
    (advance): advance is DocstepAdvanceTimer => advance.kind === "timer",
  );

  if (!spec) {
    return { ms: null, reason: "No timer-based docstepAdvance in runtime config." };
  }

  const multiplier = timerUnitToMs(spec.unit);
  if (multiplier == null) {
    return {
      ms: null,
      reason: `Timer unit '${spec.unit}' is not supported for interval hinting.`,
    };
  }

  return {
    ms: spec.amount * multiplier,
    reason: `Derived from runtime.docstepAdvance timer(${spec.amount} ${spec.unit})`,
  };
}

export function createRuntime(doc: FluxDocument, options: RuntimeOptions = {}): Runtime {
  let state = initRuntimeState(doc);
  let docstep = state.docstepIndex ?? 0;
  const opts: RuntimeOptions = { clock: "manual", ...options };
  let timer: ReturnType<typeof setInterval> | null = null;

  const snapshot = (): RuntimeSnapshot => buildSnapshot(doc, state, docstep);

  const step = (): RuntimeSnapshot => {
    state = runDocstepOnce(doc, state);
    docstep = state.docstepIndex;
    const snap = snapshot();
    return snap;
  };

  const reset = (): RuntimeSnapshot => {
    state = initRuntimeState(doc);
    docstep = 0;
    return snapshot();
  };

  const applyEvent = (event: RuntimeEvent): void => {
    const kernelEvent = {
      type: event.type,
      location: event.location,
      payload: event.payload,
    };
    state = handleEvent(doc, state, kernelEvent as any);
    docstep = state.docstepIndex ?? docstep;
  };

  const start = (): void => {
    if (opts.clock !== "timer") return;
    if (timer) return;
    const hint = getDocstepIntervalHint(doc, state);
    const interval = opts.docstepIntervalMs ?? hint.ms ?? 1000;
    timer = setInterval(() => {
      const snap = step();
      opts.onDocstep?.(snap);
    }, interval);
  };

  const stop = (): void => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  return {
    get doc() {
      return doc;
    },
    get state() {
      return state;
    },
    get docstep() {
      return docstep;
    },
    get options() {
      return opts;
    },
    step,
    reset,
    applyEvent,
    snapshot,
    start,
    stop,
  };
}

function buildSnapshot(doc: FluxDocument, state: RuntimeState, docstep: number): RuntimeSnapshot {
  const params: Record<string, number | string | boolean> = { ...state.params };
  const grids: RuntimeGridSnapshot[] = [];

  for (const gridDef of doc.grids ?? []) {
    const runtimeGrid = state.grids[gridDef.name];
    const rows = runtimeGrid?.rows ?? gridDef.size?.rows;
    const cols = runtimeGrid?.cols ?? gridDef.size?.cols;
    const runtimeCells = runtimeGrid?.cells ?? [];
    const cellCount = Math.max(runtimeCells.length, gridDef.cells.length);
    const cells: RuntimeCellSnapshot[] = [];

    for (let idx = 0; idx < cellCount; idx++) {
      const def: FluxCell | undefined = gridDef.cells[idx];
      const cellState = runtimeCells[idx];
      const id = cellState?.id ?? def?.id ?? `cell${idx}`;
      const tags = cellState?.tags ?? def?.tags ?? [];
      const content = cellState?.content ?? def?.content;
      const mediaId = def?.mediaId;
      const dynamic = cellState?.dynamic ?? def?.dynamic;
      const density = def?.density;
      const salience = def?.salience;
      const numericFields = def?.numericFields;

      cells.push({ id, tags, content, mediaId, dynamic, density, salience, numericFields });
    }

    grids.push({
      name: gridDef.name,
      topology: gridDef.topology,
      rows,
      cols,
      cells,
    });
  }

  return { docstep, params, grids };
}

function timerUnitToMs(unit: TimerUnit): number | null {
  switch (unit) {
    case "ms":
    case "millisecond":
    case "milliseconds":
      return 1;
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return 1000;
    case "m":
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return 60_000;
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return 3_600_000;
    default:
      return null;
  }
}
