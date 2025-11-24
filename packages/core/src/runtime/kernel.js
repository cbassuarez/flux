/**
 * Build an initial RuntimeState from a parsed FluxDocument.
 * - Params are initialized from `state.params.initial`.
 * - Grids are materialized into rectangular cell matrices (row-major 1D array).
 */
export function initRuntimeState(doc) {
    const params = {};
    for (const param of doc.state.params) {
        params[param.name] = param.initial;
    }
    const grids = {};
    for (const gridDef of doc.grids) {
        const rows = gridDef.size?.rows ?? 0;
        const cols = gridDef.size?.cols ?? 0;
        const cells = [];
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
                }
                else {
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
 * - Evaluates all mode=docstep rules in document order.
 * - Applies their effects in a second "commit" phase (last-writer wins).
 */
export function runDocstepOnce(doc, prev) {
    const paramWrites = new Map();
    const cellWrites = new Map();
    const docstepRules = (doc.rules ?? []).filter((rule) => rule.mode === "docstep");
    for (const rule of docstepRules) {
        if (rule.scope?.grid) {
            // Grid-scoped rule: run once per cell
            const gridId = rule.scope.grid;
            const gridState = prev.grids[gridId];
            if (!gridState)
                continue;
            const { rows, cols, cells } = gridState;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const idx = r * cols + c;
                    const cell = cells[idx];
                    const neighbors = buildNeighborsNamespace(prev, gridId, r, c);
                    const ctx = {
                        params: prev.params,
                        cell,
                        neighbors,
                    };
                    const cond = evalExpr(rule.condition, ctx);
                    if (typeof cond !== "boolean") {
                        throw new Error(`Docstep rule '${rule.name}' condition did not evaluate to a boolean (got ${typeof cond})`);
                    }
                    if (cond) {
                        applyStatements(rule.thenBranch, ctx, gridId, r, c, paramWrites, cellWrites);
                    }
                }
            }
        }
        else {
            // Doc-scoped rule: run once, no cell/neighbors
            const ctx = {
                params: prev.params,
            };
            const cond = evalExpr(rule.condition, ctx);
            if (typeof cond !== "boolean") {
                throw new Error(`Docstep rule '${rule.name}' condition did not evaluate to a boolean (got ${typeof cond})`);
            }
            if (cond) {
                applyStatements(rule.thenBranch, ctx, undefined, undefined, undefined, paramWrites, cellWrites);
            }
        }
    }
    return applyWrites(prev, paramWrites, cellWrites);
}
/**
 * Event handling is reserved for a later kernel milestone.
 * For now it is a documented no-op.
 */
export function handleEvent(_doc, state, _event) {
    // v0.1 runtime kernel: event rules are not executed yet.
    return state;
}
function applyStatements(statements, ctx, gridId, row, col, paramWrites, cellWrites) {
    for (const stmt of statements) {
        switch (stmt.kind) {
            case "AssignmentStatement":
                handleAssignment(stmt, ctx, gridId, row, col, paramWrites, cellWrites);
                break;
            // v0.1 kernel: ignore other statement kinds (let, advanceDocstep, etc.)
            default:
                break;
        }
    }
}
function handleAssignment(stmt, ctx, gridId, row, col, paramWrites, cellWrites) {
    if (stmt.kind !== "AssignmentStatement")
        return;
    const target = stmt.target;
    const value = evalExpr(stmt.value, ctx);
    if (target.kind === "Identifier") {
        // Param assignment
        paramWrites.set(target.name, value);
        return;
    }
    if (target.kind === "MemberExpression" &&
        target.object.kind === "Identifier" &&
        target.object.name === "cell") {
        if (!gridId || row === undefined || col === undefined) {
            throw new Error("cell.* assignment is only allowed in grid-scoped docstep rules");
        }
        const key = makeCellKey(gridId, row, col);
        const existing = cellWrites.get(key) ?? {};
        existing[target.property] = value;
        cellWrites.set(key, existing);
        return;
    }
    throw new Error("Unsupported assignment target in v0.1 runtime kernel");
}
function makeCellKey(gridId, row, col) {
    return `${gridId}:${row}:${col}`;
}
function applyWrites(prev, paramWrites, cellWrites) {
    // Clone params
    const params = { ...prev.params };
    for (const [name, value] of paramWrites) {
        params[name] = value;
    }
    // Clone grids and cells
    const grids = {};
    for (const [gridId, gridState] of Object.entries(prev.grids)) {
        const rows = gridState.rows;
        const cols = gridState.cols;
        const cells = gridState.cells.map((cell) => ({ ...cell }));
        grids[gridId] = {
            name: gridState.name ?? gridId,
            rows,
            cols,
            cells,
        };
    }
    // Apply cell patches (last writer wins)
    for (const [key, patch] of cellWrites) {
        const [gridId, rowStr, colStr] = key.split(":");
        const r = Number(rowStr);
        const c = Number(colStr);
        const grid = grids[gridId];
        if (!grid)
            continue;
        const idx = r * grid.cols + c;
        const cell = grid.cells[idx];
        if (!cell)
            continue;
        Object.assign(cell, patch);
    }
    return {
        doc: prev.doc,
        docstepIndex: prev.docstepIndex + 1,
        params,
        grids,
        runtimeConfig: prev.runtimeConfig,
    };
}
/* -------------------------------------------------------------------------- */
/*                          Neighbors / expression eval                       */
/* -------------------------------------------------------------------------- */
function buildNeighborsNamespace(state, gridId, row, col) {
    const grid = state.grids[gridId];
    if (!grid) {
        return {
            all: () => [],
        };
    }
    const { rows, cols, cells } = grid;
    const all = () => {
        const result = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0)
                    continue;
                const rr = row + dr;
                const cc = col + dc;
                if (rr < 0 || rr >= rows || cc < 0 || cc >= cols)
                    continue;
                const idx = rr * cols + cc;
                const cell = cells[idx];
                result.push({ row: rr, col: cc, cell });
            }
        }
        return result;
    };
    return { all };
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
            // v0.1 kernel: no generic function calls are supported at runtime.
            throw new Error("Call expressions are not supported in the v0.1 runtime kernel");
        case "NeighborsCallExpression":
            return evalNeighborsCall(expr, ctx);
        default: {
            const _exhaustive = expr;
            return _exhaustive;
        }
    }
}
function evalIdentifier(name, ctx) {
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
    return ctx.params[name];
}
function evalUnary(op, argument, ctx) {
    const value = evalExpr(argument, ctx);
    switch (op) {
        case "not":
            return !value;
        case "-":
            return -value;
        default:
            throw new Error(`Unsupported unary operator '${op}' in v0.1 runtime kernel`);
    }
}
function evalBinary(op, left, right, ctx) {
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
            const l = evalExpr(left, ctx);
            const r = evalExpr(right, ctx);
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
function evalMember(objectExpr, property, ctx) {
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
            if (count === 0)
                return 0;
            return sum / count;
        }
        throw new Error(`Unsupported neighbors aggregate property '${property}' in v0.1 runtime kernel`);
    }
    const obj = evalExpr(objectExpr, ctx);
    if (obj == null) {
        throw new Error(`Cannot read property '${property}' of null/undefined`);
    }
    return obj[property];
}
function evalNeighborsCall(expr, ctx) {
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
