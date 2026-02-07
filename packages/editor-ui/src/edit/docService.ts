import { parseDocument, type DocumentNode, type FluxDocument, type RefreshPolicy } from "@flux-lang/core";
import type { JSONContent } from "@tiptap/core";
import { fetchEditSource, fetchEditState, postTransform, RequestTimeoutError, type TransformRequest } from "./api";
import { tiptapToFluxText } from "./richText";
import { hashString } from "./slotRuntime";

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

export type TraceEventType =
  | "FIELD_CHANGE"
  | "COMMIT_START"
  | "COMMIT_OK"
  | "COMMIT_FAIL"
  | "COMMIT_TIMEOUT"
  | "COMMIT_SKIPPED"
  | "CANON_SET"
  | "FETCH_SOURCE_OK"
  | "FETCH_NODE_OK"
  | "STALE_IGNORED";

export type EditTraceEvent = {
  ts: number;
  eventType: TraceEventType;
  selectedId: string | null;
  dirty: boolean;
  loadReason?: LastLoadReason;
  beforeHash?: string | null;
  afterHash?: string | null;
  revision?: number | null;
  reqId?: number;
  writeId?: string | null;
};

type TraceEventInput = Omit<EditTraceEvent, "ts" | "selectedId" | "dirty"> &
  Partial<Pick<EditTraceEvent, "ts" | "selectedId" | "dirty">>;

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
  editTrace: EditTraceEvent[];
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
  traceEvent: (event: TraceEventInput) => void;
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
    editTrace: [],
  };
  const listeners = new Set<() => void>();
  let undoStack: string[] = [];
  let redoStack: string[] = [];
  let writeSeq = 0;
  let requestSeq = 0;
  let expectedMinRevision = 0;
  let expectedHash: string | null = null;

  const setState = (next: DocServiceState | ((prev: DocServiceState) => DocServiceState)) => {
    state = typeof next === "function" ? (next as (prev: DocServiceState) => DocServiceState)(state) : next;
    listeners.forEach((listener) => listener());
  };

  const hashSource = (source: string) => {
    const hashed = hashString(source);
    return Math.abs(hashed).toString(16).padStart(8, "0");
  };

  const appendTrace = (input: TraceEventInput) => {
    const entry: EditTraceEvent = {
      ts: input.ts ?? Date.now(),
      eventType: input.eventType,
      selectedId: input.selectedId ?? state.selection.id,
      dirty: input.dirty ?? state.dirty,
      loadReason: input.loadReason,
      beforeHash: input.beforeHash,
      afterHash: input.afterHash,
      revision: input.revision,
      reqId: input.reqId,
      writeId: input.writeId ?? state.lastWriteId,
    };
    setState((prev) => ({ ...prev, editTrace: [...prev.editTrace, entry].slice(-30) }));
  };

  const shouldIgnoreIncoming = (reason: LastLoadReason, incomingRevision: number | null, incomingHash: string | null) => {
    if (state.dirty && reason !== "applyTransform" && reason !== "persistAck") {
      return "dirty";
    }
    if (incomingRevision !== null && incomingRevision < expectedMinRevision) {
      return "revision";
    }
    if (
      incomingRevision === null &&
      expectedHash &&
      incomingHash &&
      incomingHash !== expectedHash &&
      expectedMinRevision > 0 &&
      !["initial", "openDoc", "externalChange"].includes(reason)
    ) {
      return "hash";
    }
    return null;
  };

  const updateExpected = (source: string, revision: number | null | undefined, reason: LastLoadReason) => {
    const nextHash = hashSource(source);
    if (reason === "initial" || reason === "openDoc") {
      expectedMinRevision = revision ?? 0;
      expectedHash = nextHash;
      return;
    }
    if (["persistAck", "applyTransform", "externalChange", "viewerSync"].includes(reason)) {
      if (typeof revision === "number") {
        expectedMinRevision = Math.max(expectedMinRevision, revision);
      }
      expectedHash = nextHash;
    }
  };

  const refreshFromPayload = async (
    payload: unknown,
    overrideSource: string | undefined,
    overrideState: Record<string, unknown> | null,
    opts: { reason: LastLoadReason; writeId?: string | null; tag?: string; reqId?: number },
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
    const prevHash = hashSource(prevSource);
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
      revision:
        (payloadState as any)?.revision ??
        (payload as any)?.revision ??
        (payloadState as any)?.newRevision ??
        (payload as any)?.newRevision ??
        state.doc?.revision,
      lastValidRevision:
        (payloadState as any)?.lastValidRevision ?? (payload as any)?.lastValidRevision ?? state.doc?.lastValidRevision,
      docPath,
      title: (payloadState as any)?.title ?? state.doc?.title,
      previewPath: (payloadState as any)?.previewPath ?? state.doc?.previewPath ?? "/preview",
      capabilities: (payloadState as any)?.capabilities ?? state.doc?.capabilities,
    };
    const nextRevision =
      (payloadState as any)?.revision ??
      (payload as any)?.revision ??
      (payloadState as any)?.newRevision ??
      (payload as any)?.newRevision ??
      (payloadState as any)?.lastValidRevision ??
      (payload as any)?.lastValidRevision ??
      null;
    const nextHash = hashSource(source);

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
    updateExpected(source, nextRevision, reason);
    appendTrace({
      eventType: "CANON_SET",
      loadReason: reason,
      beforeHash: prevHash,
      afterHash: nextHash,
      revision: nextRevision,
      reqId: opts.reqId,
      writeId: opts.writeId ?? state.lastWriteId,
    });
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
    const reqId = ++requestSeq;
    const [statePayloadRaw, sourcePayload] = await Promise.all([
      fetchEditState(),
      overrideSource ? Promise.resolve({ source: overrideSource } as SourcePayload) : fetchEditSource(),
    ]);
    const extractedState = extractStateFromPayload(statePayloadRaw) ?? (statePayloadRaw as Record<string, unknown>);
    const mergedState = overrideState ?? extractedState;
    const source = overrideSource ?? sourcePayload?.source ?? "";
    const incomingRevision =
      (sourcePayload as any)?.revision ??
      (sourcePayload as any)?.newRevision ??
      (mergedState as any)?.revision ??
      (mergedState as any)?.newRevision ??
      (statePayloadRaw as any)?.revision ??
      (statePayloadRaw as any)?.newRevision ??
      null;
    const incomingHash = source ? hashSource(source) : null;
    appendTrace({
      eventType: "FETCH_SOURCE_OK",
      afterHash: incomingHash ?? undefined,
      revision: incomingRevision,
      reqId,
    });
    const resolvedReason = reason ?? (state.status === "idle" ? "initial" : "openDoc");
    const ignoreReason = shouldIgnoreIncoming(resolvedReason, incomingRevision, incomingHash);
    if (ignoreReason) {
      appendTrace({
        eventType: "STALE_IGNORED",
        loadReason: resolvedReason,
        beforeHash: hashSource(state.doc?.source ?? ""),
        afterHash: incomingHash ?? undefined,
        revision: incomingRevision,
        reqId,
      });
      return state.doc;
    }
    return refreshFromPayload(
      { ...(statePayloadRaw as any), ...(mergedState as any), source },
      source,
      mergedState,
      { reason: resolvedReason, tag: "refreshFromServer", reqId },
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
    if (state.isApplying) {
      appendTrace({ eventType: "COMMIT_SKIPPED", beforeHash: hashSource(state.doc?.source ?? "") });
      return {
        ok: false,
        nextAst: state.doc?.ast ?? null,
        nextSource: state.doc?.source ?? "",
        diagnostics: state.doc?.diagnostics,
        error: "Transform already in progress",
      };
    }
    const writeId = options?.writeId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `write-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const seq = ++writeSeq;
    const prevSource = state.doc?.source ?? "";
    const beforeHash = hashSource(prevSource);
    let errorMessage: string | undefined;
    appendTrace({ eventType: "COMMIT_START", beforeHash, writeId });
    setState({
      ...state,
      isApplying: true,
      isSaving: true,
      dirty: true,
      lastWriteId: writeId,
      error: undefined,
    });
    const { request, fallback } = buildTransformRequest(transform, state.doc);
    const requestWithWriteId = { ...request, writeId };
    const fallbackWithWriteId = fallback ? { ...fallback, writeId } : undefined;
    let usedFallback = false;
    try {
      let payload: unknown;
      let ok = false;
      let nextState: Record<string, unknown> | null = null;
      try {
        payload = await postTransform(requestWithWriteId);
        ok = (payload as any)?.ok !== false;
        if (ok && fallbackWithWriteId && !usedFallback) {
          nextState = extractStateFromPayload(payload) ?? null;
          const before = (payload as any)?._fluxBefore;
          const after = (payload as any)?._fluxAfter;
          const isHeaderNoop = before && after && before === after;
          const nextSourceStr = typeof (payload as any)?.source === "string" ? (payload as any).source : undefined;
          const rev =
            (nextState as any)?.revision ??
            (payload as any)?.revision ??
            (nextState as any)?.newRevision ??
            (payload as any)?.newRevision ??
            (nextState as any)?.lastValidRevision ??
            (payload as any)?.lastValidRevision ??
            null;
          const sameSource = nextSourceStr !== undefined && nextSourceStr === prevSource;
          const isHeuristicNoop =
            !isHeaderNoop &&
            before == null &&
            after == null &&
            sameSource &&
            rev != null &&
            state.doc?.revision != null &&
            rev <= state.doc.revision;
          if (isHeaderNoop || isHeuristicNoop) {
            payload = await postTransform(fallbackWithWriteId);
            ok = (payload as any)?.ok !== false;
            usedFallback = true;
            nextState = null;
          }
        }
      } catch (error) {
        if (fallbackWithWriteId) {
          payload = await postTransform(fallbackWithWriteId);
          ok = (payload as any)?.ok !== false;
          usedFallback = true;
        } else {
          throw error;
        }
      }

      if (!ok && fallbackWithWriteId && !usedFallback) {
        payload = await postTransform(fallbackWithWriteId);
        ok = (payload as any)?.ok !== false;
        usedFallback = true;
      }

      if (!nextState) {
        nextState = extractStateFromPayload(payload) ?? null;
      }
      if (!ok) {
        const diagnostics = (payload as any)?.diagnostics ?? nextState?.diagnostics ?? state.doc?.diagnostics;
        const nextDoc = state.doc ? { ...state.doc, diagnostics } : state.doc;
        errorMessage = (payload as any)?.error as string | undefined;
        appendTrace({ eventType: "COMMIT_FAIL", beforeHash, writeId });
        setState({
          ...state,
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
        appendTrace({
          eventType: "STALE_IGNORED",
          loadReason: options?.reason ?? "persistAck",
          beforeHash,
          afterHash: nextSource ? hashSource(nextSource) : undefined,
          writeId,
        });
        return {
          ok: true,
          nextAst: state.doc?.ast ?? null,
          nextSource: state.doc?.source ?? prevSource,
          diagnostics: state.doc?.diagnostics,
        };
      }

      appendTrace({
        eventType: "COMMIT_OK",
        beforeHash,
        afterHash: nextSource ? hashSource(nextSource) : undefined,
        revision:
          (nextState as any)?.revision ??
          (payload as any)?.revision ??
          (nextState as any)?.newRevision ??
          (payload as any)?.newRevision ??
          (nextState as any)?.lastValidRevision ??
          (payload as any)?.lastValidRevision ??
          null,
        writeId,
      });
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
      const isTimeout =
        error instanceof RequestTimeoutError ||
        (error instanceof DOMException && error.name === "AbortError") ||
        (error as { name?: string }).name === "AbortError";
      errorMessage = (error as Error)?.message ?? String(error);
      appendTrace({ eventType: isTimeout ? "COMMIT_TIMEOUT" : "COMMIT_FAIL", beforeHash, writeId });
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
    appendTrace({ eventType: "FIELD_CHANGE" });
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
    traceEvent: appendTrace,
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
    const isRichTextComplex = transform.richText ? isComplexRichText(transform.richText) : false;
    const args: Record<string, unknown> = {
      id: transform.id,
      nodeId: transform.id,
      text: transform.text ?? plainTextFromRich,
    };
    if (transform.richText && isRichTextComplex) {
      args.richText = transform.richText;
    }
    const request: TransformRequest = {
      op: "setTextNodeContent",
      args,
    };
    const fallback = buildTextReplaceNodeFallback(transform, doc);
    if (transform.richText && isRichTextComplex && fallback) {
      return { request: fallback, fallback: request };
    }
    return { request, fallback };
  }
  if (transform.type === "setNodeProps") {
    const request = {
      op: "setNodeProps",
      args: { id: transform.id, nodeId: transform.id, props: transform.props },
    };
    let fallback: TransformRequest | undefined;
    if (doc?.index) {
      const entry = doc.index.get(transform.id);
      if (entry) {
        const nextNode: DocumentNode = {
          ...entry.node,
          props: { ...(entry.node.props ?? {}), ...transform.props },
        };
        fallback = { op: "replaceNode", args: { id: transform.id, node: nextNode } };
      }
    }
    return { request, fallback };
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
    if (fallback) {
      return { request: fallback, fallback: request };
    }
    return { request, fallback };
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
    if (fallback) {
      return { request: fallback, fallback: request };
    }
    return { request, fallback };
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
  const nextNode: DocumentNode & Record<string, any> = {
    ...entry.node,
    props: nextProps,
    refresh: transform.refresh ?? entry.node.refresh,
    transition: transform.transition ?? (entry.node as any).transition,
  };
  if (transform.reserve !== undefined && "reserve" in (entry.node as any)) (nextNode as any).reserve = transform.reserve;
  if (transform.fit !== undefined && "fit" in (entry.node as any)) (nextNode as any).fit = transform.fit;
  if (transform.refresh !== undefined && "refresh" in (entry.node as any)) (nextNode as any).refresh = transform.refresh;
  if (
    transform.transition !== undefined &&
    ("transition" in (entry.node as any) || (entry.node as any).transition !== undefined)
  ) {
    (nextNode as any).transition = transform.transition;
  }
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
  const nextNode: DocumentNode & Record<string, any> = {
    ...entry.node,
    props: nextProps,
  };
  if ("generator" in (entry.node as any)) {
    (nextNode as any).generator = transform.generator;
  }
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

function isComplexRichText(json: JSONContent): boolean {
  const visit = (node: any): boolean => {
    if (!node || typeof node !== "object") return false;
    if (Array.isArray(node.marks) && node.marks.length > 0) return true;
    if (node.type === "inlineSlot") return true;
    const attrs = node.attrs;
    if (attrs && typeof attrs === "object") {
      const idValue = (attrs as any).id ?? (attrs as any).textId;
      if (typeof idValue === "string" || typeof idValue === "number") return true;
    }
    if (typeof node.type === "string" && !["doc", "paragraph", "text"].includes(node.type)) return true;
    if (Array.isArray(node.content)) return node.content.some(visit);
    return false;
  };
  return visit(json);
}
