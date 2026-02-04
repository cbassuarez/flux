import fs from "node:fs";
import path from "node:path";
import type {
  AssetBank,
  AssetDefinition,
  AssetsBlock,
  BodyBlock,
  DocumentNode,
  FluxDocument,
  FluxMeta,
  FluxParam,
  MaterialsBlock,
  NodePropValue,
  RefreshPolicy,
  TimerUnit,
} from "./ast.js";
import { computeGridLayout } from "./layout.js";
import { createRuntime, type RuntimeSnapshot } from "./runtime.js";

export type RenderValue =
  | string
  | number
  | boolean
  | null
  | RenderValue[]
  | { [key: string]: RenderValue }
  | RenderAssetRef;

export interface RenderAssetRef {
  kind: "asset";
  id: string;
  path: string;
  name: string;
  assetKind: string;
}

export interface RenderAsset {
  id: string;
  name: string;
  kind: string;
  path: string;
  tags: string[];
  weight: number;
  meta?: Record<string, RenderValue>;
  source?: {
    type: "asset" | "bank" | "material";
    name: string;
  };
}

export interface RenderGridCell {
  id: string;
  row: number;
  col: number;
  tags: string[];
  content: string | null;
  mediaId: string | null;
  dynamic: number | null;
  density: number | null;
  salience: number | null;
}

export interface RenderGridData {
  name: string;
  rows: number;
  cols: number;
  cells: RenderGridCell[];
}

export interface RenderNode {
  id: string;
  kind: string;
  props: Record<string, RenderValue>;
  children: RenderNode[];
  grid?: RenderGridData;
}

export interface RenderDocument {
  meta: FluxMeta;
  seed: number;
  time: number;
  docstep: number;
  pageConfig?: FluxDocument["pageConfig"];
  assets: RenderAsset[];
  body: RenderNode[];
}

export type SlotFitPolicy = "clip" | "ellipsis" | "shrink" | "scaleDown";

export type SlotReserve =
  | { kind: "fixed"; width: number; height: number; units: string }
  | { kind: "fixedWidth"; width: number; units: string };

export interface RenderNodeIR {
  nodeId: string;
  id: string;
  kind: string;
  props: Record<string, RenderValue>;
  children: RenderNodeIR[];
  refresh: RefreshPolicy;
  slot?: {
    reserve?: SlotReserve;
    fit?: SlotFitPolicy;
  };
  grid?: RenderGridData;
}

export interface RenderDocumentIR {
  meta: FluxMeta;
  seed: number;
  time: number;
  docstep: number;
  pageConfig?: FluxDocument["pageConfig"];
  assets: RenderAsset[];
  body: RenderNodeIR[];
}

export interface RenderOptions {
  seed?: number;
  time?: number;
  docstep?: number;
  assetCwd?: string;
  assetResolver?: AssetResolver;
}

export interface DocumentRuntime {
  readonly doc: FluxDocument;
  readonly seed: number;
  readonly time: number;
  readonly docstep: number;
  render(): RenderDocument;
  tick(seconds: number): RenderDocument;
  step(n?: number): RenderDocument;
}

export interface DocumentRuntimeIR {
  readonly doc: FluxDocument;
  readonly seed: number;
  readonly time: number;
  readonly docstep: number;
  render(): RenderDocumentIR;
  tick(seconds: number): RenderDocumentIR;
  step(n?: number): RenderDocumentIR;
}

export type AssetResolver = (bank: AssetBank, options: { cwd?: string }) => string[];

interface ResolvedAsset {
  __asset: true;
  id: string;
  name: string;
  kind: string;
  path: string;
  tags: string[];
  weight: number;
  meta?: Record<string, RenderValue>;
  source?: RenderAsset["source"];
  strategy?: AssetBank["strategy"];
}

interface EvalContext {
  params: Record<string, number | string | boolean>;
  time: number;
  docstep: number;
  rng: () => number;
  propSeed: number;
  assets: ResolvedAsset[];
}

interface NodeCacheEntry {
  refreshKey: number;
  time: number;
  docstep: number;
  props: Record<string, RenderValue>;
}

interface RenderContext {
  doc: FluxDocument;
  params: Record<string, number | string | boolean>;
  time: number;
  docstep: number;
  seed: number;
  assets: ResolvedAsset[];
  legacySnapshot: RuntimeSnapshot | null;
}

export function createDocumentRuntime(doc: FluxDocument, options: RenderOptions = {}): DocumentRuntime {
  const seed = options.seed ?? 0;
  let time = options.time ?? 0;
  let docstep = options.docstep ?? 0;
  const body = ensureBody(doc);
  const assets = buildAssetCatalog(doc, options);
  const baseParams = buildParams(doc.state.params);
  const nodeCache = new Map<string, NodeCacheEntry>();

  let legacySnapshot: RuntimeSnapshot | null = null;
  let legacySnapshotDocstep: number | null = null;

  const getLegacySnapshot = (): RuntimeSnapshot | null => {
    if (!doc.grids?.length) return null;
    if (legacySnapshot && legacySnapshotDocstep === docstep) {
      return legacySnapshot;
    }
    const runtime = createRuntime(doc, { clock: "manual" });
    let snap = runtime.snapshot();
    if (docstep > 0) {
      try {
        for (let i = 0; i < docstep; i += 1) {
          snap = runtime.step();
        }
      } catch {
        snap = runtime.snapshot();
      }
    }
    legacySnapshot = snap;
    legacySnapshotDocstep = docstep;
    return legacySnapshot;
  };

  const render = (): RenderDocument => {
    const snap = getLegacySnapshot();
    const params = snap?.params ?? baseParams;
    const ctx: RenderContext = {
      doc,
      params,
      time,
      docstep,
      seed,
      assets,
      legacySnapshot: snap,
    };

    const renderedBody = body.nodes.map((node, index) =>
      renderNode(node, ctx, nodeCache, "root", undefined, index),
    );

    return {
      meta: doc.meta,
      seed,
      time,
      docstep,
      pageConfig: doc.pageConfig,
      assets: assetsToRender(assets),
      body: renderedBody,
    };
  };

  const tick = (seconds: number): RenderDocument => {
    const delta = Number(seconds);
    if (!Number.isFinite(delta)) {
      throw new Error("tick(seconds) requires a finite number");
    }
    time += delta;
    return render();
  };

  const step = (n: number = 1): RenderDocument => {
    const amount = Number(n);
    if (!Number.isFinite(amount)) {
      throw new Error("step(n) requires a finite number");
    }
    docstep += amount;
    return render();
  };

  return {
    get doc() {
      return doc;
    },
    get seed() {
      return seed;
    },
    get time() {
      return time;
    },
    get docstep() {
      return docstep;
    },
    render,
    tick,
    step,
  };
}

export function renderDocument(doc: FluxDocument, options: RenderOptions = {}): RenderDocument {
  const runtime = createDocumentRuntime(doc, options);
  return runtime.render();
}

export function createDocumentRuntimeIR(doc: FluxDocument, options: RenderOptions = {}): DocumentRuntimeIR {
  const runtime = createDocumentRuntime(doc, options);
  const body = ensureBody(doc);

  const toIr = (rendered: RenderDocument): RenderDocumentIR => buildRenderDocumentIR(rendered, body);

  return {
    get doc() {
      return runtime.doc;
    },
    get seed() {
      return runtime.seed;
    },
    get time() {
      return runtime.time;
    },
    get docstep() {
      return runtime.docstep;
    },
    render: () => toIr(runtime.render()),
    tick: (seconds: number) => toIr(runtime.tick(seconds)),
    step: (n?: number) => toIr(runtime.step(n)),
  };
}

export function renderDocumentIR(doc: FluxDocument, options: RenderOptions = {}): RenderDocumentIR {
  const runtime = createDocumentRuntimeIR(doc, options);
  return runtime.render();
}

function ensureBody(doc: FluxDocument): BodyBlock {
  if (doc.body?.nodes?.length) {
    return doc.body;
  }
  if (!doc.grids?.length) {
    return { nodes: [] };
  }

  const pages = new Map<number, DocumentNode[]>();
  for (const grid of doc.grids) {
    const pageNumber = grid.page ?? 1;
    const node: DocumentNode = {
      id: grid.name,
      kind: "grid",
      props: {
        ref: { kind: "LiteralValue", value: grid.name },
      },
      children: [],
    };
    const list = pages.get(pageNumber) ?? [];
    list.push(node);
    pages.set(pageNumber, list);
  }

  const nodes: DocumentNode[] = [];
  const sortedPages = Array.from(pages.keys()).sort((a, b) => a - b);
  for (const pageNumber of sortedPages) {
    const pageNodes = pages.get(pageNumber) ?? [];
    nodes.push({
      id: `page${pageNumber}`,
      kind: "page",
      props: {},
      children: pageNodes,
      refresh: { kind: "onDocstep" },
    });
  }

  return { nodes };
}

function buildRenderDocumentIR(rendered: RenderDocument, body: BodyBlock): RenderDocumentIR {
  return {
    ...rendered,
    body: buildRenderNodesIR(body.nodes, rendered.body, "root", undefined),
  };
}

function buildRenderNodesIR(
  astNodes: DocumentNode[],
  renderedNodes: RenderNode[],
  parentPath: string,
  parentPolicy: RefreshPolicy | undefined,
): RenderNodeIR[] {
  const count = Math.max(astNodes.length, renderedNodes.length);
  const result: RenderNodeIR[] = [];

  for (let index = 0; index < count; index += 1) {
    const rendered = renderedNodes[index];
    const fallbackAst: DocumentNode = rendered
      ? { id: rendered.id, kind: rendered.kind, props: {}, children: [] }
      : { id: `node${index}`, kind: "node", props: {}, children: [] };
    const astNode = astNodes[index] ?? fallbackAst;
    const renderedNode: RenderNode = rendered ?? {
      id: astNode.id,
      kind: astNode.kind,
      props: {},
      children: [],
    };

    const nodePath = `${parentPath}/${astNode.kind}:${astNode.id}:${index}`;
    const effectivePolicy = astNode.refresh ?? parentPolicy ?? { kind: "onLoad" };
    const children = buildRenderNodesIR(
      astNode.children ?? [],
      renderedNode.children ?? [],
      nodePath,
      effectivePolicy,
    );

    const slot = buildSlotInfo(astNode.kind, renderedNode.props);

    result.push({
      ...renderedNode,
      nodeId: nodePath,
      refresh: effectivePolicy,
      slot,
      children,
    });
  }

  return result;
}

function buildSlotInfo(
  kind: string,
  props: Record<string, RenderValue>,
): { reserve?: SlotReserve; fit?: SlotFitPolicy } | undefined {
  if (kind !== "slot" && kind !== "inline_slot") return undefined;
  const reserve = parseSlotReserve(props.reserve);
  const fit = parseSlotFit(props.fit);
  if (!reserve && !fit) return undefined;
  return { reserve, fit };
}

function parseSlotFit(value: RenderValue | undefined): SlotFitPolicy | undefined {
  if (typeof value !== "string") return undefined;
  switch (value) {
    case "clip":
    case "ellipsis":
    case "shrink":
    case "scaleDown":
      return value;
    default:
      return undefined;
  }
}

function parseSlotReserve(value: RenderValue | undefined): SlotReserve | undefined {
  if (value == null) return undefined;
  if (typeof value === "object") {
    if (Array.isArray(value)) return parseSlotReserveArray(value);
    const maybeAsset = value as RenderAssetRef;
    if (maybeAsset.kind === "asset") return undefined;
    return parseSlotReserveObject(value as Record<string, RenderValue>);
  }
  if (typeof value === "string") {
    const fixedMatch = value.match(/^fixed\(\s*([0-9.+-]+)\s*,\s*([0-9.+-]+)\s*,\s*([^)]+)\s*\)$/i);
    if (fixedMatch) {
      const width = Number(fixedMatch[1]);
      const height = Number(fixedMatch[2]);
      const units = fixedMatch[3].trim();
      if (Number.isFinite(width) && Number.isFinite(height) && units) {
        return { kind: "fixed", width, height, units };
      }
    }
    const fixedWidthMatch = value.match(/^fixedWidth\(\s*([0-9.+-]+)\s*,\s*([^)]+)\s*\)$/i);
    if (fixedWidthMatch) {
      const width = Number(fixedWidthMatch[1]);
      const units = fixedWidthMatch[2].trim();
      if (Number.isFinite(width) && units) {
        return { kind: "fixedWidth", width, units };
      }
    }
  }
  return undefined;
}

function parseSlotReserveObject(value: Record<string, RenderValue>): SlotReserve | undefined {
  const kind = typeof value.kind === "string" ? value.kind : null;
  if (kind === "fixed") {
    const width = toFiniteNumber(value.width);
    const height = toFiniteNumber(value.height);
    const units = typeof value.units === "string" ? value.units : null;
    if (width !== null && height !== null && units) {
      return { kind: "fixed", width, height, units };
    }
  }
  if (kind === "fixedWidth") {
    const width = toFiniteNumber(value.width);
    const units = typeof value.units === "string" ? value.units : null;
    if (width !== null && units) {
      return { kind: "fixedWidth", width, units };
    }
  }
  return undefined;
}

function parseSlotReserveArray(value: RenderValue[]): SlotReserve | undefined {
  if (value.length >= 3) {
    const width = toFiniteNumber(value[0]);
    const height = toFiniteNumber(value[1]);
    const units = typeof value[2] === "string" ? value[2] : null;
    if (width !== null && height !== null && units) {
      return { kind: "fixed", width, height, units };
    }
  }
  if (value.length >= 2) {
    const width = toFiniteNumber(value[0]);
    const units = typeof value[1] === "string" ? value[1] : null;
    if (width !== null && units) {
      return { kind: "fixedWidth", width, units };
    }
  }
  return undefined;
}

function toFiniteNumber(value: RenderValue | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildParams(params: FluxParam[]): Record<string, number | string | boolean> {
  const values: Record<string, number | string | boolean> = {};
  for (const param of params ?? []) {
    values[param.name] = param.initial as number | string | boolean;
  }
  return values;
}

function renderNode(
  node: DocumentNode,
  ctx: RenderContext,
  cache: Map<string, NodeCacheEntry>,
  parentPath: string,
  parentPolicy: RefreshPolicy | undefined,
  index: number,
): RenderNode {
  const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
  const effectivePolicy = node.refresh ?? parentPolicy ?? { kind: "onLoad" };
  const refreshKey = computeRefreshKey(effectivePolicy, ctx.time, ctx.docstep);
  const cached = cache.get(nodePath);

  let props: Record<string, RenderValue>;
  let evalTime = cached?.time ?? 0;
  let evalDocstep = cached?.docstep ?? 0;

  if (!cached || cached.refreshKey !== refreshKey) {
    const ctxWindow = computeEvalWindow(effectivePolicy, ctx.time, ctx.docstep);
    evalTime = ctxWindow.time;
    evalDocstep = ctxWindow.docstep;
    props = resolveProps(node.props, {
      params: ctx.params,
      time: evalTime,
      docstep: evalDocstep,
      seed: ctx.seed,
      assets: ctx.assets,
      refreshKey,
      nodePath,
      nodeId: node.id,
      nodeKind: node.kind,
    });
    cache.set(nodePath, { refreshKey, time: evalTime, docstep: evalDocstep, props });
  } else {
    props = cached.props;
  }

  const children = node.children.map((child, childIndex) =>
    renderNode(child, ctx, cache, nodePath, effectivePolicy, childIndex),
  );

  const rendered: RenderNode = {
    id: node.id,
    kind: node.kind,
    props,
    children,
  };

  if (node.kind === "grid") {
    const gridData = resolveGridData(node, props, ctx);
    if (gridData) {
      rendered.grid = gridData;
    }
  }

  return rendered;
}

function resolveProps(
  props: Record<string, NodePropValue>,
  ctx: {
    params: Record<string, number | string | boolean>;
    time: number;
    docstep: number;
    seed: number;
    assets: ResolvedAsset[];
    refreshKey: number;
    nodePath: string;
    nodeId: string;
    nodeKind: string;
  },
): Record<string, RenderValue> {
  const resolved: Record<string, RenderValue> = {};
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (value.kind === "LiteralValue") {
      resolved[key] = toRenderValue(value.value);
      continue;
    }
    const propSeed = stableHash(ctx.seed, ctx.nodePath, key, ctx.refreshKey);
    const rng = mulberry32(propSeed);
    const evalCtx: EvalContext = {
      params: ctx.params,
      time: ctx.time,
      docstep: ctx.docstep,
      rng,
      propSeed,
      assets: ctx.assets,
    };
    try {
      const exprValue = evalExpr(value.expr, evalCtx);
      resolved[key] = toRenderValue(exprValue);
    } catch (error) {
      const detail = (error as Error)?.message ?? String(error);
      const contextParts = [
        ctx.nodeId ? `node '${ctx.nodeId}'` : "",
        ctx.nodeKind ? `kind '${ctx.nodeKind}'` : "",
        `prop '${key}'`,
      ].filter(Boolean);
      const context = contextParts.length ? ` (${contextParts.join(", ")})` : "";
      throw new Error(`${detail}${context}`);
    }
  }
  return resolved;
}

function computeEvalWindow(
  policy: RefreshPolicy,
  time: number,
  docstep: number,
): { time: number; docstep: number } {
  switch (policy.kind) {
    case "onLoad":
    case "never":
      return { time: 0, docstep: 0 };
    case "onDocstep":
      return { time, docstep };
    case "every": {
      const seconds = durationToSeconds(policy.amount, policy.unit);
      if (seconds == null || seconds <= 0) {
        throw new Error(`Unsupported refresh duration unit '${policy.unit}'`);
      }
      const bucket = Math.floor(time / seconds);
      return { time: bucket * seconds, docstep };
    }
    default: {
      const _exhaustive: never = policy;
      return _exhaustive;
    }
  }
}

function computeRefreshKey(policy: RefreshPolicy, time: number, docstep: number): number {
  switch (policy.kind) {
    case "onLoad":
    case "never":
      return 0;
    case "onDocstep":
      return docstep;
    case "every": {
      const seconds = durationToSeconds(policy.amount, policy.unit);
      if (seconds == null || seconds <= 0) {
        throw new Error(`Unsupported refresh duration unit '${policy.unit}'`);
      }
      return Math.floor(time / seconds);
    }
    default: {
      const _exhaustive: never = policy;
      return _exhaustive;
    }
  }
}

function resolveGridData(
  node: DocumentNode,
  props: Record<string, RenderValue>,
  ctx: RenderContext,
): RenderGridData | null {
  const snapshot = ctx.legacySnapshot;
  if (!snapshot) return null;

  const refValue = props.ref ?? props.name ?? props.grid ?? node.id;
  const ref = typeof refValue === "string" ? refValue : node.id;
  const layout = computeGridLayout(ctx.doc, snapshot);
  const view = layout.grids.find((grid) => grid.name === ref);
  if (!view) return null;

  return {
    name: view.name,
    rows: view.rows,
    cols: view.cols,
    cells: view.cells.map((cell) => ({
      id: cell.id,
      row: cell.row,
      col: cell.col,
      tags: [...cell.tags],
      content: cell.content ?? null,
      mediaId: cell.mediaId ?? null,
      dynamic: cell.dynamic ?? null,
      density: cell.density ?? null,
      salience: cell.salience ?? null,
    })),
  };
}

function assetsToRender(assets: ResolvedAsset[]): RenderAsset[] {
  return assets
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      path: asset.path,
      tags: [...asset.tags],
      weight: asset.weight,
      meta: asset.meta ? normalizeMeta(asset.meta) : undefined,
      source: asset.source,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeMeta(meta: Record<string, RenderValue>): Record<string, RenderValue> {
  const keys = Object.keys(meta).sort();
  const normalized: Record<string, RenderValue> = {};
  for (const key of keys) {
    normalized[key] = meta[key];
  }
  return normalized;
}

function toRenderValue(value: unknown): RenderValue {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => toRenderValue(item));
  }
  if (typeof value === "object") {
    if (isResolvedAsset(value)) {
      return {
        kind: "asset",
        id: value.id,
        path: value.path,
        name: value.name,
        assetKind: value.kind,
      };
    }
    const entries = Object.entries(value as Record<string, unknown>);
    const normalized: Record<string, RenderValue> = {};
    for (const [key, item] of entries) {
      normalized[key] = toRenderValue(item);
    }
    return normalized;
  }
  return value as RenderValue;
}

function evalExpr(expr: any, ctx: EvalContext): unknown {
  switch (expr.kind) {
    case "Literal":
      return expr.value;
    case "ListExpression":
      return expr.items.map((item: any) => evalExpr(item, ctx));
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
      throw new Error("neighbors.*() is not supported in document expressions");
    default: {
      throw new Error(`Unsupported expression kind '${expr?.kind ?? "unknown"}'`);
    }
  }
}

function evalIdentifier(name: string, ctx: EvalContext): unknown {
  if (name === "params") return ctx.params;
  if (name === "time" || name === "timeSeconds") return ctx.time;
  if (name === "docstep") return ctx.docstep;
  return ctx.params[name];
}

function evalUnary(op: string, argument: any, ctx: EvalContext): unknown {
  const value = evalExpr(argument, ctx);
  switch (op) {
    case "not":
      return !value;
    case "-":
      return -(value as number);
    default:
      throw new Error(`Unsupported unary operator '${op}'`);
  }
}

function evalBinary(op: string, left: any, right: any, ctx: EvalContext): unknown {
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
          throw new Error(`Unsupported binary operator '${op}'`);
      }
    }
  }
}

function evalMember(objectExpr: any, property: string, ctx: EvalContext): unknown {
  const obj = evalExpr(objectExpr, ctx) as any;
  if (obj == null) {
    throw new Error(`Cannot read property '${property}' of null/undefined`);
  }
  return obj[property];
}

function evalCall(expr: any, ctx: EvalContext): unknown {
  // Supported document-expression builtins:
  // choose, chooseStep, now/timeSeconds, stableHash, assets.pick
  if (expr.callee.kind === "Identifier") {
    const name = expr.callee.name;
    if (name === "choose") {
      return evalChoose(expr.args, ctx);
    }
    if (name === "chooseStep") {
      return evalChooseStep(expr.args, ctx);
    }
    if (name === "cycle") {
      return evalCycle(expr.args, ctx);
    }
    if (name === "hashpick") {
      return evalHashpick(expr.args, ctx);
    }
    if (name === "phase") {
      return evalPhase(expr.args, ctx);
    }
    if (name === "lerp") {
      return evalLerp(expr.args, ctx);
    }
    if (name === "shuffle") {
      return evalShuffle(expr.args, ctx);
    }
    if (name === "sample") {
      return evalSample(expr.args, ctx);
    }
    if (name === "now" || name === "timeSeconds") {
      return ctx.time;
    }
    if (name === "stableHash") {
      const values = evalCallArgs(expr.args, ctx);
      return stableHash(...values.positional, values.named);
    }
  }

  if (
    expr.callee.kind === "MemberExpression" &&
    expr.callee.object.kind === "Identifier" &&
    expr.callee.object.name === "assets" &&
    expr.callee.property === "pick"
  ) {
    return evalAssetsPick(expr.args, ctx);
  }

  const calleeName = describeCallee(expr.callee) ?? "unknown";
  const location = formatExprLocation(expr);
  throw new Error(
    `Unsupported function call '${calleeName}' in document expressions${location}`,
  );
}

function evalCallArgs(args: any[], ctx: EvalContext): {
  positional: unknown[];
  named: Record<string, unknown>;
} {
  const positional: unknown[] = [];
  const named: Record<string, unknown> = {};

  for (const arg of args ?? []) {
    if (arg.kind === "NamedArg") {
      named[arg.name] = evalExpr(arg.value, ctx);
    } else {
      positional.push(evalExpr(arg, ctx));
    }
  }

  return { positional, named };
}

function evalChoose(args: any[], ctx: EvalContext): unknown {
  const { positional, named } = evalCallArgs(args, ctx);
  const list = (named.list ?? positional[0]) as unknown;
  if (!Array.isArray(list)) {
    throw new Error("choose(list) expects a list");
  }
  if (list.length === 0) return null;
  const idx = Math.floor(ctx.rng() * list.length);
  return list[idx];
}

function evalChooseStep(args: any[], ctx: EvalContext): unknown {
  const { positional, named } = evalCallArgs(args, ctx);
  const list = (named.list ?? positional[0]) as unknown;
  if (!Array.isArray(list)) {
    throw new Error("chooseStep(list) expects a list");
  }
  if (list.length === 0) {
    throw new Error("chooseStep(list) expects a non-empty list");
  }
  const offsetRaw = named.offset ?? 0;
  const offset = typeof offsetRaw === "number" && Number.isFinite(offsetRaw) ? offsetRaw : 0;
  const idx = Math.abs(Math.floor(ctx.docstep + offset)) % list.length;
  return list[idx];
}

function evalCycle(args: any[], ctx: EvalContext): unknown {
  const { positional, named } = evalCallArgs(args, ctx);
  const list = (named.list ?? positional[0]) as unknown;
  if (!Array.isArray(list)) {
    throw new Error("cycle(list, index) expects a list");
  }
  if (list.length === 0) return null;
  const rawIndex = named.index ?? positional[1] ?? ctx.docstep;
  const indexValue = typeof rawIndex === "number" && Number.isFinite(rawIndex) ? rawIndex : 0;
  const idx = ((Math.floor(indexValue) % list.length) + list.length) % list.length;
  return list[idx];
}

function evalHashpick(args: any[], ctx: EvalContext): unknown {
  const { positional, named } = evalCallArgs(args, ctx);
  const list = (named.list ?? positional[0]) as unknown;
  if (!Array.isArray(list)) {
    throw new Error("hashpick(list, key) expects a list");
  }
  if (list.length === 0) return null;
  const keyRaw = named.key ?? positional[1];
  if (keyRaw == null) {
    throw new Error("hashpick(list, key) expects a key");
  }
  const hash = stableHash(String(keyRaw));
  const idx = hash % list.length;
  return list[idx];
}

function evalPhase(args: any[], ctx: EvalContext): number {
  const { positional, named } = evalCallArgs(args, ctx);
  const raw = named.value ?? positional[0] ?? ctx.docstep;
  const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  const floor = Math.floor(value);
  return value - floor;
}

function evalLerp(args: any[], ctx: EvalContext): number {
  const { positional, named } = evalCallArgs(args, ctx);
  const a = named.a ?? positional[0];
  const b = named.b ?? positional[1];
  const t = named.t ?? positional[2];
  if (![a, b, t].every((v) => typeof v === "number" && Number.isFinite(v))) {
    throw new Error("lerp(a, b, t) expects numeric arguments");
  }
  return (a as number) + ((b as number) - (a as number)) * (t as number);
}

function evalShuffle(args: any[], ctx: EvalContext): unknown[] {
  const { positional, named } = evalCallArgs(args, ctx);
  const list = (named.list ?? positional[0]) as unknown;
  if (!Array.isArray(list)) {
    throw new Error("shuffle(list) expects a list");
  }
  return shuffleList(list, ctx.rng);
}

function evalSample(args: any[], ctx: EvalContext): unknown[] {
  const { positional, named } = evalCallArgs(args, ctx);
  const list = (named.list ?? positional[0]) as unknown;
  if (!Array.isArray(list)) {
    throw new Error("sample(list, n) expects a list");
  }
  const nRaw = named.n ?? positional[1] ?? 1;
  const n = typeof nRaw === "number" && Number.isFinite(nRaw) ? Math.floor(nRaw) : 1;
  if (n <= 0) return [];
  const shuffled = shuffleList(list, ctx.rng);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

function shuffleList(list: unknown[], rng: () => number): unknown[] {
  const items = [...list];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function describeCallee(callee: any): string | null {
  if (!callee) return null;
  if (callee.kind === "Identifier") return String(callee.name);
  if (callee.kind === "MemberExpression") {
    const object = callee.object;
    const objectName = object?.kind === "Identifier" ? object.name : null;
    const property = typeof callee.property === "string" ? callee.property : null;
    if (objectName && property) {
      return `${objectName}.${property}`;
    }
  }
  return null;
}

function formatExprLocation(expr: any): string {
  const loc = expr?.location ?? expr?.loc ?? null;
  const line =
    typeof loc?.line === "number" ? loc.line : typeof expr?.line === "number" ? expr.line : null;
  const column =
    typeof loc?.column === "number"
      ? loc.column
      : typeof expr?.column === "number"
        ? expr.column
        : null;
  if (line != null && column != null) {
    return ` at ${line}:${column}`;
  }
  return "";
}

function evalAssetsPick(args: any[], ctx: EvalContext): ResolvedAsset | null {
  const { positional, named } = evalCallArgs(args, ctx);
  const rawTags = named.tags ?? positional[0];
  const rawStrategy = named.strategy ?? positional[1];
  const rawSeed = named.seed ?? positional[2];

  const tags = Array.isArray(rawTags)
    ? rawTags.map((tag) => String(tag))
    : rawTags
      ? [String(rawTags)]
      : [];

  const strategy = typeof rawStrategy === "string" ? rawStrategy : undefined;
  if (strategy && strategy !== "weighted" && strategy !== "uniform") {
    throw new Error(`Unknown asset pick strategy '${strategy}'`);
  }

  const candidates = ctx.assets.filter((asset) =>
    tags.length === 0 ? true : tags.every((tag) => asset.tags.includes(tag)),
  );

  if (candidates.length === 0) return null;

  const resolvedStrategy =
    strategy ??
    (candidates.every((asset) => asset.strategy === candidates[0].strategy)
      ? candidates[0].strategy
      : undefined) ??
    "uniform";

  const pickRng =
    rawSeed != null
      ? mulberry32(stableHash(ctx.propSeed, rawSeed, "assets.pick"))
      : ctx.rng;

  if (resolvedStrategy === "weighted") {
    const total = candidates.reduce(
      (sum, asset) => sum + (Number.isFinite(asset.weight) ? asset.weight : 1),
      0,
    );
    if (total <= 0) {
      const idx = Math.floor(pickRng() * candidates.length);
      return candidates[idx];
    }
    let roll = pickRng() * total;
    for (const asset of candidates) {
      const weight = Number.isFinite(asset.weight) ? asset.weight : 1;
      roll -= weight;
      if (roll <= 0) return asset;
    }
    return candidates[candidates.length - 1];
  }

  const idx = Math.floor(pickRng() * candidates.length);
  return candidates[idx];
}

function buildAssetCatalog(doc: FluxDocument, options: RenderOptions): ResolvedAsset[] {
  const assets: ResolvedAsset[] = [];
  const blocks = doc.assets;
  const resolver = options.assetResolver ?? defaultAssetResolver;

  if (blocks) {
    for (const asset of blocks.assets ?? []) {
      assets.push(materializeAssetDefinition(asset));
    }
    for (const bank of blocks.banks ?? []) {
      const entries = resolver(bank, { cwd: options.assetCwd });
      const root = normalizePath(bank.root);
      for (const rel of entries) {
        const relPath = normalizePath(rel);
        const fullPath = root ? `${root}/${relPath}` : relPath;
        assets.push(materializeBankAsset(bank, relPath, fullPath));
      }
    }
  }

  if (doc.materials) {
    assets.push(...materializeMaterials(doc.materials));
  }

  return assets;
}

function materializeAssetDefinition(asset: AssetDefinition): ResolvedAsset {
  const pathValue = normalizePath(asset.path);
  return {
    __asset: true,
    id: makeAssetId("asset", asset.name, asset.kind, pathValue),
    name: asset.name,
    kind: asset.kind,
    path: pathValue,
    tags: [...(asset.tags ?? [])],
    weight:
      typeof asset.weight === "number" && Number.isFinite(asset.weight)
        ? asset.weight
        : 1,
    meta: asset.meta ? normalizeMeta(toRenderValue(asset.meta) as Record<string, RenderValue>) : undefined,
    source: { type: "asset", name: asset.name },
  };
}

function materializeBankAsset(bank: AssetBank, relPath: string, fullPath: string): ResolvedAsset {
  return {
    __asset: true,
    id: makeAssetId("bank", bank.name, bank.kind, relPath),
    name: relPath,
    kind: bank.kind,
    path: fullPath,
    tags: [...(bank.tags ?? [])],
    weight: 1,
    source: { type: "bank", name: bank.name },
    strategy: bank.strategy,
  };
}

function materializeMaterials(block: MaterialsBlock): ResolvedAsset[] {
  const assets: ResolvedAsset[] = [];
  for (const material of block.materials ?? []) {
    const meta: Record<string, RenderValue> = {
      label: material.label ?? null,
      description: material.description ?? null,
      color: material.color ?? null,
    };
    if (material.score) {
      meta.score = toRenderValue(material.score) as RenderValue;
    }
    if (material.midi) {
      meta.midi = toRenderValue(material.midi) as RenderValue;
    }
    if (material.video) {
      meta.video = toRenderValue(material.video) as RenderValue;
    }
    assets.push({
      __asset: true,
      id: makeAssetId("material", material.name, "material", material.name),
      name: material.name,
      kind: "material",
      path: "",
      tags: [...(material.tags ?? [])],
      weight: 1,
      meta,
      source: { type: "material", name: material.name },
    });
  }
  return assets;
}

function defaultAssetResolver(bank: AssetBank, options: { cwd?: string }): string[] {
  const cwd = options.cwd ?? process.cwd();
  const rootAbs = path.resolve(cwd, bank.root);
  if (!fs.existsSync(rootAbs)) {
    return [];
  }
  const files = walkFiles(rootAbs);
  const matcher = globToRegExp(normalizePath(bank.include));
  const matches = files
    .map((filePath) => normalizePath(path.relative(rootAbs, filePath)))
    .filter((rel) => matcher.test(rel))
    .sort((a, b) => a.localeCompare(b));
  return matches;
}

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function globToRegExp(pattern: string): RegExp {
  let regex = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        regex += ".*";
        i += 2;
      } else {
        regex += "[^/]*";
        i += 1;
      }
      continue;
    }
    if (ch === "?") {
      regex += "[^/]";
      i += 1;
      continue;
    }
    if ("\\.^$+()[]{}|".includes(ch)) {
      regex += `\\${ch}`;
    } else {
      regex += ch;
    }
    i += 1;
  }
  regex += "$";
  return new RegExp(regex);
}

function normalizePath(value: string): string {
  if (!value) return "";
  return value.split(path.sep).join("/").replace(/\/+/g, "/").replace(/^\.\//, "");
}

function durationToSeconds(amount: number, unit: TimerUnit): number | null {
  switch (unit) {
    case "ms":
    case "millisecond":
    case "milliseconds":
      return amount / 1000;
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return amount;
    case "m":
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return amount * 60;
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return amount * 3600;
    default:
      return null;
  }
}

function isResolvedAsset(value: unknown): value is ResolvedAsset {
  return Boolean(value && typeof value === "object" && (value as any).__asset);
}

function makeAssetId(prefix: string, name: string, kind: string, pathValue: string): string {
  const hash = stableHash(prefix, name, kind, pathValue);
  return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}

function stableHash(...values: unknown[]): number {
  const serialized = values.map((value) => stableSerialize(value)).join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i += 1) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableSerialize(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "number") return `n:${String(value)}`;
  if (typeof value === "string") return `s:${value}`;
  if (typeof value === "boolean") return `b:${value}`;
  if (Array.isArray(value)) {
    return `a:[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `o:{${entries
      .map(([key, val]) => `${key}:${stableSerialize(val)}`)
      .join(",")}}`;
  }
  return `u:${String(value)}`;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
