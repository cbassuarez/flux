import type { FluxDocument, FluxExpr, DocstepAdvanceTimer } from "./ast.js";

// A single cell in the runtime grid state
export interface RuntimeCellState {
  id: string; // matches IR cell id (e.g. "c1")
  tags: string[]; // copied from document
  content: string; // mutable
  dynamic: number; // mutable
}

// Snapshot of a single grid
export interface RuntimeGridSnapshot {
  name: string; // grid name, e.g. "main"
  rows: number;
  cols: number;
  cells: RuntimeCellState[]; // row-major order
}

// Snapshot of the whole document state at a docstep
export interface RuntimeSnapshot {
  docstep: number;
  params: Record<string, number>;
  grids: RuntimeGridSnapshot[];
}

// Options for runtime creation
export interface RuntimeOptions {
  seed?: number; // deterministic random seed
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

export interface CreateRuntimeOptions extends RuntimeOptions {}

export function createRuntime(doc: FluxDocument, options: CreateRuntimeOptions = {}): FluxRuntime {
  const state: InternalRuntimeState = {
    doc,
    docstep: 0,
    params: buildParams(doc),
    grids: buildGrids(doc),
    random: makeRandom(options.seed),
  };

  function getSnapshot(): RuntimeSnapshot {
    return buildSnapshot(state);
  }

  function setParam(name: string, value: number): void {
    if (!state.params.has(name)) return;
    state.params.set(name, value);
  }

  function setParams(values: Record<string, number>): void {
    for (const [key, value] of Object.entries(values)) {
      setParam(key, value);
    }
  }

  function getParams(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of state.params) {
      result[key] = value;
    }
    return result;
  }

  function getDocstep(): number {
    return state.docstep;
  }

  function getDocument(): FluxDocument {
    return state.doc;
  }

  function stepDocstep(): RuntimeSnapshot {
    const patches: CellPatch[] = [];
    const rules = (state.doc.rules ?? []).filter((rule) => rule.mode === "docstep");

    for (const grid of state.grids.values()) {
      const gridRules = rules.filter((rule) => rule.scope?.grid === grid.name);
      if (gridRules.length === 0) continue;

      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
          const idx = row * grid.cols + col;
          const cell = grid.cells[idx];
          if (!cell) continue;

          for (const rule of gridRules) {
            const ctx: EvalContext = {
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
                if (stmt.kind !== "AssignmentStatement") continue;
                const target = resolveAssignmentTarget(stmt.target, ctx);
                if (!target) continue;

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
    return buildSnapshot(state);
  }

  return {
    getDocument,
    getDocstep,
    getSnapshot,
    stepDocstep,
    getParams,
    setParams,
    setParam,
  };
}

interface InternalGrid {
  name: string;
  rows: number;
  cols: number;
  cells: RuntimeCellState[];
  cellIndex: Map<string, number>;
}

interface InternalRuntimeState {
  doc: FluxDocument;
  docstep: number;
  params: Map<string, number>;
  grids: Map<string, InternalGrid>;
  random: () => number;
}

interface CellPatch {
  gridName: string;
  cellId: string;
  property: "content" | "dynamic";
  value: string | number;
}

function buildParams(doc: FluxDocument): Map<string, number> {
  const params = new Map<string, number>();
  for (const param of doc.state.params ?? []) {
    if (typeof param.initial === "number") {
      params.set(param.name, param.initial);
    }
  }
  return params;
}

function buildGrids(doc: FluxDocument): Map<string, InternalGrid> {
  const grids = new Map<string, InternalGrid>();
  for (const grid of doc.grids ?? []) {
    const rows = grid.size?.rows ?? 0;
    const cols = grid.size?.cols ?? 0;
    const cells: RuntimeCellState[] = [];
    const cellIndex = new Map<string, number>();

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellDef = grid.cells[idx];
        const cellState: RuntimeCellState = {
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

function makeRandom(seed: number | undefined): () => number {
  let s = (seed ?? Date.now()) >>> 0;
  return function next() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

interface EvalContext {
  state: InternalRuntimeState;
  grid: InternalGrid;
  cell: RuntimeCellState;
  row: number;
  col: number;
}

function evalExpr(expr: FluxExpr, ctx: EvalContext): any {
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

function evalIdentifier(name: string, ctx: EvalContext): any {
  if (name === "cell") return ctx.cell;
  if (name === "neighbors") return neighborsNamespace;
  if (name === "random") return ctx.state.random;
  if (ctx.state.params.has(name)) return ctx.state.params.get(name);
  return undefined;

  function neighborsNamespace(method?: string) {
    if (method === "all" || method === "orth") {
      return evalNeighborsCall({ kind: "NeighborsCallExpression", namespace: "neighbors", method, args: [] }, ctx);
    }
    return [];
  }
}

function evalUnary(op: string, argument: FluxExpr, ctx: EvalContext): any {
  const value = evalExpr(argument, ctx);
  switch (op) {
    case "not":
      return !value;
    case "-":
      return -(value as number);
    default:
      return undefined;
  }
}

function evalBinary(op: string, left: FluxExpr, right: FluxExpr, ctx: EvalContext): any {
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
      return (evalExpr(left, ctx) as any) < (evalExpr(right, ctx) as any);
    case "<=":
      return (evalExpr(left, ctx) as any) <= (evalExpr(right, ctx) as any);
    case ">":
      return (evalExpr(left, ctx) as any) > (evalExpr(right, ctx) as any);
    case ">=":
      return (evalExpr(left, ctx) as any) >= (evalExpr(right, ctx) as any);
    case "+":
      return (evalExpr(left, ctx) as any) + (evalExpr(right, ctx) as any);
    case "-":
      return (evalExpr(left, ctx) as any) - (evalExpr(right, ctx) as any);
    case "*":
      return (evalExpr(left, ctx) as any) * (evalExpr(right, ctx) as any);
    case "/":
      return (evalExpr(left, ctx) as any) / (evalExpr(right, ctx) as any);
    default:
      return undefined;
  }
}

function evalMember(objectExpr: FluxExpr, property: string, ctx: EvalContext): any {
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

  const obj = evalExpr(objectExpr, ctx) as any;
  if (obj == null) return undefined;
  return obj[property];
}

function evalCall(expr: Extract<FluxExpr, { kind: "CallExpression" }>, ctx: EvalContext): any {
  if (expr.callee.kind === "Identifier" && expr.callee.name === "random") {
    return ctx.state.random();
  }

  if (expr.callee.kind === "Identifier" && expr.callee.name === "max") {
    const [a, b] = expr.args;
    return Math.max(Number(evalExpr(a, ctx)), Number(evalExpr(b, ctx)));
  }

  if (
    expr.callee.kind === "MemberExpression" &&
    expr.callee.property === "contains"
  ) {
    const target = evalExpr(expr.callee.object, ctx);
    const arg = expr.args[0] ? evalExpr(expr.args[0], ctx) : undefined;
    if (Array.isArray(target)) {
      return target.includes(arg as any);
    }
  }

  const callee = evalExpr(expr.callee, ctx);
  if (typeof callee === "function") {
    const args = expr.args.map((a) => evalExpr(a, ctx));
    return callee(...args);
  }

  return undefined;
}

function evalNeighborsCall(
  expr: Extract<FluxExpr, { kind: "NeighborsCallExpression" }>,
  ctx: EvalContext,
): RuntimeCellState[] {
  const offsets = expr.method === "orth" ? orthogonalOffsets : allOffsets;
  const neighbors: RuntimeCellState[] = [];

  for (const [dr, dc] of offsets) {
    const rr = ctx.row + dr;
    const cc = ctx.col + dc;
    if (rr < 0 || rr >= ctx.grid.rows || cc < 0 || cc >= ctx.grid.cols) continue;
    const idx = rr * ctx.grid.cols + cc;
    const neighbor = ctx.grid.cells[idx];
    if (neighbor) neighbors.push(neighbor);
  }

  return neighbors;
}

const allOffsets: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const orthogonalOffsets: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function resolveAssignmentTarget(
  target: FluxExpr,
  _ctx: EvalContext,
): CellPatch["property"] | null {
  if (target.kind === "MemberExpression" && target.object.kind === "Identifier" && target.object.name === "cell") {
    if (target.property === "content" || target.property === "dynamic") {
      return target.property;
    }
  }
  return null;
}

function applyPatches(state: InternalRuntimeState, patches: CellPatch[]): void {
  for (const patch of patches) {
    const grid = state.grids.get(patch.gridName);
    if (!grid) continue;
    const idx = grid.cellIndex.get(patch.cellId);
    if (idx === undefined) continue;
    const cell = grid.cells[idx];
    if (!cell) continue;
    (cell as any)[patch.property] = patch.value as any;
  }
}

function buildSnapshot(state: InternalRuntimeState): RuntimeSnapshot {
  const params: Record<string, number> = {};
  for (const [key, value] of state.params) {
    params[key] = value;
  }

  const grids: RuntimeGridSnapshot[] = [];
  for (const grid of state.grids.values()) {
    const cells = grid.cells.map((cell) => ({
      id: cell.id,
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

export interface DocstepIntervalHint {
  millis: number;
  source?: string;
}

export function getDocstepIntervalHint(doc: FluxDocument): DocstepIntervalHint | null {
  const spec = doc.runtime?.docstepAdvance?.find((advance) => advance.kind === "timer") as
    | DocstepAdvanceTimer
    | undefined;
  if (!spec) return null;

  const unit = normalizeUnit(spec.unit);
  if (!unit) return null;

  const multiplier = unit === "ms" ? 1 : unit === "s" ? 1000 : 60000;
  return { millis: spec.amount * multiplier, source: `timer(${spec.amount} ${spec.unit})` };
}

function normalizeUnit(unit: string): "ms" | "s" | "m" | null {
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

