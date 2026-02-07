import fs from "node:fs";
import path from "node:path";
import type {
  AssetBank,
  AssetDefinition,
  AssetsBlock,
  BodyBlock,
  DocumentNode,
  FluxDocument,
  FluxExpr,
  FluxMeta,
  FluxParam,
  FluxValueLiteral,
  MaterialsBlock,
  NodePropValue,
  RefreshPolicy,
  TransitionSpec,
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
  style?: RenderNodeStyle;
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
  style?: RenderNodeStyle;
  counters?: RenderNodeCounters;
}

export interface RenderNodeCounters {
  section?: string;
  figure?: number;
  table?: number;
  footnote?: number;
  label?: string;
  ref?: string;
}

export interface RenderStyleDefinition {
  name: string;
  className: string;
  props: Record<string, RenderValue>;
}

export interface RenderNodeStyle {
  name?: string;
  role?: string;
  className?: string;
  inline?: Record<string, RenderValue>;
}

export interface RefreshEventMeta {
  nextTime?: number;
  firedAt?: number;
  bucket?: number;
}

export interface NormalizedTransitionSpec {
  type: "none" | "appear" | "fade" | "wipe" | "flash";
  durationMs: number;
  ease: string;
  direction?: string;
}

export interface SlotPresentation {
  valueHash: string;
  shouldRefresh: boolean;
  transition: NormalizedTransitionSpec;
  eventMeta?: RefreshEventMeta;
}

export interface RenderDocumentIR {
  meta: FluxMeta;
  seed: number;
  time: number;
  docstep: number;
  pageConfig?: FluxDocument["pageConfig"];
  assets: RenderAsset[];
  body: RenderNodeIR[];
  theme?: string;
  styles?: RenderStyleDefinition[];
  slotMeta?: Record<string, SlotPresentation>;
}

export interface RenderOptions {
  seed?: number;
  time?: number;
  docstep?: number;
  assetCwd?: string;
  assetResolver?: AssetResolver;
}

interface StyleSpec {
  name: string;
  className: string;
  props: Record<string, NodePropValue>;
  staticProps: Record<string, RenderValue>;
  dynamicProps: Record<string, FluxExpr>;
  axesSafe: boolean;
}

interface StyleRegistry {
  theme: string;
  tokens: Record<string, RenderValue>;
  tokenFlat: Record<string, FluxValueLiteral>;
  styles: Map<string, StyleSpec>;
  renderStyles: RenderStyleDefinition[];
}

interface VisibilityContext {
  params: Record<string, number | string | boolean>;
  meta: FluxMeta;
  tokens: Record<string, RenderValue>;
  seed: number;
}

interface CounterRegistry {
  refs: Map<string, string>;
  countersByNodePath: Map<string, RenderNodeCounters>;
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
  meta: FluxMeta;
  tokens: Record<string, RenderValue>;
  refs: Map<string, string>;
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
  styleRegistry: StyleRegistry;
  counterRegistry: CounterRegistry;
}

export function createDocumentRuntime(doc: FluxDocument, options: RenderOptions = {}): DocumentRuntime {
  const seed = options.seed ?? 0;
  let time = options.time ?? 0;
  let docstep = options.docstep ?? 0;
  const baseBody = ensureBody(doc);
  const assets = buildAssetCatalog(doc, options);
  const baseParams = buildParams(doc.state.params);
  const styleRegistry = buildStyleRegistry(doc);
  const body = applyVisibility(baseBody, {
    params: baseParams,
    meta: doc.meta,
    tokens: styleRegistry.tokens,
    seed,
  });
  const counterRegistry = buildCounterRegistry(body);
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
      styleRegistry,
      counterRegistry,
    };

    const renderedBody = body.nodes.map((node, index) =>
      renderNode(node, ctx, nodeCache, "root", undefined, undefined, index, false),
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
  const baseBody = ensureBody(doc);
  const styleRegistry = buildStyleRegistry(doc);
  const baseParams = buildParams(doc.state.params);
  const body = applyVisibility(baseBody, {
    params: baseParams,
    meta: doc.meta,
    tokens: styleRegistry.tokens,
    seed: options.seed ?? 0,
  });
  const counterRegistry = buildCounterRegistry(body);

  const toIr = (rendered: RenderDocument): RenderDocumentIR =>
    buildRenderDocumentIR(rendered, body, styleRegistry, counterRegistry);

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
      refresh: { kind: "docstep" },
    });
  }

  return { nodes };
}

function buildRenderDocumentIR(
  rendered: RenderDocument,
  body: BodyBlock,
  styleRegistry: StyleRegistry,
  counterRegistry: CounterRegistry,
): RenderDocumentIR {
  const slotMeta: Record<string, SlotPresentation> = {};
  return {
    ...rendered,
    body: buildRenderNodesIR(
      body.nodes,
      rendered.body,
      "root",
      undefined,
      counterRegistry,
      slotMeta,
      { seed: rendered.seed, time: rendered.time, docstep: rendered.docstep },
    ),
    theme: styleRegistry.theme,
    styles: styleRegistry.renderStyles,
    slotMeta,
  };
}

function buildRenderNodesIR(
  astNodes: DocumentNode[],
  renderedNodes: RenderNode[],
  parentPath: string,
  parentPolicy: RefreshPolicy | undefined,
  counterRegistry: CounterRegistry,
  slotMeta: Record<string, SlotPresentation>,
  presentationCtx: { seed: number; time: number; docstep: number },
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
    const isSlot = astNode.kind === "slot" || astNode.kind === "inline_slot";
    const effectivePolicy = isSlot ? astNode.refresh ?? { kind: "never" } : astNode.refresh ?? parentPolicy ?? { kind: "never" };
    const children = buildRenderNodesIR(
      astNode.children ?? [],
      renderedNode.children ?? [],
      nodePath,
      effectivePolicy,
      counterRegistry,
      slotMeta,
      presentationCtx,
    );

    const slot = buildSlotInfo(astNode.kind, renderedNode.props);
    if (isSlot) {
      const transition = normalizeTransitionSpec(astNode.transition);
      const trigger = didFire(effectivePolicy, {
        seed: presentationCtx.seed,
        slotId: nodePath,
        timeSec: presentationCtx.time,
        docstep: presentationCtx.docstep,
      });
      slotMeta[nodePath] = {
        valueHash: computeSlotValueHash(renderedNode),
        shouldRefresh: trigger.fired,
        transition,
        eventMeta: trigger.meta,
      };
    }

    result.push({
      ...renderedNode,
      nodeId: nodePath,
      refresh: effectivePolicy,
      slot,
      children,
      style: renderedNode.style,
      counters: counterRegistry.countersByNodePath.get(nodePath),
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

function normalizeTransitionSpec(spec?: TransitionSpec): NormalizedTransitionSpec {
  if (!spec || spec.kind === "none") {
    return { type: "none", durationMs: 0, ease: "linear" };
  }
  switch (spec.kind) {
    case "appear":
      return { type: "appear", durationMs: 0, ease: "linear" };
    case "fade":
      return {
        type: "fade",
        durationMs: Math.max(0, spec.durationMs ?? 220),
        ease: spec.ease ?? "inOut",
      };
    case "wipe":
      return {
        type: "wipe",
        durationMs: Math.max(0, spec.durationMs ?? 260),
        ease: spec.ease ?? "inOut",
        direction: spec.direction ?? "left",
      };
    case "flash":
      return {
        type: "flash",
        durationMs: Math.max(0, spec.durationMs ?? 120),
        ease: "linear",
      };
    default: {
      const _exhaustive: never = spec;
      return _exhaustive;
    }
  }
}

function computeSlotValueHash(slotNode: RenderNode): string {
  const signature = slotNode.children.map((child) => buildValueSignature(child));
  const hash = stableHash("slot", signature);
  return hash.toString(16).padStart(8, "0");
}

function buildValueSignature(node: RenderNode): unknown {
  return {
    kind: node.kind,
    props: node.props,
    children: (node.children ?? []).map((child) => buildValueSignature(child)),
    grid: node.grid ?? undefined,
  };
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
  parentRefreshOwnerId: string | undefined,
  index: number,
  insideSlot: boolean,
): RenderNode {
  const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
  const isSlot = node.kind === "slot" || node.kind === "inline_slot";
  const effectivePolicy = isSlot ? node.refresh ?? { kind: "never" } : node.refresh ?? parentPolicy ?? { kind: "never" };
  const refreshOwnerId = isSlot ? nodePath : parentRefreshOwnerId ?? nodePath;
  const cached = cache.get(nodePath);
  const refreshState = computeRefreshState(
    effectivePolicy,
    { seed: ctx.seed, time: ctx.time, docstep: ctx.docstep, refreshOwnerId },
    cached,
  );
  const refreshKey = refreshState.refreshKey;

  let props: Record<string, RenderValue>;
  let evalTime = cached?.time ?? 0;
  let evalDocstep = cached?.docstep ?? 0;

  if (!cached || cached.refreshKey !== refreshKey) {
    evalTime = refreshState.evalTime;
    evalDocstep = refreshState.evalDocstep;
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
      meta: ctx.doc.meta,
      tokens: ctx.styleRegistry.tokens,
      refs: ctx.counterRegistry.refs,
    });
    cache.set(nodePath, { refreshKey, time: evalTime, docstep: evalDocstep, props });
  } else {
    props = cached.props;
  }

  const nextInsideSlot = insideSlot || isSlot;
  const children = node.children.map((child, childIndex) =>
    renderNode(child, ctx, cache, nodePath, effectivePolicy, refreshOwnerId, childIndex, nextInsideSlot),
  );

  const style = resolveNodeStyle(
    node,
    props,
    ctx,
    {
      time: evalTime,
      docstep: evalDocstep,
      refreshKey,
      nodePath,
      nodeId: node.id,
      nodeKind: node.kind,
    },
    insideSlot,
  );

  const rendered: RenderNode = {
    id: node.id,
    kind: node.kind,
    props,
    children,
  };
  if (style) {
    rendered.style = style;
  }

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
    meta: FluxMeta;
    tokens: Record<string, RenderValue>;
    refs: Map<string, string>;
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
      meta: ctx.meta,
      tokens: ctx.tokens,
      refs: ctx.refs,
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

const DEFAULT_TOKENS: Record<string, FluxValueLiteral> = {
  "font.serif": '"Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif',
  "font.sans": '"Inter", "Helvetica Neue", Arial, sans-serif',
  "font.mono": '"Source Code Pro", "Courier New", monospace',
  "space.xs": 2,
  "space.s": 4,
  "space.m": 8,
  "space.l": 12,
  "space.xl": 18,
  "color.text": "#1d1b17",
  "color.muted": "#6b645a",
  "color.link": "#2b4c7e",
  "color.rule": "#d1c8bb",
  "color.calloutBg": "#f6f1e8",
  "color.calloutBorder": "#d9d0c4",
  "rule.thin": 1,
};

function buildStyleRegistry(doc: FluxDocument): StyleRegistry {
  const theme = resolveThemeName(doc);
  const themeBlock = doc.themes?.find((t) => t.name === theme);

  const tokenFlat: Record<string, FluxValueLiteral> = {
    ...DEFAULT_TOKENS,
    ...(doc.tokens?.tokens ?? {}),
    ...(themeBlock?.tokens?.tokens ?? {}),
  };

  const tokens = buildTokenTree(tokenFlat);

  const baseStyles = buildDefaultStyles(tokenFlat);
  const docStyles = doc.styles?.styles ?? [];
  const themeStyles = themeBlock?.styles?.styles ?? [];
  const mergedStyles = mergeStyleInputs(baseStyles, docStyles, themeStyles);
  const styles = resolveStyleSpecs(mergedStyles, tokens);

  const renderStyles: RenderStyleDefinition[] = Array.from(styles.values()).map((style) => ({
    name: style.name,
    className: style.className,
    props: style.staticProps,
  }));

  return {
    theme,
    tokens,
    tokenFlat,
    styles,
    renderStyles,
  };
}

function resolveThemeName(doc: FluxDocument): string {
  const target = typeof doc.meta?.target === "string" ? doc.meta.target : null;
  if (target) return target;
  return "screen";
}

function applyVisibility(body: BodyBlock, ctx: VisibilityContext): BodyBlock {
  return { nodes: filterVisibleNodes(body.nodes, ctx, "root") };
}

function filterVisibleNodes(
  nodes: DocumentNode[],
  ctx: VisibilityContext,
  parentPath: string,
): DocumentNode[] {
  const result: DocumentNode[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
    const visible = evaluateVisibleIf(node, ctx, nodePath);
    if (!visible) continue;
    const children = node.children?.length
      ? filterVisibleNodes(node.children, ctx, nodePath)
      : [];
    result.push({ ...node, children });
  }
  return result;
}

function evaluateVisibleIf(node: DocumentNode, ctx: VisibilityContext, nodePath: string): boolean {
  const visibleProp = node.props?.visibleIf;
  if (!visibleProp) return true;
  if (visibleProp.kind === "LiteralValue") {
    return Boolean(visibleProp.value);
  }
  const propSeed = stableHash(ctx.seed, nodePath, "visibleIf");
  const rng = mulberry32(propSeed);
  const evalCtx: EvalContext = {
    params: ctx.params,
    time: 0,
    docstep: 0,
    rng,
    propSeed,
    assets: [],
    meta: ctx.meta,
    tokens: ctx.tokens,
    refs: new Map(),
  };
  const value = evalExpr(visibleProp.expr, evalCtx);
  return Boolean(value);
}

function buildCounterRegistry(body: BodyBlock): CounterRegistry {
  const refs = new Map<string, string>();
  const countersByNodePath = new Map<string, RenderNodeCounters>();
  let figureCount = 0;
  let tableCount = 0;
  let footnoteCount = 0;
  const sectionCounters: number[] = [];

  const visit = (node: DocumentNode, parentPath: string, index: number): void => {
    const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
    const counters: RenderNodeCounters = {};

    const headingLevel = getHeadingLevel(node);
    if (headingLevel != null) {
      while (sectionCounters.length < headingLevel) sectionCounters.push(0);
      sectionCounters.length = headingLevel;
      sectionCounters[headingLevel - 1] += 1;
      const sectionNumber = sectionCounters.join(".");
      counters.section = sectionNumber;
    }

    if (node.kind === "figure") {
      figureCount += 1;
      counters.figure = figureCount;
    }
    if (node.kind === "table") {
      tableCount += 1;
      counters.table = tableCount;
    }
    if (node.kind === "footnote") {
      footnoteCount += 1;
      counters.footnote = footnoteCount;
    }

    const label = getLiteralString(node.props?.label);
    if (label) {
      counters.label = label;
      const refText = formatRefText(node, counters);
      counters.ref = refText;
      refs.set(label, refText);
    }

    if (Object.keys(counters).length) {
      countersByNodePath.set(nodePath, counters);
    }

    node.children?.forEach((child, childIndex) => visit(child, nodePath, childIndex));
  };

  body.nodes.forEach((node, index) => visit(node, "root", index));

  return { refs, countersByNodePath };
}

function getHeadingLevel(node: DocumentNode): number | null {
  if (node.kind !== "text") return null;
  const explicit = getLiteralNumber(node.props?.level);
  if (explicit != null && explicit >= 1) return explicit;
  const style = getLiteralString(node.props?.style);
  if (style === "H1") return 1;
  if (style === "H2") return 2;
  const variant = getLiteralString(node.props?.variant);
  if (variant === "heading") return 1;
  return null;
}

function getLiteralString(value: NodePropValue | undefined): string | null {
  if (!value || value.kind !== "LiteralValue") return null;
  return typeof value.value === "string" ? value.value : null;
}

function getLiteralNumber(value: NodePropValue | undefined): number | null {
  if (!value || value.kind !== "LiteralValue") return null;
  return typeof value.value === "number" && Number.isFinite(value.value) ? value.value : null;
}

function formatRefText(node: DocumentNode, counters: RenderNodeCounters): string {
  if (counters.section) return `§${counters.section}`;
  if (counters.figure != null) return `Figure ${counters.figure}`;
  if (counters.table != null) return `Table ${counters.table}`;
  if (counters.footnote != null) return `Footnote ${counters.footnote}`;
  return counters.label ?? "";
}

function buildTokenTree(tokens: Record<string, FluxValueLiteral>): Record<string, RenderValue> {
  const root: Record<string, any> = {};
  for (const [key, value] of Object.entries(tokens)) {
    const parts = key.split(".");
    let cursor = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (i === parts.length - 1) {
        cursor[part] = value;
      } else {
        if (!cursor[part] || typeof cursor[part] !== "object") {
          cursor[part] = {};
        }
        cursor = cursor[part];
      }
    }
  }
  return root as Record<string, RenderValue>;
}

function buildDefaultStyles(tokens: Record<string, FluxValueLiteral>): StyleInput[] {
  const t = (key: string): FluxValueLiteral => tokens[key] ?? DEFAULT_TOKENS[key] ?? "";
  const lit = (value: FluxValueLiteral | FluxValueLiteral[]): NodePropValue => ({
    kind: "LiteralValue",
    value,
  });

  return [
    {
      name: "Body",
      props: {
        "font.family": lit(t("font.serif")),
        "font.size": lit(10.8),
        "line.height": lit(1.45),
        color: lit(t("color.text")),
        "space.after": lit(t("space.m")),
      },
    },
    {
      name: "H1",
      extends: "Body",
      props: {
        "font.size": lit(16.5),
        "font.weight": lit(600),
        "space.before": lit(t("space.l")),
        "space.after": lit(t("space.s")),
      },
    },
    {
      name: "H2",
      extends: "Body",
      props: {
        "font.size": lit(13),
        "font.weight": lit(600),
        "space.before": lit(t("space.m")),
        "space.after": lit(t("space.s")),
      },
    },
    {
      name: "Title",
      extends: "H1",
      props: {
        "font.size": lit(26),
        "letter.spacing": lit("0.02em"),
        "space.after": lit(t("space.s")),
      },
    },
    {
      name: "Subtitle",
      extends: "Body",
      props: {
        "font.size": lit(12.5),
        color: lit(t("color.muted")),
        "space.after": lit(t("space.m")),
      },
    },
    {
      name: "Byline",
      extends: "Body",
      props: {
        "font.size": lit(9.5),
        "letter.spacing": lit("0.08em"),
        "text.transform": lit("uppercase"),
        color: lit(t("color.muted")),
      },
    },
    {
      name: "Abstract",
      extends: "Body",
      props: {
        color: lit(t("color.muted")),
      },
    },
    {
      name: "Keywords",
      extends: "Body",
      props: {
        "font.size": lit(9),
        "letter.spacing": lit("0.06em"),
        "text.transform": lit("uppercase"),
        color: lit(t("color.muted")),
      },
    },
    {
      name: "Caption",
      extends: "Body",
      props: {
        "font.size": lit(9.5),
        color: lit(t("color.muted")),
        "space.before": lit(t("space.s")),
        "space.after": lit(t("space.xs")),
      },
    },
    {
      name: "Credit",
      extends: "Body",
      props: {
        "font.size": lit(8.5),
        color: lit(t("color.muted")),
      },
    },
    {
      name: "Code",
      extends: "Body",
      props: {
        "font.family": lit(t("font.mono")),
        "font.size": lit(9.5),
        background: lit("#f4f0e9"),
        padding: lit(t("space.s")),
        "border.radius": lit(4),
      },
    },
    {
      name: "Quote",
      extends: "Body",
      props: {
        "font.style": lit("italic"),
        color: lit(t("color.muted")),
        "space.before": lit(t("space.s")),
        "space.after": lit(t("space.s")),
      },
    },
    {
      name: "Callout",
      extends: "Body",
      props: {
        background: lit(t("color.calloutBg")),
        border: lit(`1pt solid ${t("color.calloutBorder")}`),
        padding: lit(t("space.m")),
        "border.radius": lit(6),
        "space.before": lit(t("space.m")),
        "space.after": lit(t("space.m")),
      },
    },
    // Legacy variant aliases
    {
      name: "Label",
      extends: "Body",
      props: {
        "font.size": lit(8.5),
        "text.transform": lit("uppercase"),
        "letter.spacing": lit("0.14em"),
        color: lit(t("color.muted")),
      },
    },
    {
      name: "Edition",
      extends: "Body",
      props: {
        "font.size": lit(9.5),
        "letter.spacing": lit("0.08em"),
        "text.transform": lit("uppercase"),
        color: lit(t("color.muted")),
      },
    },
    {
      name: "Note",
      extends: "Body",
      props: {
        "font.size": lit(8.5),
        color: lit(t("color.muted")),
      },
    },
    {
      name: "Sample",
      extends: "Body",
      props: {
        "font.size": lit(10),
        "letter.spacing": lit("0.08em"),
      },
    },
    {
      name: "List",
      extends: "Body",
      props: {
        "space.after": lit(t("space.s")),
      },
    },
    {
      name: "End",
      extends: "Body",
      props: {
        "font.size": lit(10),
        "text.align": lit("right"),
        "space.before": lit(t("space.m")),
      },
    },
  ];
}

interface StyleInput {
  name: string;
  extends?: string;
  props: Record<string, NodePropValue>;
}

function mergeStyleInputs(...styleLists: StyleInput[][]): Map<string, StyleInput> {
  const map = new Map<string, StyleInput>();
  for (const list of styleLists) {
    for (const style of list) {
      const existing = map.get(style.name);
      if (!existing) {
        map.set(style.name, { ...style, props: { ...style.props } });
        continue;
      }
      map.set(style.name, {
        name: style.name,
        extends: style.extends ?? existing.extends,
        props: { ...existing.props, ...style.props },
      });
    }
  }
  return map;
}

function resolveTokenExpr(expr: FluxExpr, tokens: Record<string, RenderValue>): RenderValue | null {
  if (!exprUsesOnlyTokens(expr)) return null;
  const propSeed = stableHash("style.tokens");
  const rng = mulberry32(propSeed);
  const evalCtx: EvalContext = {
    params: {},
    time: 0,
    docstep: 0,
    rng,
    propSeed,
    assets: [],
    meta: { version: "0.0.0" },
    tokens,
    refs: new Map(),
  };
  const value = evalExpr(expr, evalCtx);
  return toRenderValue(value);
}

function exprUsesOnlyTokens(expr: FluxExpr): boolean {
  let ok = true;
  const visit = (node: FluxExpr): void => {
    if (!ok) return;
    switch (node.kind) {
      case "Literal":
        return;
      case "Identifier":
        if (node.name !== "tokens") ok = false;
        return;
      case "ListExpression":
        node.items.forEach(visit);
        return;
      case "UnaryExpression":
        visit(node.argument);
        return;
      case "BinaryExpression":
        visit(node.left);
        visit(node.right);
        return;
      case "MemberExpression":
        visit(node.object);
        return;
      case "CallExpression":
      case "NeighborsCallExpression":
      default:
        ok = false;
        return;
    }
  };
  visit(expr);
  return ok;
}

function resolveStyleSpecs(
  styleMap: Map<string, StyleInput>,
  tokens: Record<string, RenderValue>,
): Map<string, StyleSpec> {
  const resolved = new Map<string, StyleSpec>();
  const visiting = new Set<string>();

  const resolve = (name: string): StyleSpec => {
    const cached = resolved.get(name);
    if (cached) return cached;
    if (visiting.has(name)) {
      throw new Error(`Style inheritance cycle detected at '${name}'`);
    }
    visiting.add(name);
    const input = styleMap.get(name);
    const baseName = input?.extends;
    const baseProps = baseName ? resolve(baseName).props : {};
    const mergedProps = { ...baseProps, ...(input?.props ?? {}) };
    const dynamicProps: Record<string, FluxExpr> = {};
    const staticProps: Record<string, RenderValue> = {};
    let axesSafe = false;
    for (const [key, value] of Object.entries(mergedProps)) {
      if (key === "font.axes.safe") {
        if (value.kind === "LiteralValue" && value.value === true) {
          axesSafe = true;
        }
        continue;
      }
      if (value.kind === "LiteralValue") {
        staticProps[key] = toRenderValue(value.value);
      } else {
        const tokenStatic = resolveTokenExpr(value.expr, tokens);
        if (tokenStatic !== null) {
          staticProps[key] = tokenStatic;
        } else {
          dynamicProps[key] = value.expr;
        }
      }
    }
    const spec: StyleSpec = {
      name,
      className: makeStyleClassName(name),
      props: mergedProps,
      staticProps,
      dynamicProps,
      axesSafe,
    };
    visiting.delete(name);
    resolved.set(name, spec);
    return spec;
  };

  for (const name of styleMap.keys()) {
    resolve(name);
  }

  return resolved;
}

function makeStyleClassName(name: string): string {
  return `flux-style-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

const ROLE_STYLE_MAP: Record<string, string> = {
  title: "Title",
  subtitle: "Subtitle",
  caption: "Caption",
  credit: "Credit",
  abstract: "Abstract",
  keywords: "Keywords",
  byline: "Byline",
};

const VARIANT_STYLE_MAP: Record<string, string> = {
  title: "Title",
  subtitle: "Subtitle",
  heading: "H2",
  caption: "Caption",
  credit: "Credit",
  label: "Label",
  edition: "Edition",
  note: "Note",
  sample: "Sample",
  list: "List",
  end: "End",
};

const KIND_STYLE_MAP: Record<string, string> = {
  text: "Body",
  blockquote: "Quote",
  codeblock: "Code",
  callout: "Callout",
};

function resolveNodeStyle(
  node: DocumentNode,
  resolvedProps: Record<string, RenderValue>,
  ctx: RenderContext,
  evalMeta: {
    time: number;
    docstep: number;
    refreshKey: number;
    nodePath: string;
    nodeId: string;
    nodeKind: string;
  },
  insideSlot: boolean,
): RenderNodeStyle | undefined {
  const roleRaw = resolveRenderString(resolvedProps.role);
  const styleRaw = resolveRenderString(resolvedProps.style);
  const variantRaw = resolveRenderString(resolvedProps.variant);

  let name: string | undefined;
  let role: string | undefined;

  if (styleRaw) {
    name = styleRaw;
  } else if (roleRaw) {
    role = roleRaw;
    name = ROLE_STYLE_MAP[roleRaw] ?? roleRaw;
  } else if (variantRaw) {
    name = VARIANT_STYLE_MAP[variantRaw] ?? variantRaw;
  } else if (KIND_STYLE_MAP[node.kind]) {
    name = KIND_STYLE_MAP[node.kind];
  }

  if (!name) return undefined;

  const spec = ctx.styleRegistry.styles.get(name);
  const className = spec?.className ?? makeStyleClassName(name);
  const inline: Record<string, RenderValue> = {};

  if (spec) {
    for (const [key, expr] of Object.entries(spec.dynamicProps)) {
      if (isLayoutSensitiveStyleKey(key)) {
        const axesAllowed =
          key.startsWith("font.axes.") &&
          ctx.styleRegistry.theme === "screen" &&
          spec.axesSafe;
        if (!insideSlot && !axesAllowed) {
          throw new Error(
            `Dynamic style '${spec.name}.${key}' must be inside a slot or marked axes-safe for screen`,
          );
        }
      }
      const propSeed = stableHash(ctx.seed, evalMeta.nodePath, "style", spec.name, key, evalMeta.refreshKey);
      const rng = mulberry32(propSeed);
      const evalCtx: EvalContext = {
        params: ctx.params,
        time: evalMeta.time,
        docstep: evalMeta.docstep,
        rng,
        propSeed,
        assets: ctx.assets,
        meta: ctx.doc.meta,
        tokens: ctx.styleRegistry.tokens,
        refs: ctx.counterRegistry.refs,
      };
      const value = evalExpr(expr, evalCtx);
      inline[key] = toRenderValue(value);
    }
  }

  const style: RenderNodeStyle = { name, role, className };
  if (Object.keys(inline).length > 0) {
    style.inline = inline;
  }
  return style;
}

function resolveRenderString(value: RenderValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => resolveRenderString(item as RenderValue)).join(" ");
  if (typeof value === "object") {
    if ((value as RenderAssetRef).kind === "asset") {
      return (value as RenderAssetRef).name ?? "";
    }
  }
  return "";
}

function isLayoutSensitiveStyleKey(key: string): boolean {
  if (key.startsWith("font.axes.")) return true;
  switch (key) {
    case "font.family":
    case "font.size":
    case "font.weight":
    case "font.style":
    case "line.height":
    case "letter.spacing":
    case "space.before":
    case "space.after":
    case "space.indent":
      return true;
    default:
      return false;
  }
}

// Deterministic time buckets (avoid tick-rate dependence).
const AT_BUCKET_SEC = 0.1;
const POISSON_BUCKET_SEC = 0.25;

export function didFire(
  policy: RefreshPolicy,
  ctx: { seed: number; slotId: string; timeSec: number; docstep: number },
): { fired: boolean; meta?: RefreshEventMeta } {
  switch (policy.kind) {
    case "never":
      return { fired: false };
    case "docstep":
      return { fired: true, meta: { bucket: ctx.docstep, firedAt: ctx.timeSec } };
    case "every": {
      if (policy.intervalSec <= 0) return { fired: false };
      if (ctx.timeSec < policy.phaseSec) {
        return { fired: false, meta: { nextTime: policy.phaseSec } };
      }
      const bucket = Math.floor((ctx.timeSec - policy.phaseSec) / policy.intervalSec);
      const firedAt = policy.phaseSec + bucket * policy.intervalSec;
      return {
        fired: true,
        meta: { bucket, firedAt, nextTime: firedAt + policy.intervalSec },
      };
    }
    case "at": {
      const bucket = Math.floor(ctx.timeSec / AT_BUCKET_SEC);
      const targetBucket = Math.floor(policy.timeSec / AT_BUCKET_SEC);
      return {
        fired: bucket === targetBucket,
        meta: { bucket: targetBucket, firedAt: policy.timeSec },
      };
    }
    case "atEach": {
      const bucket = Math.floor(ctx.timeSec / AT_BUCKET_SEC);
      let firedAt: number | undefined;
      let nextTime: number | undefined;
      for (const t of policy.timesSec ?? []) {
        const tBucket = Math.floor(t / AT_BUCKET_SEC);
        if (tBucket === bucket) {
          firedAt = firedAt ?? t;
        } else if (t > ctx.timeSec && nextTime == null) {
          nextTime = t;
        }
      }
      if (firedAt == null) {
        return { fired: false, meta: nextTime != null ? { nextTime } : undefined };
      }
      return { fired: true, meta: { bucket, firedAt, nextTime } };
    }
    case "poisson": {
      const bucket = Math.floor(ctx.timeSec / POISSON_BUCKET_SEC);
      const firedAt = bucket * POISSON_BUCKET_SEC;
      const rate = Math.max(0, policy.ratePerSec);
      const p = 1 - Math.exp(-rate * POISSON_BUCKET_SEC);
      const fired = rand01(ctx.seed, ctx.slotId, `poisson:${bucket}`) < p;
      return { fired, meta: fired ? { bucket, firedAt } : undefined };
    }
    case "chance": {
      const p = Math.max(0, Math.min(1, policy.p));
      if (policy.every.kind === "docstep") {
        const bucket = ctx.docstep;
        const fired = rand01(ctx.seed, ctx.slotId, `chance:docstep:${bucket}`) < p;
        return { fired, meta: fired ? { bucket, firedAt: ctx.timeSec } : undefined };
      }
      const bucket = Math.floor(ctx.timeSec / policy.every.intervalSec);
      const firedAt = bucket * policy.every.intervalSec;
      const fired = rand01(ctx.seed, ctx.slotId, `chance:${bucket}`) < p;
      return { fired, meta: fired ? { bucket, firedAt } : undefined };
    }
    default: {
      const _exhaustive: never = policy;
      return _exhaustive;
    }
  }
}

function computeRefreshState(
  policy: RefreshPolicy,
  ctx: { seed: number; time: number; docstep: number; refreshOwnerId: string },
  cached: NodeCacheEntry | undefined,
): {
  refreshKey: number;
  evalTime: number;
  evalDocstep: number;
  shouldRefresh: boolean;
  eventMeta?: RefreshEventMeta;
} {
  const trigger = didFire(policy, {
    seed: ctx.seed,
    slotId: ctx.refreshOwnerId,
    timeSec: ctx.time,
    docstep: ctx.docstep,
  });
  const shouldRefresh = trigger.fired;
  let refreshKey = cached?.refreshKey ?? 0;
  let evalTime = cached?.time ?? ctx.time;
  let evalDocstep = cached?.docstep ?? ctx.docstep;

  switch (policy.kind) {
    case "never": {
      refreshKey = 0;
      if (!cached) {
        evalTime = ctx.time;
        evalDocstep = ctx.docstep;
      }
      break;
    }
    case "docstep": {
      refreshKey = ctx.docstep;
      evalTime = ctx.time;
      evalDocstep = ctx.docstep;
      break;
    }
    case "every": {
      if (ctx.time < policy.phaseSec) {
        if (!cached) {
          evalTime = ctx.time;
          evalDocstep = ctx.docstep;
        }
        break;
      }
      const bucket = Math.floor((ctx.time - policy.phaseSec) / policy.intervalSec);
      refreshKey = bucket;
      evalTime = policy.phaseSec + bucket * policy.intervalSec;
      evalDocstep = ctx.docstep;
      break;
    }
    case "at": {
      if (trigger.fired) {
        refreshKey = trigger.meta?.bucket ?? refreshKey;
        evalTime = policy.timeSec;
        evalDocstep = ctx.docstep;
      } else if (!cached) {
        evalTime = ctx.time;
        evalDocstep = ctx.docstep;
      }
      break;
    }
    case "atEach": {
      if (trigger.fired) {
        refreshKey = trigger.meta?.bucket ?? refreshKey;
        evalTime = trigger.meta?.firedAt ?? ctx.time;
        evalDocstep = ctx.docstep;
      } else if (!cached) {
        evalTime = ctx.time;
        evalDocstep = ctx.docstep;
      }
      break;
    }
    case "poisson":
    case "chance": {
      if (trigger.fired) {
        refreshKey = trigger.meta?.bucket ?? refreshKey;
        evalTime = trigger.meta?.firedAt ?? ctx.time;
        evalDocstep = ctx.docstep;
      } else if (!cached) {
        evalTime = ctx.time;
        evalDocstep = ctx.docstep;
      }
      break;
    }
    default: {
      const _exhaustive: never = policy;
      return _exhaustive;
    }
  }

  return { refreshKey, evalTime, evalDocstep, shouldRefresh, eventMeta: trigger.meta };
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
  if (name === "meta") return ctx.meta;
  if (name === "tokens") return ctx.tokens;
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
    if (name === "ref") {
      return evalRef(expr.args, ctx);
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
    (expr.callee.property === "pick" || expr.callee.property === "shuffle")
  ) {
    if (expr.callee.property === "shuffle") {
      return evalAssetsShuffle(expr.args, ctx);
    }
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

function resolveListArgument(
  positional: unknown[],
  named: Record<string, unknown>,
  fnName: string,
): { list: unknown[]; usedVariadic: boolean } {
  if (named.list !== undefined) {
    if (!Array.isArray(named.list)) {
      throw new Error(`${fnName}(list) expects a list`);
    }
    return { list: named.list, usedVariadic: false };
  }
  if (Array.isArray(positional[0])) {
    return { list: positional[0], usedVariadic: false };
  }
  if (positional.length > 1) {
    return { list: positional, usedVariadic: true };
  }
  throw new Error(`${fnName}(list) expects a list`);
}

function evalChoose(args: any[], ctx: EvalContext): unknown {
  const { positional, named } = evalCallArgs(args, ctx);
  const { list } = resolveListArgument(positional, named, "choose");
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
  const { list, usedVariadic } = resolveListArgument(positional, named, "cycle");
  if (list.length === 0) return null;
  const rawIndex = named.index ?? (usedVariadic ? undefined : positional[1]) ?? (named.list !== undefined ? positional[0] : undefined) ?? ctx.docstep;
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

function evalRef(args: any[], ctx: EvalContext): string {
  const { positional, named } = evalCallArgs(args, ctx);
  const label = named.label ?? positional[0];
  if (typeof label !== "string") {
    throw new Error("ref(label) expects a string label");
  }
  const resolved = ctx.refs.get(label);
  if (!resolved) {
    throw new Error(`ref('${label}') target not found`);
  }
  return resolved;
}

function shuffleList<T>(list: T[], rng: () => number): T[] {
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
  const rawExclude = named.excludeTags;
  const rawStrategy = named.strategy ?? positional[1];
  const rawSeed = named.seed ?? positional[2];
  const rawNoRepeat = named.noRepeatSteps ?? named.noRepeat ?? positional[3];

  const tags = Array.isArray(rawTags)
    ? rawTags.map((tag) => String(tag))
    : rawTags
      ? [String(rawTags)]
      : [];

  const excludeTags = Array.isArray(rawExclude)
    ? rawExclude.map((tag) => String(tag))
    : rawExclude
      ? [String(rawExclude)]
      : [];

  const strategy = typeof rawStrategy === "string" ? rawStrategy : undefined;
  if (strategy && strategy !== "weighted" && strategy !== "uniform") {
    throw new Error(`Unknown asset pick strategy '${strategy}'`);
  }

  const candidates = filterAssets(ctx.assets, tags, excludeTags);

  if (candidates.length === 0) return null;

  const resolvedStrategy =
    strategy ??
    (candidates.every((asset) => asset.strategy === candidates[0].strategy)
      ? candidates[0].strategy
      : undefined) ??
    "uniform";

  const noRepeatSteps =
    typeof rawNoRepeat === "number" && Number.isFinite(rawNoRepeat) ? Math.max(0, Math.floor(rawNoRepeat)) : 0;

  const baseRng =
    rawSeed != null
      ? mulberry32(stableHash(ctx.propSeed, rawSeed, "assets.pick"))
      : ctx.rng;

  if (noRepeatSteps > 0) {
    const history = new Set<string>();
    for (let i = 1; i <= noRepeatSteps; i += 1) {
      const prev = pickAssetAtStep(candidates, resolvedStrategy, ctx, ctx.docstep - i, 0);
      if (prev) history.add(prev.id);
    }
    for (let salt = 0; salt < candidates.length; salt += 1) {
      const candidate = pickAssetAtStep(candidates, resolvedStrategy, ctx, ctx.docstep, salt);
      if (candidate && !history.has(candidate.id)) return candidate;
    }
    return pickAssetAtStep(candidates, resolvedStrategy, ctx, ctx.docstep, 0);
  }

  return pickAssetByStrategy(candidates, resolvedStrategy, baseRng);
}

function evalAssetsShuffle(args: any[], ctx: EvalContext): ResolvedAsset[] {
  const { positional, named } = evalCallArgs(args, ctx);
  const rawTags = named.tags ?? positional[0];
  const rawExclude = named.excludeTags;
  const rawSeed = named.seed ?? positional[1];

  const tags = Array.isArray(rawTags)
    ? rawTags.map((tag) => String(tag))
    : rawTags
      ? [String(rawTags)]
      : [];

  const excludeTags = Array.isArray(rawExclude)
    ? rawExclude.map((tag) => String(tag))
    : rawExclude
      ? [String(rawExclude)]
      : [];

  const candidates = filterAssets(ctx.assets, tags, excludeTags);
  if (candidates.length === 0) return [];

  const rng =
    rawSeed != null
      ? mulberry32(stableHash(ctx.propSeed, rawSeed, "assets.shuffle"))
      : mulberry32(stableHash(ctx.propSeed, "assets.shuffle"));

  return shuffleList(candidates, rng);
}

function filterAssets(
  assets: ResolvedAsset[],
  tags: string[],
  excludeTags: string[],
): ResolvedAsset[] {
  return assets.filter((asset) => {
    if (tags.length && !tags.every((tag) => asset.tags.includes(tag))) return false;
    if (excludeTags.length && excludeTags.some((tag) => asset.tags.includes(tag))) return false;
    return true;
  });
}

function pickAssetAtStep(
  candidates: ResolvedAsset[],
  strategy: string,
  ctx: EvalContext,
  step: number,
  salt: number,
): ResolvedAsset | null {
  if (candidates.length === 0) return null;
  const rng = mulberry32(stableHash(ctx.propSeed, step, salt, "assets.pick.step"));
  return pickAssetByStrategy(candidates, strategy, rng);
}

function pickAssetByStrategy(
  candidates: ResolvedAsset[],
  strategy: string,
  rng: () => number,
): ResolvedAsset {
  if (strategy === "weighted") {
    const total = candidates.reduce(
      (sum, asset) => sum + (Number.isFinite(asset.weight) ? asset.weight : 1),
      0,
    );
    if (total <= 0) {
      const idx = Math.floor(rng() * candidates.length);
      return candidates[idx];
    }
    let roll = rng() * total;
    for (const asset of candidates) {
      const weight = Number.isFinite(asset.weight) ? asset.weight : 1;
      roll -= weight;
      if (roll <= 0) return asset;
    }
    return candidates[candidates.length - 1];
  }
  const idx = Math.floor(rng() * candidates.length);
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
    tags: [...(bank.tags ?? []), `bank:${bank.name}`],
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

function isResolvedAsset(value: unknown): value is ResolvedAsset {
  return Boolean(value && typeof value === "object" && (value as any).__asset);
}

function makeAssetId(prefix: string, name: string, kind: string, pathValue: string): string {
  const hash = stableHash(prefix, name, kind, pathValue);
  return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}

function rand01(seed: number, slotId: string, key: string | number): number {
  const hash = stableHash(seed, slotId, key);
  const rng = mulberry32(hash);
  return rng();
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
