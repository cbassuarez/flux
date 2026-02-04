import { initRuntimeState, runDocstepOnce, handleEvent } from "./runtime/kernel.js";
export function getDocstepIntervalHint(doc, state) {
    const spec = (doc.runtime?.docstepAdvance ?? []).find((advance) => advance.kind === "timer");
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
export function createRuntime(doc, options = {}) {
    let state = initRuntimeState(doc);
    let docstep = state.docstepIndex ?? 0;
    const opts = { clock: "manual", ...options };
    let timer = null;
    const snapshot = () => buildSnapshot(doc, state, docstep);
    const step = () => {
        state = runDocstepOnce(doc, state);
        docstep = state.docstepIndex;
        const snap = snapshot();
        return snap;
    };
    const reset = () => {
        state = initRuntimeState(doc);
        docstep = 0;
        return snapshot();
    };
    const applyEvent = (event) => {
        const kernelEvent = {
            type: event.type,
            location: event.location,
            payload: event.payload,
        };
        state = handleEvent(doc, state, kernelEvent);
        docstep = state.docstepIndex ?? docstep;
    };
    const start = () => {
        if (opts.clock !== "timer")
            return;
        if (timer)
            return;
        const hint = getDocstepIntervalHint(doc, state);
        const interval = opts.docstepIntervalMs ?? hint.ms ?? 1000;
        timer = setInterval(() => {
            const snap = step();
            opts.onDocstep?.(snap);
        }, interval);
    };
    const stop = () => {
        if (!timer)
            return;
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
function buildSnapshot(doc, state, docstep) {
    const params = { ...state.params };
    const grids = [];
    for (const gridDef of doc.grids ?? []) {
        const runtimeGrid = state.grids[gridDef.name];
        const rows = runtimeGrid?.rows ?? gridDef.size?.rows;
        const cols = runtimeGrid?.cols ?? gridDef.size?.cols;
        const runtimeCells = runtimeGrid?.cells ?? [];
        const cellCount = Math.max(runtimeCells.length, gridDef.cells.length);
        const cells = [];
        for (let idx = 0; idx < cellCount; idx++) {
            const def = gridDef.cells[idx];
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
function timerUnitToMs(unit) {
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
//# sourceMappingURL=runtime.js.map