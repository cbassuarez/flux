import { parseDocument, type DocumentNode, type FluxDocument, type RefreshPolicy } from "@flux-lang/core";
import type { JSONContent } from "@tiptap/core";
import { fetchEditSource, fetchEditState, postTransform, type TransformRequest } from "./api";
import { tiptapToFluxText } from "./richText";

export type LastLoadReason =
  | "initial"
  | "openDoc"
  | "applyTransform"
  | "persistAck"
  | "externalChange"
  | "viewerSync"
  | "unknown";

export type DocEventLog = {
  reason: LastLoadReason;
  docRev: number;
  sourceRev: number;
  dirty: boolean;
  writeId?: string | null;
  tag?: string;
};

export function logDocEvent(event: DocEventLog) {
  const payload = {
    reason: event.reason,
    docRev: event.docRev,
    sourceRev: event.sourceRev,
    dirty: event.dirty,
    writeId: event.writeId ?? undefined,
    tag: event.tag,
  };
  if (typeof window !== "undefined" && (import.meta as any)?.env?.DEV) {
    console.info("[doc-event]", payload);
  }
}

export type DocIndexEntry = {
  id: string;
  node: DocumentNode;
  parentId: string | null;
  path: string[];
  depth: number;
};

export type AssetItem = {
  id: string;
  name: string;
  kind: string;
  path: string;
  tags: string[];
  bankName?: string | null;
  source?: { type: string; name: string };
  meta?: Record<string, unknown>;
};

export type EditorDoc = {
  source: string;
  ast: FluxDocument | null;
  index: Map<string, DocIndexEntry>;
  assetsIndex: AssetItem[];
  diagnostics?: unknown;
  revision?: number;
  lastValidRevision?: number;
  docPath?: string;
  title?: string;
  previewPath?: string;
  capabilities?: Record<string, unknown>;
};

export type EditorSelection = {
  id: string | null;
  kind?: string | null;
};

export type RuntimeInputs = {
  seed: number;
  time: number;
  docstep: number;
};

type SlotTransition = { kind: string; [key: string]: unknown };

export type EditorTransform =
  | { type: "setTextNodeContent"; id: string; text?: string; richText?: JSONContent }
  | { type: "setNodeProps"; id: string; props: Record<string, unknown> }
  | { type: "setSlotProps"; id: string; reserve?: string; fit?: string; refresh?: RefreshPolicy; transition?: SlotTransition }
  | { type: "setSlotGenerator"; id: string; generator: Record<string, unknown> }
  | { type: "reorderNode"; id: string; parentId: string; index: number }
  | { type: "replaceNode"; id: string; node: DocumentNode }
  | { type: "setSource"; source: string }
  | { type: "server"; request: TransformRequest };

export type ApplyTransformResult = {
  ok: boolean;
  nextAst: FluxDocument | null;
  nextSource: string;
  diagnostics?: unknown;
  error?: string;
};

export type DocServiceState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  doc: EditorDoc | null;
  selection: EditorSelection;
  runtime: RuntimeInputs;
  isApplying: boolean;
  isSaving: boolean;
  dirty: boolean;
  docRev: number;
  sourceRev: number;
  lastWriteId: string | null;
  lastLoadReason: LastLoadReason;
  pendingExternalChange?: { mtime?: number; path?: string; source?: string } | null;
};

export type DocService = {
  getState: () => DocServiceState;
  subscribe: (listener: () => void) => () => void;
  loadDoc: () => Promise<DocServiceState>;
  applyTransform: (
    transform: EditorTransform | TransformRequest,
    options?: { pushHistory?: boolean; writeId?: string; reason?: LastLoadReason },
  ) => Promise<ApplyTransformResult>;
  saveDoc: (source: string) => Promise<DocServiceState>;
  undo: () => Promise<DocServiceState | null>;
  redo: () => Promise<DocServiceState | null>;
  setSelection: (id: string | null, kind?: string | null) => void;
  setRuntimeInputs: (inputs: Partial<RuntimeInputs>) => void;
  markDirtyDraft: () => void;
  markExternalChange: (payload: { path?: string; mtime?: number; source?: string; writeId?: string | null }) => void;
  acceptExternalReload: () => void;
  dismissExternalReload: () => void;
};

type SourcePayload = Awaited<ReturnType<typeof fetchEditSource>>;

function buildIndex(doc: FluxDocument | null): Map<string, DocIndexEntry> {
  const map = new Map<string, DocIndexEntry>();
  if (!doc?.body?.nodes) return map;

  const visit = (node: DocumentNode, parentId: string | null, path: string[], depth: number) => {
    const entry: DocIndexEntry = { id: node.id, node, parentId, path, depth };
    map.set(node.id, entry);
    node.children?.forEach((child) => visit(child, node.id, [...path, node.id], depth + 1));
  };

  doc.body.nodes.forEach((node) => visit(node, null, [], 0));
  return map;
}

function buildAssetsIndex(raw: unknown): AssetItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const source = record.source as { type?: string; name?: string } | undefined;
      const tags = Array.isArray(record.tags) ? record.tags.map((tag) => String(tag)) : [];
      return {
        id: String(record.id ?? ""),
        name: String(record.name ?? record.path ?? record.id ?? "asset"),
        kind: String(record.kind ?? "asset"),
        path: String(record.path ?? ""),
        tags,
        bankName: source?.type === "bank" ? String(source.name ?? "") : null,
        source: source?.type ? { type: String(source.type), name: String(source.name ?? "") } : undefined,
        meta: typeof record.meta === "object" && record.meta ? (record.meta as Record<string, unknown>) : undefined,
      } as AssetItem;
    })
    .filter((item): item is AssetItem => Boolean(item && item.id));
}

function parseDoc(source: string, docPath?: string): FluxDocument | null {
  if (!source.trim()) return null;
  try {
    return parseDocument(source, {
      sourcePath: docPath ?? "document.flux",
      resolveIncludes: false,
    });
  } catch {
    return null;
  }
}

function extractStateFromPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.state && typeof record.state === "object") return record.state as Record<string, unknown>;
  if (record.updatedState && typeof record.updatedState === "object") return record.updatedState as Record<string, unknown>;
  if (record.doc || record.diagnostics || record.title || record.path || record.capabilities) {
    return record as Record<string, unknown>;
  }
  return null;
}

export function createDocService(): DocService {
  let state: DocServiceState = {
    status: "idle",
    doc: null,
    selection: { id: null, kind: null },
    runtime: { seed: 0, time: 0, docstep: 0 },
    isApplying: false,
    isSaving: false,
    dirty: false,
    docRev: 0,
    sourceRev: 0,
    lastWriteId: null,
    lastLoadReason: "initial",
    pendingExternalChange: null,
  };
  const listeners = new Set<() => void>();
  let undoStack: string[] = [];
  let redoStack: string[] = [];
  let writeSeq = 0;

  const setState = (next: DocServiceState | ((prev: DocServiceState) => DocServiceState)) => {
    state = typeof next === "function" ? (next as (prev: DocServiceState) => DocServiceState)(state) : next;
    listeners.forEach((listener) => listener());
  };

  const refreshFromPayload = async (
    payload: unknown,
    overrideSource: string | undefined,
    overrideState: Record<string, unknown> | null,
    opts: { reason: LastLoadReason; writeId?: string | null; tag?: string },
  ): Promise<EditorDoc | null> => {
    const reason = opts.reason;
    const payloadState = extractStateFromPayload(payload) ?? overrideState ?? (payload as Record<string, unknown>);
    const source =
      overrideSource ??
      (typeof (payload as any)?.source === "string" ? ((payload as any).source as string) : undefined) ??
      (payloadState?.source as string | undefined) ??
      state.doc?.source ??
      "";
    const prevSource = state.doc?.source ?? "";
    const docPath = (payloadState?.path as string | undefined) ?? state.doc?.docPath;
    const astFromState = (payloadState as any)?.doc ?? (payloadState as any)?.ast ?? null;
    const ast = astFromState && typeof astFromState === "object" ? (astFromState as FluxDocument) : parseDoc(source, docPath);
    const index = buildIndex(ast);
    const assetsIndex = buildAssetsIndex((payloadState as any)?.assets ?? (payload as any)?.assets);
    const nextDoc: EditorDoc = {
      source,
      ast,
      index,
      assetsIndex,
      diagnostics: (payloadState as any)?.diagnostics ?? state.doc?.diagnostics,
      revision: (payloadState as any)?.revision ?? (payload as any)?.revision ?? state.doc?.revision,
      lastValidRevision:
        (payloadState as any)?.lastValidRevision ?? (payload as any)?.lastValidRevision ?? state.doc?.lastValidRevision,
      docPath,
      title: (payloadState as any)?.title ?? state.doc?.title,
      previewPath: (payloadState as any)?.previewPath ?? state.doc?.previewPath ?? "/preview",
      capabilities: (payloadState as any)?.capabilities ?? state.doc?.capabilities,
    };

    const nextRuntime = extractRuntimeInputs(payloadState, state.runtime);
    const nextSelection = normalizeSelection(state.selection, index);
    const docChanged = reason !== "unknown";
    const sourceChanged = source !== prevSource;
    const nextDocRev = docChanged ? state.docRev + 1 : state.docRev;
    const nextSourceRev = sourceChanged ? state.sourceRev + 1 : state.sourceRev;
    const dirty =
      reason === "persistAck"
        ? false
        : reason === "applyTransform"
          ? true
          : state.dirty;

    const nextState: DocServiceState = {
      ...state,
      status: "ready",
      doc: nextDoc,
      error: undefined,
      selection: nextSelection,
      runtime: nextRuntime,
      isApplying: false,
      isSaving: false,
      dirty,
      docRev: nextDocRev,
      sourceRev: nextSourceRev,
      lastWriteId: opts?.writeId ?? state.lastWriteId,
      lastLoadReason: reason,
      pendingExternalChange: null,
    };
    setState(nextState);
    logDocEvent({
      reason,
      docRev: nextState.docRev,
      sourceRev: nextState.sourceRev,
      dirty: nextState.dirty,
      writeId: nextState.lastWriteId,
      tag: opts.tag,
    });
    return nextDoc;
  };

  const refreshFromServer = async (
    overrideSource?: string,
    overrideState: Record<string, unknown> | null = null,
    reason?: LastLoadReason,
  ) => {
    const [statePayloadRaw, sourcePayload] = await Promise.all([
      fetchEditState(),
      overrideSource ? Promise.resolve({ source: overrideSource } as SourcePayload) : fetchEditSource(),
    ]);
    const extractedState = extractStateFromPayload(statePayloadRaw) ?? (statePayloadRaw as Record<string, unknown>);
    const mergedState = overrideState ?? extractedState;
    const source = overrideSource ?? sourcePayload?.source ?? "";
    const resolvedReason = reason ?? (state.status === "idle" ? "initial" : "openDoc");
    return refreshFromPayload(
      { ...(statePayloadRaw as any), ...(mergedState as any), source },
      source,
      mergedState,
      { reason: resolvedReason, tag: "refreshFromServer" },
    );
  };

  const loadDoc = async () => {
    setState({ ...state, status: "loading", error: undefined, isApplying: false, isSaving: false });
    try {
      return await refreshFromServer();
    } catch (error) {
      const message = (error as Error)?.message ?? String(error);
      setState({
        ...state,
        status: "error",
        error: message,
        isApplying: false,
        isSaving: false,
      });
      return state;
    }
  };

  const applyTransform = async (
    transform: EditorTransform | TransformRequest,
    options?: { pushHistory?: boolean; writeId?: string; reason?: LastLoadReason },
  ) => {
    const writeId = options?.writeId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `write-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const seq = ++writeSeq;
    const prevSource = state.doc?.source ?? "";
    let errorMessage: string | undefined;
    setState({
      ...state,
      isApplying: true,
      isSaving: true,
      dirty: true,
      lastWriteId: writeId,
      error: undefined,
    });
    const { request, fallback } = buildTransformRequest(transform, state.doc);
    let usedFallback = false;
    try {
      let payload: unknown;
      let ok = false;
      try {
        payload = await postTransform(request);
        ok = (payload as any)?.ok !== false;
      } catch (error) {
        if (fallback) {
          payload = await postTransform(fallback);
          ok = (payload as any)?.ok !== false;
          usedFallback = true;
        } else {
          throw error;
        }
      }

      if (!ok && fallback && !usedFallback) {
        payload = await postTransform(fallback);
        ok = (payload as any)?.ok !== false;
        usedFallback = true;
      }

      const nextState = extractStateFromPayload(payload) ?? null;
      if (!ok) {
        const diagnostics = (payload as any)?.diagnostics ?? nextState?.diagnostics ?? state.doc?.diagnostics;
        const nextDoc = state.doc ? { ...state.doc, diagnostics } : state.doc;
        errorMessage = (payload as any)?.error as string | undefined;
        setState({
          status: "ready",
          doc: nextDoc,
          error: errorMessage,
          selection: state.selection,
          runtime: state.runtime,
          isApplying: false,
        });
        return {
          ok: false,
          nextAst: nextDoc?.ast ?? null,
          nextSource: nextDoc?.source ?? prevSource,
          diagnostics: nextDoc?.diagnostics,
          error: errorMessage,
        };
      }

      if (options?.pushHistory !== false) {
        if (prevSource) undoStack = [...undoStack, prevSource].slice(-50);
        redoStack = [];
      }

      const nextSource = typeof (payload as any)?.source === "string" ? (payload as any).source : undefined;
      if (seq !== writeSeq) {
        // stale response; ignore
        return {
          ok: true,
          nextAst: state.doc?.ast ?? null,
          nextSource: state.doc?.source ?? prevSource,
          diagnostics: state.doc?.diagnostics,
        };
      }

      const nextDoc = await refreshFromPayload(payload, nextSource, nextState ?? null, {
        reason: options?.reason ?? "persistAck",
        writeId,
        tag: "applyTransform",
      });

      return {
        ok: true,
        nextAst: nextDoc?.ast ?? null,
        nextSource: nextDoc?.source ?? prevSource,
        diagnostics: nextDoc?.diagnostics,
      };
    } catch (error) {
      errorMessage = (error as Error)?.message ?? String(error);
      setState({
        ...state,
        status: "error",
        error: errorMessage,
        isApplying: false,
        isSaving: false,
      });
      return {
        ok: false,
        nextAst: state.doc?.ast ?? null,
        nextSource: state.doc?.source ?? prevSource,
        diagnostics: state.doc?.diagnostics,
        error: errorMessage,
      };
    } finally {
      setState((prev) => ({ ...prev, isApplying: false, isSaving: false }));
    }
  };

  const saveDoc = async (source: string) => {
    const result = await applyTransform({ type: "setSource", source }, { pushHistory: false });
    return state;
  };

  const undo = async () => {
    if (!undoStack.length) return null;
    const previous = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    if (state.doc?.source) {
      redoStack = [...redoStack, state.doc.source].slice(-50);
    }
    await saveDoc(previous);
    return state;
  };

  const redo = async () => {
    if (!redoStack.length) return null;
    const next = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);
    if (state.doc?.source) {
      undoStack = [...undoStack, state.doc.source].slice(-50);
    }
    await saveDoc(next);
    return state;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const getState = () => state;

  const setSelection = (id: string | null, kind?: string | null) => {
    const normalized = id ? id : null;
    if (state.selection.id === normalized && state.selection.kind === (kind ?? state.selection.kind)) return;
    setState({ ...state, selection: { id: normalized, kind: kind ?? null } });
  };

  const setRuntimeInputs = (inputs: Partial<RuntimeInputs>) => {
    const next = { ...state.runtime, ...inputs };
    setState({ ...state, runtime: next });
  };

  const markDirtyDraft = () => {
    if (state.dirty) return;
    setState({ ...state, dirty: true });
  };

  const markExternalChange = (payload: { path?: string; mtime?: number; source?: string; writeId?: string | null }) => {
    // Ignore our own writes
    if (payload.writeId && payload.writeId === state.lastWriteId) return;
    if (!state.dirty) {
      void refreshFromServer(payload.source, null, "externalChange");
      return;
    }
    setState({
      ...state,
      pendingExternalChange: { path: payload.path, mtime: payload.mtime, source: payload.source },
      lastLoadReason: "externalChange",
    });
  };

  const acceptExternalReload = () => {
    const pending = state.pendingExternalChange;
    if (!pending) return;
    void refreshFromServer(pending.source ?? undefined, null, "externalChange");
  };

  const dismissExternalReload = () => {
    if (!state.pendingExternalChange) return;
    setState({ ...state, pendingExternalChange: null });
  };

  return {
    getState,
    subscribe,
    loadDoc,
    applyTransform,
    saveDoc,
    undo,
    redo,
    setSelection,
    setRuntimeInputs,
    markDirtyDraft,
    markExternalChange,
    acceptExternalReload,
    dismissExternalReload,
  };
}

function normalizeSelection(selection: EditorSelection, index: Map<string, DocIndexEntry>): EditorSelection {
  if (!selection.id) return { id: null, kind: selection.kind ?? null };
  const entry = index.get(selection.id);
  if (!entry) return { id: null, kind: null };
  return { id: selection.id, kind: entry.node.kind };
}

function extractRuntimeInputs(raw: Record<string, unknown> | null | undefined, previous: RuntimeInputs): RuntimeInputs {
  if (!raw || typeof raw !== "object") return previous;
  const runtime =
    (raw as any).runtime ??
    (raw as any).snapshot ??
    (raw as any).state ??
    (raw as any).runtimeState ??
    null;
  const seed = readNumber(runtime?.seed ?? runtime?.randomSeed ?? (raw as any).seed ?? previous.seed);
  const time = readNumber(runtime?.time ?? runtime?.clock ?? (raw as any).time ?? previous.time);
  const docstep = readNumber(runtime?.docstep ?? runtime?.step ?? (raw as any).docstep ?? previous.docstep);
  return { seed, time, docstep };
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function buildTransformRequest(transform: EditorTransform | TransformRequest, doc?: EditorDoc | null): {
  request: TransformRequest;
  fallback?: TransformRequest;
} {
  if ("op" in transform) return { request: transform };
  if (transform.type === "server") return { request: transform.request };
  if (transform.type === "setSource") {
    return { request: { op: "setSource", args: { source: transform.source } } };
  }
  if (transform.type === "replaceNode") {
    return { request: { op: "replaceNode", args: { id: transform.id, node: transform.node } } };
  }
  if (transform.type === "setTextNodeContent") {
    const plainTextFromRich = transform.richText ? extractTextFromRich(transform.richText) : undefined;
    const request: TransformRequest = {
      op: "setTextNodeContent",
      args: {
        id: transform.id,
        nodeId: transform.id,
        text: transform.text ?? plainTextFromRich,
        richText: transform.richText,
      },
    };
    const fallback = buildTextReplaceNodeFallback(transform, doc);
    return { request, fallback };
  }
  if (transform.type === "setNodeProps") {
    return {
      request: {
        op: "setNodeProps",
        args: { id: transform.id, nodeId: transform.id, props: transform.props },
      },
    };
  }
  if (transform.type === "setSlotProps") {
    const request: TransformRequest = {
      op: "setSlotProps",
      args: {
        id: transform.id,
        slotId: transform.id,
        reserve: transform.reserve,
        fit: transform.fit,
        refresh: transform.refresh,
        transition: transform.transition,
      },
    };
    const fallback = buildSlotPropsFallback(transform, doc);
    return {
      request,
      fallback,
    };
  }
  if (transform.type === "setSlotGenerator") {
    const request: TransformRequest = {
      op: "setSlotGenerator",
      args: {
        id: transform.id,
        slotId: transform.id,
        generator: transform.generator,
      },
    };
    const fallback = buildSlotGeneratorFallback(transform, doc);
    return {
      request,
      fallback,
    };
  }
  if (transform.type === "reorderNode") {
    return {
      request: {
        op: "reorderNode",
        args: {
          id: transform.id,
          nodeId: transform.id,
          parentId: transform.parentId,
          index: transform.index,
        },
      },
    };
  }
  return { request: transform as TransformRequest };
}

function buildTextReplaceNodeFallback(
  transform: Extract<EditorTransform, { type: "setTextNodeContent" }>,
  doc?: EditorDoc | null,
): TransformRequest | undefined {
  if (!doc?.index) return undefined;
  const entry = doc.index.get(transform.id);
  if (!entry) return undefined;
  const existingIds = new Set(doc.index.keys());
  let nextNode: DocumentNode | null = null;

  if (transform.richText) {
    nextNode = tiptapToFluxText(entry.node, transform.richText, existingIds);
  } else if (typeof transform.text === "string") {
    const nextProps: Record<string, any> = { ...(entry.node.props ?? {}) };
    nextProps.content = { kind: "LiteralValue", value: transform.text };
    nextNode = { ...entry.node, props: nextProps, children: [] };
  }

  if (!nextNode) return undefined;
  return { op: "replaceNode", args: { id: transform.id, node: nextNode } };
}

function buildSlotPropsFallback(
  transform: Extract<EditorTransform, { type: "setSlotProps" }>,
  doc?: EditorDoc | null,
): TransformRequest | undefined {
  if (!doc?.index) return undefined;
  const entry = doc.index.get(transform.id);
  if (!entry) return undefined;
  if (entry.node.kind !== "inline_slot" && entry.node.kind !== "slot") return undefined;
  const nextProps: Record<string, any> = { ...(entry.node.props ?? {}) };
  if (transform.reserve !== undefined) nextProps.reserve = { kind: "LiteralValue", value: transform.reserve };
  if (transform.fit !== undefined) nextProps.fit = { kind: "LiteralValue", value: transform.fit };
  const nextNode: DocumentNode = {
    ...entry.node,
    props: nextProps,
    refresh: transform.refresh ?? entry.node.refresh,
    transition: transform.transition ?? (entry.node as any).transition,
  };
  return { op: "replaceNode", args: { id: transform.id, node: nextNode } };
}

function buildSlotGeneratorFallback(
  transform: Extract<EditorTransform, { type: "setSlotGenerator" }>,
  doc?: EditorDoc | null,
): TransformRequest | undefined {
  if (!doc?.index) return undefined;
  const entry = doc.index.get(transform.id);
  if (!entry) return undefined;
  if (entry.node.kind !== "inline_slot" && entry.node.kind !== "slot") return undefined;
  const nextProps: Record<string, any> = { ...(entry.node.props ?? {}) };
  nextProps.generator = transform.generator as any;
  const nextNode: DocumentNode = {
    ...entry.node,
    props: nextProps,
  };
  return { op: "replaceNode", args: { id: transform.id, node: nextNode } };
}

function extractTextFromRich(json: JSONContent): string {
  const visit = (node: any): string => {
    if (!node) return "";
    if (typeof node.text === "string") return node.text;
    if (Array.isArray(node.content)) return node.content.map(visit).join("");
    return "";
  };
  return visit(json);
}
