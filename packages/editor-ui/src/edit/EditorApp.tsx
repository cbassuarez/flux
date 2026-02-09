import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DndContext, DragOverlay, PointerSensor, useDroppable, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Command } from "cmdk";
import MonacoEditor, { loader } from "@monaco-editor/react";
import type { JSONContent } from "@tiptap/core";
import type { DocumentNode, NodePropValue, RefreshPolicy } from "@flux-lang/core";
import { FLUX_TAGLINE, coerceVersionInfo, formatFluxVersion, type FluxVersionInfo } from "@flux-lang/brand";
import "./editor.css";
import {
  DividerHairline,
  EditorFrame,
  InspectorPane,
  OutlinePane,
  PageStage,
} from "./components/EditorShell";
import { Button } from "./components/ui/Button";
import { MenuBar } from "./components/MenuBar";
import { EditorFooter } from "./components/EditorFooter";
import { StatusBar } from "./components/StatusBar";
import { monaco } from "./monaco";
import {
  createDocService,
  type AssetItem,
  type DocIndexEntry,
  type EditTraceEvent,
  type EditorTransform,
  type DocServiceState,
} from "./docService";
import { buildOutlineFromDoc, extractPlainText, getLiteralString, getLiteralValue, type OutlineNode } from "./docModel";
import RichTextEditor from "./RichTextEditor";
import type { TransformRequest } from "./api";
import {
  applyImageFrame,
  ensureFluxAttributes,
  ensurePreviewStyle,
  findFluxElement,
  patchSlotContent,
  patchSlotContentWithTransition,
  setPreviewRootClass,
  clearSlotTransitionLayers,
  type ImageFrame,
} from "./previewDom";
import {
  buildAddCalloutTransform,
  buildAddFigureTransform,
  buildAddParagraphTransform,
  buildAddSectionTransform,
  buildAddSlotTransform,
  buildAddTableTransform,
} from "./transforms";
import { extractDiagnosticsItems, extractDiagnosticsSummary } from "./diagnostics";
import { matchSorter } from "match-sorter";
import {
  advanceSlotPlaybackState,
  computeSlotValue,
  filterAssetsByTags,
  formatDuration,
  normalizeRefreshPolicy,
  parseDurationString,
  resolveSlotValueForIndex,
  simulateSlotChanges,
  type EditorRuntimeInputs,
  type SlotGeneratorSpec,
  type SlotPlaybackState,
  type SlotTransitionSpec,
  type SlotValue,
} from "./slotRuntime";
import { EditorRuntimeProvider, useEditorRuntimeState } from "./runtimeContext";
import { buildGeneratorExpr, hasEmptyValue, isChooseCycleSpec, promoteVariants, wrapExpressionValue } from "./generatorUtils";
import { buildEditorCommands, type EditorCommand } from "./commands/editorCommands";
import { getFluxVersionInfo } from "./versionInfo";
import { assetPreviewUrl } from "./slotAssets";

loader.config({ monaco });

type Toast = {
  kind: "success" | "error" | "info";
  message: string;
};

type FindItem = {
  id: string;
  text: string;
  breadcrumbs: string[];
  kind: string;
};

export default function EditorApp() {
  const serviceRef = useRef(createDocService());
  const docService = serviceRef.current;
    const docState = useSyncExternalStore(
      docService.subscribe,
      docService.getState,
      docService.getState
    );
  const doc = docState.doc;
  const selectedId = docState.selection.id;
  const runtimeStore = useEditorRuntimeState({
    seed: docState.runtime.seed,
    timeSec: docState.runtime.time,
    docstep: docState.runtime.docstep,
  });
  const runtimeState = runtimeStore.state;
  const runtimeActions = runtimeStore.actions;
  const [activeMode, setActiveMode] = useState<"preview" | "edit" | "source">("preview");
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [assetPanelOpen, setAssetPanelOpen] = useState(true);
  const [outlineVisible, setOutlineVisible] = useState(true);
    const [showStatusBar, setShowStatusBar] = useState(true);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [docSettingsOpen, setDocSettingsOpen] = useState(false);
  const [buildInfoOpen, setBuildInfoOpen] = useState(false);
  const [outlineQuery, setOutlineQuery] = useState("");
  const [debugSlots, setDebugSlots] = useState(false);
  const [showIds, setShowIds] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sourceDraft, setSourceDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [toast, setToast] = useState<Toast | null>(null);
  const [draggingAsset, setDraggingAsset] = useState<AssetItem | null>(null);
  const [draggingOutlineId, setDraggingOutlineId] = useState<string | null>(null);
  const [inspectorVisible, setInspectorVisible] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 1100,
  );
  const [outlineWidth, setOutlineWidth] = useState(() => getStoredWidth("outline", 300));
  const [inspectorWidth, setInspectorWidth] = useState(() => getStoredWidth("inspector", 320));
  const [transformError, setTransformError] = useState<string | null>(null);
  const [adjustImageMode, setAdjustImageMode] = useState(false);
  const [frameDraft, setFrameDraft] = useState<ImageFrame | null>(null);
  const [focusedPane, setFocusedPane] = useState("none");
  const [activeEditor, setActiveEditor] = useState<"tiptap" | "monaco" | "none">("none");
  const [debugEnabled] = useState(() => isDebugEnabled());
  const [buildInfo, setBuildInfo] = useState<{ id: string | null; dist: string | null }>({ id: null, dist: null });
  const [fluxVersionInfo, setFluxVersionInfo] = useState<FluxVersionInfo>(() => coerceVersionInfo({ version: "0.0.0" }));

  const runtimeInputs = useMemo<EditorRuntimeInputs>(
    () => ({
      seed: runtimeState.seed,
      timeSec: runtimeState.timeSec,
      docstep: runtimeState.docstep,
    }),
    [runtimeState.docstep, runtimeState.seed, runtimeState.timeSec],
  );

  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const richEditorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const monacoEditorRef = useRef<any>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const previewSelectedRef = useRef<HTMLElement | null>(null);
  const previewHoveredRef = useRef<HTMLElement | null>(null);
  const frameTargetRef = useRef<HTMLElement | null>(null);
  const frameDraftRef = useRef<ImageFrame | null>(null);
  const frameDragRef = useRef<{ startX: number; startY: number; frame: ImageFrame } | null>(null);
  const previewCleanupRef = useRef<(() => void) | null>(null);
  const pendingPageScrollRef = useRef(false);
  const slotPlaybackRef = useRef<Map<string, SlotPlaybackState>>(new Map());
  const previewTransitionTimerRef = useRef<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const selectNode = useCallback(
    (id: string | null) => {
      if (!id) {
        docService.setSelection(null);
        return;
      }
      const kind = doc?.index?.get(id)?.node.kind ?? null;
      docService.setSelection(id, kind);
    },
    [doc?.index, docService],
  );
    
    useEffect(() => {
        setShowStatusBar(getStoredStatusBar());
      }, []);

  useEffect(() => {
    void docService.loadDoc();
  }, [docService]);

    useEffect(() => {
        const fetchBuildId = async () => {
            try {
                const res = await fetch("/edit/build-id.json", { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json();
                setBuildInfo({
                    id: (json as any)?.buildId ?? null,
                    dist: (json as any)?.editorDist ?? null,
                });
            } catch {
                // ignore
            }
        };
        void fetchBuildId();
    }, []);

  useEffect(() => {
    let alive = true;
    void getFluxVersionInfo().then((info) => {
      if (!alive) return;
      setFluxVersionInfo(info);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!doc?.source) return;
    if (docState.dirty) return;
    if (sourceDraft.trim() === "" || sourceDraft === doc.source) {
      setSourceDraft(doc.source);
    }
  }, [doc?.source, sourceDraft, docState.dirty]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("flux-editor-outline-width", String(outlineWidth));
  }, [outlineWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("flux-editor-inspector-width", String(inspectorWidth));
  }, [inspectorWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("flux.editor.showStatusBar", showStatusBar ? "1" : "0");
  }, [showStatusBar]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1100) setInspectorVisible(false);
    const handleResize = () => {
      if (window.innerWidth < 1100) setInspectorVisible(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!debugEnabled) return;
    const root = editorRootRef.current;
    if (!root) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const topmost = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      if (!topmost) return;
      const style = window.getComputedStyle(topmost);
      console.info("[editor-hit-test]", {
        target: target ? `${target.tagName.toLowerCase()}#${target.id || ""}.${target.className || ""}` : "none",
        topmost: `${topmost.tagName.toLowerCase()}#${topmost.id || ""}.${topmost.className || ""}`,
        pointerEvents: style.pointerEvents,
      });
    };
    root.addEventListener("click", handleClick, true);
    return () => root.removeEventListener("click", handleClick, true);
  }, [debugEnabled]);

  useEffect(() => {
    if (!debugEnabled) return;
    const handleFocus = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) {
        setFocusedPane("none");
        return;
      }
      if (active.closest(".inspector-pane")) {
        setFocusedPane("inspector");
      } else if (active.closest(".outline-pane")) {
        setFocusedPane("outline");
      } else if (active.closest(".page-stage")) {
        setFocusedPane("preview");
      } else if (active.closest(".rich-text-editor") || active.closest(".text-fallback-editor")) {
        setFocusedPane("editor");
      } else {
        setFocusedPane("other");
      }
    };
    window.addEventListener("focusin", handleFocus);
    handleFocus();
    return () => window.removeEventListener("focusin", handleFocus);
  }, [debugEnabled]);

  useEffect(() => {
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".monaco-editor")) {
        setActiveEditor("monaco");
        return;
      }
      if (target?.closest(".rich-text-editor") || target?.closest(".text-fallback-editor")) {
        setActiveEditor("tiptap");
        return;
      }
      setActiveEditor("none");
    };
    window.addEventListener("focusin", handleFocus);
    return () => window.removeEventListener("focusin", handleFocus);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "flux-select" && event.data.nodeId) {
        selectNode(String(event.data.nodeId));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [selectNode]);

  useEffect(() => {
    return () => {
      if (previewCleanupRef.current) {
        previewCleanupRef.current();
        previewCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: "flux-debug", enabled: debugSlots }, "*");
  }, [debugSlots]);

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame?.contentWindow || !selectedId) return;
    frame.contentWindow.postMessage({ type: "flux-highlight", nodeId: selectedId }, "*");
  }, [selectedId]);


  const outline = useMemo(() => buildOutlineFromDoc(doc?.ast ?? null), [doc?.ast]);

  useEffect(() => {
    if (selectedId || !outline.length) return;
    selectNode(outline[0].id);
  }, [outline, selectedId, selectNode]);

  const selectedEntry = useMemo(() => {
    if (!selectedId || !doc?.index) return null;
    return doc.index.get(selectedId) ?? null;
  }, [doc?.index, selectedId]);

  const selectedNode = selectedEntry?.node ?? null;
  const frameEntry = useMemo(() => resolveFrameEntry(selectedEntry, doc?.index), [doc?.index, selectedEntry]);
  const illegalSlotProps = useMemo(() => {
    if (!selectedNode) return false;
    if (selectedNode.kind === "slot" || selectedNode.kind === "inline_slot") return false;
    const nodeAny = selectedNode as any;
    const props = selectedNode.props as Record<string, unknown> | undefined;
    return Boolean(nodeAny.refresh || nodeAny.transition || props?.refresh || props?.transition);
  }, [selectedNode]);
  const activeTextEntry = useMemo(() => {
    if (!selectedEntry || !doc?.index) return null;
    if (isSlotContext(selectedEntry, doc.index)) return null;
    if (selectedEntry.node.kind === "text") return selectedEntry;

    const descendant = findFirstChild(selectedEntry.node, "text");
    if (descendant) {
      return doc.index.get(descendant.id) ?? null;
    }

    let entry: typeof selectedEntry | null = selectedEntry;
    while (entry && entry.node.kind !== "text") {
      entry = entry.parentId ? doc.index.get(entry.parentId) ?? null : null;
    }
    return entry;
  }, [selectedEntry, doc?.index]);

  const activeTextNode = activeTextEntry?.node ?? null;
  const captionTarget = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== "figure") return null;
    return resolveCaptionTarget(selectedNode);
  }, [selectedNode]);

  useEffect(() => {
    if (activeMode !== "edit") return;
    if (!activeTextNode) return;
    const editor = richEditorRef.current;
    if (!editor?.commands?.focus) return;
    const timer = window.setTimeout(() => {
      editor.commands.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMode, activeTextNode?.id]);

  useEffect(() => {
    if (!frameEntry) {
      setFrameDraft(null);
      frameDraftRef.current = null;
      return;
    }
    const next = readImageFrame(frameEntry.node);
    setFrameDraft(next);
    frameDraftRef.current = next;
  }, [frameEntry?.id, frameEntry?.node]);

  useEffect(() => {
    if (!frameEntry) {
      setAdjustImageMode(false);
    }
  }, [frameEntry]);

  const diagnosticsSummary = useMemo(() => extractDiagnosticsSummary(doc?.diagnostics), [doc?.diagnostics]);
  const diagnosticsItems = useMemo(() => extractDiagnosticsItems(doc?.diagnostics), [doc?.diagnostics]);
  const footerSaveState = useMemo<"saved" | "dirty" | "error">(() => {
    if (saveStatus === "error") return "error";
    if (sourceDirty || docState.dirty) return "dirty";
    return "saved";
  }, [docState.dirty, saveStatus, sourceDirty]);
  const footerModeLabel = useMemo(() => {
    if (runtimeState.mode === "playback") return "Playback";
    if (activeMode === "edit") return "Edit";
    if (activeMode === "source") return "Source";
    return "Preview";
  }, [activeMode, runtimeState.mode]);
  const playbackReadout = useMemo(() => {
    if (runtimeState.mode !== "playback") return undefined;
    const time = Number.isFinite(runtimeState.timeSec) ? runtimeState.timeSec : 0;
    return `Step ${runtimeState.docstep} • t=${time.toFixed(1)}s`;
  }, [runtimeState.docstep, runtimeState.mode, runtimeState.timeSec]);
  const previewSrc = useMemo(() => buildPreviewSrc(doc?.previewPath, doc?.revision), [doc?.previewPath, doc?.revision]);

  const syncPreviewOverlays = useCallback(() => {
    const frame = previewFrameRef.current;
    const frameDoc = frame?.contentDocument;
    if (!frameDoc) return;
    ensurePreviewStyle(frameDoc);
    setPreviewRootClass(frameDoc, "flux-editor-show-ids", showIds);
    setPreviewRootClass(frameDoc, "flux-editor-adjust-image", adjustImageMode);

    const nextSelected = selectedId ? findFluxElement(frameDoc, selectedId) : null;
    if (previewSelectedRef.current && previewSelectedRef.current !== nextSelected) {
      previewSelectedRef.current.removeAttribute("data-flux-selected");
    }
    if (nextSelected && selectedId) {
      const kind = selectedEntry?.node.kind ?? doc?.index?.get(selectedId)?.node.kind;
      ensureFluxAttributes(nextSelected, selectedId, kind);
      nextSelected.setAttribute("data-flux-selected", "true");
    }
    previewSelectedRef.current = nextSelected;

    const nextHovered = hoveredId ? findFluxElement(frameDoc, hoveredId) : null;
    if (previewHoveredRef.current && previewHoveredRef.current !== nextHovered) {
      previewHoveredRef.current.removeAttribute("data-flux-hovered");
    }
    if (nextHovered && hoveredId) {
      const kind = doc?.index?.get(hoveredId)?.node.kind;
      ensureFluxAttributes(nextHovered, hoveredId, kind);
      nextHovered.setAttribute("data-flux-hovered", "true");
    }
    previewHoveredRef.current = nextHovered;
  }, [adjustImageMode, doc?.index, hoveredId, selectedEntry?.node.kind, selectedId, showIds]);

  const syncSlotLabels = useCallback(() => {
    if (!showIds || !doc?.index) return;
    const frameDoc = previewFrameRef.current?.contentDocument;
    if (!frameDoc) return;
    for (const entry of doc.index.values()) {
      if (entry.node.kind !== "slot" && entry.node.kind !== "inline_slot") continue;
      const el = findFluxElement(frameDoc, entry.id);
      if (!el) continue;
      ensureFluxAttributes(el, entry.id, entry.node.kind);
      el.setAttribute("data-flux-slot", "true");
    }
  }, [doc?.index, showIds]);

  const applySlotSnapshot = useCallback(() => {
    if (!doc?.index) return;
    const frameDoc = previewFrameRef.current?.contentDocument;
    if (!frameDoc) return;
    for (const entry of doc.index.values()) {
      if (entry.node.kind !== "inline_slot" && entry.node.kind !== "slot") continue;
      const program = readSlotProgram(entry.node);
      const { value, hash, bucket, eventIndex } = computeSlotValue(
        program.spec,
        (entry.node as any).refresh,
        runtimeInputs,
        entry.id,
        doc?.assetsIndex ?? [],
      );
      const slotEl = findFluxElement(frameDoc, entry.id);
      if (!slotEl) continue;
      ensureFluxAttributes(slotEl, entry.id, entry.node.kind);
      clearSlotTransitionLayers(slotEl);
      patchSlotContent(slotEl, value, entry.node.kind === "inline_slot");
      slotPlaybackRef.current.set(entry.id, { bucket, eventIndex, value, hash });
    }
  }, [doc?.assetsIndex, doc?.index, runtimeInputs]);

  const applySlotPlaybackTick = useCallback(() => {
    if (!doc?.index) return;
    const frameDoc = previewFrameRef.current?.contentDocument;
    if (!frameDoc) return;
    for (const entry of doc.index.values()) {
      if (entry.node.kind !== "inline_slot" && entry.node.kind !== "slot") continue;
      const program = readSlotProgram(entry.node);
      const prev = slotPlaybackRef.current.get(entry.id);
      const { state, changed } = advanceSlotPlaybackState(
        prev,
        program.spec,
        (entry.node as any).refresh,
        runtimeInputs,
        entry.id,
        doc?.assetsIndex ?? [],
      );
      slotPlaybackRef.current.set(entry.id, state);
      if (!changed) continue;
      const slotEl = findFluxElement(frameDoc, entry.id);
      if (!slotEl) continue;
      ensureFluxAttributes(slotEl, entry.id, entry.node.kind);
      const transition = (entry.node as any).transition as SlotTransitionSpec | undefined;
      if (!transition || transition.kind === "none" || transition.kind === "appear" || runtimeState.reducedMotion) {
        patchSlotContent(slotEl, state.value, entry.node.kind === "inline_slot");
      } else {
        patchSlotContentWithTransition(slotEl, state.value, entry.node.kind === "inline_slot", transition, {
          reducedMotion: runtimeState.reducedMotion,
        });
      }
    }
  }, [doc?.assetsIndex, doc?.index, runtimeInputs, runtimeState.reducedMotion]);

  const applyFrameToPreview = useCallback(
    (frame: ImageFrame) => {
      const frameDoc = previewFrameRef.current?.contentDocument;
      if (!frameDoc || !frameEntry) return;
      const targetEl =
        findFluxElement(frameDoc, frameEntry.id) ??
        (selectedId ? findFluxElement(frameDoc, selectedId) : null);
      if (!targetEl) return;
      const img = targetEl.tagName === "IMG" ? targetEl : targetEl.querySelector("img");
      if (!img) return;
      if (frameTargetRef.current && frameTargetRef.current !== img) {
        frameTargetRef.current.removeAttribute("data-flux-frame-target");
      }
      frameTargetRef.current = img as HTMLElement;
      applyImageFrame(img as HTMLElement, frame);
    },
    [frameEntry, selectedId],
  );

  const attachPreviewListeners = useCallback(() => {
    const frame = previewFrameRef.current;
    const frameDoc = frame?.contentDocument;
    if (!frameDoc) return () => undefined;
    ensurePreviewStyle(frameDoc);

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const fluxEl = target?.closest?.("[data-flux-id], [data-flux-node]") as HTMLElement | null;
      if (!fluxEl) return;
      const nodeId = fluxEl.getAttribute("data-flux-id") ?? fluxEl.getAttribute("data-flux-node");
      if (nodeId) selectNode(String(nodeId));
    };

    const handlePointerMove = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const fluxEl = target?.closest?.("[data-flux-id], [data-flux-node]") as HTMLElement | null;
      const nodeId = fluxEl?.getAttribute("data-flux-id") ?? fluxEl?.getAttribute("data-flux-node");
      setHoveredId((prev) => (prev === nodeId ? prev : nodeId ?? null));
    };

    const handlePointerLeave = () => {
      setHoveredId(null);
    };

    frameDoc.addEventListener("click", handleClick, true);
    frameDoc.addEventListener("pointermove", handlePointerMove);
    frameDoc.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      frameDoc.removeEventListener("click", handleClick, true);
      frameDoc.removeEventListener("pointermove", handlePointerMove);
      frameDoc.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  const handlePreviewLoad = useCallback(() => {
    const frame = previewFrameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: "flux-debug", enabled: debugSlots }, "*");
    if (selectedId) {
      frame.contentWindow.postMessage({ type: "flux-highlight", nodeId: selectedId }, "*");
    }
    if (previewCleanupRef.current) {
      previewCleanupRef.current();
      previewCleanupRef.current = null;
    }
    previewCleanupRef.current = attachPreviewListeners();
    syncPreviewOverlays();
    syncSlotLabels();
    if (runtimeState.mode === "playback") {
      applySlotPlaybackTick();
    } else {
      applySlotSnapshot();
    }
  }, [applySlotPlaybackTick, applySlotSnapshot, attachPreviewListeners, debugSlots, runtimeState.mode, selectedId, syncPreviewOverlays, syncSlotLabels]);

  const updateMonacoMarkers = useCallback(() => {
    const monacoInstance = monacoRef.current;
    const editor = monacoEditorRef.current;
    if (!monacoInstance || !editor) return;
    const markers = diagnosticsItems
      .filter((item) => item.range)
      .map((item) => ({
        message: item.message,
        severity:
          item.level === "fail" ? monacoInstance.MarkerSeverity.Error : monacoInstance.MarkerSeverity.Warning,
        startLineNumber: item.range?.start.line ?? 1,
        startColumn: item.range?.start.column ?? 1,
        endLineNumber: item.range?.end.line ?? item.range?.start.line ?? 1,
        endColumn: item.range?.end.column ?? item.range?.start.column ?? 1,
      }));
    const model = editor.getModel();
    if (model) monacoInstance.editor.setModelMarkers(model, "flux", markers);
  }, [diagnosticsItems]);

  useEffect(() => {
    updateMonacoMarkers();
  }, [updateMonacoMarkers]);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (node: OutlineNode) => {
      map.set(node.id, node.label);
      node.children.forEach(walk);
    };
    outline.forEach(walk);
    return map;
  }, [outline]);

  const breadcrumbs = useMemo(() => {
    if (!selectedEntry) return [] as string[];
    const pathIds = [...(selectedEntry.path ?? []), selectedEntry.id];
    return pathIds.map((id) => labelMap.get(id) ?? id);
  }, [labelMap, selectedEntry]);

  const breadcrumbLabel = breadcrumbs.length ? breadcrumbs.join(" › ") : "Document";

  const filteredOutline = useMemo(() => filterOutline(outline, outlineQuery), [outline, outlineQuery]);

  const searchItems = useMemo(() => {
    if (!doc?.ast?.body?.nodes) return [] as FindItem[];
    const items: FindItem[] = [];

    const walk = (node: DocumentNode, breadcrumbs: string[]) => {
      const nextBreadcrumbs =
        node.kind === "page" || node.kind === "section" || node.kind === "figure"
          ? [...breadcrumbs, labelMap.get(node.id) ?? node.id]
          : breadcrumbs;

      if (node.kind === "text") {
        const text = extractPlainText(node).trim();
        if (text) {
          items.push({
            id: node.id,
            text,
            breadcrumbs: nextBreadcrumbs,
            kind: node.kind,
          });
        }
      }

      node.children?.forEach((child) => walk(child, nextBreadcrumbs));
    };

    doc.ast.body.nodes.forEach((node) => walk(node, []));
    return items;
  }, [doc?.ast, labelMap]);

  const findResults = useMemo(() => {
    if (!findQuery.trim()) return [] as FindItem[];
    const lower = findQuery.trim().toLowerCase();
    return searchItems.filter((item) => item.text.toLowerCase().includes(lower));
  }, [findQuery, searchItems]);

  const findIndexLookup = useMemo(() => {
    const map = new Map<string, number>();
    findResults.forEach((item, idx) => map.set(item.id, idx));
    return map;
  }, [findResults]);

  const visibleFindResults = useMemo(() => findResults.slice(0, 8), [findResults]);

  const groupedFindResults = useMemo(() => {
    const groups = new Map<string, FindItem[]>();
    for (const item of visibleFindResults) {
      const label = item.breadcrumbs.slice(0, 2).join(" · ") || "Document";
      const list = groups.get(label);
      if (list) {
        list.push(item);
      } else {
        groups.set(label, [item]);
      }
    }
    return Array.from(groups, ([label, items]) => ({ label, items }));
  }, [visibleFindResults]);

  const activeFindItem = findResults.length ? findResults[Math.min(findIndex, findResults.length - 1)] : null;

  useEffect(() => {
    if (!activeFindItem) return;
    selectNode(activeFindItem.id);
  }, [activeFindItem, selectNode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !isTypingTarget) {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
      if (!isTypingTarget && event.key === "]") {
        event.preventDefault();
        setInspectorVisible((prev) => !prev);
      }
      if (event.key === "Escape") {
        setFindOpen(false);
        setPaletteOpen(false);
        setDiagnosticsOpen(false);
        setAboutOpen(false);
        setDocSettingsOpen(false);
        setBuildInfoOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sourceDirty = doc?.source ? sourceDraft !== doc.source : false;

  const handleTransform = useCallback(
    async (transform: EditorTransform | TransformRequest, successMessage?: string) => {
      if (runtimeState.mode === "playback") {
        runtimeActions.setMode("edit");
      }
      setSaveStatus("saving");
      const result = await docService.applyTransform(transform, { pushHistory: true });
      if (result.ok) {
        setSaveStatus("saved");
        setTransformError(null);
        if (successMessage) setToast({ kind: "success", message: successMessage });
      } else {
        setSaveStatus("error");
        const message = result.error ?? "Transform failed";
        setTransformError(message);
        setToast({ kind: "error", message });
      }
    },
    [docService, runtimeActions, runtimeState.mode],
  );

  const applyTextContent = useCallback(
    (id: string, payload: { text?: string; richText?: JSONContent }) => {
      void handleTransform({ type: "setTextNodeContent", id, ...payload });
    },
    [handleTransform],
  );

  const [debouncedRichTextUpdate, flushRichTextUpdate] = useDebouncedCallback((id: string, richText: JSONContent) => {
    applyTextContent(id, { richText });
  }, 400);

  const [debouncedPlainTextUpdate, flushPlainTextUpdate] = useDebouncedCallback((id: string, text: string) => {
    applyTextContent(id, { text });
  }, 240);

  const commitPlainTextUpdate = useCallback(
    (id: string, text: string) => {
      applyTextContent(id, { text });
    },
    [applyTextContent],
  );

  const applySlotGenerator = useCallback(
    (slotId: string, spec: SlotGeneratorSpec) => {
      const expr = buildGeneratorExpr(spec);
      const generator = expr ? wrapExpressionValue(expr) : (spec as unknown as Record<string, unknown>);
      void handleTransform({ type: "setSlotGenerator", id: slotId, generator });
    },
    [handleTransform],
  );

  const handlePreviewTransition = useCallback(
    (payload: { current: SlotValue; next: SlotValue; transition?: SlotTransitionSpec }) => {
      if (runtimeState.mode !== "edit") return;
      if (!selectedEntry) return;
      if (selectedEntry.node.kind !== "slot" && selectedEntry.node.kind !== "inline_slot") return;
      const frameDoc = previewFrameRef.current?.contentDocument;
      if (!frameDoc) return;
      const slotEl = findFluxElement(frameDoc, selectedEntry.id);
      if (!slotEl) return;

      if (previewTransitionTimerRef.current) {
        window.clearTimeout(previewTransitionTimerRef.current);
        previewTransitionTimerRef.current = null;
      }

      const inline = selectedEntry.node.kind === "inline_slot";
      const transition =
        runtimeState.reducedMotion || !payload.transition || payload.transition.kind === "none"
          ? { kind: "appear" }
          : payload.transition;

      patchSlotContentWithTransition(slotEl, payload.next, inline, transition, { reducedMotion: runtimeState.reducedMotion });

      const duration = getTransitionDurationMs(transition);
      const holdMs = 300;
      previewTransitionTimerRef.current = window.setTimeout(() => {
        clearSlotTransitionLayers(slotEl);
        patchSlotContent(slotEl, payload.current, inline);
      }, duration + holdMs);
    },
    [runtimeState.mode, runtimeState.reducedMotion, selectedEntry],
  );

  const commitFrame = useCallback(
    (frame: ImageFrame) => {
      if (!frameEntry) return;
      const nextNode = updateImageFrameNode(frameEntry.node, frame);
      void handleTransform({ op: "replaceNode", args: { id: frameEntry.id, node: nextNode } });
    },
    [frameEntry, handleTransform],
  );

  const [debouncedCommitFrame, flushCommitFrame] = useDebouncedCallback((frame: ImageFrame) => {
    commitFrame(frame);
  }, 240);

  // Flush pending text updates when the active text node changes
  useEffect(() => {
    flushPlainTextUpdate();
    flushRichTextUpdate();
  }, [activeTextNode?.id, flushPlainTextUpdate, flushRichTextUpdate]);

  // Flush pending frame updates when the selected entry changes
  useEffect(() => {
    flushCommitFrame();
  }, [selectedEntry?.id, flushCommitFrame]);

  // Flush any pending text edits when unmounting to avoid losing last keystrokes
  useEffect(
    () => () => {
      flushPlainTextUpdate();
      flushRichTextUpdate();
    },
    [flushPlainTextUpdate, flushRichTextUpdate],
  );

  const handleInsertSection = useCallback(() => {
    void handleTransform(buildAddSectionTransform(), "Section added");
  }, [handleTransform]);

  const handleInsertPage = useCallback(() => {
    const afterPageId = docState.selection.kind === "page" ? docState.selection.id ?? undefined : undefined;
    pendingPageScrollRef.current = true;
    void handleTransform({ op: "addPage", args: { afterPageId } }, "Page added");
  }, [docState.selection.id, docState.selection.kind, handleTransform]);

  const handleInsertParagraph = useCallback(() => {
    void handleTransform(buildAddParagraphTransform(), "Paragraph added");
  }, [handleTransform]);

  const handleInsertFigure = useCallback(() => {
    void handleTransform(
      buildAddFigureTransform({ bankName: "", tags: [], caption: "", reserve: "", fit: "scaleDown" }),
      "Figure added",
    );
  }, [handleTransform]);

  const handleInsertCallout = useCallback(() => {
    void handleTransform(buildAddCalloutTransform(), "Callout inserted");
  }, [handleTransform]);

  const handleInsertTable = useCallback(() => {
    void handleTransform(buildAddTableTransform(), "Table inserted");
  }, [handleTransform]);

  const handleInsertSlot = useCallback(() => {
    void handleTransform(buildAddSlotTransform(), "Slot inserted");
  }, [handleTransform]);

  const scrollPageIntoView = useCallback((pageId: string) => {
    const frameDoc = previewFrameRef.current?.contentDocument;
    if (!frameDoc) return;
    const el = frameDoc.querySelector(`[data-flux-id="${pageId}"][data-flux-kind="page"]`);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, []);

  useEffect(() => {
    if (!pendingPageScrollRef.current) return;
    pendingPageScrollRef.current = false;
    if (!selectedId || !doc?.index) return;
    const entry = doc.index.get(selectedId);
    if (entry?.node.kind !== "page") return;
    scrollPageIntoView(selectedId);
  }, [doc?.index, scrollPageIntoView, selectedId]);

  const handleApplySource = useCallback(async () => {
    if (!sourceDirty) return;
    setSaveStatus("saving");
    const result = await docService.applyTransform({ type: "setSource", source: sourceDraft }, { pushHistory: false });
    if (result.ok) {
      setSaveStatus("saved");
      setToast({ kind: "success", message: "Source applied" });
    } else {
      setSaveStatus("error");
      setToast({ kind: "error", message: result.error ?? "Source apply failed" });
    }
  }, [docService, sourceDraft, sourceDirty]);

  const handleSetActiveMode = useCallback(
    (mode: "preview" | "edit" | "source") => {
      setActiveMode(mode);
      if (mode === "edit" && runtimeState.mode === "playback") {
        runtimeActions.setMode("edit");
      }
    },
    [runtimeActions, runtimeState.mode],
  );

  const handleSave = useCallback(async () => {
    if (!sourceDirty && !docState.dirty) {
      setToast({ kind: "info", message: "No changes to save." });
      return;
    }
    if (sourceDirty) {
      await handleApplySource();
      return;
    }
    if (!doc?.source) return;
    setSaveStatus("saving");
    await docService.saveDoc(doc.source);
    setSaveStatus("saved");
  }, [doc?.source, docService, docState.dirty, handleApplySource, sourceDirty]);

  const handleResetLayout = useCallback(() => {
    setOutlineWidth(300);
    setInspectorWidth(320);
    setInspectorVisible(true);
    setAssetPanelOpen(true);
    setOutlineVisible(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("flux-editor-outline-width");
      window.localStorage.removeItem("flux-editor-inspector-width");
    }
  }, []);

  const toggleOutline = useCallback(() => setOutlineVisible((prev) => !prev), []);
  const toggleInspector = useCallback(() => setInspectorVisible((prev) => !prev), []);
  const toggleAssets = useCallback(() => setAssetPanelOpen((prev) => !prev), []);
  const toggleDiagnostics = useCallback(() => setDiagnosticsOpen((prev) => !prev), []);
  const toggleStatusBar = useCallback(() => setShowStatusBar((prev) => !prev), []);
  const enterFocusMode = useCallback(() => {
    setOutlineVisible(false);
    setInspectorVisible(false);
  }, []);

  const handleExportPdf = useCallback(() => {
    setToast({ kind: "info", message: "PDF export is not available yet." });
  }, []);

  const handleCopyId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setToast({ kind: "success", message: "Copied ID to clipboard." });
    } catch {
      setToast({ kind: "error", message: "Unable to copy ID." });
    }
  }, []);

  const handleCopyDiagnosticsSummary = useCallback(async () => {
    const summary = `Diagnostics: pass ${diagnosticsSummary.pass}, warn ${diagnosticsSummary.warn}, fail ${diagnosticsSummary.fail}`;
    try {
      await navigator.clipboard.writeText(summary);
      setToast({ kind: "success", message: "Diagnostics summary copied." });
    } catch {
      setToast({ kind: "error", message: "Unable to copy diagnostics summary." });
    }
  }, [diagnosticsSummary.fail, diagnosticsSummary.pass, diagnosticsSummary.warn]);

  const buildInfoLabel = useMemo(() => {
    const parts = [buildInfo.id ? `build ${buildInfo.id}` : null, buildInfo.dist ? buildInfo.dist : null].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Build info unavailable";
  }, [buildInfo.dist, buildInfo.id]);

  const handleCopyBuildInfo = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildInfoLabel);
      setToast({ kind: "success", message: "Build info copied." });
    } catch {
      setToast({ kind: "error", message: "Unable to copy build info." });
    }
  }, [buildInfoLabel]);

  const startResize = useCallback(
    (side: "left" | "right") => (event: any) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = side === "left" ? outlineWidth : inspectorWidth;
      const min = 240;
      const max = 420;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const next =
          side === "left"
            ? clamp(startWidth + delta, min, max)
            : clamp(startWidth - delta, min, max);
        if (side === "left") {
          setOutlineWidth(next);
        } else {
          setInspectorWidth(next);
        }
      };
      const handleUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [outlineWidth, inspectorWidth],
  );

  const handleAssignAsset = useCallback(
    (asset: AssetItem, targetId: string) => {
      if (!doc?.ast || !doc?.index) return;
      const ids = new Set(doc.index.keys());
      const assignment = buildAssetAssignment(doc.ast, doc.index, targetId, asset, ids);
      if (!assignment) {
        setToast({ kind: "error", message: "Drop a figure or slot target." });
        return;
      }
      void handleTransform({ op: "replaceNode", args: { id: assignment.id, node: assignment.node } }, "Asset applied");
    },
    [doc?.ast, doc?.index, handleTransform],
  );

  const handleOutlineReorder = useCallback(
    (event: any) => {
      if (!doc?.index) return;
      const activeId = event.active?.data?.current?.nodeId as string | undefined;
      if (!activeId) return;
      const activeEntry = doc.index.get(activeId);
      if (!activeEntry || !activeEntry.parentId) return;
      if (activeEntry.node.kind === "page" || activeEntry.node.kind === "section") return;

      const parentEntry = doc.index.get(activeEntry.parentId);
      if (!parentEntry || parentEntry.node.kind !== "section") return;
      const fromContainerId = `section:${parentEntry.id}`;
      const fromIndex = parentEntry.node.children?.findIndex((child) => child.id === activeId) ?? -1;
      if (fromIndex < 0) return;

      const overData = event.over?.data?.current as
        | { nodeId?: string; containerType?: "page" | "section"; containerId?: string }
        | undefined;
      if (!overData) return;

      let toContainerId: string | null = null;
      let toIndex = 0;

      if (overData.containerType && overData.containerId) {
        toContainerId = `${overData.containerType}:${overData.containerId}`;
        if (overData.containerType === "section") {
          const sectionEntry = doc.index.get(overData.containerId);
          toIndex = sectionEntry?.node.children?.length ?? 0;
        } else {
          const pageEntry = doc.index.get(overData.containerId);
          const section = pageEntry?.node.children?.find((child) => child.kind === "section");
          toIndex = section?.children?.length ?? 0;
        }
      } else if (overData.nodeId) {
        const overEntry = doc.index.get(overData.nodeId);
        if (!overEntry || !overEntry.parentId) return;
        const overParent = doc.index.get(overEntry.parentId);
        if (!overParent || overParent.node.kind !== "section") return;
        toContainerId = `section:${overParent.id}`;
        toIndex = overParent.node.children?.findIndex((child) => child.id === overEntry.id) ?? 0;
      }

      if (!toContainerId) return;
      if (fromContainerId === toContainerId && fromIndex === toIndex) return;
      void handleTransform({
        op: "moveNode",
        args: {
          nodeId: activeId,
          fromContainerId,
          toContainerId,
          toIndex,
        },
      });
      selectNode(activeId);
    },
    [doc?.index, handleTransform, selectNode],
  );

  const handleDragEnd = useCallback(
    (event: any) => {
      const dragType = event.active?.data?.current?.type as string | undefined;
      setDraggingAsset(null);
      setDraggingOutlineId(null);

      if (dragType === "outline") {
        handleOutlineReorder(event);
        return;
      }

      const asset = event.active?.data?.current?.asset as AssetItem | undefined;
      if (!asset) return;

      const overData = event.over?.data?.current;
      if (overData?.type === "outline-drop" && overData.nodeId) {
        handleAssignAsset(asset, String(overData.nodeId));
        return;
      }

      const nodeId = dropAssetOnPreview(
        previewFrameRef.current,
        previewWrapRef.current,
        pointerRef.current,
        true,
      );
      if (nodeId) {
        handleAssignAsset(asset, nodeId);
      }
    },
    [handleAssignAsset, handleOutlineReorder],
  );

  const handleDragStart = useCallback((event: any) => {
    const dragType = event.active?.data?.current?.type as string | undefined;
    if (dragType === "outline") {
      const nodeId = event.active?.data?.current?.nodeId as string | undefined;
      if (nodeId) setDraggingOutlineId(String(nodeId));
      return;
    }
    const asset = event.active?.data?.current?.asset as AssetItem | undefined;
    if (asset) setDraggingAsset(asset);
  }, []);

  const editorCommands = useMemo(
    () =>
      buildEditorCommands({
        docState,
        undo: () => void docService.undo(),
        redo: () => void docService.redo(),
        sourceDirty,
        runtimeState,
        runtimeActions,
        selectionId: selectedId,
        handleSave,
        handleExportPdf,
        handleResetLayout,
        handleInsertPage,
        handleInsertSection,
        handleInsertParagraph,
        handleInsertFigure,
        handleInsertSlot,
        handleInsertCallout,
        handleInsertTable,
        setFindOpen,
        setPaletteOpen,
        setActiveMode: handleSetActiveMode,
        toggleOutline,
        toggleInspector,
        toggleAssets,
        toggleDiagnostics,
        toggleStatusBar,
        enterFocusMode,
        openAbout: () => setAboutOpen(true),
        openDocSettings: () => setDocSettingsOpen(true),
        openBuildInfo: () => setBuildInfoOpen(true),
        copyDiagnostics: handleCopyDiagnosticsSummary,
      }),
    [
      docState,
      docService,
      sourceDirty,
      runtimeActions,
      runtimeState,
      selectedId,
      handleSave,
      handleExportPdf,
      handleResetLayout,
      handleInsertPage,
      handleInsertSection,
      handleInsertParagraph,
      handleInsertFigure,
      handleInsertSlot,
      handleInsertCallout,
      handleInsertTable,
      setFindOpen,
      setPaletteOpen,
      handleSetActiveMode,
      toggleOutline,
      toggleInspector,
      toggleAssets,
      toggleDiagnostics,
      toggleStatusBar,
      enterFocusMode,
      handleCopyDiagnosticsSummary,
    ],
  );

  const paletteCommands = useMemo(() => {
    return Object.values(editorCommands)
      .filter((command) => command.enabled && command.palette !== false)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [editorCommands]);

  useEffect(() => {
    if (!draggingAsset) return;
    const handler = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", handler);
    return () => window.removeEventListener("pointermove", handler);
  }, [draggingAsset]);

  useEffect(() => {
    if (!showIds) setHoveredId(null);
  }, [showIds]);

  useEffect(() => {
    syncPreviewOverlays();
  }, [syncPreviewOverlays]);

  useEffect(() => {
    if (runtimeState.mode !== "edit") return;
    applySlotSnapshot();
  }, [applySlotSnapshot, doc?.revision, doc?.source, runtimeInputs, runtimeState.mode]);

  useEffect(() => {
    if (runtimeState.mode !== "playback") return;
    applySlotPlaybackTick();
  }, [applySlotPlaybackTick, doc?.revision, doc?.source, runtimeInputs, runtimeState.mode]);

  useEffect(() => {
    syncSlotLabels();
    slotPlaybackRef.current.clear();
    if (runtimeState.mode === "playback") {
      applySlotPlaybackTick();
    } else {
      applySlotSnapshot();
    }
  }, [applySlotPlaybackTick, applySlotSnapshot, previewSrc, runtimeState.mode, syncSlotLabels]);

  useEffect(() => {
    if (frameDraft && frameEntry) {
      applyFrameToPreview(frameDraft);
    }
  }, [applyFrameToPreview, frameDraft, frameEntry]);

  useEffect(() => {
    if (!adjustImageMode || !frameEntry) return;
    const frameDoc = previewFrameRef.current?.contentDocument;
    if (!frameDoc) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const frameTarget = frameTargetRef.current;
      if (!frameTarget || !target || !frameTarget.contains(target)) return;
      event.preventDefault();
      const base = frameDraftRef.current ?? readImageFrame(frameEntry.node);
      frameDragRef.current = { startX: event.clientX, startY: event.clientY, frame: base };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const drag = frameDragRef.current;
        if (!drag) return;
        const dx = moveEvent.clientX - drag.startX;
        const dy = moveEvent.clientY - drag.startY;
        let next = { ...drag.frame };
        if (moveEvent.shiftKey) {
          next.scale = clamp(drag.frame.scale + -dy * 0.005, 0.5, 2.5);
        } else {
          next.offsetX = drag.frame.offsetX + dx;
          next.offsetY = drag.frame.offsetY + dy;
        }
        frameDraftRef.current = next;
        applyFrameToPreview(next);
      };

      const handlePointerUp = () => {
        const finalFrame = frameDraftRef.current;
        if (finalFrame) {
          setFrameDraft(finalFrame);
          commitFrame(finalFrame);
        }
        frameDragRef.current = null;
        frameDoc.removeEventListener("pointermove", handlePointerMove);
        frameDoc.removeEventListener("pointerup", handlePointerUp);
      };

      frameDoc.addEventListener("pointermove", handlePointerMove);
      frameDoc.addEventListener("pointerup", handlePointerUp);
    };

    const handleWheel = (event: WheelEvent) => {
      const target = event.target as Node | null;
      const frameTarget = frameTargetRef.current;
      if (!frameTarget || !target || !frameTarget.contains(target)) return;
      event.preventDefault();
      const base = frameDraftRef.current ?? readImageFrame(frameEntry.node);
      const next = {
        ...base,
        scale: clamp(base.scale + -event.deltaY * 0.0015, 0.5, 2.5),
      };
      frameDraftRef.current = next;
      setFrameDraft(next);
      applyFrameToPreview(next);
      debouncedCommitFrame(next);
    };

    frameDoc.addEventListener("pointerdown", handlePointerDown);
    frameDoc.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      frameDoc.removeEventListener("pointerdown", handlePointerDown);
      frameDoc.removeEventListener("wheel", handleWheel);
    };
  }, [adjustImageMode, applyFrameToPreview, commitFrame, debouncedCommitFrame, frameEntry]);

  useEffect(() => {
    if (!adjustImageMode || !frameEntry) return;
    const handleKey = (event: KeyboardEvent) => {
      if (!frameDraftRef.current) return;
      const delta = event.shiftKey ? 10 : 1;
      let next = { ...frameDraftRef.current };
      let changed = false;
      if (event.key === "ArrowLeft") {
        next.offsetX -= delta;
        changed = true;
      }
      if (event.key === "ArrowRight") {
        next.offsetX += delta;
        changed = true;
      }
      if (event.key === "ArrowUp") {
        next.offsetY -= delta;
        changed = true;
      }
      if (event.key === "ArrowDown") {
        next.offsetY += delta;
        changed = true;
      }
      if (!changed) return;
      event.preventDefault();
      frameDraftRef.current = next;
      setFrameDraft(next);
      applyFrameToPreview(next);
      debouncedCommitFrame(next);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [adjustImageMode, applyFrameToPreview, debouncedCommitFrame, frameEntry]);

  if (docState.status === "loading") {
    return (
      <div className="editor-root">
        <div className="editor-loading-panel">Loading editor state…</div>
      </div>
    );
  }

  if (docState.status === "error") {
    return (
      <div className="editor-root">
          <div className="editor-loading-panel">
            <h2>Unable to load editor</h2>
            <p>{docState.error ?? "Unknown error"}</p>
            <Button type="button" onClick={() => void docService.loadDoc()}>
              Retry
            </Button>
          </div>
        </div>
    );
  }

  return (
    <div className="editor-root" ref={editorRootRef}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDraggingAsset(null);
          setDraggingOutlineId(null);
        }}
      >
      <EditorRuntimeProvider value={runtimeStore}>
      <EditorFrame>
        {docState.pendingExternalChange ? (
          <div className="conflict-bar">
            <span>File changed on disk. Reload?</span>
            <div className="conflict-actions">
              <Button variant="primary" size="sm" onClick={() => docService.acceptExternalReload()}>
                Reload
              </Button>
              <Button variant="ghost" size="sm" onClick={() => docService.dismissExternalReload()}>
                Keep local
              </Button>
            </div>
          </div>
        ) : null}
        {/* Brand comes from @flux-lang/brand; do not fork. */}
        <MenuBar
          commands={editorCommands}
          checked={{
            "view.toggleOutline": outlineVisible,
            "view.toggleInspector": inspectorVisible,
            "view.toggleAssets": assetPanelOpen,
            "view.toggleDiagnostics": diagnosticsOpen,
            "view.showStatusBar": showStatusBar,
          }}
          brandInfo={fluxVersionInfo}
          onBrandVersionClick={() => editorCommands["help.buildInfo"]?.run()}
        />
        {showStatusBar ? (
          <StatusBar
            canSave={sourceDirty || docState.dirty}
            onSave={handleSave}
            onUndo={() => void docService.undo()}
            onRedo={() => void docService.redo()}
            saveLabel={renderSaveStatus(saveStatus, sourceDirty)}
            fileName={getFileName(doc?.docPath)}
            docTitle={doc?.title ?? "Flux Document"}
            revisionLabel={doc?.revision != null ? `rev ${doc.revision}` : "rev —"}
            dirty={sourceDirty || docState.dirty}
            onOpenDocSettings={() => setDocSettingsOpen(true)}
            diagnosticsCount={diagnosticsSummary.warn + diagnosticsSummary.fail}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
            connectionLabel={getConnectionLabel()}
            runtime={{ docstep: runtimeState.docstep, seed: runtimeState.seed, timeSec: runtimeState.timeSec }}
          />
        ) : null}

          <main className="editor-body">
            {outlineVisible ? (
              <>
                <OutlinePane className="editor-pane outline-pane" style={{ width: outlineWidth }}>
                  <div className="pane-header">
                    <div className="pane-heading">
                      <div className="pane-title">Outline</div>
                      <div className="pane-breadcrumb">{breadcrumbLabel}</div>
                    </div>
                    <div className="pane-actions">
                      <Button variant="ghost" size="sm" onClick={() => setAssetPanelOpen((open) => !open)}>
                        {assetPanelOpen ? "Hide Assets" : "Assets"}
                      </Button>
                    </div>
                  </div>
                  <div className="pane-search">
                    <input
                      className="input input-quiet"
                      value={outlineQuery}
                      onChange={(event) => setOutlineQuery(event.target.value)}
                      placeholder="Filter outline…"
                    />
                  </div>
                  <div className="pane-body scroll">
                    {filteredOutline.length ? (
                      <OutlineTree
                        nodes={filteredOutline}
                        selectedId={selectedId}
                        draggingAsset={draggingAsset}
                        draggingOutlineId={draggingOutlineId}
                        onSelect={selectNode}
                      />
                    ) : (
                      <div className="empty">{outlineQuery ? "No matches." : "No outline data."}</div>
                    )}
                  </div>
                  {assetPanelOpen ? (
                    <>
                      <DividerHairline />
                      <div className="pane-header pane-header-sub">
                        <div className="pane-title">Asset Bank</div>
                      </div>
                      <div className="pane-body scroll asset-body">
                        <AssetBrowser assets={doc?.assetsIndex ?? []} />
                      </div>
                    </>
                  ) : null}
                </OutlinePane>

                <div
                  className="pane-resizer"
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={startResize("left")}
                />
              </>
            ) : null}

            <PageStage>
              <div className="page-stage-inner">
                <div className="paper-stack">
                  <div className="preview-wrap" ref={previewWrapRef}>
                    <iframe
                      ref={previewFrameRef}
                      title="Flux preview"
                      src={previewSrc}
                      sandbox="allow-same-origin allow-scripts allow-forms allow-downloads"
                      onLoad={handlePreviewLoad}
                    />
                  </div>
                </div>
              </div>
            </PageStage>

            {inspectorVisible ? (
              <>
                <div
                  className="pane-resizer"
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={startResize("right")}
                />
                <InspectorPane className="editor-pane inspector-pane" style={{ width: inspectorWidth }}>
                  {activeMode === "source" ? (
                    <>
                      <div className="pane-header">
                        <div className="pane-title">Source</div>
                        <div className="pane-actions">
                          <span className={`status-pill ${sourceDirty ? "status-dirty" : "status-saved"}`}>
                            {sourceDirty ? "Unsaved" : "Clean"}
                          </span>
                          <Button variant="ghost" size="sm" onClick={handleApplySource} disabled={!sourceDirty || docState.isApplying}>
                            Apply
                          </Button>
                        </div>
                      </div>
                      <div className="pane-body source-body">
                        <MonacoEditor
                          height="100%"
                          language="plaintext"
                          theme="vs-dark"
                          value={sourceDraft}
                          onChange={(value) => setSourceDraft(value ?? "")}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            wordWrap: "on",
                            scrollBeyondLastLine: false,
                          }}
                          onMount={(editor, monacoInstance) => {
                            monacoRef.current = monacoInstance;
                            monacoEditorRef.current = editor;
                            updateMonacoMarkers();
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="pane-header">
                        <div className="pane-title">Inspector</div>
                        <div className="pane-actions">
                          <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)}>
                            Palette
                          </Button>
                        </div>
                      </div>
                      <div className="pane-body scroll">
                        {selectedNode ? (
                          <div className="inspector-content">
                            <div className="inspector-header">
                              <div className="inspector-title">{labelMap.get(selectedNode.id) ?? selectedNode.id}</div>
                              <div className="inspector-meta">
                                <span>{selectedNode.kind}</span>
                                <button type="button" className="id-pill" onClick={() => handleCopyId(selectedNode.id)}>
                                  #{selectedNode.id}
                                </button>
                              </div>
                              <div className="inspector-actions">
                                <Button variant="ghost" size="sm" type="button" disabled>
                                  Duplicate
                                </Button>
                                <Button variant="ghost" size="sm" type="button" disabled>
                                  Delete
                                </Button>
                              </div>
                            </div>
                            {transformError ? <div className="inspector-alert">{transformError}</div> : null}
                            {illegalSlotProps && selectedNode ? (
                              <div className="inspector-alert slot-alert">
                                <div>Refresh/transition can only be set on slots.</div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const props = { ...(selectedNode.props ?? {}) } as Record<string, unknown>;
                                    delete props.refresh;
                                    delete props.transition;
                                    const cleaned: DocumentNode = {
                                      ...selectedNode,
                                      props,
                                    } as DocumentNode;
                                    delete (cleaned as any).refresh;
                                    delete (cleaned as any).transition;
                                    void handleTransform({ type: "replaceNode", id: selectedNode.id, node: cleaned });
                                  }}
                                >
                                  Fix
                                </Button>
                              </div>
                            ) : null}

                            {activeTextNode ? (
                              <div className="inspector-section">
                                <div className="section-title">Content</div>
                                {activeMode === "edit" ? (
                                  <TextContentEditor
                                    node={activeTextNode}
                                    onRichTextUpdate={(json) => debouncedRichTextUpdate(activeTextNode.id, json)}
                                    onPlainTextUpdate={(text) => debouncedPlainTextUpdate(activeTextNode.id, text)}
                                    onPlainTextCommit={(text) => commitPlainTextUpdate(activeTextNode.id, text)}
                                    onInlineSlotSelect={(id) => {
                                      if (id) {
                                        selectNode(id);
                                      }
                                    }}
                                    onReady={(editor) => {
                                      richEditorRef.current = editor;
                                    }}
                                    hydrationKey={`${docState.docRev}:${activeTextNode.id}`}
                                    allowHydrate={!docState.dirty}
                                    onDirty={() => docService.markDirtyDraft()}
                                    highlightQuery={findOpen ? findQuery : undefined}
                                  />
                                ) : (
                                  <div className="section-hint">Switch to Edit Text to modify content.</div>
                                )}
                              </div>
                            ) : activeMode === "edit" ? (
                              <div className="inspector-section">
                                <div className="section-title">Content</div>
                                <div className="section-hint">Select a text node to edit.</div>
                              </div>
                            ) : null}

                            {selectedNode.kind === "inline_slot" || selectedNode.kind === "slot" ? (
                              <SlotInspector
                                node={selectedNode}
                                assets={doc?.assetsIndex ?? []}
                                runtime={runtimeInputs}
                                reducedMotion={runtimeState.reducedMotion}
                                onLiteralChange={(textId, text) => applyTextContent(textId, { text })}
                                onGeneratorChange={(spec) => applySlotGenerator(selectedNode.id, spec)}
                                onPropsChange={(payload) => handleTransform({ type: "setSlotProps", id: selectedNode.id, ...payload })}
                                onPreviewTransition={handlePreviewTransition}
                                lockReset={docState.dirty || docState.isApplying}
                                onDirty={() => docService.markDirtyDraft()}
                              />
                            ) : null}

                            {captionTarget ? (
                              <CaptionInspector
                                label="Caption"
                                value={captionTarget.value}
                                resetToken={`${captionTarget.id}-${doc?.docPath ?? "doc"}`}
                                lockReset={docState.dirty || docState.isApplying}
                                onDirty={() => docService.markDirtyDraft()}
                                onCommit={(value) => {
                                  if (captionTarget.kind === "prop") {
                                    handleTransform({
                                      type: "setNodeProps",
                                      id: captionTarget.id,
                                      props: { caption: { kind: "LiteralValue", value } },
                                    });
                                    return;
                                  }
                                  applyTextContent(captionTarget.id, { text: value });
                                }}
                              />
                            ) : null}

                            {frameEntry && frameDraft ? (
                              <ImageFrameInspector
                                frame={frameDraft}
                                adjustMode={adjustImageMode}
                                onToggleAdjust={() => setAdjustImageMode((prev) => !prev)}
                                onChange={(next) => {
                                  setFrameDraft(next);
                                  frameDraftRef.current = next;
                                  applyFrameToPreview(next);
                                  debouncedCommitFrame(next);
                                }}
                                onCommit={(next) => {
                                  setFrameDraft(next);
                                  frameDraftRef.current = next;
                                  applyFrameToPreview(next);
                                  commitFrame(next);
                                }}
                                onReset={() => {
                                  const next = defaultImageFrame();
                                  setFrameDraft(next);
                                  frameDraftRef.current = next;
                                  applyFrameToPreview(next);
                                  commitFrame(next);
                                }}
                              />
                            ) : selectedNode.kind === "figure" ? (
                              <div className="inspector-section">
                                <div className="section-title">Figure</div>
                                <div className="section-hint">Drop an asset onto the figure in the preview or outline.</div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="inspector-empty">Select a node to inspect properties.</div>
                        )}
                      </div>
                    </>
                  )}
                </InspectorPane>
              </>
            ) : null}
          </main>
          <EditorFooter
            docTitle={doc?.title ?? "Untitled"}
            docPath={doc?.docPath}
            saveState={footerSaveState}
            modeLabel={footerModeLabel}
            breadcrumb={breadcrumbLabel}
            playbackReadout={playbackReadout}
            diagnosticsSummary={{ errors: diagnosticsSummary.fail, warnings: diagnosticsSummary.warn }}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
          />

          {diagnosticsOpen ? (
            <ModalShell title="Diagnostics" onClose={() => setDiagnosticsOpen(false)}>
              {diagnosticsItems.length ? (
                <div className="diagnostics-list">
                  {diagnosticsItems.map((item, index) => (
                    <div key={`${item.level}-${index}`} className={`diagnostics-item diagnostics-${item.level}`}>
                      <div className="diagnostics-kind">{item.level.toUpperCase()}</div>
                      <div className="diagnostics-message">{item.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="diagnostics-empty">No diagnostics reported.</div>
              )}
            </ModalShell>
          ) : null}

          {aboutOpen ? (
            <ModalShell title="About Flux Editor" onClose={() => setAboutOpen(false)}>
              <div className="modal-body">
                <p className="flux-about-tagline">{FLUX_TAGLINE}</p>
                <div className="settings-row">
                  <span>Version</span>
                  <span>{formatFluxVersion(fluxVersionInfo.version)}</span>
                </div>
                <div className="modal-meta">{buildInfoLabel}</div>
              </div>
            </ModalShell>
          ) : null}

          {docSettingsOpen ? (
            <ModalShell title="Document Settings" onClose={() => setDocSettingsOpen(false)}>
              <div className="modal-body">
                <div className="settings-row">
                  <span>Filename</span>
                  <span>{getFileName(doc?.docPath)}</span>
                </div>
                <div className="settings-row">
                  <span>Title</span>
                  <span>{doc?.title ?? "Flux Document"}</span>
                </div>
                <div className="settings-row">
                  <span>Revision</span>
                  <span>{doc?.revision != null ? `rev ${doc.revision}` : "—"}</span>
                </div>
                <div className="settings-row">
                  <span>Preview Path</span>
                  <span>{doc?.previewPath ?? "—"}</span>
                </div>
              </div>
            </ModalShell>
          ) : null}

          {buildInfoOpen ? (
            <ModalShell title="Version / Build Info" onClose={() => setBuildInfoOpen(false)}>
              <div className="modal-body">
                <div className="settings-row">
                  <span>Version</span>
                  <span>{formatFluxVersion(fluxVersionInfo.version)}</span>
                </div>
                <div className="settings-row">
                  <span>Channel</span>
                  <span>{fluxVersionInfo.channel ?? "stable"}</span>
                </div>
                <div className="settings-row">
                  <span>Build</span>
                  <span>{buildInfo.id ?? "—"}</span>
                </div>
                <div className="settings-row">
                  <span>Distribution</span>
                  <span>{buildInfo.dist ?? "—"}</span>
                </div>
                {fluxVersionInfo.sha ? (
                  <div className="settings-row">
                    <span>SHA</span>
                    <span>{fluxVersionInfo.sha}</span>
                  </div>
                ) : null}
                <div className="settings-row">
                  <span>Tagline</span>
                  <span>{fluxVersionInfo.tagline}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={handleCopyBuildInfo}>
                  Copy Build Info
                </Button>
              </div>
            </ModalShell>
          ) : null}

          {toast ? <div className={`toast toast-${toast.kind}`}>{toast.message}</div> : null}

          {findOpen ? (
            <div className="modal-layer" aria-hidden={!findOpen}>
              <div className="modal-scrim" onClick={() => setFindOpen(false)} />
              <div className="modal-panel find-panel" role="dialog" aria-modal="true">
                  <div className="modal-header">
                    <span className="modal-title">Find in Document</span>
                    <Button variant="ghost" size="sm" iconOnly onClick={() => setFindOpen(false)}>
                      ✕
                    </Button>
                  </div>
                <input
                  className="input"
                  autoFocus
                  value={findQuery}
                  onChange={(event) => {
                    setFindQuery(event.target.value);
                    setFindIndex(0);
                  }}
                  placeholder="Search text…"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (findResults.length) {
                        setFindIndex((prev) => (prev + 1) % findResults.length);
                      }
                    }
                    if (event.key === "Escape") {
                      setFindOpen(false);
                    }
                  }}
                />
                {findResults.length ? (
                  <div className="find-results">
                    {groupedFindResults.map((group) => (
                      <div key={group.label} className="find-group">
                        <div className="find-group-title">{group.label}</div>
                        {group.items.map((item) => {
                          const idx = findIndexLookup.get(item.id) ?? 0;
                          return (
                            <button
                              key={item.id}
                              className={`find-result ${idx === findIndex ? "is-active" : ""}`}
                              onClick={() => {
                                setFindIndex(idx);
                                selectNode(item.id);
                              }}
                            >
                              <div className="find-text">{item.text}</div>
                              <div className="find-breadcrumbs">{item.breadcrumbs.join(" · ")}</div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : findQuery ? (
                  <div className="find-empty">No matches</div>
                ) : null}
              </div>
            </div>
          ) : null}

          {paletteOpen ? (
            <CommandPalette
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              commands={paletteCommands}
            />
          ) : null}
      </EditorFrame>
      </EditorRuntimeProvider>

        <DragOverlay>
          {draggingAsset ? (
            <div className="asset-card drag-overlay">
              <div className="asset-thumb" style={{ backgroundImage: `url(${assetPreviewUrl(draggingAsset)})` }} />
              <div className="asset-title">{draggingAsset.name}</div>
            </div>
          ) : draggingOutlineId ? (
            <div className="outline-drag-overlay">
              Moving {labelMap.get(draggingOutlineId) ?? draggingOutlineId}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function OutlineTree({
  nodes,
  selectedId,
  draggingAsset,
  draggingOutlineId,
  onSelect,
}: {
  nodes: OutlineNode[];
  selectedId?: string | null;
  draggingAsset?: AssetItem | null;
  draggingOutlineId?: string | null;
  onSelect: (id: string) => void;
}) {
  if (!nodes.length) return <div className="empty">No outline data.</div>;
  return (
    <div className="outline-tree">
      {nodes.map((node) => (
        <OutlineItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          draggingAsset={draggingAsset}
          draggingOutlineId={draggingOutlineId}
          parentKind={null}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function OutlineItem({
  node,
  depth,
  selectedId,
  draggingAsset,
  draggingOutlineId,
  parentKind,
  onSelect,
}: {
  node: OutlineNode;
  depth: number;
  selectedId?: string | null;
  draggingAsset?: AssetItem | null;
  draggingOutlineId?: string | null;
  parentKind?: string | null;
  onSelect: (id: string) => void;
}) {
  const canDrag = parentKind === "section";
  const isContainer = node.kind === "page" || node.kind === "section";
  const droppableId =
    node.kind === "page" ? `page:${node.id}` : node.kind === "section" ? `section:${node.id}` : `node:${node.id}`;
  const draggable = useDraggable({
    id: `outline-drag:${node.id}`,
    data: { type: "outline", nodeId: node.id },
    disabled: !canDrag,
  });
  const droppable = useDroppable({
    id: droppableId,
    data: {
      type: "outline-drop",
      nodeId: node.id,
      containerType: isContainer ? (node.kind as "page" | "section") : undefined,
      containerId: isContainer ? node.id : undefined,
    },
  });
  const isSelected = selectedId === node.id;
  const allowAssetDrop = node.kind === "figure" || node.kind === "slot" || node.kind === "image";
  const allowReorderDrop = parentKind === "section" || isContainer;
  const showDropTarget =
    droppable.isOver && ((draggingAsset && allowAssetDrop) || (draggingOutlineId && allowReorderDrop));
  return (
    <div className="outline-item">
      <button
        type="button"
        ref={(el) => {
          droppable.setNodeRef(el);
          draggable.setNodeRef(el);
        }}
        className={`outline-btn ${isSelected ? "is-selected" : ""} ${showDropTarget ? "is-over" : ""} ${
          draggable.isDragging ? "is-dragging" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 16}px` }}
        onClick={() => onSelect(node.id)}
        {...draggable.attributes}
        {...draggable.listeners}
      >
        <span className="outline-kind">{node.kind}</span>
        <span className="outline-label">{node.label}</span>
      </button>
      {node.children.length ? (
        <div className="outline-children">
          {node.children.map((child) => (
            <OutlineItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              draggingAsset={draggingAsset}
              draggingOutlineId={draggingOutlineId}
              parentKind={node.kind}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AssetBrowser({ assets }: { assets: AssetItem[] }) {
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");

  const tags = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((asset) => asset.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    let results = assets;
    if (query.trim()) {
      results = matchSorter(results, query.trim(), { keys: ["name", "path", "kind", "tags", "bankName"] });
    }
    if (activeTags.length) {
      results = results.filter((asset) => activeTags.every((tag) => asset.tags.includes(tag)));
    }
    return results;
  }, [assets, query, activeTags]);

  return (
    <div className="asset-browser">
      <div className="asset-controls">
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search assets…"
        />
        <div className="asset-view-toggle">
          <Button
            variant="ghost"
            size="sm"
            className={view === "grid" ? "is-active" : undefined}
            onClick={() => setView("grid")}
          >
            Grid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={view === "list" ? "is-active" : undefined}
            onClick={() => setView("list")}
          >
            List
          </Button>
        </div>
      </div>
      {tags.length ? (
        <div className="asset-tags">
          {tags.slice(0, 10).map((tag) => (
            <button
              key={tag}
              className={`tag-chip ${activeTags.includes(tag) ? "is-active" : ""}`}
              onClick={() =>
                setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
              }
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
      <div className={`asset-list ${view}`}>
        {filtered.map((asset) => (
          <AssetCard key={asset.id} asset={asset} view={view} />
        ))}
      </div>
    </div>
  );
}

function AssetCard({ asset, view }: { asset: AssetItem; view: "grid" | "list" }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: asset.id,
    data: { type: "asset", asset },
  });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className={`asset-card ${view} ${isDragging ? "is-dragging" : ""}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className="asset-thumb" style={{ backgroundImage: `url(${assetPreviewUrl(asset)})` }} />
      <div className="asset-meta">
        <div className="asset-title">{asset.name}</div>
        <div className="asset-path">{asset.path}</div>
        {asset.bankName ? <div className="asset-bank">{asset.bankName}</div> : null}
      </div>
    </div>
  );
}

class EditorErrorBoundary extends Component<{ onError: (error: Error) => void; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function TextContentEditor({
  node,
  onRichTextUpdate,
  onPlainTextUpdate,
  onPlainTextCommit,
  onInlineSlotSelect,
  onReady,
  hydrationKey,
  allowHydrate,
  onDirty,
  highlightQuery,
}: {
  node: DocumentNode;
  onRichTextUpdate: (json: JSONContent) => void;
  onPlainTextUpdate: (text: string) => void;
  onPlainTextCommit: (text: string) => void;
  onInlineSlotSelect: (id: string | null) => void;
  onReady?: (editor: any | null) => void;
  hydrationKey: string;
  allowHydrate: boolean;
  onDirty?: () => void;
  highlightQuery?: string;
}) {
  const [plainDraft, setPlainDraft] = useState(() => extractPlainText(node));
  const [fallback, setFallback] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (!allowHydrate) return;
    setPlainDraft(extractPlainText(node));
  }, [node.id, node.props, node.children, allowHydrate]);

  useEffect(() => {
    setEditorReady(false);
    setFallback(false);
  }, [node.id]);

  useEffect(() => {
    if (editorReady || fallback) return;
    const timer = window.setTimeout(() => setFallback(true), 3000);
    return () => window.clearTimeout(timer);
  }, [editorReady, fallback]);

  useEffect(() => {
    if (fallback) onReady?.(null);
  }, [fallback, onReady]);

  if (fallback) {
    return (
      <div className="text-fallback-editor">
        <div className="fallback-banner">TipTap unavailable. Using fallback editor.</div>
        <textarea
          className="textarea"
          value={plainDraft}
          onChange={(event) => {
            const next = event.target.value;
            setPlainDraft(next);
            onDirty?.();
            onPlainTextUpdate(next);
          }}
          onBlur={() => onPlainTextCommit(plainDraft)}
          rows={6}
          autoFocus
        />
      </div>
    );
  }

  return (
    <EditorErrorBoundary
      onError={() => {
        setFallback(true);
      }}
    >
      <RichTextEditor
        node={node}
        onUpdate={onRichTextUpdate}
        onInlineSlotSelect={onInlineSlotSelect}
        onReady={(editor) => {
          setEditorReady(Boolean(editor));
          onReady?.(editor);
        }}
        hydrationKey={hydrationKey}
        allowHydrate={allowHydrate}
        onDirty={onDirty}
        initialText={plainDraft}
        highlightQuery={highlightQuery}
      />
    </EditorErrorBoundary>
  );
}

function CaptionInspector({
  label,
  value,
  onCommit,
  lockReset,
  resetToken,
  onDirty,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  lockReset?: boolean;
  resetToken: string;
  onDirty?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (lockReset || isFocused) return;
    setDraft(value);
  }, [value, lockReset, resetToken, isFocused]);

  return (
    <div className="inspector-section">
      <div className="section-title">{label}</div>
      <label className="field">
        <span>Text</span>
        <input
          className="input"
          data-testid="inspector-field:caption"
          value={draft}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => {
            setDraft(event.target.value);
            onDirty?.();
          }}
          onBlur={() => {
            setIsFocused(false);
            onCommit(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit(draft);
            }
          }}
        />
      </label>
    </div>
  );
}

function SlotInspector({
  node,
  assets,
  runtime,
  reducedMotion,
  onLiteralChange,
  onGeneratorChange,
  onPropsChange,
  onPreviewTransition,
  lockReset,
  onDirty,
}: {
  node: DocumentNode;
  assets: AssetItem[];
  runtime: EditorRuntimeInputs;
  reducedMotion: boolean;
  onLiteralChange: (textId: string, text: string) => void;
  onGeneratorChange: (generator: SlotGeneratorSpec) => void;
  onPropsChange: (payload: { reserve?: string; fit?: string; refresh?: RefreshPolicy; transition?: SlotTransitionSpec }) => void;
  onPreviewTransition: (payload: { current: SlotValue; next: SlotValue; transition?: SlotTransitionSpec }) => void;
  lockReset?: boolean;
  onDirty?: () => void;
}) {
  const program = useMemo(() => readSlotProgram(node), [node]);
  const baseSpec = program.spec;
  const refreshPolicy = (node as any).refresh as RefreshPolicy | undefined;
  const transitionPolicy = (node as any).transition as SlotTransitionSpec | undefined;
  const [variants, setVariants] = useState<Array<string | null>>(() => {
    if (baseSpec?.kind === "choose" || baseSpec?.kind === "cycle") return [...baseSpec.values];
    if (baseSpec?.kind === "literal") return [baseSpec.value];
    return [];
  });
  const [tagsDraft, setTagsDraft] = useState<string[]>(() => (baseSpec?.kind === "assetsPick" ? baseSpec.tags : []));
  const [tagInput, setTagInput] = useState("");
  const [bankDraft, setBankDraft] = useState(() => (baseSpec?.kind === "assetsPick" ? baseSpec.bank ?? "" : ""));
  const [rateDraft, setRateDraft] = useState<number>(() => (baseSpec?.kind === "poisson" ? baseSpec.ratePerSec : 1));
  const [reserve, setReserve] = useState(getLiteralString(node.props?.reserve) ?? "fixedWidth(8, ch)");
  const [fit, setFit] = useState(getLiteralString(node.props?.fit) ?? "ellipsis");
  const [isFocused, setIsFocused] = useState(false);
  const focusCountRef = useRef(0);

  const handleFocus = () => {
    focusCountRef.current += 1;
    setIsFocused(true);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      focusCountRef.current = Math.max(0, focusCountRef.current - 1);
      if (focusCountRef.current === 0) setIsFocused(false);
    }, 0);
  };

  useEffect(() => {
    if (lockReset || isFocused) return;
    if (baseSpec?.kind === "choose" || baseSpec?.kind === "cycle") {
      setVariants([...baseSpec.values]);
    } else if (baseSpec?.kind === "literal") {
      setVariants([baseSpec.value]);
    } else {
      setVariants([]);
    }
  }, [node.id, baseSpec?.kind, JSON.stringify(baseSpec), lockReset, isFocused]);

  useEffect(() => {
    if (lockReset || isFocused) return;
    if (baseSpec?.kind === "assetsPick") setTagsDraft(baseSpec.tags);
  }, [baseSpec?.kind, JSON.stringify(baseSpec), lockReset, isFocused]);

  useEffect(() => {
    if (lockReset || isFocused) return;
    if (baseSpec?.kind === "assetsPick") setBankDraft(baseSpec.bank ?? "");
  }, [baseSpec?.kind, baseSpec && "bank" in baseSpec ? baseSpec.bank : "", lockReset, isFocused]);

  useEffect(() => {
    if (lockReset || isFocused) return;
    if (baseSpec?.kind === "poisson") setRateDraft(baseSpec.ratePerSec);
  }, [baseSpec?.kind, baseSpec && "ratePerSec" in baseSpec ? baseSpec.ratePerSec : 0, lockReset, isFocused]);

  useEffect(() => {
    if (lockReset || isFocused) return;
    setReserve(getLiteralString(node.props?.reserve) ?? "fixedWidth(8, ch)");
    setFit(getLiteralString(node.props?.fit) ?? "ellipsis");
  }, [node.id, node.props, lockReset, isFocused]);

  const effectiveSpec = useMemo(() => {
    if (!baseSpec) return null;
    if (baseSpec.kind === "choose" || baseSpec.kind === "cycle") {
      return { ...baseSpec, values: variants };
    }
    if (baseSpec.kind === "literal") {
      return { ...baseSpec, value: variants[0] ?? "" };
    }
    if (baseSpec.kind === "assetsPick") {
      return { ...baseSpec, tags: tagsDraft, bank: bankDraft || undefined };
    }
    if (baseSpec.kind === "poisson") {
      return { ...baseSpec, ratePerSec: rateDraft };
    }
    return baseSpec;
  }, [baseSpec, bankDraft, rateDraft, tagsDraft, variants]);

  const currentState = useMemo(
    () => computeSlotValue(effectiveSpec, refreshPolicy, runtime, node.id, assets),
    [assets, effectiveSpec, node.id, refreshPolicy, runtime],
  );

  const currentValue = currentState.value.kind === "asset" ? currentState.value.label : currentState.value.text;

  const simulation = useMemo(
    () => simulateSlotChanges(effectiveSpec, refreshPolicy, runtime, node.id, assets, 12),
    [assets, effectiveSpec, node.id, refreshPolicy, runtime],
  );

  const candidateAssets = useMemo(() => {
    if (effectiveSpec?.kind !== "assetsPick") return [];
    return filterAssetsByTags(assets, effectiveSpec.tags, effectiveSpec.bank);
  }, [assets, effectiveSpec]);

  const availableBanks = useMemo(() => {
    const banks = new Set<string>();
    assets.forEach((asset) => {
      if (asset.bankName) banks.add(asset.bankName);
    });
    return Array.from(banks);
  }, [assets]);

  const generatorDetails = useMemo(() => describeGenerator(effectiveSpec), [effectiveSpec]);

  const [pushGeneratorUpdate, flushGeneratorUpdate] = useDebouncedCallback((spec: SlotGeneratorSpec | null) => {
    if (!spec) return;
    if (spec.kind === "literal" && program.source.kind === "text" && program.source.textId) {
      onLiteralChange(program.source.textId, spec.value);
      return;
    }
    onGeneratorChange(spec);
  }, 220);

  useEffect(
    () => () => {
      flushGeneratorUpdate();
    },
    [flushGeneratorUpdate],
  );

  const commitChooseCycleVariants = (nextValues: Array<string | null>) => {
    if (!isChooseCycleSpec(baseSpec)) return;
    const nextSpec = { ...baseSpec, values: nextValues };
    if (hasEmptyValue(nextSpec)) return;
    onGeneratorChange(nextSpec);
  };

  const handleVariantChange = (index: number, value: string) => {
    onDirty?.();
    const next = variants.map((item, idx) => (idx === index ? value : item));
    setVariants(next);
    if (baseSpec?.kind === "literal") {
      pushGeneratorUpdate({ ...baseSpec, value });
    }
  };

  const handleVariantCommit = (index: number, value: string) => {
    const next = variants.map((item, idx) => (idx === index ? value : item));
    setVariants(next);
    commitChooseCycleVariants(next);
  };

  const handleAddVariant = () => {
    onDirty?.();
    const promotion = promoteVariants(baseSpec, variants);
    if (!promotion) return;
    setVariants(promotion.nextVariants);
    onGeneratorChange(promotion.nextSpec);
  };

  const handleRemoveVariant = (index: number) => {
    onDirty?.();
    const next = variants.filter((_, idx) => idx !== index);
    setVariants(next);
    if (baseSpec?.kind === "choose" || baseSpec?.kind === "cycle") {
      commitChooseCycleVariants(next);
    } else if (baseSpec?.kind === "literal") {
      onGeneratorChange({ kind: "choose", values: next });
    }
  };

  const handleMoveVariant = (index: number, delta: number) => {
    onDirty?.();
    const next = [...variants];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moving] = next.splice(index, 1);
    next.splice(target, 0, moving);
    setVariants(next);
    if (baseSpec?.kind === "choose" || baseSpec?.kind === "cycle") {
      commitChooseCycleVariants(next);
    } else if (baseSpec?.kind === "literal") {
      onGeneratorChange({ kind: "choose", values: next });
    }
  };

  const showVariants =
    baseSpec?.kind === "choose" || baseSpec?.kind === "cycle" || baseSpec?.kind === "literal";
  const isNonEnumerable = !showVariants && baseSpec?.kind !== "assetsPick";

  const nextPreviewValue = useMemo(() => {
    if (!effectiveSpec || !simulation.length) return null;
    const next = simulation[0];
    return resolveSlotValueForIndex(effectiveSpec, runtime.seed, node.id, next.eventIndex, assets);
  }, [assets, effectiveSpec, node.id, runtime.seed, simulation]);

  const handlePreviewTransition = () => {
    if (!nextPreviewValue) return;
    onPreviewTransition({ current: currentState.value, next: nextPreviewValue, transition: transitionPolicy });
  };

  return (
    <div className="inspector-section slot-program-section">
      <div className="section-title">Slot</div>
      <div className="slot-panels">
        <div className="slot-panel">
          <div className="panel-title">Content</div>
          <div className="slot-current">
            <div className="slot-current-info">
              <div className="slot-current-value">{currentValue || "—"}</div>
              {currentState.value.kind === "asset" && currentState.value.asset ? (
                <div className="slot-current-meta">
                  {currentState.value.asset.id ? <span>ID: {currentState.value.asset.id}</span> : null}
                  {currentState.value.asset.path ? <span>Path: {currentState.value.asset.path}</span> : null}
                </div>
              ) : null}
            </div>
            {currentState.value.kind === "asset" && currentState.value.asset ? (
              <div
                className="slot-current-media"
                style={{ backgroundImage: `url(${assetPreviewUrl(currentState.value.asset)})` }}
              />
            ) : null}
          </div>

          <div className="slot-subtitle">Source / generator</div>
          <div className="slot-source">
            {generatorDetails.length ? (
              generatorDetails.map((detail) => (
                <div key={detail.label} className="slot-source-row">
                  <span>{detail.label}</span>
                  <span>{detail.value}</span>
                </div>
              ))
            ) : (
              <div className="section-hint">No generator metadata available.</div>
            )}
          </div>

          {baseSpec?.kind === "assetsPick" ? (
            <div className="slot-tags-editor">
              <div className="slot-subtitle">Tags</div>
              <div className="slot-tags">
                {tagsDraft.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-chip"
                    onClick={() => {
                      const next = tagsDraft.filter((item) => item !== tag);
                      setTagsDraft(next);
                      onDirty?.();
                      onGeneratorChange({ ...baseSpec, tags: next, bank: bankDraft || undefined });
                    }}
                  >
                    {tag} ✕
                  </button>
                ))}
                <input
                  className="input tag-input"
                  value={tagInput}
                  placeholder="Add tag"
                  onFocus={handleFocus}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      const nextTag = tagInput.trim().replace(/,$/, "");
                      if (!nextTag) return;
                      const next = Array.from(new Set([...tagsDraft, nextTag]));
                      setTagsDraft(next);
                      setTagInput("");
                      onDirty?.();
                      onGeneratorChange({ ...baseSpec, tags: next, bank: bankDraft || undefined });
                    }
                  }}
                  onBlur={() => {
                    handleBlur();
                    const nextTag = tagInput.trim();
                    if (!nextTag) return;
                    const next = Array.from(new Set([...tagsDraft, nextTag]));
                    setTagsDraft(next);
                    setTagInput("");
                    onDirty?.();
                    onGeneratorChange({ ...baseSpec, tags: next, bank: bankDraft || undefined });
                  }}
                />
              </div>
              {availableBanks.length ? (
                <label className="field">
                  <span>Bank</span>
                  <select
                    className="select"
                    value={bankDraft}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={(event) => {
                      const next = event.target.value;
                      setBankDraft(next);
                      onDirty?.();
                      onGeneratorChange({ ...baseSpec, tags: tagsDraft, bank: next || undefined });
                    }}
                  >
                    <option value="">Any</option>
                    {availableBanks.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {baseSpec?.kind === "poisson" ? (
            <label className="field">
              <span>Rate / sec</span>
              <input
                className="input"
                type="number"
                value={rateDraft}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRateDraft(next);
                  onDirty?.();
                  onGeneratorChange({ ...baseSpec, ratePerSec: next });
                }}
              />
            </label>
          ) : null}

          {showVariants ? (
            <>
              <div className="slot-subtitle">Variants</div>
              <div className="variant-list">
                {variants.map((value, index) => (
                  <div key={index} className="variant-row">
                    <input
                      className="input"
                      data-testid={`inspector-field:slot-variant-${index}`}
                      value={value ?? ""}
                      onFocus={handleFocus}
                      onBlur={(event) => {
                        handleBlur();
                        handleVariantCommit(index, event.target.value);
                      }}
                      onChange={(event) => handleVariantChange(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleVariantCommit(index, event.currentTarget.value);
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <div className="variant-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => handleMoveVariant(index, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => handleMoveVariant(index, 1)}
                        disabled={index === variants.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => handleRemoveVariant(index)}
                        disabled={variants.length <= 1 && baseSpec?.kind === "literal"}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid="inspector-action:add-variant"
                  onClick={handleAddVariant}
                >
                  Add variant
                </Button>
              </div>
            </>
          ) : isNonEnumerable ? (
            <div className="slot-non-enum">
              <div className="section-hint">This generator is probabilistic; edit its parameters above.</div>
            </div>
          ) : null}

          {baseSpec?.kind === "assetsPick" ? (
            <div className="slot-candidates">
              <div className="slot-subtitle">Candidates</div>
              {candidateAssets.length ? (
                <div className="slot-candidates-grid">
                  {candidateAssets.slice(0, 8).map((asset) => (
                    <div key={asset.id} className="slot-candidate">
                      <div className="slot-candidate-thumb" style={{ backgroundImage: `url(${assetPreviewUrl(asset)})` }} />
                      <div className="slot-candidate-label">{asset.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="section-hint">No assets match the current tags.</div>
              )}
            </div>
          ) : null}

          <div className="slot-sim">
            <div className="slot-subtitle">Simulate next 12 changes</div>
            {simulation.length ? (
              <div className="slot-sim-table">
                <div className="slot-sim-head">
                  <span>Bucket</span>
                  <span>Time</span>
                  <span>Value</span>
                  <span>Hash</span>
                </div>
                {simulation.map((row) => (
                  <div key={`${row.bucket}-${row.timeSec}-${row.hash}`} className="slot-sim-row">
                    <span>{row.bucket}</span>
                    <span>{row.timeSec.toFixed(2)}s</span>
                    <span>{row.value}</span>
                    <span>{row.hash}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="section-hint">No upcoming refresh events.</div>
            )}
          </div>

          <div className="slot-layout">
            <label className="field">
              <span>Reserve</span>
              <input
                className="input"
                value={reserve}
                onFocus={handleFocus}
                onChange={(event) => {
                  setReserve(event.target.value);
                  onDirty?.();
                }}
                onBlur={() => {
                  handleBlur();
                  onPropsChange({ reserve });
                }}
              />
            </label>
            <label className="field">
              <span>Fit</span>
              <select
                className="select"
                value={fit}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={(event) => {
                  setFit(event.target.value);
                  onDirty?.();
                  onPropsChange({ fit: event.target.value });
                }}
              >
                {"clip,ellipsis,shrink,scaleDown".split(",").map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="slot-panel">
          <div className="panel-title">Refresh</div>
          <RefreshEditor value={refreshPolicy} onChange={(next) => onPropsChange({ refresh: next })} />
        </div>

        <div className="slot-panel">
          <div className="panel-title">Transition</div>
          <TransitionEditor
            value={transitionPolicy}
            reducedMotion={reducedMotion}
            onChange={(next) => onPropsChange({ transition: next })}
          />
          <Button type="button" variant="ghost" size="sm" onClick={handlePreviewTransition}>
            Preview transition
          </Button>
        </div>
      </div>
    </div>
  );
}

function RefreshEditor({
  value,
  onChange,
}: {
  value: RefreshPolicy | undefined;
  onChange: (next: RefreshPolicy) => void;
}) {
  const normalized = useMemo(() => normalizeRefreshPolicy(value as any), [value]);
  const [mode, setMode] = useState<
    "never" | "docstep" | "every" | "at" | "atEach" | "poisson" | "chance"
  >("docstep");
  const [everyDuration, setEveryDuration] = useState("1s");
  const [everyPhase, setEveryPhase] = useState("");
  const [atTime, setAtTime] = useState("1s");
  const [atEachTimes, setAtEachTimes] = useState("1s, 2s");
  const [poissonRate, setPoissonRate] = useState("1");
  const [chanceP, setChanceP] = useState("0.4");
  const [chanceEveryKind, setChanceEveryKind] = useState<"docstep" | "duration">("docstep");
  const [chanceEveryDuration, setChanceEveryDuration] = useState("1s");

  useEffect(() => {
    const kind = normalized.kind === "docstep" ? "docstep" : normalized.kind === "never" ? "never" : normalized.kind;
    if (
      kind === "every" ||
      kind === "at" ||
      kind === "atEach" ||
      kind === "poisson" ||
      kind === "chance" ||
      kind === "docstep" ||
      kind === "never"
    ) {
      setMode(kind);
    }

    if (normalized.kind === "every") {
      setEveryDuration(formatDuration(toSeconds(normalized.amount, normalized.unit)));
      setEveryPhase(
        normalized.phase !== undefined ? formatDuration(toSeconds(normalized.phase, normalized.phaseUnit ?? normalized.unit)) : "",
      );
    }
    if (normalized.kind === "at") {
      setAtTime(formatDuration(toSeconds(normalized.time, normalized.unit ?? "s")));
    }
    if (normalized.kind === "atEach") {
      const times = (normalized.times ?? []).map((time) => formatDuration(toSeconds(time, normalized.unit ?? "s")));
      setAtEachTimes(times.join(", "));
    }
    if (normalized.kind === "poisson") {
      setPoissonRate(String(normalized.ratePerSec));
    }
    if (normalized.kind === "chance") {
      setChanceP(String(normalized.p));
      if (!normalized.every || normalized.every.kind === "docstep") {
        setChanceEveryKind("docstep");
      } else {
        setChanceEveryKind("duration");
        setChanceEveryDuration(formatDuration(toSeconds(normalized.every.amount, normalized.every.unit)));
      }
    }
  }, [normalized, normalized.kind]);

  const validation = useMemo(() => {
    let error: string | null = null;
    let hint: string | null = null;
    let policy: RefreshPolicy | null = null;

    if (mode === "never") {
      policy = { kind: "never" } as any;
    } else if (mode === "docstep") {
      policy = { kind: "docstep" } as any;
    } else if (mode === "every") {
      const duration = parseDurationString(everyDuration);
      if (!duration) error = "Enter a duration like 1.2s or 250ms.";
      const phase = everyPhase.trim() ? parseDurationString(everyPhase) : null;
      if (everyPhase.trim() && !phase) error = "Phase must be a valid duration.";
      if (!error && duration) {
        policy = {
          kind: "every",
          amount: duration.amount,
          unit: duration.unit,
          phase: phase?.amount,
          phaseUnit: phase?.unit,
        } as any;
        hint = `bucket=${formatDuration(duration.seconds)}`;
      }
    } else if (mode === "at") {
      const time = parseDurationString(atTime);
      if (!time) error = "Enter a time like 4s or 500ms.";
      if (!error && time) {
        policy = { kind: "at", time: time.amount, unit: time.unit } as any;
      }
    } else if (mode === "atEach") {
      const parts = atEachTimes
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (!parts.length) error = "Enter at least one time.";
      const parsed = parts.map((part) => parseDurationString(part));
      if (!error && parsed.some((item) => !item)) error = "Each time must include a unit (ms, s, m).";
      if (!error && parsed.every(Boolean)) {
        const timesSec = parsed.map((item) => item!.seconds);
        policy = { kind: "atEach", times: timesSec, unit: "s" } as any;
      }
    } else if (mode === "poisson") {
      const rate = Number(poissonRate);
      if (!Number.isFinite(rate)) error = "Rate must be a number.";
      if (!error) {
        policy = { kind: "poisson", ratePerSec: rate } as any;
        const bucketSec = 0.25;
        const p = 1 - Math.exp(-Math.max(0, rate) * bucketSec);
        hint = `bucket=${formatDuration(bucketSec)} · p/bucket≈${p.toFixed(3)}`;
      }
    } else if (mode === "chance") {
      const p = Number(chanceP);
      if (!Number.isFinite(p) || p < 0 || p > 1) error = "p must be between 0 and 1.";
      if (!error) {
        if (chanceEveryKind === "docstep") {
          policy = { kind: "chance", p, every: { kind: "docstep" } } as any;
          hint = `bucket=${formatDuration(0.25)} · p/bucket=${p}`;
        } else {
          const duration = parseDurationString(chanceEveryDuration);
          if (!duration) error = "Every must be a duration like 1s.";
          if (!error && duration) {
            policy = { kind: "chance", p, every: { kind: "every", amount: duration.amount, unit: duration.unit } } as any;
            hint = `bucket=${formatDuration(duration.seconds)} · p/bucket=${p}`;
          }
        }
      }
    }

    return { error, policy, hint };
  }, [
    atEachTimes,
    atTime,
    chanceEveryDuration,
    chanceEveryKind,
    chanceP,
    everyDuration,
    everyPhase,
    mode,
    poissonRate,
  ]);

  return (
    <div className="refresh-editor">
      <label className="field">
        <span>Mode</span>
        <select className="select" value={mode} onChange={(event) => setMode(event.target.value as any)}>
          <option value="never">never</option>
          <option value="docstep">docstep</option>
          <option value="every">every</option>
          <option value="at">at</option>
          <option value="atEach">atEach</option>
          <option value="poisson">poisson</option>
          <option value="chance">chance</option>
        </select>
      </label>

      {mode === "every" ? (
        <div className="refresh-fields">
          <label className="field">
            <span>Duration</span>
            <input className="input" value={everyDuration} onChange={(event) => setEveryDuration(event.target.value)} />
          </label>
          <label className="field">
            <span>Phase (optional)</span>
            <input className="input" value={everyPhase} onChange={(event) => setEveryPhase(event.target.value)} />
          </label>
        </div>
      ) : null}

      {mode === "at" ? (
        <label className="field">
          <span>Time</span>
          <input className="input" value={atTime} onChange={(event) => setAtTime(event.target.value)} />
        </label>
      ) : null}

      {mode === "atEach" ? (
        <label className="field">
          <span>Times</span>
          <input className="input" value={atEachTimes} onChange={(event) => setAtEachTimes(event.target.value)} />
        </label>
      ) : null}

      {mode === "poisson" ? (
        <label className="field">
          <span>Rate / sec</span>
          <input className="input" value={poissonRate} onChange={(event) => setPoissonRate(event.target.value)} />
        </label>
      ) : null}

      {mode === "chance" ? (
        <div className="refresh-fields">
          <label className="field">
            <span>p</span>
            <input className="input" value={chanceP} onChange={(event) => setChanceP(event.target.value)} />
          </label>
          <label className="field">
            <span>Every</span>
            <select
              className="select"
              value={chanceEveryKind}
              onChange={(event) => setChanceEveryKind(event.target.value as any)}
            >
              <option value="docstep">docstep</option>
              <option value="duration">duration</option>
            </select>
          </label>
          {chanceEveryKind === "duration" ? (
            <label className="field">
              <span>Duration</span>
              <input
                className="input"
                value={chanceEveryDuration}
                onChange={(event) => setChanceEveryDuration(event.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {validation.hint ? <div className="field-hint">{validation.hint}</div> : null}
      {validation.error ? <div className="field-error">{validation.error}</div> : null}
      <div className="refresh-actions">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!validation.policy || Boolean(validation.error)}
          onClick={() => {
            if (validation.policy) onChange(validation.policy);
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function TransitionEditor({
  value,
  reducedMotion,
  onChange,
}: {
  value: SlotTransitionSpec | undefined;
  reducedMotion: boolean;
  onChange: (next: SlotTransitionSpec) => void;
}) {
  const [mode, setMode] = useState<"none" | "appear" | "fade" | "wipe" | "flash">("none");
  const [durationMs, setDurationMs] = useState("220");
  const [ease, setEase] = useState<"in" | "out" | "inOut" | "linear">("inOut");
  const [direction, setDirection] = useState<"left" | "right" | "up" | "down">("right");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const kind = value?.kind ?? "none";
    setMode(kind);
    if (kind === "fade" || kind === "wipe" || kind === "flash") {
      setDurationMs(String((value as any).durationMs ?? 220));
    }
    if (kind === "fade" || kind === "wipe") {
      setEase(((value as any).ease ?? "inOut") as any);
    }
    if (kind === "wipe") {
      setDirection(((value as any).direction ?? "right") as any);
    }
  }, [value]);

  const parseDuration = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
  };

  const commit = (
    nextMode: typeof mode,
    overrides?: { durationMs?: string; ease?: "in" | "out" | "inOut" | "linear"; direction?: "left" | "right" | "up" | "down" },
  ) => {
    if (nextMode === "none" || nextMode === "appear") {
      setError(null);
      onChange({ kind: nextMode });
      return;
    }
    const rawDuration = overrides?.durationMs ?? durationMs;
    const nextEase = overrides?.ease ?? ease;
    const nextDirection = overrides?.direction ?? direction;
    const duration = parseDuration(rawDuration);
    if (!duration) {
      setError("Duration must be a positive number of ms.");
      return;
    }
    setError(null);
    if (nextMode === "fade") {
      onChange({ kind: "fade", durationMs: duration, ease: nextEase });
      return;
    }
    if (nextMode === "wipe") {
      onChange({ kind: "wipe", direction: nextDirection, durationMs: duration, ease: nextEase });
      return;
    }
    if (nextMode === "flash") {
      onChange({ kind: "flash", durationMs: duration });
    }
  };

  return (
    <div className="transition-editor">
      <label className="field">
        <span>Mode</span>
        <select
          className="select"
          value={mode}
          onChange={(event) => {
            const next = event.target.value as any;
            setMode(next);
            commit(next);
          }}
        >
          <option value="none">none</option>
          <option value="appear">appear</option>
          <option value="fade">fade</option>
          <option value="wipe">wipe</option>
          <option value="flash">flash</option>
        </select>
      </label>

      {mode === "fade" || mode === "wipe" || mode === "flash" ? (
        <label className="field">
          <span>Duration (ms)</span>
          <input
            className="input"
            value={durationMs}
            onChange={(event) => {
              const next = event.target.value;
              setDurationMs(next);
              commit(mode, { durationMs: next });
            }}
          />
        </label>
      ) : null}

      {mode === "fade" || mode === "wipe" ? (
        <label className="field">
          <span>Ease</span>
          <select
            className="select"
            value={ease}
            onChange={(event) => {
              const next = event.target.value as any;
              setEase(next);
              commit(mode, { ease: next });
            }}
          >
            <option value="in">in</option>
            <option value="out">out</option>
            <option value="inOut">inOut</option>
            <option value="linear">linear</option>
          </select>
        </label>
      ) : null}

      {mode === "wipe" ? (
        <label className="field">
          <span>Direction</span>
          <select
            className="select"
            value={direction}
            onChange={(event) => {
              const next = event.target.value as any;
              setDirection(next);
              commit(mode, { direction: next });
            }}
          >
            <option value="left">left</option>
            <option value="right">right</option>
            <option value="up">up</option>
            <option value="down">down</option>
          </select>
        </label>
      ) : null}

      {reducedMotion ? <div className="field-hint">Reduced motion is on. Playback will use appear().</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}

function ImageFrameInspector({
  frame,
  adjustMode,
  onToggleAdjust,
  onChange,
  onCommit,
  onReset,
}: {
  frame: ImageFrame;
  adjustMode: boolean;
  onToggleAdjust: () => void;
  onChange: (frame: ImageFrame) => void;
  onCommit: (frame: ImageFrame) => void;
  onReset: () => void;
}) {
  const handlePatch = (patch: Partial<ImageFrame>) => {
    onChange({ ...frame, ...patch });
  };

  const commitPatch = (patch: Partial<ImageFrame>) => {
    onCommit({ ...frame, ...patch });
  };

  return (
    <div className="inspector-section frame-section">
      <div className="section-title">Frame</div>
      <div className="frame-toolbar">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={adjustMode ? "is-active" : undefined}
          onClick={onToggleAdjust}
        >
          Adjust image
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>
      <label className="field">
        <span>Fit</span>
        <select
          className="select"
          value={frame.fit}
          onChange={(event) => commitPatch({ fit: event.target.value as ImageFrame["fit"] })}
        >
          <option value="contain">contain</option>
          <option value="cover">cover</option>
        </select>
      </label>
      <label className="field">
        <span>Scale</span>
        <input
          className="range"
          type="range"
          min={0.5}
          max={2.5}
          step={0.01}
          value={frame.scale}
          onChange={(event) => handlePatch({ scale: Number(event.target.value) })}
          onPointerUp={(event) => commitPatch({ scale: Number((event.target as HTMLInputElement).value) })}
        />
        <div className="frame-value">{frame.scale.toFixed(2)}×</div>
      </label>
      <div className="frame-grid">
        <label className="field">
          <span>Offset X</span>
          <input
            className="input"
            type="number"
            value={Math.round(frame.offsetX)}
            onChange={(event) => handlePatch({ offsetX: Number(event.target.value) })}
            onBlur={(event) => commitPatch({ offsetX: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Offset Y</span>
          <input
            className="input"
            type="number"
            value={Math.round(frame.offsetY)}
            onChange={(event) => handlePatch({ offsetY: Number(event.target.value) })}
            onBlur={(event) => commitPatch({ offsetY: Number(event.target.value) })}
          />
        </label>
      </div>
      <div className="frame-nudge">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => commitPatch({ offsetY: frame.offsetY - 1 })}
        >
          ↑
        </Button>
        <div className="frame-nudge-row">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => commitPatch({ offsetX: frame.offsetX - 1 })}
          >
            ←
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => commitPatch({ offsetX: frame.offsetX + 1 })}
          >
            →
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => commitPatch({ offsetY: frame.offsetY + 1 })}
        >
          ↓
        </Button>
      </div>
    </div>
  );
}

function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: EditorCommand[];
}) {
  const groups = commands.reduce<Record<string, EditorCommand[]>>((acc, command) => {
    const group = command.group ?? "Commands";
    if (!acc[group]) acc[group] = [];
    acc[group].push(command);
    return acc;
  }, {});

  return (
    <Command.Dialog
      className="command-root"
      open={open}
      onOpenChange={onOpenChange}
      overlayClassName="cmdk-overlay"
      contentClassName="command-dialog"
    >
      <Command.Input className="command-input" placeholder="Type a command…" />
      <Command.List className="command-list">
        {Object.entries(groups).map(([group, items]) => (
          <Command.Group key={group} heading={group}>
            {items.map((item) => (
              <Command.Item
                key={item.id}
                value={`${item.label} ${item.shortcut ?? ""}`}
                onSelect={() => {
                  item.run();
                  onOpenChange(false);
                }}
              >
                <span>{item.label}</span>
                {item.shortcut ? <span className="command-shortcut">{item.shortcut}</span> : null}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-layer" aria-hidden={false}>
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <Button variant="ghost" size="sm" iconOnly onClick={onClose}>
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
): [(...args: Parameters<T>) => void, () => void] {
  const timeoutRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (lastArgsRef.current) {
          callback(...lastArgsRef.current);
        }
        timeoutRef.current = null;
        lastArgsRef.current = null;
      }, delay);
    },
    [callback, delay],
  );

  const flush = useCallback(() => {
    if (!timeoutRef.current && !lastArgsRef.current) return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (lastArgsRef.current) {
      callback(...lastArgsRef.current);
      lastArgsRef.current = null;
    }
  }, [callback]);

  return [debounced, flush];
}

function renderSaveStatus(status: "idle" | "saving" | "saved" | "error", dirty: boolean) {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Error !";
  if (dirty) return "Unsaved •";
  return "Saved ✓";
}

function HealthStrip({
  state,
  selectedId,
  activeEditor,
  trace,
  enabled,
}: {
  state: DocServiceState;
  selectedId: string | null;
  activeEditor: "tiptap" | "monaco" | "none";
  trace: EditTraceEvent[];
  enabled: boolean;
}) {
  if (!enabled) return null;
  return (
    <div className="health-strip-wrap">
      <div className="health-strip">
        <span>docRev {state.docRev}</span>
        <span>sourceRev {state.sourceRev}</span>
        <span>dirty {state.dirty ? "true" : "false"}</span>
        <span>isSaving {state.isSaving ? "true" : "false"}</span>
        <span>isApplying {state.isApplying ? "true" : "false"}</span>
        <span>lastWriteId {state.lastWriteId ?? "—"}</span>
        <span>lastLoadReason {state.lastLoadReason}</span>
        <span>selected {selectedId ?? "none"}</span>
        <span>activeEditor {activeEditor}</span>
      </div>
      <EditTraceLog entries={trace} />
    </div>
  );
}

function EditTraceLog({ entries }: { entries: EditTraceEvent[] }) {
  if (!entries.length) return null;
  return (
    <div className="edit-trace-log">
      <div className="edit-trace-header">Edit pipeline trace</div>
      <div className="edit-trace-rows">
        {entries.map((entry, index) => (
          <div key={`${entry.ts}-${index}`} className="edit-trace-row">
            <span>{entry.ts}</span>
            <span>{entry.eventType}</span>
            <span>{entry.selectedId ?? "—"}</span>
            <span>{entry.dirty ? "dirty" : "clean"}</span>
            <span>{entry.loadReason ?? "—"}</span>
            <span>{entry.beforeHash ?? "—"}</span>
            <span>{entry.afterHash ?? "—"}</span>
            <span>{entry.revision ?? "—"}</span>
            <span>{entry.reqId ?? "—"}</span>
            <span>{entry.writeId ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type SlotProgram = {
  spec: SlotGeneratorSpec | null;
  raw: unknown;
  source: { kind: "prop" | "text"; key?: string; textId?: string };
};

type CaptionTarget = { kind: "prop" | "text"; id: string; value: string };

function readSlotProgram(node: DocumentNode): SlotProgram {
  const props = node.props ?? {};
  const textChild = node.children?.find((child) => child.kind === "text");
  const propEntry = findSlotGeneratorProp(props);
  if (propEntry) {
    const expr = unwrapExpression(propEntry.value);
    const spec = parseGeneratorSpec(expr);
    return {
      spec,
      raw: propEntry.value,
      source: { kind: "prop", key: propEntry.key },
    };
  }
  if (textChild) {
    const value = getLiteralString(textChild.props?.content) ?? "";
    return {
      spec: { kind: "literal", value },
      raw: textChild.props?.content ?? null,
      source: { kind: "text", textId: textChild.id },
    };
  }
  const literalContent = getLiteralString(props.content as any);
  if (literalContent !== null) {
    return {
      spec: { kind: "literal", value: literalContent ?? "" },
      raw: props.content ?? null,
      source: { kind: "prop", key: "content" },
    };
  }
  return { spec: null, raw: null, source: { kind: "prop" } };
}

function resolveSlotDisplayText(node: DocumentNode, runtime: EditorRuntimeInputs, assets: AssetItem[]): string {
  const program = readSlotProgram(node);
  if (!program.spec) {
    const textChild = node.children?.find((child) => child.kind === "text");
    return getLiteralString(textChild?.props?.content) ?? "";
  }
  const { value } = computeSlotValue(program.spec, (node as any).refresh, runtime, node.id, assets);
  return value.kind === "asset" ? value.label : value.text;
}

function describeGenerator(spec: SlotGeneratorSpec | null): { label: string; value: string }[] {
  if (!spec) return [];
  if (spec.kind === "literal") return [{ label: "kind", value: "literal" }, { label: "value", value: spec.value }];
  if (spec.kind === "choose" || spec.kind === "cycle") {
    return [
      { label: "kind", value: spec.kind },
      { label: "count", value: String(spec.values.length) },
      { label: "values", value: spec.values.join(" · ") || "—" },
    ];
  }
  if (spec.kind === "assetsPick") {
    return [
      { label: "kind", value: "assets.pick" },
      { label: "tags", value: spec.tags.join(", ") || "—" },
    ];
  }
  if (spec.kind === "poisson") {
    return [
      { label: "kind", value: "poisson" },
      { label: "rate/sec", value: String(spec.ratePerSec) },
    ];
  }
  if (spec.kind === "at") {
    return [
      { label: "kind", value: "at" },
      { label: "values", value: spec.values.join(" · ") || "—" },
    ];
  }
  if (spec.kind === "every") {
    return [
      { label: "kind", value: "every" },
      { label: "amount", value: String(spec.amount) },
      { label: "unit", value: spec.unit ?? "—" },
    ];
  }
  return [{ label: "kind", value: "unknown" }, { label: "summary", value: spec.summary }];
}

function findSlotGeneratorProp(props: Record<string, unknown>): { key: string; value: unknown } | null {
  const preferred = ["generator", "source", "program", "content", "value"];
  for (const key of preferred) {
    if (!(key in props)) continue;
    const value = (props as Record<string, unknown>)[key];
    if (key === "content" && isLiteralProp(value)) continue;
    if (value !== undefined) return { key, value };
  }
  for (const [key, value] of Object.entries(props)) {
    if (IGNORED_SLOT_PROP_KEYS.has(key)) continue;
    if (value && typeof value === "object" && !(value as any).kind) {
      return { key, value };
    }
    if (!isLiteralProp(value)) return { key, value };
  }
  return null;
}

function unwrapExpression(value: any): any {
  if (!value || typeof value !== "object") return value;
  if (value.kind === "LiteralValue") return { kind: "Literal", value: value.value };
  if (value.kind === "DynamicValue" || value.kind === "ExpressionValue" || value.kind === "ExprValue") {
    return value.expr ?? value.expression ?? value.value ?? value;
  }
  return value;
}

function parseGeneratorSpec(expr: any): SlotGeneratorSpec | null {
  if (!expr) return null;
  if (expr.kind === "choose" && Array.isArray(expr.values)) {
    return { kind: "choose", values: expr.values.map((value: any) => coerceVariantValue(value)) };
  }
  if (expr.kind === "cycle" && Array.isArray(expr.values)) {
    return { kind: "cycle", values: expr.values.map((value: any) => coerceVariantValue(value)) };
  }
  if (expr.kind === "assetsPick" && Array.isArray(expr.tags)) {
    return { kind: "assetsPick", tags: expr.tags.map((tag: any) => String(tag)), bank: expr.bank };
  }
  if (expr.kind === "poisson" && typeof expr.ratePerSec === "number") {
    return { kind: "poisson", ratePerSec: expr.ratePerSec };
  }
  if (expr.kind === "literal" && "value" in expr) {
    return { kind: "literal", value: coerceVariantValue(expr.value) };
  }
  if (expr.kind === "Literal") {
    return { kind: "literal", value: coerceVariantValue(expr.value) };
  }
  if (expr.kind === "CallExpression") {
    const callee = getCalleeName(expr.callee);
    const args = Array.isArray(expr.args) ? expr.args : [];
    if (!callee) return { kind: "unknown", summary: "call" };
    if (callee === "choose" || callee === "cycle") {
      const values = extractVariantList(args);
      return { kind: callee, values };
    }
    if (callee === "poisson") {
      const rate = readNumberLiteral(args[0]) ?? 1;
      return { kind: "poisson", ratePerSec: rate };
    }
    if (callee === "at") {
      const values = extractStringList(args.slice(1));
      const times = extractNumberList(args.slice(0, 1));
      return { kind: "at", times, values };
    }
    if (callee === "every") {
      const amount = readNumberLiteral(args[0]) ?? 1;
      const values = extractStringList(args.slice(1));
      return { kind: "every", amount, unit: undefined, values };
    }
    if (callee === "assets.pick" || callee === "assetsPick") {
      const tags = extractStringList(args);
      return { kind: "assetsPick", tags };
    }
    return { kind: "unknown", summary: callee };
  }
  if (expr.kind === "Identifier") {
    return { kind: "unknown", summary: expr.name ?? "identifier" };
  }
  return { kind: "unknown", summary: "expression" };
}

function getCalleeName(expr: any): string | null {
  if (!expr || typeof expr !== "object") return null;
  if (expr.kind === "Identifier") return expr.name;
  if (expr.kind === "MemberExpression") {
    const objectName = getCalleeName(expr.object);
    const property = expr.property;
    if (!objectName) return property ?? null;
    return `${objectName}.${property ?? ""}`.replace(/\.$/, "");
  }
  return null;
}

function extractStringList(args: any[]): string[] {
  if (!args.length) return [];
  if (args.length === 1) {
    const literalArray = readArrayLiteral(args[0]);
    if (literalArray.length) return literalArray;
  }
  return args.map((arg) => readStringLiteral(arg)).filter((value): value is string => typeof value === "string");
}

function extractVariantList(args: any[]): Array<string | null> {
  if (!args.length) return [];
  if (args.length === 1) {
    const literalArray = readVariantArrayLiteral(args[0]);
    if (literalArray.length) return literalArray;
  }
  return args
    .map((arg) => readVariantLiteral(arg))
    .filter((value): value is string | null => value !== undefined);
}

function extractNumberList(args: any[]): number[] {
  return args.map((arg) => readNumberLiteral(arg)).filter((value): value is number => typeof value === "number");
}

function readArrayLiteral(expr: any): string[] {
  if (!expr) return [];
  if (expr.kind === "Literal" && Array.isArray(expr.value)) {
    return expr.value.map((value: any) => String(value));
  }
  return [];
}

function readVariantArrayLiteral(expr: any): Array<string | null> {
  if (!expr) return [];
  if (expr.kind === "Literal" && Array.isArray(expr.value)) {
    return expr.value.map((value: any) => coerceVariantValue(value));
  }
  return [];
}

function readStringLiteral(expr: any): string | null {
  if (!expr) return null;
  if (expr.kind === "Literal" && (typeof expr.value === "string" || typeof expr.value === "number")) {
    return String(expr.value);
  }
  return null;
}

function readVariantLiteral(expr: any): string | null | undefined {
  if (!expr) return undefined;
  if (expr.kind === "Literal") return coerceVariantValue(expr.value);
  return undefined;
}

function readNumberLiteral(expr: any): number | null {
  if (!expr) return null;
  if (expr.kind === "Literal" && typeof expr.value === "number") return expr.value;
  if (expr.kind === "Literal" && typeof expr.value === "string") {
    const parsed = Number(expr.value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function coerceVariantValue(value: any): string | null {
  if (value === null) return null;
  return String(value ?? "");
}

function isLiteralProp(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as any).kind === "LiteralValue");
}

function resolveCaptionTarget(node: DocumentNode): CaptionTarget | null {
  const propCaption = getLiteralString(node.props?.caption);
  if (propCaption !== null) return { kind: "prop", id: node.id, value: propCaption ?? "" };
  const captionNode = findCaptionTextNode(node);
  if (captionNode) {
    return {
      kind: "text",
      id: captionNode.id,
      value: getLiteralString(captionNode.props?.content) ?? extractPlainText(captionNode),
    };
  }
  return null;
}

function findCaptionTextNode(node: DocumentNode): DocumentNode | null {
  let fallback: DocumentNode | null = null;
  const visit = (current: DocumentNode): DocumentNode | null => {
    if (current.kind === "text") {
      const role = getLiteralString(current.props?.role) ?? "";
      const style = getLiteralString(current.props?.style) ?? "";
      if (/caption/i.test(role) || /caption/i.test(style)) return current;
      if (!fallback) fallback = current;
    }
    for (const child of current.children ?? []) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(node) ?? fallback;
}

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") return true;
  return window.localStorage.getItem("flux-editor-debug") === "1";
}

const IGNORED_SLOT_PROP_KEYS = new Set([
  "reserve",
  "fit",
  "refresh",
  "transition",
  "frame",
  "src",
  "title",
  "caption",
  "label",
  "style",
  "role",
  "url",
  "href",
  "name",
]);

function buildPreviewSrc(basePath?: string, revision?: number): string {
  if (typeof window === "undefined") return basePath ?? "/preview";
  const url = new URL(basePath ?? "/preview", window.location.origin);
  const file = getFileParam();
  if (file) url.searchParams.set("file", file);
  if (typeof revision === "number") url.searchParams.set("rev", String(revision));
  return `${url.pathname}${url.search}`;
}

function getFileParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("file");
}

function nextId(prefix: string, ids: Set<string>) {
  let n = 1;
  let candidate = `${prefix}${n}`;
  while (ids.has(candidate)) {
    n += 1;
    candidate = `${prefix}${n}`;
  }
  ids.add(candidate);
  return candidate;
}

function buildAssetAssignment(
  doc: any,
  index: Map<string, any>,
  targetId: string,
  asset: AssetItem,
  ids: Set<string>,
): { id: string; node: DocumentNode } | null {
  const start = index.get(targetId);
  if (!start) return null;
  let entry = start;
  while (entry && !["figure", "slot", "image"].includes(entry.node.kind)) {
    entry = entry.parentId ? index.get(entry.parentId) : null;
  }
  if (!entry) return null;

  if (entry.node.kind === "image") {
    const updated: DocumentNode = {
      ...entry.node,
      props: { ...(entry.node.props ?? {}), src: { kind: "LiteralValue", value: asset.path } },
    };
    return { id: entry.node.id, node: updated };
  }

  const slotNode = entry.node.kind === "slot" ? entry.node : findFirstChild(entry.node, "slot");
  if (!slotNode) return null;

  const imageNode = findFirstChild(slotNode, "image");
  if (imageNode) {
    const updated: DocumentNode = {
      ...imageNode,
      props: { ...(imageNode.props ?? {}), src: { kind: "LiteralValue", value: asset.path } },
    };
    return { id: imageNode.id, node: updated };
  }

  const nextImage: DocumentNode = {
    id: nextId("image", ids),
    kind: "image",
    props: { src: { kind: "LiteralValue", value: asset.path } },
    children: [],
  };

  const nextSlot: DocumentNode = {
    ...slotNode,
    children: [nextImage],
  };
  return { id: slotNode.id, node: nextSlot };
}

function findFirstChild(node: DocumentNode, kind: string): DocumentNode | null {
  for (const child of node.children ?? []) {
    if (child.kind === kind) return child;
    const nested = findFirstChild(child, kind);
    if (nested) return nested;
  }
  return null;
}

function isSlotContext(entry: DocIndexEntry, index: Map<string, DocIndexEntry>): boolean {
  let current: DocIndexEntry | null = entry;
  while (current) {
    if (current.node.kind === "slot" || current.node.kind === "inline_slot") return true;
    current = current.parentId ? index.get(current.parentId) ?? null : null;
  }
  return false;
}


function resolveFrameEntry(
  entry: DocIndexEntry | null,
  index: Map<string, DocIndexEntry> | null | undefined,
): DocIndexEntry | null {
  if (!entry || !index) return null;
  if (entry.node.kind === "image") return entry;
  if (entry.node.kind === "slot" || entry.node.kind === "figure") {
    const imageNode = findFirstChild(entry.node, "image");
    if (!imageNode) return null;
    return index.get(imageNode.id) ?? null;
  }
  return null;
}

function readImageFrame(node: DocumentNode): ImageFrame {
  const raw = getLiteralValue(node.props?.frame);
  if (raw && typeof raw === "object") {
    const record = raw as Partial<ImageFrame>;
    return {
      fit: record.fit === "contain" ? "contain" : "cover",
      scale: typeof record.scale === "number" ? record.scale : 1,
      offsetX: typeof record.offsetX === "number" ? record.offsetX : 0,
      offsetY: typeof record.offsetY === "number" ? record.offsetY : 0,
    };
  }
  return defaultImageFrame();
}

function updateImageFrameNode(node: DocumentNode, frame: ImageFrame): DocumentNode {
  const props: Record<string, NodePropValue> = { ...(node.props ?? {}) };
  props.frame = { kind: "LiteralValue", value: frame };
  return { ...node, props };
}

function defaultImageFrame(): ImageFrame {
  return { fit: "cover", scale: 1, offsetX: 0, offsetY: 0 };
}

function reorderChildren(parent: DocumentNode, activeId: string, overId: string): DocumentNode | null {
  const children = [...(parent.children ?? [])];
  const from = children.findIndex((child) => child.id === activeId);
  const to = children.findIndex((child) => child.id === overId);
  if (from < 0 || to < 0) return null;
  const [moving] = children.splice(from, 1);
  const insertIndex = from < to ? to - 1 : to;
  children.splice(insertIndex, 0, moving);
  return { ...parent, children };
}

function dropAssetOnPreview(
  frame: HTMLIFrameElement | null,
  wrap: HTMLDivElement | null,
  point: { x: number; y: number },
  resolveId = false,
): string | boolean {
  if (!frame || !wrap) return false;
  const rect = wrap.getBoundingClientRect();
  if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return false;
  const frameRect = frame.getBoundingClientRect();
  const relX = point.x - frameRect.left;
  const relY = point.y - frameRect.top;
  const doc = frame.contentWindow?.document;
  if (!doc) return false;
  const target = doc.elementFromPoint(relX, relY) as HTMLElement | null;
  const fluxEl = target?.closest?.("[data-flux-id], [data-flux-node]") as HTMLElement | null;
  if (!fluxEl) return false;
  const nodeId = fluxEl.getAttribute("data-flux-id") ?? fluxEl.getAttribute("data-flux-node");
  if (resolveId) return nodeId ?? false;
  return Boolean(nodeId);
}

function filterOutline(nodes: OutlineNode[], query: string): OutlineNode[] {
  if (!query.trim()) return nodes;
  const lower = query.trim().toLowerCase();
  const matches = (node: OutlineNode) =>
    node.label.toLowerCase().includes(lower) || node.kind.toLowerCase().includes(lower);
  const walk = (node: OutlineNode): OutlineNode | null => {
    const nextChildren = node.children.map(walk).filter(Boolean) as OutlineNode[];
    if (matches(node) || nextChildren.length) {
      return { ...node, children: nextChildren };
    }
    return null;
  };
  return nodes.map(walk).filter(Boolean) as OutlineNode[];
}

function getStoredWidth(key: "outline" | "inspector", fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(`flux-editor-${key}-width`);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

function getStoredStatusBar() {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem("flux.editor.showStatusBar");
  if (raw === null) return true;
  return raw === "1";
}

function getFileName(path?: string | null) {
  if (!path) return "doc.flux";
  const parts = path.split("/");
  return parts[parts.length - 1] || "doc.flux";
}

function getConnectionLabel() {
  if (typeof window === "undefined") return "Local";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "Local";
  return "Remote";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toSeconds(amount: number, unit: string): number {
  if (!Number.isFinite(amount)) return 0;
  const normalized = unit.toLowerCase();
  if (normalized === "ms") return amount / 1000;
  if (normalized === "m") return amount * 60;
  return amount;
}

function getTransitionDurationMs(transition?: SlotTransitionSpec | null): number {
  if (!transition) return 0;
  if (transition.kind === "fade" || transition.kind === "wipe" || transition.kind === "flash") {
    return Math.max(0, transition.durationMs ?? 0);
  }
  return 0;
}
