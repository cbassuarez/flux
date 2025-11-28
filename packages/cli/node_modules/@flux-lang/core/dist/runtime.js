export function createRuntime(doc, options = {}) {
    const state = {
        doc,
        docstep: 0,
        params: buildParams(doc),
        grids: buildGrids(doc),
        random: makeRandom(),
    };
    const clock = options.clock ?? "manual";
    const timerOverrideMs = options.timerOverrideMs ?? null;
    const onEvent = options.onEvent;
    let timer = null;
    const materialKeys = new Set((doc.materials?.materials ?? []).map((m) => m.name));
    function getSnapshot() {
        return buildSnapshot(state);
    }
    function emit(events) {
        if (!onEvent)
            return;
        for (const ev of events) {
            onEvent(ev);
        }
    }
    function stepDocstep() {
        const prevSnapshot = buildSnapshot(state);
        const patches = [];
        const rules = (state.doc.rules ?? []).filter((rule) => rule.mode === "docstep");
        for (const grid of state.grids.values()) {
            const gridRules = rules.filter((rule) => rule.scope?.grid === grid.name);
            if (gridRules.length === 0)
                continue;
            for (let row = 0; row < grid.rows; row++) {
                for (let col = 0; col < grid.cols; col++) {
                    const idx = row * grid.cols + col;
                    const cell = grid.cells[idx];
                    if (!cell)
                        continue;
                    for (const rule of gridRules) {
                        const ctx = {
                            state,
                            grid,
                            cell,
                            row,
                            col,
                        };
                        const condition = evalExpr(rule.condition, ctx);
                        if (condition) {
                            const assignments = rule.thenBranch ?? [];
                            for (const stmt of assignments) {
                                if (stmt.kind !== "AssignmentStatement")
                                    continue;
                                const target = resolveAssignmentTarget(stmt.target, ctx);
                                if (!target)
                                    continue;
                                const value = evalExpr(stmt.value, ctx);
                                patches.push({
                                    gridName: grid.name,
                                    cellId: cell.id,
                                    property: target,
                                    value,
                                });
                            }
                        }
                    }
                }
            }
        }
        applyPatches(state, patches);
        state.docstep += 1;
        const snapshot = buildSnapshot(state);
        const events = [
            { kind: "docstep", docstep: snapshot.docstep, timestamp: Date.now() },
        ];
        const prevGridMap = new Map(prevSnapshot.grids.map((g) => [g.name, g]));
        for (const grid of snapshot.grids) {
            const prevGrid = prevGridMap.get(grid.name);
            for (const cell of grid.cells) {
                const prevCell = prevGrid?.cells[cell.row * grid.cols + cell.col];
                const prevContent = prevCell?.content ?? "";
                if (prevContent !== cell.content) {
                    events.push({
                        kind: "cellChanged",
                        docstep: snapshot.docstep,
                        grid: grid.name,
                        cellId: cell.id,
                        prevContent,
                        nextContent: cell.content,
                        dynamic: cell.dynamic,
                    });
                    if (materialKeys.has(cell.content)) {
                        events.push({
                            kind: "materialTrigger",
                            docstep: snapshot.docstep,
                            grid: grid.name,
                            cellId: cell.id,
                            materialKey: cell.content,
                            dynamic: cell.dynamic,
                            params: { ...snapshot.params },
                        });
                    }
                }
            }
        }
        emit(events);
        return { snapshot, events };
    }
    function start() {
        if (clock !== "internal")
            return;
        if (timer)
            return;
        const hint = getDocstepIntervalHint(doc);
        const interval = timerOverrideMs ?? hint?.millis ?? 1000;
        timer = setInterval(() => {
            stepDocstep();
        }, interval);
    }
    function stop() {
        if (!timer)
            return;
        clearInterval(timer);
        timer = null;
    }
    function isRunning() {
        return timer !== null;
    }
    function setParam(name, value) {
        state.params.set(name, value);
    }
    return {
        getSnapshot,
        stepDocstep,
        start,
        stop,
        isRunning,
        setParam,
    };
}
function buildParams(doc) {
    const params = new Map();
    for (const param of doc.state.params ?? []) {
        if (typeof param.initial === "number") {
            params.set(param.name, param.initial);
        }
    }
    return params;
}
function buildGrids(doc) {
    const grids = new Map();
    for (const grid of doc.grids ?? []) {
        const rows = grid.size?.rows ?? 0;
        const cols = grid.size?.cols ?? 0;
        const cells = [];
        const cellIndex = new Map();
        let idx = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellDef = grid.cells[idx];
                const cellState = {
                    id: cellDef?.id ?? `r${r}c${c}`,
                    tags: [...(cellDef?.tags ?? [])],
                    content: cellDef?.content ?? "",
                    dynamic: typeof cellDef?.dynamic === "number" ? cellDef.dynamic : 0,
                };
                cells.push(cellState);
                cellIndex.set(cellState.id, idx);
                idx += 1;
            }
        }
        grids.set(grid.name, { name: grid.name, rows, cols, cells, cellIndex });
    }
    return grids;
}
function makeRandom() {
    let s = Date.now() >>> 0;
    return function next() {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return (s >>> 0) / 0xffffffff;
    };
}
function evalExpr(expr, ctx) {
    switch (expr.kind) {
        case "Literal":
            return expr.value;
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
        default:
            return undefined;
    }
}
function evalIdentifier(name, ctx) {
    if (name === "cell")
        return ctx.cell;
    if (name === "neighbors")
        return neighborsNamespace;
    if (name === "random")
        return ctx.state.random;
    if (ctx.state.params.has(name))
        return ctx.state.params.get(name);
    return undefined;
    function neighborsNamespace(method) {
        if (method === "all" || method === "orth") {
            return evalNeighborsCall({ kind: "NeighborsCallExpression", namespace: "neighbors", method, args: [] }, ctx);
        }
        return [];
    }
}
function evalUnary(op, argument, ctx) {
    const value = evalExpr(argument, ctx);
    switch (op) {
        case "not":
            return !value;
        case "-":
            return -value;
        default:
            return undefined;
    }
}
function evalBinary(op, left, right, ctx) {
    switch (op) {
        case "and":
            return Boolean(evalExpr(left, ctx)) && Boolean(evalExpr(right, ctx));
        case "or":
            return Boolean(evalExpr(left, ctx)) || Boolean(evalExpr(right, ctx));
        case "==":
            return evalExpr(left, ctx) === evalExpr(right, ctx);
        case "!=":
            return evalExpr(left, ctx) !== evalExpr(right, ctx);
        case "<":
            return evalExpr(left, ctx) < evalExpr(right, ctx);
        case "<=":
            return evalExpr(left, ctx) <= evalExpr(right, ctx);
        case ">":
            return evalExpr(left, ctx) > evalExpr(right, ctx);
        case ">=":
            return evalExpr(left, ctx) >= evalExpr(right, ctx);
        case "+":
            return evalExpr(left, ctx) + evalExpr(right, ctx);
        case "-":
            return evalExpr(left, ctx) - evalExpr(right, ctx);
        case "*":
            return evalExpr(left, ctx) * evalExpr(right, ctx);
        case "/":
            return evalExpr(left, ctx) / evalExpr(right, ctx);
        default:
            return undefined;
    }
}
function evalMember(objectExpr, property, ctx) {
    if (objectExpr.kind === "NeighborsCallExpression") {
        const neighbors = evalNeighborsCall(objectExpr, ctx);
        if (property === "dynamic") {
            let max = 0;
            for (const cell of neighbors) {
                if (typeof cell.dynamic === "number" && cell.dynamic > max) {
                    max = cell.dynamic;
                }
            }
            return max;
        }
        return undefined;
    }
    const obj = evalExpr(objectExpr, ctx);
    if (obj == null)
        return undefined;
    return obj[property];
}
function evalCall(expr, ctx) {
    if (expr.callee.kind === "Identifier" && expr.callee.name === "random") {
        return ctx.state.random();
    }
    if (expr.callee.kind === "Identifier" && expr.callee.name === "max") {
        const [a, b] = expr.args;
        return Math.max(Number(evalExpr(a, ctx)), Number(evalExpr(b, ctx)));
    }
    if (expr.callee.kind === "MemberExpression" &&
        expr.callee.property === "contains") {
        const target = evalExpr(expr.callee.object, ctx);
        const arg = expr.args[0] ? evalExpr(expr.args[0], ctx) : undefined;
        if (Array.isArray(target)) {
            return target.includes(arg);
        }
    }
    const callee = evalExpr(expr.callee, ctx);
    if (typeof callee === "function") {
        const args = expr.args.map((a) => evalExpr(a, ctx));
        return callee(...args);
    }
    return undefined;
}
function evalNeighborsCall(expr, ctx) {
    const offsets = expr.method === "orth" ? orthogonalOffsets : allOffsets;
    const neighbors = [];
    for (const [dr, dc] of offsets) {
        const rr = ctx.row + dr;
        const cc = ctx.col + dc;
        if (rr < 0 || rr >= ctx.grid.rows || cc < 0 || cc >= ctx.grid.cols)
            continue;
        const idx = rr * ctx.grid.cols + cc;
        const neighbor = ctx.grid.cells[idx];
        if (neighbor)
            neighbors.push(neighbor);
    }
    return neighbors;
}
const allOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
];
const orthogonalOffsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
];
function resolveAssignmentTarget(target, _ctx) {
    if (target.kind === "MemberExpression" && target.object.kind === "Identifier" && target.object.name === "cell") {
        if (target.property === "content" || target.property === "dynamic") {
            return target.property;
        }
    }
    return null;
}
function applyPatches(state, patches) {
    for (const patch of patches) {
        const grid = state.grids.get(patch.gridName);
        if (!grid)
            continue;
        const idx = grid.cellIndex.get(patch.cellId);
        if (idx === undefined)
            continue;
        const cell = grid.cells[idx];
        if (!cell)
            continue;
        cell[patch.property] = patch.value;
    }
}
function buildSnapshot(state) {
    const params = {};
    for (const [key, value] of state.params) {
        if (typeof value === "number") {
            params[key] = value;
        }
    }
    const grids = [];
    for (const grid of state.grids.values()) {
        const cells = grid.cells.map((cell, idx) => ({
            id: cell.id,
            row: Math.floor(idx / grid.cols),
            col: idx % grid.cols,
            tags: [...cell.tags],
            content: cell.content,
            dynamic: cell.dynamic,
        }));
        grids.push({
            name: grid.name,
            rows: grid.rows,
            cols: grid.cols,
            cells,
        });
    }
    return { docstep: state.docstep, params, grids };
}
export function getDocstepIntervalHint(doc) {
    const spec = doc.runtime?.docstepAdvance?.find((advance) => advance.kind === "timer");
    if (!spec)
        return null;
    const unit = normalizeUnit(spec.unit);
    if (!unit)
        return null;
    const multiplier = unit === "ms" ? 1 : unit === "s" ? 1000 : 60000;
    return { millis: spec.amount * multiplier, source: `timer(${spec.amount} ${spec.unit})` };
}
function normalizeUnit(unit) {
    switch (unit) {
        case "ms":
        case "millisecond":
        case "milliseconds":
            return "ms";
        case "s":
        case "sec":
        case "secs":
        case "second":
        case "seconds":
            return "s";
        case "m":
        case "min":
        case "mins":
        case "minute":
        case "minutes":
            return "m";
        default:
            return null;
    }
}
//# sourceMappingURL=runtime.js.map