import type {
    EventsApplyPolicy,
    FluxDocument,
    FluxExpr,
    FluxRule,
    FluxStmt,
    RuleBranch,
} from "../ast.js";
import type {
    FluxEvent,
    GridRuntimeState,
    NeighborRef,
    NeighborsNamespace,
    RuntimeCellState,
    RuntimeState,
} from "./model.js";

/**
 * Build an initial RuntimeState from a parsed FluxDocument.
 * - Params are initialized from `state.params.initial`.
 * - Grids are materialized into rectangular cell matrices (row-major 1D array).
 */
export function initRuntimeState(doc: FluxDocument): RuntimeState {
    const params: Record<string, number | boolean | string> = {};

    for (const param of doc.state.params) {
        params[param.name] = param.initial as number | boolean | string;
    }

    const grids: Record<string, GridRuntimeState> = {};

    for (const gridDef of doc.grids) {
        const rows = gridDef.size?.rows ?? 0;
        const cols = gridDef.size?.cols ?? 0;

        const cells: RuntimeCellState[] = [];
        let idx = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const def = gridDef.cells[idx];

                if (def) {
                    cells.push({
                        id: def.id,
                        tags: def.tags ?? [],
                        content: def.content ?? "",
                        dynamic: typeof def.dynamic === "number" ? def.dynamic : 0,
                    });
                } else {
                    // Blank cell placeholder
                    cells.push({
                        id: `r${r}c${c}`,
                        tags: [],
                        content: "",
                        dynamic: 0,
                    });
                }

                idx += 1;
            }
        }

        grids[gridDef.name] = {
            name: gridDef.name,
            rows,
            cols,
            cells,
        };
    }

    return {
        doc,
        docstepIndex: 0,
        params,
        grids,
        runtimeConfig: doc.runtime,
    };
}

/**
 * Run a single docstep:
 * - Flushes any param/cell writes deferred from prior event handling.
 * - Evaluates all mode=docstep rules in document order (multi-branch).
 * - Applies their effects in a second "commit" phase (last-writer wins).
 */
export function runDocstepOnce(doc: FluxDocument, prev: RuntimeState): RuntimeState {
    // Flush writes deferred from event handling before this docstep evaluates.
    const base = flushPending(prev);

    const writes = newWriteCollector();
    const control: Control = { advanceRequested: false };

    const docstepRules = (doc.rules ?? []).filter((rule) => rule.mode === "docstep");
    for (const rule of docstepRules) {
        runRule(rule, base, writes, control);
    }

    return commitWrites(base, writes, { advanceDocstep: true });
}

/**
 * Apply an event to the runtime: run all `mode=event` rules whose `onEventType`
 * matches the event, then apply their effects according to the document's
 * `runtime.eventsApply` policy:
 *   - "immediate":                    cell + param writes applied now.
 *   - "deferred":                     cell + param writes deferred to next docstep.
 *   - "cellImmediateParamsDeferred":  cells now, params next docstep (default).
 *
 * If a matching rule calls `advanceDocstep()`, a docstep is run after the
 * event's immediate writes are applied (which also flushes the deferred ones).
 */
export function handleEvent(
    doc: FluxDocument,
    state: RuntimeState,
    event: FluxEvent,
): RuntimeState {
    const eventRules = (doc.rules ?? []).filter(
        (rule) => rule.mode === "event" && eventTypeMatches(rule, event),
    );

    const writes = newWriteCollector();
    const control: Control = { advanceRequested: false };

    for (const rule of eventRules) {
        runRule(rule, state, writes, control, event);
    }

    const policy: EventsApplyPolicy =
        doc.runtime?.eventsApply ?? "cellImmediateParamsDeferred";

    let next = applyEventWrites(state, writes, policy);

    // A rule-requested advance runs a full docstep, flushing deferred writes.
    if (control.advanceRequested) {
        next = runDocstepOnce(doc, next);
    }

    return next;
}

function eventTypeMatches(rule: FluxRule, event: FluxEvent): boolean {
    // No declared type matches any event; otherwise require an exact match.
    return rule.onEventType == null || rule.onEventType === event.type;
}

/* -------------------------------------------------------------------------- */
/*                           Rule execution / writes                          */
/* -------------------------------------------------------------------------- */

interface WriteCollector {
    paramWrites: Map<string, unknown>;
    cellWrites: Map<string, Partial<RuntimeCellState>>;
}

interface Control {
    advanceRequested: boolean;
}

function newWriteCollector(): WriteCollector {
    return { paramWrites: new Map(), cellWrites: new Map() };
}

/**
 * Run one rule over its scope. Grid-scoped rules evaluate once per cell with a
 * `cell`/`neighbors` context; doc-scoped rules evaluate once.
 */
function runRule(
    rule: FluxRule,
    prev: RuntimeState,
    writes: WriteCollector,
    control: Control,
    event?: FluxEvent,
): void {
    if (rule.scope?.grid) {
        const gridId = rule.scope.grid;
        const gridState = prev.grids[gridId];
        if (!gridState) return;

        const { rows, cols, cells } = gridState;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = cells[r * cols + c];
                const ctx: EvalContext = {
                    params: prev.params,
                    cell,
                    neighbors: buildNeighborsNamespace(prev, gridId, r, c),
                    locals: {},
                    event,
                };
                runBranches(rule, ctx, gridId, r, c, writes, control);
            }
        }
    } else {
        const ctx: EvalContext = { params: prev.params, locals: {}, event };
        runBranches(rule, ctx, undefined, undefined, undefined, writes, control);
    }
}

/**
 * Evaluate a rule's branches in order: the first branch whose condition is true
 * runs its body; if none match, the optional else branch runs.
 */
function runBranches(
    rule: FluxRule,
    ctx: EvalContext,
    gridId: string | undefined,
    row: number | undefined,
    col: number | undefined,
    writes: WriteCollector,
    control: Control,
): void {
    const branches: RuleBranch[] =
        rule.branches?.length ? rule.branches : [{ condition: rule.condition, thenBranch: rule.thenBranch }];

    for (const branch of branches) {
        const cond = evalExpr(branch.condition, ctx);
        if (typeof cond !== "boolean") {
            throw new Error(
                `Rule '${rule.name}' condition did not evaluate to a boolean (got ${typeof cond})`,
            );
        }
        if (cond) {
            applyStatements(branch.thenBranch, ctx, gridId, row, col, writes, control);
            return;
        }
    }

    if (rule.elseBranch) {
        applyStatements(rule.elseBranch, ctx, gridId, row, col, writes, control);
    }
}

/* -------------------------------------------------------------------------- */
/*                               Helpers / eval                               */
/* -------------------------------------------------------------------------- */

interface EvalContext {
    params: Record<string, number | boolean | string>;
    cell?: RuntimeCellState;
    neighbors?: NeighborsNamespace;
    /** Local `let` bindings, scoped to a single rule/branch evaluation. */
    locals?: Record<string, unknown>;
    /** The triggering event, available to `event`-mode rules. */
    event?: FluxEvent;
}

function applyStatements(
    statements: FluxStmt[],
    ctx: EvalContext,
    gridId: string | undefined,
    row: number | undefined,
    col: number | undefined,
    writes: WriteCollector,
    control: Control,
): void {
    for (const stmt of statements) {
        switch (stmt.kind) {
            case "AssignmentStatement":
                handleAssignment(stmt, ctx, gridId, row, col, writes);
                break;
            case "LetStatement":
                // Bind a local for the remainder of this rule/branch evaluation.
                (ctx.locals ??= {})[stmt.name] = evalExpr(stmt.value, ctx);
                break;
            case "AdvanceDocstepStatement":
                control.advanceRequested = true;
                break;
            case "ExpressionStatement":
                // Evaluated for completeness; the v0.1 calculus has no side effects
                // outside of assignments, so the result is discarded.
                evalExpr(stmt.expr, ctx);
                break;
            default: {
                const _exhaustive: never = stmt;
                void _exhaustive;
            }
        }
    }
}

function handleAssignment(
    stmt: FluxStmt,
    ctx: EvalContext,
    gridId: string | undefined,
    row: number | undefined,
    col: number | undefined,
    writes: WriteCollector,
): void {
    if (stmt.kind !== "AssignmentStatement") return;

    const target = stmt.target;
    const value = evalExpr(stmt.value, ctx);

    if (target.kind === "Identifier") {
        // Param assignment
        writes.paramWrites.set(target.name, value);
        return;
    }

    if (
        target.kind === "MemberExpression" &&
        target.object.kind === "Identifier" &&
        target.object.name === "cell"
    ) {
        if (!gridId || row === undefined || col === undefined) {
            throw new Error("cell.* assignment is only allowed in grid-scoped rules");
        }

        const key = makeCellKey(gridId, row, col);
        const existing = writes.cellWrites.get(key) ?? {};
        (existing as any)[target.property] = value;
        writes.cellWrites.set(key, existing);
        return;
    }

    throw new Error("Unsupported assignment target in v0.1 runtime kernel");
}

function makeCellKey(gridId: string, row: number, col: number): string {
    return `${gridId}:${row}:${col}`;
}

/** Clone the grids of a state into a fresh, mutable structure. */
function cloneGrids(prev: RuntimeState): Record<string, GridRuntimeState> {
    const grids: Record<string, GridRuntimeState> = {};
    for (const [gridId, gridState] of Object.entries(prev.grids)) {
        grids[gridId] = {
            name: gridState.name ?? gridId,
            rows: gridState.rows,
            cols: gridState.cols,
            cells: gridState.cells.map((cell) => ({ ...cell })),
        };
    }
    return grids;
}

function applyParamWrites(
    params: Record<string, number | boolean | string>,
    paramWrites: Map<string, unknown>,
): void {
    for (const [name, value] of paramWrites) {
        params[name] = value as number | boolean | string;
    }
}

function applyCellWrites(
    grids: Record<string, GridRuntimeState>,
    cellWrites: Map<string, Partial<RuntimeCellState>>,
): void {
    for (const [key, patch] of cellWrites) {
        const [gridId, rowStr, colStr] = key.split(":");
        const grid = grids[gridId];
        if (!grid) continue;
        const idx = Number(rowStr) * grid.cols + Number(colStr);
        const cell = grid.cells[idx];
        if (!cell) continue;
        Object.assign(cell, patch);
    }
}

/** Apply collected writes immediately and (optionally) advance the docstep. */
function commitWrites(
    prev: RuntimeState,
    writes: WriteCollector,
    options: { advanceDocstep: boolean },
): RuntimeState {
    const params = { ...prev.params };
    applyParamWrites(params, writes.paramWrites);

    const grids = cloneGrids(prev);
    applyCellWrites(grids, writes.cellWrites);

    return {
        doc: prev.doc,
        docstepIndex: prev.docstepIndex + (options.advanceDocstep ? 1 : 0),
        params,
        grids,
        runtimeConfig: prev.runtimeConfig,
    };
}

/**
 * Apply event-rule writes under the given policy. Deferred writes are stashed on
 * the returned state and flushed at the start of the next docstep. Does not
 * advance the docstep on its own.
 */
function applyEventWrites(
    prev: RuntimeState,
    writes: WriteCollector,
    policy: EventsApplyPolicy,
): RuntimeState {
    const paramsImmediate = policy === "immediate";
    const cellsImmediate = policy === "immediate" || policy === "cellImmediateParamsDeferred";

    const params = { ...prev.params };
    const grids = cloneGrids(prev);

    const pendingParamWrites: Record<string, number | boolean | string> = {
        ...(prev.pendingParamWrites ?? {}),
    };
    const pendingCellWrites: Record<string, Partial<RuntimeCellState>> = {
        ...(prev.pendingCellWrites ?? {}),
    };

    if (paramsImmediate) {
        applyParamWrites(params, writes.paramWrites);
    } else {
        for (const [name, value] of writes.paramWrites) {
            pendingParamWrites[name] = value as number | boolean | string;
        }
    }

    if (cellsImmediate) {
        applyCellWrites(grids, writes.cellWrites);
    } else {
        for (const [key, patch] of writes.cellWrites) {
            pendingCellWrites[key] = { ...(pendingCellWrites[key] ?? {}), ...patch };
        }
    }

    return {
        doc: prev.doc,
        docstepIndex: prev.docstepIndex,
        params,
        grids,
        runtimeConfig: prev.runtimeConfig,
        pendingParamWrites,
        pendingCellWrites,
    };
}

/** Merge any deferred event writes into a fresh state, clearing the queues. */
function flushPending(prev: RuntimeState): RuntimeState {
    const hasPending =
        (prev.pendingParamWrites && Object.keys(prev.pendingParamWrites).length > 0) ||
        (prev.pendingCellWrites && Object.keys(prev.pendingCellWrites).length > 0);
    if (!hasPending) return prev;

    const params = { ...prev.params, ...prev.pendingParamWrites };
    const grids = cloneGrids(prev);
    applyCellWrites(grids, new Map(Object.entries(prev.pendingCellWrites ?? {})));

    return {
        doc: prev.doc,
        docstepIndex: prev.docstepIndex,
        params,
        grids,
        runtimeConfig: prev.runtimeConfig,
        pendingParamWrites: {},
        pendingCellWrites: {},
    };
}

/* -------------------------------------------------------------------------- */
/*                          Neighbors / expression eval                       */
/* -------------------------------------------------------------------------- */

function buildNeighborsNamespace(
    state: RuntimeState,
    gridId: string,
    row: number,
    col: number,
): NeighborsNamespace {
    const grid = state.grids[gridId];
    if (!grid) {
        return {
            all: () => [],
        };
    }

    const { rows, cols, cells } = grid;

    const all = (): NeighborRef[] => {
        const result: NeighborRef[] = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const rr = row + dr;
                const cc = col + dc;
                if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
                const idx = rr * cols + cc;
                const cell = cells[idx];
                result.push({ row: rr, col: cc, cell });
            }
        }
        return result;
    };

    return { all };
}

function evalExpr(expr: FluxExpr, ctx: EvalContext): unknown {
    switch (expr.kind) {
        case "Literal":
            return expr.value;

        case "ListExpression":
            return expr.items.map((item) => evalExpr(item, ctx));

        case "Identifier":
            return evalIdentifier(expr.name, ctx);

        case "UnaryExpression":
            return evalUnary(expr.op, expr.argument, ctx);

        case "BinaryExpression":
            return evalBinary(expr.op, expr.left, expr.right, ctx);

        case "MemberExpression":
            return evalMember(expr.object, expr.property, ctx);

        case "CallExpression":
            return evalCall(expr, ctx);

        case "NeighborsCallExpression":
            return evalNeighborsCall(expr, ctx);

        default: {
            const _exhaustive: never = expr;
            return _exhaustive;
        }
    }
}

function evalIdentifier(name: string, ctx: EvalContext): unknown {
    // Local `let` bindings shadow everything else for the current evaluation.
    if (ctx.locals && Object.prototype.hasOwnProperty.call(ctx.locals, name)) {
        return ctx.locals[name];
    }
    if (name === "cell") {
        if (!ctx.cell) {
            throw new Error("'cell' is not defined in this context");
        }
        return ctx.cell;
    }
    if (name === "neighbors") {
        if (!ctx.neighbors) {
            throw new Error("'neighbors' is not defined in this context");
        }
        return ctx.neighbors;
    }
    if (name === "event") {
        if (!ctx.event) {
            throw new Error("'event' is only defined in event-mode rules");
        }
        return ctx.event;
    }
    return ctx.params[name];
}

function evalUnary(op: string, argument: FluxExpr, ctx: EvalContext): unknown {
    const value = evalExpr(argument, ctx);
    switch (op) {
        case "not":
            return !value;
        case "-":
            return -(value as number);
        default:
            throw new Error(`Unsupported unary operator '${op}' in v0.1 runtime kernel`);
    }
}

function evalBinary(op: string, left: FluxExpr, right: FluxExpr, ctx: EvalContext): unknown {
    switch (op) {
        case "and": {
            const l = evalExpr(left, ctx);
            return Boolean(l) && Boolean(evalExpr(right, ctx));
        }
        case "or": {
            const l = evalExpr(left, ctx);
            return Boolean(l) || Boolean(evalExpr(right, ctx));
        }
        default: {
            const l = evalExpr(left, ctx) as any;
            const r = evalExpr(right, ctx) as any;
            switch (op) {
                case "==":
                    return l === r;
                case "!=":
                    return l !== r;
                case "===":
                    return l === r;
                case "!==":
                    return l !== r;
                case "<":
                    return l < r;
                case "<=":
                    return l <= r;
                case ">":
                    return l > r;
                case ">=":
                    return l >= r;
                case "+":
                    return l + r;
                case "-":
                    return l - r;
                case "*":
                    return l * r;
                case "/":
                    return l / r;
                default:
                    throw new Error(`Unsupported binary operator '${op}' in v0.1 runtime kernel`);
            }
        }
    }
}

function evalMember(objectExpr: FluxExpr, property: string, ctx: EvalContext): unknown {
    // Special-case neighbors.* aggregators:
    if (objectExpr.kind === "NeighborsCallExpression") {
        const refs = evalNeighborsCall(objectExpr, ctx);

        if (property === "dynamic") {
            let sum = 0;
            let count = 0;
            for (const ref of refs) {
                const d = ref.cell.dynamic;
                if (typeof d === "number" && Number.isFinite(d)) {
                    sum += d;
                    count += 1;
                }
            }
            if (count === 0) return 0;
            return sum / count;
        }

        throw new Error(
            `Unsupported neighbors aggregate property '${property}' in v0.1 runtime kernel`,
        );
    }

    const obj = evalExpr(objectExpr, ctx) as any;
    if (obj == null) {
        throw new Error(`Cannot read property '${property}' of null/undefined`);
    }
    return obj[property];
}

/**
 * Deterministic math standard library available to rule expressions. All
 * functions are pure, so the runtime stays reproducible across runs.
 */
function evalCall(
    expr: Extract<FluxExpr, { kind: "CallExpression" }>,
    ctx: EvalContext,
): unknown {
    if (expr.callee.kind !== "Identifier") {
        throw new Error("Only named function calls are supported in rule expressions");
    }
    const name = expr.callee.name;
    const args = expr.args.map((arg) => {
        if (arg.kind === "NamedArg") {
            throw new Error(`Function '${name}' does not take named arguments`);
        }
        return Number(evalExpr(arg, ctx));
    });

    switch (name) {
        case "min":
            return Math.min(...args);
        case "max":
            return Math.max(...args);
        case "abs":
            return Math.abs(args[0]);
        case "floor":
            return Math.floor(args[0]);
        case "ceil":
            return Math.ceil(args[0]);
        case "round":
            return Math.round(args[0]);
        case "sign":
            return Math.sign(args[0]);
        case "sqrt":
            return Math.sqrt(args[0]);
        case "pow":
            return Math.pow(args[0], args[1]);
        case "mod": {
            const [a, b] = args;
            return ((a % b) + b) % b; // floored modulo (handles negatives)
        }
        case "clamp": {
            const [x, lo, hi] = args;
            return Math.min(Math.max(x, lo), hi);
        }
        case "lerp": {
            const [a, b, t] = args;
            return a + (b - a) * t;
        }
        default:
            throw new Error(`Unknown function '${name}' in rule expression`);
    }
}

function evalNeighborsCall(
    expr: Extract<FluxExpr, { kind: "NeighborsCallExpression" }>,
    ctx: EvalContext,
): NeighborRef[] {
    if (!ctx.neighbors) {
        throw new Error("neighbors.*() used outside of a grid-scoped context");
    }
    switch (expr.method) {
        case "all":
            return ctx.neighbors.all();
        default:
            throw new Error(`Unsupported neighbors method '${expr.method}' in v0.1 runtime kernel`);
    }
}
