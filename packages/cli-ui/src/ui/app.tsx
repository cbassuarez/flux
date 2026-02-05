import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import path from "node:path";
import fs from "node:fs/promises";
import {
  getRecentsStore,
  updateRecents,
  getPinnedDirsStore,
  addPinnedDir,
  removePinnedDir,
  getLastUsedDirStore,
  setLastUsedDir,
  indexFiles,
  walkFilesFromFs,
  resolveConfig,
  viewCommand,
  pdfCommand,
  checkCommand,
  formatCommand,
  addCommand,
  newCommand,
  fetchViewerPatch,
  fetchViewerStatus,
  requestViewerPdf,
} from "@flux-lang/cli-core";
import type { ViewerSession } from "@flux-lang/cli-core";
import { AppFrame } from "../components/AppFrame.js";
import { NavList } from "../components/NavList.js";
import { CommandPaletteModal } from "../components/CommandPaletteModal.js";
import { ToastHost } from "../components/ToastHost.js";
import { Card } from "../components/Card.js";
import { HelpOverlay } from "../components/HelpOverlay.js";
import { Clickable } from "../components/Clickable.js";
import { NewWizardScreen } from "../screens/NewWizardScreen.js";
import { OpenScreen } from "../screens/OpenScreen.js";
import { DocDetailsScreen } from "../screens/DocDetailsScreen.js";
import { ExportScreen } from "../screens/ExportScreen.js";
import { DoctorScreen } from "../screens/DoctorScreen.js";
import { FormatScreen } from "../screens/FormatScreen.js";
import { EditScreen } from "../screens/EditScreen.js";
import { SettingsScreen } from "../screens/SettingsScreen.js";
import { MouseProvider } from "../state/mouse.js";
import { useToasts } from "../state/toasts.js";
import { useProgress } from "../state/progress.js";
import { resolveActionRoute, resolveRouteAfterOpen } from "../state/dashboard-machine.js";
import { buildPaletteItems, filterPaletteItems, groupPaletteItems } from "../palette/index.js";
import { accent, color, truncateMiddle } from "../theme/index.js";
import type {
  FontsPreset,
  FontFallback,
  NavItem,
  PageSizeOption,
  TemplateName,
  ThemeOption,
  ViewerStatus,
  WizardIndexMap,
  WizardSelectKey,
  WizardStep,
  WizardValues,
} from "../state/types.js";
import { PaneFrame } from "../components/PaneFrame.js";

interface AppProps {
  cwd: string;
  mode?: "new";
  initialArgs?: string[];
  detach?: boolean;
  helpCommand?: string;
  version?: string;
}

const TEMPLATE_OPTIONS: { label: string; value: TemplateName; hint: string }[] = [
  { label: "Demo", value: "demo", hint: "Live slots + assets + annotations" },
  { label: "Article", value: "article", hint: "Narrative article starter" },
  { label: "Spec", value: "spec", hint: "Technical spec layout" },
  { label: "Zine", value: "zine", hint: "Visual zine layout" },
  { label: "Paper", value: "paper", hint: "Academic paper with abstract" },
  { label: "Blank", value: "blank", hint: "Minimal empty layout" },
];

const PAGE_OPTIONS: { label: string; value: PageSizeOption }[] = [
  { label: "Letter", value: "Letter" },
  { label: "A4", value: "A4" },
];

const THEME_OPTIONS: { label: string; value: ThemeOption }[] = [
  { label: "Screen", value: "screen" },
  { label: "Print", value: "print" },
  { label: "Both", value: "both" },
];

const FONT_OPTIONS: { label: string; value: FontsPreset; hint: string }[] = [
  { label: "Tech", value: "tech", hint: "Inter + IBM Plex Sans + JetBrains Mono" },
  { label: "Bookish", value: "bookish", hint: "Iowan Old Style + serif body" },
];

const FALLBACK_OPTIONS: { label: string; value: FontFallback; hint: string }[] = [
  { label: "System fallback", value: "system", hint: "Full stack with safe fallbacks" },
  { label: "Primary only", value: "none", hint: "Use primary fonts only" },
];

const YES_NO_OPTIONS: { label: string; value: boolean }[] = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

const CHAPTER_OPTIONS: { label: string; value: number }[] = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
];

const BACKEND_LABEL = "typesetter";
const FILE_INDEX_CAP = 20000;
const FILE_INDEX_DEPTH = 7;
const SEARCH_DEBOUNCE_MS = 200;

export function App(props: AppProps) {
  const { exit } = useApp();
  const [recents, setRecents] = useState<NavItem[]>([]);
  const [recentsPath, setRecentsPath] = useState<string | undefined>(undefined);
  const [currentDocument, setCurrentDocument] = useState<string | null>(null);
  const [pinnedDirs, setPinnedDirs] = useState<string[]>([]);
  const [lastUsedDir, setLastUsedDirState] = useState<string | null>(null);
  const [navIndex, setNavIndex] = useState(1);
  const [focus, setFocus] = useState<"nav" | "pane">("pane");
  const [route, setRoute] = useState<"open" | "doc" | "new" | "export" | "doctor" | "format" | "edit" | "settings" | "add">(
    props.mode === "new" ? "new" : "open",
  );
  const [pendingAction, setPendingAction] = useState<null | "edit" | "export" | "doctor" | "format">(null);
  const [openQuery, setOpenQuery] = useState("");
  const [openDebouncedQuery, setOpenDebouncedQuery] = useState("");
  const [openShowAll, setOpenShowAll] = useState(false);
  const [openRoot, setOpenRoot] = useState(props.cwd);
  const [openRootInitialized, setOpenRootInitialized] = useState(false);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [openIndexing, setOpenIndexing] = useState(false);
  const [openTruncated, setOpenTruncated] = useState(false);
  const [openSelectedIndex, setOpenSelectedIndex] = useState(0);
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const [openFolderIndex, setOpenFolderIndex] = useState(0);
  const [openPreview, setOpenPreview] = useState<null | {
    title?: string | null;
    filePath: string;
    modified?: string;
    size?: string;
    status?: string | null;
  }>(null);
  const { toasts, push: pushToast } = useToasts();
  const { progress, start: startProgress, stop: stopProgress } = useProgress();
  const [busy, setBusy] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(Boolean(props.helpCommand));
  const [versionOpen, setVersionOpen] = useState(Boolean(props.version));
  const [wizardStep, setWizardStep] = useState(0);
  const initialTitle = titleFromTemplate("demo");
  const initialName = slugify(initialTitle);
  const [wizardValues, setWizardValues] = useState<WizardValues>({
    title: initialTitle,
    name: initialName,
    template: "demo",
    page: "Letter",
    theme: "screen",
    fonts: "tech",
    fontFallback: "system",
    assets: true,
    chaptersEnabled: false,
    chapters: 2,
    live: true,
  });
  const [wizardIndexes, setWizardIndexes] = useState<WizardIndexMap>({
    template: 0,
    page: 0,
    theme: 0,
    fonts: 0,
    fontFallback: 0,
    assets: 0,
    chaptersEnabled: 1,
    chapters: 1,
    live: 0,
  });
  const [wizardCreated, setWizardCreated] = useState<null | { docPath: string; dir: string; files: string[] }>(null);
  const [wizardPostCreate, setWizardPostCreate] = useState({ openViewer: true, setCurrent: true, selectedIndex: 0 });
  const [wizardLiveTouched, setWizardLiveTouched] = useState(false);
  const [wizardOutDir, setWizardOutDir] = useState<string | undefined>(props.cwd);
  const [wizardDefaultsApplied, setWizardDefaultsApplied] = useState(false);
  const [initialRouteHandled, setInitialRouteHandled] = useState(false);
  const [viewerSession, setViewerSession] = useState<ViewerSession | null>(null);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus | null>(null);
  const [streamOk, setStreamOk] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [fluxFiles, setFluxFiles] = useState<string[]>([]);
  const [cols, setCols] = useState(() => process.stdout.columns ?? 80);
  const [rows, setRows] = useState(() => process.stdout.rows ?? 24);
  const [debugLayout, setDebugLayout] = useState(false);
  const [doctorSummary, setDoctorSummary] = useState("Run Doctor to check this document.");
  const [doctorLogs, setDoctorLogs] = useState<string[]>([]);
  const [doctorLogsOpen, setDoctorLogsOpen] = useState(false);
  const [formatSummary, setFormatSummary] = useState("Run Format to clean up this document.");
  const [formatLogs, setFormatLogs] = useState<string[]>([]);
  const [formatLogsOpen, setFormatLogsOpen] = useState(false);
  const [editLogs, setEditLogs] = useState<string[]>([]);
  const [editLogsOpen, setEditLogsOpen] = useState(false);
  const [exportResultPath, setExportResultPath] = useState<string | null>(null);
  const [exportActionIndex, setExportActionIndex] = useState(0);
  const [docActionIndex, setDocActionIndex] = useState(0);
  const [wizardNameTouched, setWizardNameTouched] = useState(false);
  const [docPreview, setDocPreview] = useState<null | {
    title?: string | null;
    filePath: string;
    modified?: string;
    size?: string;
  }>(null);
  const openScanController = useRef<AbortController | null>(null);
  const openScanId = useRef(0);
  const openPreviewRequestId = useRef(0);
  const docPreviewRequestId = useRef(0);
  const editLaunchRef = useRef<{ docPath: string; url: string } | null>(null);
  const editLaunching = useRef(false);

  const navItems = useMemo<NavItem[]>(() => ([
    { type: "section", label: "File" },
    { type: "action", id: "open", label: "Open" },
    { type: "action", id: "new", label: "New" },
    { type: "section", label: "Actions" },
    { type: "action", id: "edit", label: "Edit" },
    { type: "action", id: "export", label: "Export PDF" },
    { type: "action", id: "doctor", label: "Doctor" },
    { type: "action", id: "format", label: "Format" },
  ]), []);

  const paletteItems = useMemo(() => buildPaletteItems({
    recents: recents.filter((item) => item.type === "doc") as { path: string }[],
    fluxFiles,
    activeDoc: currentDocument,
  }), [recents, fluxFiles, currentDocument]);

  const filteredPalette = useMemo(() => filterPaletteItems(paletteItems, paletteQuery), [paletteItems, paletteQuery]);
  const limitedPalette = useMemo(() => filteredPalette.slice(0, 12), [filteredPalette]);
  const paletteGroups = useMemo(() => groupPaletteItems(limitedPalette), [limitedPalette]);

  const innerWidth = Math.max(20, cols - 4);
  const overlayWidth = Math.max(28, Math.min(72, innerWidth - 4));
  const navWidth = Math.min(32, Math.max(20, Math.floor(innerWidth * 0.34)));
  const paneWidth = Math.max(20, innerWidth - navWidth - 2);
  const navContentWidth = Math.max(12, navWidth - 4);
  const paneContentWidth = Math.max(20, paneWidth - 4);
  const navListHeight = Math.max(8, rows - 14);

  const mouseDisabled = paletteOpen || helpOpen || versionOpen;

  useEffect(() => {
    const stdout = process.stdout;
    if (!stdout?.on || !stdout?.off) return;
    const handleResize = () => {
      setCols(stdout.columns ?? 80);
      setRows(stdout.rows ?? 24);
    };
    stdout.on("resize", handleResize);
    return () => {
      stdout.off("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    void refreshRecents();
    void refreshPinnedDirs();
    void refreshLastUsedDir();
    void refreshConfig();
    void loadFluxFiles();
    setWizardDefaultsApplied(false);
    setOpenRootInitialized(false);
  }, [props.cwd]);

  useEffect(() => {
    if (!config || wizardDefaultsApplied) return;
    const defaults = buildWizardDefaults(config);
    applyWizardValues(defaults, config);
    setWizardDefaultsApplied(true);
  }, [config, wizardDefaultsApplied]);

  useEffect(() => {
    if (initialRouteHandled) return;
    if (!config) return;
    if (helpOpen || versionOpen) {
      setInitialRouteHandled(true);
      return;
    }
    const initialArgs = props.initialArgs ?? [];
    if (initialArgs.length === 0) {
      if (props.mode === "new") openWizard();
      setInitialRouteHandled(true);
      return;
    }
    void handleInitialRoute(initialArgs).finally(() => setInitialRouteHandled(true));
  }, [config, helpOpen, versionOpen, initialRouteHandled, props.initialArgs, props.mode]);

  useEffect(() => {
    const timer = setTimeout(() => setOpenDebouncedQuery(openQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [openQuery]);

  useEffect(() => {
    if (!openRootInitialized) return;
    void setLastUsedDir(props.cwd, openRoot).then((store) => setLastUsedDirState(store.dir ?? null)).catch(() => null);
  }, [openRoot, openRootInitialized, props.cwd]);

  useEffect(() => {
    if (!openRootInitialized) return;
    openScanController.current?.abort();
    const controller = new AbortController();
    openScanController.current = controller;
    const scanId = ++openScanId.current;
    setOpenIndexing(true);
    setOpenTruncated(false);
    setOpenFiles([]);

    const walker = walkFilesFromFs({
      root: openRoot,
      maxDepth: FILE_INDEX_DEPTH,
      signal: controller.signal,
      shouldEnterDir: (dirPath, dirent) => {
        if (dirent.name === "node_modules") return false;
        if (dirent.name.startsWith(".")) return false;
        return true;
      },
    });

    void (async () => {
      for await (const event of indexFiles({
        walker,
        maxFiles: FILE_INDEX_CAP,
        signal: controller.signal,
      })) {
        if (openScanId.current !== scanId) return;
        if (event.type === "file") {
          setOpenFiles((prev) => (prev.length >= FILE_INDEX_CAP ? prev : [...prev, event.path]));
        } else if (event.type === "done") {
          setOpenIndexing(false);
          setOpenTruncated(event.truncated);
        }
      }
    })();

    void loadOpenFolders(openRoot);
    setOpenSelectedIndex(0);
    setOpenFolderIndex(0);

    return () => controller.abort();
  }, [openRoot, openRootInitialized]);

  const openResults = useMemo(() => {
    const query = openDebouncedQuery.trim().toLowerCase();
    return openFiles.filter((file) => {
      if (!openShowAll && !file.toLowerCase().endsWith(".flux")) return false;
      if (!query) return true;
      const name = path.basename(file).toLowerCase();
      const full = file.toLowerCase();
      return name.includes(query) || full.includes(query);
    });
  }, [openFiles, openDebouncedQuery, openShowAll]);

  useEffect(() => {
    setOpenSelectedIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, openResults.length - 1))));
  }, [openResults.length]);

  useEffect(() => {
    setOpenFolderIndex((prev) => Math.max(0, Math.min(prev, Math.max(0, openFolders.length - 1))));
  }, [openFolders.length]);

  useEffect(() => {
    const selected = openResults[openSelectedIndex];
    if (!selected) {
      setOpenPreview(null);
      return;
    }
    const requestId = ++openPreviewRequestId.current;
    void buildPreview(selected).then((preview) => {
      if (openPreviewRequestId.current === requestId) {
        setOpenPreview(preview);
      }
    });
  }, [openResults, openSelectedIndex]);

  useEffect(() => {
    if (!currentDocument) {
      setDocPreview(null);
      return;
    }
    const requestId = ++docPreviewRequestId.current;
    void buildPreview(currentDocument).then((preview) => {
      if (docPreviewRequestId.current === requestId) {
        setDocPreview(preview ? {
          title: preview.title,
          filePath: preview.filePath,
          modified: preview.modified,
          size: preview.size,
        } : null);
      }
    });
  }, [currentDocument]);

  useEffect(() => {
    if (route === "doc") {
      setDocActionIndex(0);
    }
    if (route === "export") {
      setExportActionIndex(exportResultPath ? 1 : 0);
    }
  }, [route, exportResultPath]);

  useEffect(() => {
    if (!viewerSession) return;
    let alive = true;
    const tick = async () => {
      try {
        const payload = await fetchViewerPatch(viewerSession.url);
        if (!alive) return;
        if (payload?.errors) {
          setViewerStatus(null);
          setStreamOk(false);
          return;
        }
        if (typeof payload?.docstep === "number" || typeof payload?.time === "number") {
          setViewerStatus((prev) => ({
            docstep: payload.docstep ?? prev?.docstep ?? 0,
            time: payload.time ?? prev?.time ?? 0,
            running: prev?.running ?? true,
            docstepMs: prev?.docstepMs ?? (config?.docstepMs ?? 1000),
            seed: prev?.seed ?? 0,
          }));
          setStreamOk(true);
        }
      } catch {
        setStreamOk(false);
      }
    };
    const timer = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [viewerSession, config]);

  useEffect(() => {
    if (route !== "edit") {
      editLaunchRef.current = null;
      return;
    }
    if (!currentDocument) return;
    const activeSession = viewerSession && path.resolve(viewerSession.docPath) === currentDocument
      ? viewerSession
      : null;
    const lastLaunch = editLaunchRef.current;
    if (lastLaunch && lastLaunch.docPath === currentDocument && lastLaunch.url === activeSession?.url) {
      return;
    }
    if (editLaunching.current) return;
    editLaunching.current = true;
    void handleEdit(currentDocument).finally(() => {
      editLaunching.current = false;
    });
  }, [route, currentDocument, viewerSession]);

  useEffect(() => {
    return () => {
      if (viewerSession?.close && !props.detach) {
        void viewerSession.close();
      }
    };
  }, [viewerSession, props.detach]);

  useEffect(() => {
    setPaletteIndex((prev) => Math.max(0, Math.min(prev, limitedPalette.length - 1)));
  }, [limitedPalette.length]);

  useEffect(() => {
    if (navIndex >= navItems.length) {
      setNavIndex(Math.max(0, navItems.length - 1));
    }
    if (navItems[navIndex]?.type === "section") {
      moveSelection(1);
    }
  }, [navItems, navIndex]);

  useInput(async (input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (input && input.includes("\u001b[<")) {
      return;
    }

    if (input?.toLowerCase() === "q" && !paletteOpen && !helpOpen && !versionOpen) {
      exit();
      return;
    }

    if (versionOpen) {
      if (key.escape || key.return) setVersionOpen(false);
      return;
    }

    if (helpOpen) {
      if (key.escape || key.return) setHelpOpen(false);
      return;
    }

    if (paletteOpen) {
      if (key.escape) {
        setPaletteOpen(false);
        setPaletteQuery("");
        setPaletteIndex(0);
        return;
      }
      if (key.return) {
        const item = limitedPalette[paletteIndex];
        if (item) {
          await handlePaletteSelect(item);
        }
        setPaletteOpen(false);
        setPaletteQuery("");
        setPaletteIndex(0);
        return;
      }
      if (key.downArrow) {
        setPaletteIndex((prev) => Math.min(prev + 1, limitedPalette.length - 1));
        return;
      }
      if (key.upArrow) {
        setPaletteIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (key.backspace || key.delete) {
        setPaletteQuery((prev) => prev.slice(0, -1));
        return;
      }
      if (input) {
        setPaletteQuery((prev) => prev + input);
        return;
      }
      return;
    }

    if (key.ctrl && input === "k") {
      setPaletteOpen(true);
      setPaletteQuery("");
      setPaletteIndex(0);
      return;
    }
    if (input === "/") {
      setPaletteOpen(true);
      setPaletteQuery("");
      setPaletteIndex(0);
      return;
    }
    if (input === "?") {
      setHelpOpen(true);
      return;
    }

    if (key.tab) {
      setFocus((prev) => (prev === "nav" ? "pane" : "nav"));
      return;
    }

    if (key.escape) {
      resetToDefault();
      return;
    }

    if (route === "new") {
      await handleWizardInput(input, key);
      return;
    }

    if (focus === "nav") {
      await handleNavInput(input, key);
      return;
    }

    if (route === "open") {
      await handleOpenInput(input, key);
      return;
    }
    if (route === "doc") {
      await handleDocInput(input, key);
      return;
    }
    if (route === "export") {
      await handleExportInput(input, key);
      return;
    }
    if (route === "doctor") {
      await handleDoctorInput(input, key);
      return;
    }
    if (route === "format") {
      await handleFormatInput(input, key);
      return;
    }
    if (route === "edit") {
      await handleEditInput(input, key);
      return;
    }
  });

  const wizardSteps = useMemo<WizardStep[]>(() => {
    const steps: WizardStep[] = [
      { kind: "select", key: "template", label: "Template", options: TEMPLATE_OPTIONS },
      { kind: "input", key: "title", label: "Title", placeholder: "Flux Document" },
      { kind: "input", key: "name", label: "Name", placeholder: "folder-name" },
      { kind: "select", key: "page", label: "Page size", options: PAGE_OPTIONS },
      { kind: "select", key: "theme", label: "Theme", options: THEME_OPTIONS },
      { kind: "select", key: "fonts", label: "Fonts preset", options: FONT_OPTIONS },
      { kind: "select", key: "fontFallback", label: "Font fallback", options: FALLBACK_OPTIONS },
      { kind: "select", key: "assets", label: "Assets folder", options: YES_NO_OPTIONS },
      { kind: "select", key: "chaptersEnabled", label: "Chapters scaffold", options: YES_NO_OPTIONS },
    ];
    if (wizardValues.chaptersEnabled) {
      steps.push({ kind: "select", key: "chapters", label: "Chapters count", options: CHAPTER_OPTIONS });
    }
    steps.push({ kind: "select", key: "live", label: "Live slots", options: YES_NO_OPTIONS });
    steps.push({ kind: "summary", label: "Summary" });
    return steps;
  }, [wizardValues.chaptersEnabled]);

  useEffect(() => {
    setWizardStep((prev) => Math.max(0, Math.min(prev, wizardSteps.length - 1)));
  }, [wizardSteps.length]);

  const openResultItems = useMemo(() => openResults.map((file) => ({
    id: file,
    label: path.basename(file),
    meta: truncateMiddle(path.dirname(file), Math.max(10, Math.floor(paneContentWidth * 0.6))),
    path: file,
  })), [openResults, paneContentWidth]);

  const openActiveList = openResults.length > 0 ? "results" : "folders";
  const recentDirs = useMemo(() => {
    const dirs = recents
      .filter((item): item is Extract<NavItem, { type: "doc" }> => item.type === "doc")
      .map((item) => path.dirname(item.path));
    const unique: string[] = [];
    for (const dir of dirs) {
      if (!unique.includes(dir)) unique.push(dir);
    }
    return unique.slice(0, 5);
  }, [recents]);
  const isPinned = pinnedDirs.some((dir) => path.resolve(dir) === path.resolve(openRoot));

  const docPrimaryActions = useMemo(() => ([
    { id: "edit", label: "Edit", icon: "✎", onClick: () => void goToEdit(), active: docActionIndex === 0 },
    { id: "view", label: "View", icon: "◻︎", onClick: () => void handleView(), active: docActionIndex === 1 },
    { id: "export", label: "Export PDF", icon: "⇩", onClick: () => void goToExport(), active: docActionIndex === 2 },
  ]), [docActionIndex]);

  const docSecondaryActions = useMemo(() => ([
    { id: "doctor", label: "Doctor", icon: "✓", onClick: () => void goToDoctor(), active: docActionIndex === 3 },
    { id: "format", label: "Format", icon: "≡", onClick: () => void goToFormat(), active: docActionIndex === 4 },
  ]), [docActionIndex]);

  const rightPane = (() => {
    if (route === "new") {
      const step = wizardSteps[wizardStep] ?? null;
      return (
        <NewWizardScreen
          width={paneContentWidth}
          step={step}
          stepIndex={wizardStep}
          stepsCount={wizardSteps.length}
          values={wizardValues}
          selectedIndex={step?.kind === "select" ? wizardIndexes[step.key as WizardSelectKey] ?? 0 : 0}
          created={wizardCreated}
          postCreate={wizardPostCreate}
          outputDir={resolveWizardOutDir() ?? props.cwd}
          debug={debugLayout}
        />
      );
    }

    if (route === "open") {
      return (
        <OpenScreen
          width={paneContentWidth}
          query={openQuery}
          showAll={openShowAll}
          rootDir={openRoot}
          results={openResultItems}
          selectedIndex={openSelectedIndex}
          folders={openFolders}
          folderIndex={openFolderIndex}
          activeList={openActiveList}
          pinnedDirs={pinnedDirs}
          recentDirs={recentDirs}
          isPinned={isPinned}
          indexing={openIndexing}
          truncated={openTruncated}
          preview={openPreview}
          onToggleShowAll={() => setOpenShowAll((prev) => !prev)}
          onOpenSelected={() => {
            setFocus("pane");
            void openSelectedFile();
          }}
          onSelectResult={(index) => {
            setFocus("pane");
            setOpenSelectedIndex(index);
          }}
          onSelectFolder={(index) => {
            setFocus("pane");
            setOpenFolderIndex(index);
            const folder = openFolders[index];
            if (folder) changeOpenRoot(folder);
          }}
          onSelectPinned={(dir) => {
            setFocus("pane");
            changeOpenRoot(dir);
          }}
          onSelectRecent={(dir) => {
            setFocus("pane");
            changeOpenRoot(dir);
          }}
          onTogglePin={() => {
            setFocus("pane");
            void togglePinForCurrent();
          }}
          debug={debugLayout}
        />
      );
    }

    if (route === "doc") {
      return (
        <DocDetailsScreen
          width={paneContentWidth}
          docPath={currentDocument}
          preview={docPreview}
          primaryActions={docPrimaryActions}
          secondaryActions={docSecondaryActions}
          debug={debugLayout}
        />
      );
    }

    if (route === "export") {
      return (
        <ExportScreen
          width={paneContentWidth}
          docPath={currentDocument}
          outputPath={currentDocument ? currentDocument.replace(/\.flux$/i, ".pdf") : null}
          progress={progress}
          resultPath={exportResultPath}
          actionIndex={exportActionIndex}
          onExport={() => {
            setFocus("pane");
            void handleExport();
          }}
          onOpenFile={() => {
            setFocus("pane");
            void handleOpenFileResult();
          }}
          onReveal={() => {
            setFocus("pane");
            void handleRevealResult();
          }}
          onCopyPath={() => {
            setFocus("pane");
            void handleCopyResultPath();
          }}
          debug={debugLayout}
        />
      );
    }

    if (route === "doctor") {
      return (
        <DoctorScreen
          width={paneContentWidth}
          docPath={currentDocument}
          summary={doctorSummary}
          logs={doctorLogs}
          logsOpen={doctorLogsOpen}
          progress={progress}
          onToggleLogs={() => {
            setFocus("pane");
            setDoctorLogsOpen((prev) => !prev);
          }}
          onRun={() => {
            setFocus("pane");
            void handleCheck();
          }}
          debug={debugLayout}
        />
      );
    }

    if (route === "format") {
      return (
        <FormatScreen
          width={paneContentWidth}
          docPath={currentDocument}
          summary={formatSummary}
          logs={formatLogs}
          logsOpen={formatLogsOpen}
          onToggleLogs={() => {
            setFocus("pane");
            setFormatLogsOpen((prev) => !prev);
          }}
          onRun={() => {
            setFocus("pane");
            void handleFormat();
          }}
          debug={debugLayout}
        />
      );
    }

    if (route === "edit") {
      const viewerUrl = getViewerUrl();
      return (
        <EditScreen
          width={paneContentWidth}
          docPath={currentDocument}
          title={docPreview?.title ?? null}
          viewerUrl={viewerUrl}
          onCopyUrl={() => void handleCopyEditorUrl()}
          onExport={() => {
            setFocus("pane");
            void handleExport();
          }}
          onDoctor={() => {
            setFocus("pane");
            void handleCheck();
          }}
          onFormat={() => {
            setFocus("pane");
            void handleFormat();
          }}
          logs={editLogs}
          logsOpen={editLogsOpen}
          onToggleLogs={() => {
            setFocus("pane");
            setEditLogsOpen((prev) => !prev);
          }}
          debug={debugLayout}
        />
      );
    }

    if (route === "settings") {
      return (
        <SettingsScreen
          width={paneContentWidth}
          config={config}
          debugLayout={debugLayout}
          onToggleDebug={() => setDebugLayout((prev) => !prev)}
          debug={debugLayout}
        />
      );
    }

    const viewerUrl = getViewerUrl();
    return (
      <EditScreen
        width={paneContentWidth}
        docPath={currentDocument}
        title={docPreview?.title ?? null}
        viewerUrl={viewerUrl}
        onCopyUrl={() => void handleCopyEditorUrl()}
        onExport={() => {
          setFocus("pane");
          void handleExport();
        }}
        onDoctor={() => {
          setFocus("pane");
          void handleCheck();
        }}
        onFormat={() => {
          setFocus("pane");
          void handleFormat();
        }}
        logs={editLogs}
        logsOpen={editLogsOpen}
        onToggleLogs={() => {
          setFocus("pane");
          setEditLogsOpen((prev) => !prev);
        }}
        debug={debugLayout}
      />
    );
  })();

  return (
    <MouseProvider disabled={mouseDisabled}>
      <AppFrame debug={debugLayout}>
        <Box flexDirection="row" gap={2} height="100%">
          <PaneFrame focused={focus === "nav"} width={navWidth} height="100%">
            <Box flexDirection="column" gap={1}>
              <Box flexDirection="column">
                <Text>{accent("FLUX")}</Text>
                <Box flexDirection="row" gap={1}>
                  <Text color={streamOk ? "green" : color.muted}>{streamOk ? "●" : "○"}</Text>
                  <Text color={color.muted}>{`Flux ${props.version ?? "0.x"} · ${streamOk ? "online" : "offline"} · backend: ${BACKEND_LABEL}`}</Text>
                </Box>
              </Box>

              <Card
                title="Navigation"
                meta=""
                accent={focus === "nav"}
                ruleWidth={navContentWidth - 2}
                debug={debugLayout}
                footer={(
                  <Text color={color.muted}>/ palette · Tab focus · q quit · ? help</Text>
                )}
              >
                <NavList
                  items={navItems}
                  selectedIndex={navIndex}
                  onSelect={(index) => {
                    setNavIndex(index);
                    setFocus("nav");
                    const item = navItems[index];
                    if (item) void activateNavItem(item);
                  }}
                  width={navContentWidth}
                  maxHeight={navListHeight}
                  debug={debugLayout}
                />
              </Card>
            </Box>
          </PaneFrame>

          <PaneFrame focused={focus === "pane"} flexGrow={1} height="100%">
            <Clickable id="pane-focus" onClick={() => setFocus("pane")} priority={0}>
              <Box flexDirection="column" gap={1}>
                {rightPane}
              </Box>
            </Clickable>
          </PaneFrame>
        </Box>

        <Box marginTop={1}>
          <ToastHost toasts={toasts} busy={busy} progress={progress} />
        </Box>

        {paletteOpen ? (
          <Box position="absolute" marginTop={2} marginLeft={Math.max(2, Math.floor((innerWidth - overlayWidth) / 2))}>
            <CommandPaletteModal
              query={paletteQuery}
              groups={paletteGroups}
              selectedId={limitedPalette[paletteIndex]?.id}
              width={overlayWidth}
              debug={debugLayout}
            />
          </Box>
        ) : null}

        {helpOpen ? (
          <Box position="absolute" marginTop={2} marginLeft={Math.max(2, Math.floor((innerWidth - overlayWidth) / 2))}>
            <HelpOverlay
              width={overlayWidth}
              version={props.version}
              recentsPath={recentsPath}
              backend={BACKEND_LABEL}
              extraLines={props.helpCommand ? getHelpLines(props.helpCommand) : undefined}
            />
          </Box>
        ) : null}

        {versionOpen ? (
          <Box position="absolute" marginTop={2} marginLeft={Math.max(2, Math.floor((innerWidth - overlayWidth) / 2))}>
            <Card title="Flux CLI" meta="" accent ruleWidth={overlayWidth - 6} debug={debugLayout}>
              <Text color={color.muted}>{props.version ?? "version unknown"}</Text>
              <Text color={color.muted}>Press Esc to close</Text>
            </Card>
          </Box>
        ) : null}
      </AppFrame>
    </MouseProvider>
  );

  async function refreshRecents() {
    const store = await getRecentsStore(props.cwd);
    const list: NavItem[] = store.entries.map((entry) => ({
      type: "doc",
      label: path.basename(entry.path),
      path: entry.path,
      lastOpened: entry.lastOpened,
    }));
    setRecents(list);
    setRecentsPath(store.storePath);
  }

  async function refreshPinnedDirs() {
    const store = await getPinnedDirsStore(props.cwd);
    setPinnedDirs(store.entries);
  }

  async function refreshLastUsedDir() {
    const store = await getLastUsedDirStore(props.cwd);
    const nextDir = store.dir ?? props.cwd;
    setLastUsedDirState(store.dir);
    setOpenRoot(nextDir);
    setOpenRootInitialized(true);
  }

  async function refreshConfig() {
    const resolved = await resolveConfig({ cwd: props.cwd, env: process.env });
    setConfig(resolved.config);
  }

  async function loadFluxFiles() {
    try {
      const entries = await fs.readdir(props.cwd, { withFileTypes: true, encoding: "utf8" });
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".flux"))
        .map((entry) => path.join(props.cwd, entry.name));
      setFluxFiles(files.slice(0, 20));
    } catch {
      setFluxFiles([]);
    }
  }

  function moveSelection(delta: number) {
    let next = navIndex + delta;
    while (next >= 0 && next < navItems.length) {
      const item = navItems[next];
      if (item && item.type !== "section") {
        setNavIndex(next);
        return;
      }
      next += delta;
    }
  }

  async function activateNavItem(item: NavItem) {
    if (item.type !== "action") return;
    switch (item.id) {
      case "open":
        setPendingAction(null);
        setRoute("open");
        setFocus("pane");
        return;
      case "new":
        openWizard();
        return;
      case "edit":
        await requireDocAndRoute("edit");
        return;
      case "export":
        await requireDocAndRoute("export");
        return;
      case "doctor":
        await requireDocAndRoute("doctor");
        return;
      case "format":
        await requireDocAndRoute("format");
        return;
      default:
        return;
    }
  }

  function resetToDefault() {
    setPendingAction(null);
    setRoute("open");
    selectNavAction("open");
    setFocus("pane");
  }

  async function requireDocAndRoute(action: "edit" | "export" | "doctor" | "format") {
    const resolved = resolveActionRoute(currentDocument, action);
    setPendingAction(resolved.pendingAction);
    if (resolved.route === "open") {
      setRoute("open");
      selectNavAction("open");
      setFocus("pane");
      showToast("Select a document to continue.", "info");
      return;
    }
    selectNavAction(action);
    setRoute(resolved.route);
    setFocus("pane");
  }

  function goToEdit() {
    void requireDocAndRoute("edit");
  }

  function goToExport() {
    void requireDocAndRoute("export");
  }

  function goToDoctor() {
    void requireDocAndRoute("doctor");
  }

  function goToFormat() {
    void requireDocAndRoute("format");
  }

  async function selectCurrentDoc(docPath: string) {
    const resolved = path.resolve(docPath);
    setCurrentDocument(resolved);
    await updateRecents(props.cwd, resolved);
    void refreshRecents();
    const dir = path.dirname(resolved);
    setOpenRoot(dir);
    setLastUsedDirState(dir);
    void setLastUsedDir(props.cwd, dir);
  }

  function changeOpenRoot(nextDir: string) {
    setOpenRoot(path.resolve(nextDir));
  }

  async function togglePinForCurrent() {
    const resolved = path.resolve(openRoot);
    try {
      if (pinnedDirs.some((dir) => path.resolve(dir) === resolved)) {
        const store = await removePinnedDir(props.cwd, resolved);
        setPinnedDirs(store.entries);
        showToast("Unpinned directory", "success");
      } else {
        const store = await addPinnedDir(props.cwd, resolved);
        setPinnedDirs(store.entries);
        showToast("Pinned directory", "success");
      }
    } catch (error) {
      showToast((error as Error).message ?? "Pin update failed", "error");
    }
  }

  async function openSelectedFile() {
    const target = openResults[openSelectedIndex];
    if (!target) {
      showToast("Select a file first.", "error");
      return;
    }
    await selectCurrentDoc(target);
    const resolved = resolveRouteAfterOpen(pendingAction);
    setPendingAction(resolved.pendingAction);
    if (resolved.route !== "doc") {
      selectNavAction(resolved.route);
      setRoute(resolved.route);
      setFocus("pane");
      return;
    }
    setRoute("doc");
    setFocus("pane");
  }

  async function handleNavInput(_input: string, key: any) {
    if (key.downArrow) {
      moveSelection(1);
      return;
    }
    if (key.upArrow) {
      moveSelection(-1);
      return;
    }
    if (key.return) {
      const item = navItems[navIndex];
      if (item) await activateNavItem(item);
    }
  }

  async function handleOpenInput(input: string, key: any) {
    if (key.ctrl && input === "f") {
      setOpenShowAll((prev) => !prev);
      return;
    }
    if (key.downArrow) {
      if (openActiveList === "results") {
        setOpenSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, openResults.length - 1)));
      } else {
        setOpenFolderIndex((prev) => Math.min(prev + 1, Math.max(0, openFolders.length - 1)));
      }
      return;
    }
    if (key.upArrow) {
      if (openActiveList === "results") {
        setOpenSelectedIndex((prev) => Math.max(0, prev - 1));
      } else {
        setOpenFolderIndex((prev) => Math.max(0, prev - 1));
      }
      return;
    }
    if (key.return) {
      if (openActiveList === "results") {
        await openSelectedFile();
      } else {
        const folder = openFolders[openFolderIndex];
        if (folder) changeOpenRoot(folder);
      }
      return;
    }
    if (key.backspace || key.delete) {
      if (openQuery.length > 0) {
        setOpenQuery((prev) => prev.slice(0, -1));
      } else {
        const parent = path.dirname(openRoot);
        if (parent && parent !== openRoot) changeOpenRoot(parent);
      }
      return;
    }
    if (input) {
      setOpenQuery((prev) => prev + input);
    }
  }

  async function handleDocInput(_input: string, key: any) {
    const actionIds = ["edit", "view", "export", "doctor", "format"] as const;
    if (key.downArrow || key.rightArrow) {
      setDocActionIndex((prev) => Math.min(prev + 1, actionIds.length - 1));
      return;
    }
    if (key.upArrow || key.leftArrow) {
      setDocActionIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      const action = actionIds[docActionIndex];
      if (action === "edit") goToEdit();
      if (action === "view") await handleView();
      if (action === "export") goToExport();
      if (action === "doctor") goToDoctor();
      if (action === "format") goToFormat();
    }
  }

  async function handleExportInput(_input: string, key: any) {
    const maxIndex = exportResultPath ? 3 : 0;
    if (key.downArrow || key.rightArrow) {
      setExportActionIndex((prev) => Math.min(prev + 1, maxIndex));
      return;
    }
    if (key.upArrow || key.leftArrow) {
      setExportActionIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      if (exportActionIndex === 0) {
        await handleExport();
      } else if (exportActionIndex === 1) {
        await handleOpenFileResult();
      } else if (exportActionIndex === 2) {
        await handleRevealResult();
      } else if (exportActionIndex === 3) {
        await handleCopyResultPath();
      }
    }
  }

  async function handleDoctorInput(input: string, key: any) {
    if (input?.toLowerCase() === "l") {
      setDoctorLogsOpen((prev) => !prev);
      return;
    }
    if (key.return) {
      await handleCheck();
    }
  }

  async function handleFormatInput(input: string, key: any) {
    if (input?.toLowerCase() === "l") {
      setFormatLogsOpen((prev) => !prev);
      return;
    }
    if (key.return) {
      await handleFormat();
    }
  }

  async function handleEditInput(input: string, key: any) {
    if (input?.toLowerCase() === "l" || key.return) {
      setEditLogsOpen((prev) => !prev);
    }
  }

  async function handleWizardInput(input: string, key: any) {
    if (wizardCreated) {
      if (key.upArrow || key.downArrow) {
        setWizardPostCreate((prev) => ({ ...prev, selectedIndex: prev.selectedIndex === 0 ? 1 : 0 }));
        return;
      }
      if (input === " ") {
        setWizardPostCreate((prev) => {
          if (prev.selectedIndex === 0) {
            return { ...prev, openViewer: !prev.openViewer };
          }
          return { ...prev, setCurrent: !prev.setCurrent };
        });
        return;
      }
      if (key.return) {
        const created = wizardCreated;
        setWizardCreated(null);
        const shouldSetCurrent = wizardPostCreate.setCurrent || wizardPostCreate.openViewer;
        if (shouldSetCurrent) {
          await selectCurrentDoc(created.docPath);
        }
        if (wizardPostCreate.openViewer) {
          await handleView(created.docPath);
        }
        setRoute(shouldSetCurrent ? "doc" : "open");
        return;
      }
      if (key.escape) {
        resetToDefault();
      }
      return;
    }

    const step = wizardSteps[wizardStep];
    if (!step) return;

    if (step.kind === "summary") {
      if (key.return) {
        await submitWizard();
        return;
      }
      if (key.backspace || key.leftArrow) {
        setWizardStep((prev) => Math.max(0, prev - 1));
      }
      return;
    }

    if (step.kind === "select") {
      if (key.backspace || key.leftArrow) {
        setWizardStep((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.return) {
        await advanceWizard();
        return;
      }
      if (key.downArrow) {
        updateWizardChoice(1);
        return;
      }
      if (key.upArrow) {
        updateWizardChoice(-1);
        return;
      }
      return;
    }

    if (step.kind === "input") {
      const currentValue = String(wizardValues[step.key] ?? "");
      if (key.backspace || key.delete) {
        if (currentValue.length > 0) {
          updateWizardInput(step.key, currentValue.slice(0, -1));
        } else {
          setWizardStep((prev) => Math.max(0, prev - 1));
        }
        return;
      }
      if (key.return) {
        await advanceWizard();
        return;
      }
      if (input) {
        updateWizardInput(step.key, currentValue + input);
      }
    }
  }

  async function startViewerSession(
    docPath: string,
    overrides?: {
      docstepMs?: number;
      seed?: number;
      allowNet?: string[];
      port?: number;
      advanceTime?: boolean;
      editorDist?: string;
    },
    context: "viewer" | "editor" = "viewer",
  ): Promise<ViewerSession | null> {
    await selectCurrentDoc(docPath);
    setBusy(context === "editor" ? "Starting editor..." : "Starting viewer...");
    const result = await viewCommand({
      cwd: props.cwd,
      docPath,
      docstepMs: overrides?.docstepMs ?? config?.docstepMs ?? 1000,
      seed: overrides?.seed ?? 0,
      allowNet: overrides?.allowNet ?? [],
      port: overrides?.port,
      advanceTime: overrides?.advanceTime ?? (config?.advanceTime ?? true),
      editorDist: overrides?.editorDist,
    });
    setBusy(null);
    if (!result.ok || !result.data) {
      const fallback = context === "editor" ? "Editor failed" : "Viewer failed";
      showToast(result.error?.message ?? fallback, "error");
      return null;
    }
    setViewerSession(result.data.session);
    try {
      const status = await fetchViewerStatus(result.data.session.url);
      setViewerStatus({
        docstep: status.docstep ?? 0,
        time: status.time ?? 0,
        running: status.running ?? true,
        docstepMs: status.docstepMs ?? (config?.docstepMs ?? 1000),
        seed: status.seed ?? 0,
      });
    } catch {
      setViewerStatus({
        docstep: 0,
        time: 0,
        running: true,
        docstepMs: config?.docstepMs ?? 1000,
        seed: 0,
      });
    }
    return result.data.session;
  }

  async function handleView(docPath?: string, overrides?: {
    docstepMs?: number;
    seed?: number;
    allowNet?: string[];
    port?: number;
    advanceTime?: boolean;
    editorDist?: string;
  }) {
    const target = docPath ?? currentDocument;
    if (!target) {
      showToast("Select a document first.", "error");
      return;
    }
    const session = await startViewerSession(target, overrides);
    if (!session) return;
    openBrowser(session.url);
    showToast(session.attached ? "Attached to viewer" : "Viewer running", "success");
  }

  function appendEditLog(message: string) {
    setEditLogs((prev) => [...prev, message]);
  }

  async function handleEdit(docPath?: string) {
    const target = docPath ?? currentDocument;
    if (!target) {
      showToast("Select a document first.", "error");
      return;
    }
    if (editLaunchRef.current?.docPath !== target) {
      setEditLogs([]);
    }
    appendEditLog("Starting editor...");
    const session = await startViewerSession(target, undefined, "editor");
    if (!session) {
      appendEditLog("Editor failed to start.");
      return;
    }
    const editorUrl = `${session.url}/edit`;
    openBrowser(editorUrl);
    editLaunchRef.current = { docPath: target, url: session.url };
    appendEditLog(session.attached ? `Attached to editor at ${editorUrl}` : `Editor running at ${editorUrl}`);
    showToast(session.attached ? "Attached to editor" : "Editor running", "success");
  }

  function getViewerUrl(): string | null {
    if (!viewerSession || !currentDocument) return null;
    const matches = path.resolve(viewerSession.docPath) === currentDocument;
    if (!matches) return null;
    return viewerSession.url;
  }

  async function handleExport() {
    if (!currentDocument) {
      showToast("Select a document first.", "error");
      return;
    }
    const defaultOut = currentDocument.replace(/\.flux$/i, ".pdf");
    setBusy("Exporting PDF...");
    startProgress("Export PDF");
    try {
      const result = viewerSession
        ? await requestViewerPdf(viewerSession.url)
        : null;
      if (result) {
        await fs.writeFile(defaultOut, result);
      } else {
        await pdfCommand({ file: currentDocument, outPath: defaultOut });
      }
      setExportResultPath(defaultOut);
      setExportActionIndex(1);
      showToast(`Exported ${path.basename(defaultOut)}`, "success");
    } catch (error) {
      showToast(`Export failed: ${(error as Error).message}`, "error");
    } finally {
      stopProgress();
      setBusy(null);
    }
  }

  async function handleCheck(docPath?: string) {
    const target = docPath ?? currentDocument;
    if (!target) {
      showToast("Select a document first.", "error");
      return;
    }
    setBusy("Checking...");
    startProgress("Doctor check");
    const result = await checkCommand({ files: [target] });
    setBusy(null);
    stopProgress();
    if (!result.ok || !result.data) {
      showToast("Check failed", "error");
      setDoctorSummary("Doctor failed to run.");
      return;
    }
    const failures = result.data.results.filter((r) => !r.ok);
    if (failures.length) {
      showToast(`Doctor found ${failures.length} issue${failures.length === 1 ? "" : "s"}`, "error");
      setDoctorSummary(`Found ${failures.length} issue${failures.length === 1 ? "" : "s"}.`);
      setDoctorLogs(failures.flatMap((r) => r.errors ?? []));
      setDoctorLogsOpen(false);
    } else {
      showToast("All checks passed", "success");
      setDoctorSummary("All checks passed.");
      setDoctorLogs([]);
    }
  }

  async function handleFormat(docPath?: string) {
    const target = docPath ?? currentDocument;
    if (!target) {
      showToast("Select a document first.", "error");
      return;
    }
    setBusy("Formatting...");
    setFormatSummary("Formatting document...");
    const result = await formatCommand({ file: target });
    setBusy(null);
    if (!result.ok) {
      showToast(result.error?.message ?? "Format failed", "error");
      setFormatSummary("Format failed.");
      setFormatLogs([result.error?.message ?? "Format failed."]);
      return;
    }
    showToast("Formatted document", "success");
    setFormatSummary("Format complete.");
    setFormatLogs([]);
  }

  async function handleOpenFileResult() {
    if (!exportResultPath) return;
    openFile(exportResultPath);
    showToast("Opened file", "success");
  }

  async function handleRevealResult() {
    if (!exportResultPath) return;
    revealInFinder(exportResultPath);
    showToast("Revealed in folder", "success");
  }

  async function handleCopyResultPath() {
    if (!exportResultPath) return;
    const ok = await copyToClipboard(exportResultPath);
    showToast(ok ? "Copied path" : "Copy failed", ok ? "success" : "error");
  }

  async function handleCopyEditorUrl() {
    const viewerUrl = getViewerUrl();
    if (!viewerUrl) {
      showToast("Editor URL not available yet.", "error");
      return;
    }
    const ok = await copyToClipboard(`${viewerUrl}/edit`);
    showToast(ok ? "Copied editor URL" : "Copy failed", ok ? "success" : "error");
  }

  async function loadOpenFolders(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true, encoding: "utf8" });
      const folders = entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => entry.name !== "node_modules" && !entry.name.startsWith("."))
        .map((entry) => path.join(dir, entry.name))
        .sort((a, b) => a.localeCompare(b));
      setOpenFolders(folders);
    } catch {
      setOpenFolders([]);
    }
  }

  async function buildPreview(filePath: string) {
    try {
      const stats = await fs.stat(filePath);
      const size = formatBytes(stats.size);
      const modified = new Date(stats.mtimeMs).toLocaleString();
      let title: string | null = null;
      let status: string | null = null;

      if (stats.size <= 256 * 1024) {
        const text = await fs.readFile(filePath, "utf8");
        const sample = text.slice(0, 8000);
        const titleMatch = /title\\s*=\\s*\"([^\"]+)\"/.exec(sample);
        title = titleMatch ? titleMatch[1] : null;
        if (/document\\s*\\{/.test(sample)) {
          status = titleMatch ? "valid" : "warnings";
        } else {
          status = "errors";
        }
      }

      return {
        title,
        filePath,
        modified,
        size,
        status,
      };
    } catch {
      return {
        title: null,
        filePath,
        modified: undefined,
        size: undefined,
        status: "errors",
      };
    }
  }

  function updateWizardInput(key: "title" | "name", nextValue: string) {
    if (key === "name") {
      setWizardNameTouched(true);
    }
    setWizardValues((prev) => {
      if (key === "title") {
        const nextTitle = nextValue;
        const nextName = wizardNameTouched ? prev.name : slugify(nextTitle);
        return { ...prev, title: nextTitle, name: nextName };
      }
      const nextName = slugify(nextValue);
      return { ...prev, name: nextName };
    });
  }

  function titleFromTemplate(template: TemplateName): string {
    const map: Record<TemplateName, string> = {
      demo: "Flux Demo",
      article: "Flux Article",
      spec: "Flux Spec",
      zine: "Flux Zine",
      paper: "Flux Paper",
      blank: "Flux Document",
    };
    return map[template] ?? "Flux Document";
  }

  function slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "flux-document";
  }

  function formatBytes(size: number): string {
    if (!Number.isFinite(size)) return "";
    if (size < 1024) return `${size} B`;
    const units = ["KB", "MB", "GB"];
    let value = size / 1024;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[idx]}`;
  }

  async function handlePaletteSelect(item: { id: string; kind: string; payload?: any }) {
    if (item.kind === "template") {
      await runTemplate(item.payload.template);
      return;
    }
    if (item.kind === "doc" || item.kind === "file") {
      await selectCurrentDoc(item.payload.path);
      setRoute("doc");
      return;
    }
    if (item.kind === "action") {
      if (item.payload.action === "open") {
        setPendingAction(null);
        setRoute("open");
        setFocus("pane");
        return;
      }
      if (item.payload.action === "new") {
        openWizard();
        return;
      }
      if (item.payload.action === "edit") await requireDocAndRoute("edit");
      if (item.payload.action === "export") await requireDocAndRoute("export");
      if (item.payload.action === "doctor") await requireDocAndRoute("doctor");
      if (item.payload.action === "format") await requireDocAndRoute("format");
    }
  }

  async function runAdd(
    kind: string,
    docPath?: string,
    options?: { text?: string; heading?: string; label?: string; noHeading?: boolean; noCheck?: boolean },
  ) {
    const target = docPath ?? currentDocument;
    if (!target) {
      showToast("Select a document first.", "error");
      return;
    }
    setBusy(`Adding ${kind}...`);
    const result = await addCommand({
      cwd: props.cwd,
      file: target,
      kind: kind as any,
      text: options?.text,
      heading: options?.heading,
      label: options?.label,
      noHeading: options?.noHeading,
      noCheck: options?.noCheck,
    });
    setBusy(null);
    if (!result.ok) {
      showToast(result.error?.message ?? "Add failed", "error");
      return;
    }
    showToast(`Added ${kind}`, "success");
  }

  async function runTemplate(template: string) {
    const title = titleFromTemplate(template as TemplateName);
    const name = slugify(title);
    const outRoot = resolveWizardOutDir() ?? props.cwd;
    const outDir = path.join(outRoot, name);
    setBusy(`Creating ${template}...`);
    const result = await newCommand({
      cwd: props.cwd,
      template: template as any,
      out: outDir,
      title,
      slug: name,
      page: (config?.defaultPageSize ?? "Letter") as PageSizeOption,
      theme: (config?.defaultTheme ?? "screen") as ThemeOption,
      fonts: (config?.defaultFonts ?? "tech") as FontsPreset,
      fontFallback: "system",
      assets: true,
      chapters: 0,
      live: template === "demo",
    });
    setBusy(null);
    if (!result.ok || !result.data) {
      showToast(result.error?.message ?? "New failed", "error");
      return;
    }
    await selectCurrentDoc(result.data.docPath);
    showToast("Document created", "success");
    if (template === "blank") {
      setRoute("edit");
    } else {
      setRoute("doc");
    }
  }

  function buildWizardDefaults(cfg: any): WizardValues {
    const template: TemplateName = "demo";
    const title = titleFromTemplate(template);
    const name = slugify(title);
    return {
      title,
      name,
      template,
      page: (cfg?.defaultPageSize ?? "Letter") as PageSizeOption,
      theme: (cfg?.defaultTheme ?? "screen") as ThemeOption,
      fonts: (cfg?.defaultFonts ?? "tech") as FontsPreset,
      fontFallback: "system",
      assets: true,
      chaptersEnabled: false,
      chapters: 2,
      live: template === "demo",
    };
  }

  function resolveWizardOutDir(outDir?: string) {
    if (outDir) return outDir;
    if (wizardOutDir) return wizardOutDir;
    return props.cwd;
  }

  function indexForValue<T>(options: { value: T }[], value: T): number {
    const idx = options.findIndex((opt) => opt.value === value);
    return idx >= 0 ? idx : 0;
  }

  function applyWizardValues(nextValues: WizardValues, cfg?: any, outDir?: string) {
    setWizardValues(nextValues);
    setWizardIndexes({
      template: indexForValue(TEMPLATE_OPTIONS, nextValues.template),
      page: indexForValue(PAGE_OPTIONS, nextValues.page),
      theme: indexForValue(THEME_OPTIONS, nextValues.theme),
      fonts: indexForValue(FONT_OPTIONS, nextValues.fonts),
      fontFallback: indexForValue(FALLBACK_OPTIONS, nextValues.fontFallback),
      assets: indexForValue(YES_NO_OPTIONS, nextValues.assets),
      chaptersEnabled: indexForValue(YES_NO_OPTIONS, nextValues.chaptersEnabled),
      chapters: indexForValue(CHAPTER_OPTIONS, nextValues.chapters),
      live: indexForValue(YES_NO_OPTIONS, nextValues.live),
    });
    const nextOut = outDir ?? props.cwd;
    setWizardOutDir(nextOut);
  }

  function updateWizardChoice(direction: number) {
    const step = wizardSteps[wizardStep];
    if (!step || step.kind !== "select") return;
    const max = step.options.length - 1;
    const currentIndex = wizardIndexes[step.key] ?? 0;
    const nextIndex = Math.max(0, Math.min(max, currentIndex + direction));
    const nextValue = step.options[nextIndex]?.value;
    setWizardIndexes((prev) => ({ ...prev, [step.key]: nextIndex }));
    setWizardValues((prev) => {
      const next = { ...prev, [step.key]: nextValue };
      if (step.key === "template" && !wizardLiveTouched) {
        const nextLive = nextValue === "demo";
        next.live = nextLive;
        setWizardIndexes((indexes) => ({
          ...indexes,
          live: indexForValue(YES_NO_OPTIONS, nextLive),
        }));
      }
      if (step.key === "template") {
        const prevTitle = prev.title;
        const defaultTitle = titleFromTemplate(prev.template);
        if (prevTitle === defaultTitle) {
          const nextTitle = titleFromTemplate(nextValue as TemplateName);
          next.title = nextTitle;
          if (!wizardNameTouched) {
            next.name = slugify(nextTitle);
          }
        }
      }
      if (step.key === "chaptersEnabled" && nextValue === false) {
        next.chaptersEnabled = false;
      }
      if (step.key === "live") {
        setWizardLiveTouched(true);
      }
      return next;
    });
  }

  async function advanceWizard() {
    const step = wizardSteps[wizardStep];
    if (!step) return;
    if (step.kind === "summary") {
      await submitWizard();
      return;
    }
    if (wizardStep < wizardSteps.length - 1) {
      setWizardStep((prev) => prev + 1);
    }
  }

  async function submitWizard(valuesOverride?: WizardValues, outDirOverride?: string) {
    const values = valuesOverride ?? wizardValues;
    const outputRoot = resolveWizardOutDir(outDirOverride) ?? props.cwd;
    const outputDir = path.join(outputRoot, values.name);
    setBusy("Creating document...");
    const result = await newCommand({
      cwd: props.cwd,
      template: values.template,
      out: outputDir,
      page: values.page,
      theme: values.theme,
      fonts: values.fonts,
      fontFallback: values.fontFallback,
      assets: values.assets,
      chapters: values.chaptersEnabled ? values.chapters : 0,
      live: values.live,
      title: values.title,
      slug: values.name,
    });
    setBusy(null);
    if (!result.ok || !result.data) {
      showToast(result.error?.message ?? "New failed", "error");
      return;
    }
    if (values.template === "blank") {
      await selectCurrentDoc(result.data.docPath);
      setWizardCreated(null);
      setRoute("edit");
      showToast("Document created", "success");
      return;
    }
    setWizardCreated(result.data);
    setWizardPostCreate({ openViewer: true, setCurrent: true, selectedIndex: 0 });
    showToast("Document created", "success");
  }

  function openWizard(reset = true) {
    setRoute("new");
    setFocus("pane");
    if (reset) {
      const defaults = buildWizardDefaults(config);
      applyWizardValues(defaults, config);
      setWizardStep(0);
      setWizardCreated(null);
      setWizardPostCreate({ openViewer: true, setCurrent: true, selectedIndex: 0 });
      setWizardLiveTouched(false);
      setWizardNameTouched(false);
    }
  }

  function selectNavAction(id: string) {
    const idx = navItems.findIndex((entry) => entry.type === "action" && entry.id === id);
    if (idx >= 0) setNavIndex(idx);
  }

  async function handleInitialRoute(initialArgs: string[]) {
    const [command, ...rest] = initialArgs;
    if (!command) return;
    switch (command) {
      case "new": {
        const parsed = parseNewArgsForUi(rest);
        if (parsed.unknownTemplate) {
          showToast(`Unknown template '${parsed.unknownTemplate}'.`, "error");
        }
        const defaults = buildWizardDefaults(config);
        const next: WizardValues = { ...defaults };
        if (parsed.template) {
          next.template = parsed.template;
          next.live = parsed.live ?? (parsed.template === "demo");
        }
        if (parsed.page) next.page = parsed.page;
        if (parsed.theme) next.theme = parsed.theme;
        if (parsed.fonts) next.fonts = parsed.fonts;
        if (parsed.fontFallback) next.fontFallback = parsed.fontFallback;
        if (parsed.assets !== undefined) next.assets = parsed.assets;
        if (parsed.chapters !== undefined) {
          next.chaptersEnabled = parsed.chapters > 0;
          next.chapters = parsed.chapters > 0 ? Math.max(1, parsed.chapters) : next.chapters;
        }
        if (parsed.live !== undefined) {
          next.live = parsed.live;
        }
        let outOverride = parsed.out;
        if (parsed.out && parsed.out.endsWith(".flux")) {
          const resolved = path.resolve(props.cwd, parsed.out);
          next.name = slugify(path.basename(resolved, ".flux"));
          outOverride = path.dirname(resolved);
        }
        if (!wizardNameTouched) {
          next.name = slugify(next.title);
        }
        applyWizardValues(next, config, outOverride);
        openWizard(true);
        if (parsed.provided.live) {
          setWizardLiveTouched(true);
        }
        const autoRun = Boolean(parsed.template
          && parsed.page
          && parsed.theme
          && parsed.fonts
          && parsed.assets !== undefined
          && parsed.chapters !== undefined
          && parsed.live !== undefined);
        if (autoRun) {
          await submitWizard(next, outOverride);
        }
        return;
      }
      case "view": {
        const parsed = parseViewArgsForUi(rest);
        const target = parsed.file ?? currentDocument ?? null;
        if (!target) {
          showToast("flux view: missing <file>", "error");
          return;
        }
        await handleView(target, {
          docstepMs: parsed.docstepMs,
          seed: parsed.seed,
          allowNet: parsed.allowNet,
          port: parsed.port,
          advanceTime: parsed.advanceTime,
          editorDist: parsed.editorDist,
        });
        setRoute("doc");
        return;
      }
      case "check": {
        const target = firstFileArg(rest) ?? currentDocument ?? null;
        if (!target) {
          showToast("flux check: missing <file>", "error");
          return;
        }
        await selectCurrentDoc(target);
        setRoute("doctor");
        await handleCheck(target);
        return;
      }
      case "fmt": {
        const target = firstFileArg(rest) ?? currentDocument ?? null;
        if (!target) {
          showToast("flux fmt: missing <file>", "error");
          return;
        }
        await selectCurrentDoc(target);
        setRoute("format");
        await handleFormat(target);
        return;
      }
      case "add": {
        const parsed = parseAddArgsForUi(rest);
        if (parsed.kind) {
          await runAdd(parsed.kind, parsed.file, parsed);
          if (parsed.file) await selectCurrentDoc(parsed.file);
          setRoute("edit");
        } else {
          showToast("flux add: missing <kind> (use --no-ui for prompts)", "error");
        }
        return;
      }
      case "pdf": {
        const parsed = parsePdfArgsForUi(rest);
        if (!parsed.file || !parsed.outPath) {
          showToast("flux pdf: missing <file> or --out", "error");
          return;
        }
        setBusy("Exporting PDF...");
        const result = await pdfCommand({ file: parsed.file, outPath: parsed.outPath, seed: parsed.seed, docstep: parsed.docstep });
        setBusy(null);
        if (!result.ok) {
          showToast(result.error?.message ?? "Export failed", "error");
          return;
        }
        showToast(`Wrote ${parsed.outPath}`, "success");
        setExportResultPath(parsed.outPath);
        setExportActionIndex(1);
        await selectCurrentDoc(parsed.file);
        setRoute("export");
        return;
      }
      case "config": {
        setRoute("settings");
        return;
      }
      case "parse":
      case "render":
      case "tick":
      case "step": {
        showToast("Use --no-ui for JSON output.", "error");
        return;
      }
      default:
        return;
    }
  }

  function showToast(message: string, kind: "info" | "success" | "error" = "info") {
    pushToast(message, kind);
  }
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";

  const args =
    process.platform === "win32" ? ["/c", "start", url.replace(/&/g, "^&")] : [url];

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import("node:child_process").then(({ spawn }) => {
    spawn(command, args, { stdio: "ignore", detached: true });
  });
}

function openFile(target: string): void {
  const resolved = path.resolve(target);
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";

  const args =
    process.platform === "win32"
      ? ["/c", "start", "", resolved.replace(/&/g, "^&")]
      : [resolved];

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import("node:child_process").then(({ spawn }) => {
    spawn(command, args, { stdio: "ignore", detached: true });
  });
}

function revealInFinder(target: string): void {
  const resolved = path.resolve(target);
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer"
        : "xdg-open";
  const args =
    process.platform === "darwin"
      ? ["-R", resolved]
      : process.platform === "win32"
        ? ["/select,", resolved]
        : [path.dirname(resolved)];

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  import("node:child_process").then(({ spawn }) => {
    spawn(command, args, { stdio: "ignore", detached: true });
  });
}

async function copyToClipboard(value: string): Promise<boolean> {
  const text = value ?? "";
  try {
    const clipboardy = await import("clipboardy").catch(() => null);
    if (clipboardy?.default?.write) {
      await clipboardy.default.write(text);
      return true;
    }
    if (process.platform === "darwin") {
      const { spawn } = await import("node:child_process");
      const proc = spawn("pbcopy");
      proc.stdin?.write(text);
      proc.stdin?.end();
      return true;
    }
    if (process.platform === "win32") {
      const { spawn } = await import("node:child_process");
      const proc = spawn("clip");
      proc.stdin?.write(text);
      proc.stdin?.end();
      return true;
    }
    const { spawn } = await import("node:child_process");
    const proc = spawn("xclip", ["-selection", "clipboard"]);
    proc.stdin?.write(text);
    proc.stdin?.end();
    return true;
  } catch {
    return false;
  }
}

function parseNewArgsForUi(args: string[]) {
  const provided = {
    page: false,
    theme: false,
    fonts: false,
    fontFallback: false,
    assets: false,
    chapters: false,
    live: false,
  };
  let template: TemplateName | undefined;
  let unknownTemplate: string | undefined;
  let out: string | undefined;
  let page: PageSizeOption | undefined;
  let theme: ThemeOption | undefined;
  let fonts: FontsPreset | undefined;
  let fontFallback: FontFallback | undefined;
  let assets: boolean | undefined;
  let chapters: number | undefined;
  let live: boolean | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("-") && !template && !unknownTemplate) {
      if (isTemplateName(arg)) {
        template = arg;
      } else {
        unknownTemplate = arg;
      }
      continue;
    }
    if (arg === "--out") {
      out = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
      continue;
    }
    if (arg === "--page") {
      page = normalizePage(args[i + 1]);
      provided.page = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--page=")) {
      page = normalizePage(arg.slice("--page=".length));
      provided.page = true;
      continue;
    }
    if (arg === "--theme") {
      theme = normalizeTheme(args[i + 1]);
      provided.theme = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--theme=")) {
      theme = normalizeTheme(arg.slice("--theme=".length));
      provided.theme = true;
      continue;
    }
    if (arg === "--fonts") {
      fonts = normalizeFonts(args[i + 1]);
      provided.fonts = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--fonts=")) {
      fonts = normalizeFonts(arg.slice("--fonts=".length));
      provided.fonts = true;
      continue;
    }
    if (arg === "--fallback" || arg === "--font-fallback") {
      fontFallback = normalizeFallback(args[i + 1]);
      provided.fontFallback = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--fallback=")) {
      fontFallback = normalizeFallback(arg.slice("--fallback=".length));
      provided.fontFallback = true;
      continue;
    }
    if (arg.startsWith("--font-fallback=")) {
      fontFallback = normalizeFallback(arg.slice("--font-fallback=".length));
      provided.fontFallback = true;
      continue;
    }
    if (arg === "--assets") {
      assets = parseYesNoArg(args[i + 1]);
      provided.assets = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--assets=")) {
      assets = parseYesNoArg(arg.slice("--assets=".length));
      provided.assets = true;
      continue;
    }
    if (arg === "--chapters") {
      chapters = parseNumberArg(args[i + 1]);
      provided.chapters = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--chapters=")) {
      chapters = parseNumberArg(arg.slice("--chapters=".length));
      provided.chapters = true;
      continue;
    }
    if (arg === "--live") {
      live = parseYesNoArg(args[i + 1]);
      provided.live = true;
      i += 1;
      continue;
    }
    if (arg.startsWith("--live=")) {
      live = parseYesNoArg(arg.slice("--live=".length));
      provided.live = true;
      continue;
    }
  }

  return {
    template,
    unknownTemplate,
    out,
    page,
    theme,
    fonts,
    fontFallback,
    assets,
    chapters: Number.isFinite(chapters ?? NaN) ? chapters : undefined,
    live,
    provided,
  };
}

function parseViewArgsForUi(args: string[]) {
  let file: string | undefined;
  let port: number | undefined;
  let docstepMs: number | undefined;
  let seed: number | undefined;
  let advanceTime: boolean | undefined;
  let editorDist: string | undefined;
  const allowNet: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--port") {
      port = parseNumberArg(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--port=")) {
      port = parseNumberArg(arg.slice("--port=".length));
      continue;
    }
    if (arg === "--docstep-ms") {
      docstepMs = parseNumberArg(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--docstep-ms=")) {
      docstepMs = parseNumberArg(arg.slice("--docstep-ms=".length));
      continue;
    }
    if (arg === "--seed") {
      seed = parseNumberArg(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--seed=")) {
      seed = parseNumberArg(arg.slice("--seed=".length));
      continue;
    }
    if (arg === "--allow-net") {
      const raw = args[i + 1] ?? "";
      allowNet.push(...raw.split(",").map((item) => item.trim()).filter(Boolean));
      i += 1;
      continue;
    }
    if (arg.startsWith("--allow-net=")) {
      const raw = arg.slice("--allow-net=".length);
      allowNet.push(...raw.split(",").map((item) => item.trim()).filter(Boolean));
      continue;
    }
    if (arg === "--editor-dist") {
      editorDist = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--editor-dist=")) {
      editorDist = arg.slice("--editor-dist=".length);
      continue;
    }
    if (arg === "--no-time") {
      advanceTime = false;
      continue;
    }
    if (arg === "--tty") {
      continue;
    }
    if (!arg.startsWith("-")) {
      file = arg;
    }
  }
  return { file, port, docstepMs, seed, allowNet, advanceTime, editorDist };
}

function parseAddArgsForUi(args: string[]) {
  let kind: string | undefined;
  let file: string | undefined;
  let text: string | undefined;
  let heading: string | undefined;
  let label: string | undefined;
  let noHeading = false;
  let noCheck = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("-") && !kind) {
      kind = arg;
      continue;
    }
    if (arg === "--text") {
      text = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--text=")) {
      text = arg.slice("--text=".length);
      continue;
    }
    if (arg === "--heading") {
      heading = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--heading=")) {
      heading = arg.slice("--heading=".length);
      continue;
    }
    if (arg === "--label") {
      label = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--label=")) {
      label = arg.slice("--label=".length);
      continue;
    }
    if (arg === "--no-heading") {
      noHeading = true;
      continue;
    }
    if (arg === "--no-check") {
      noCheck = true;
      continue;
    }
    if (!arg.startsWith("-")) {
      file = arg;
    }
  }
  return { kind, file, text, heading, label, noHeading, noCheck };
}

function parsePdfArgsForUi(args: string[]) {
  let outPath: string | undefined;
  let seed: number | undefined;
  let docstep: number | undefined;
  let file: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out") {
      outPath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
      continue;
    }
    if (arg === "--seed") {
      seed = parseNumberArg(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--seed=")) {
      seed = parseNumberArg(arg.slice("--seed=".length));
      continue;
    }
    if (arg === "--docstep") {
      docstep = parseNumberArg(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--docstep=")) {
      docstep = parseNumberArg(arg.slice("--docstep=".length));
      continue;
    }
    if (!arg.startsWith("-")) {
      file = arg;
    }
  }
  return { file, outPath, seed, docstep };
}

function firstFileArg(args: string[]): string | undefined {
  return args.find((arg) => !arg.startsWith("-"));
}

function normalizePage(raw?: string): PageSizeOption | undefined {
  return raw === "A4" ? "A4" : raw === "Letter" ? "Letter" : undefined;
}

function normalizeTheme(raw?: string): ThemeOption | undefined {
  if (raw === "screen" || raw === "print" || raw === "both") return raw;
  return undefined;
}

function normalizeFonts(raw?: string): FontsPreset | undefined {
  if (raw === "tech" || raw === "bookish") return raw;
  return undefined;
}

function normalizeFallback(raw?: string): FontFallback | undefined {
  if (!raw) return undefined;
  if (raw === "none" || raw === "off" || raw === "false" || raw === "0") return "none";
  if (raw === "system") return "system";
  return undefined;
}

function parseYesNoArg(raw?: string): boolean {
  if (!raw) return true;
  return !(raw === "no" || raw === "false" || raw === "0");
}

function parseNumberArg(raw?: string): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function isTemplateName(raw: string): raw is TemplateName {
  return raw === "demo" || raw === "article" || raw === "spec" || raw === "zine" || raw === "paper" || raw === "blank";
}

function getHelpLines(command?: string): string[] {
  const topic = command ?? "";
  if (topic === "parse") {
    return [
      "Usage:",
      "  flux parse [options] <files...>",
      "",
      "Description:",
      "  Parse Flux source files and print their IR as JSON.",
      "",
      "Options:",
      "  --ndjson    Emit one JSON object per line: { \"file\", \"doc\" }.",
      "  --pretty    Pretty-print JSON (2-space indent). (default for a single file)",
      "  --compact   Compact JSON (no whitespace).",
      "  -h, --help  Show this message.",
      "",
    ];
  }
  if (topic === "check") {
    return [
      "Usage:",
      "  flux check [options] <files...>",
      "",
      "Description:",
      "  Parse Flux files and run basic static checks (grid references,",
      "  neighbors.* usage, and runtime shape).",
      "",
      "Options:",
      "  --json      Emit NDJSON diagnostics to stdout.",
      "  -h, --help  Show this message.",
      "",
    ];
  }
  if (topic === "render") {
    return [
      "Usage:",
      "  flux render [options] <file>",
      "",
      "Description:",
      "  Render a Flux document to canonical Render IR JSON.",
      "",
      "Options:",
      "  --format ir   Output format. (required; currently only 'ir')",
      "  --seed N      Deterministic RNG seed (default: 0).",
      "  --time T      Render time in seconds (default: 0).",
      "  --docstep D   Render at docstep D (default: 0).",
      "  -h, --help    Show this message.",
      "",
    ];
  }
  if (topic === "fmt") {
    return [
      "Usage:",
      "  flux fmt <file>",
      "",
      "Description:",
      "  Apply a minimal formatter to a Flux document.",
      "",
      "Options:",
      "  -h, --help  Show this message.",
      "",
    ];
  }
  if (topic === "tick") {
    return [
      "Usage:",
      "  flux tick [options] <file>",
      "",
      "Description:",
      "  Advance time by a number of seconds and render the updated IR.",
      "",
      "Options:",
      "  --seconds S  Seconds to advance time by.",
      "  --seed N     Deterministic RNG seed (default: 0).",
      "  -h, --help   Show this message.",
      "",
    ];
  }
  if (topic === "step") {
    return [
      "Usage:",
      "  flux step [options] <file>",
      "",
      "Description:",
      "  Advance docsteps and render the updated IR.",
      "",
      "Options:",
      "  --n N       Docsteps to advance by (default: 1).",
      "  --seed N    Deterministic RNG seed (default: 0).",
      "  -h, --help  Show this message.",
      "",
    ];
  }
  if (topic === "view") {
    return [
      "Usage:",
      "  flux view [options] <file>",
      "",
      "Description:",
      "  Open a local web viewer for a Flux document.",
      "",
      "Options:",
      "  --port <n>          Port for the local server (default: auto).",
      "  --docstep-ms <n>    Docstep interval in milliseconds.",
      "  --seed <n>          Seed for deterministic rendering.",
      "  --allow-net <orig>  Allow remote assets for origin (repeatable or comma-separated).",
      "  --no-time           Disable automatic time advancement.",
      "  --tty               Use the legacy TTY grid viewer.",
      "  -h, --help          Show this message.",
      "",
    ];
  }
  if (topic === "pdf") {
    return [
      "Usage:",
      "  flux pdf [options] <file> --out <file.pdf>",
      "",
      "Description:",
      "  Render a Flux document snapshot to PDF.",
      "",
      "Options:",
      "  --out <file>      Output PDF path. (required)",
      "  --seed <n>        Seed for deterministic rendering.",
      "  --docstep <n>     Docstep to render.",
      "  -h, --help        Show this message.",
      "",
    ];
  }
  if (topic === "config") {
    return [
      "Usage:",
      "  flux config",
      "  flux config set <key> <value> [--init]",
      "",
      "Options:",
      "  --json      Emit JSON.",
      "  --init      Create flux.config.json if missing.",
      "",
    ];
  }
  if (topic === "new") {
    return [
      "Usage:",
      "  flux new           (launch wizard)",
      "  flux new <template> --out <dir> --page Letter|A4 --theme print|screen|both --fonts tech|bookish",
      "    --fallback system|none --assets yes|no --chapters N --live yes|no",
      "",
      "Templates:",
      "  demo, article, spec, zine, paper, blank",
      "",
    ];
  }
  if (topic === "add") {
    return [
      "Usage:",
      "  flux add <kind> [options] <file>",
      "",
      "Kinds:",
      "  title, page, section, figure, callout, table, slot, inline-slot, bibliography-stub",
      "",
      "Options:",
      "  --text <value>       Text value for title/callout.",
      "  --heading <value>    Heading text for sections.",
      "  --label <value>      Optional label for figure/callout.",
      "  --no-heading         Omit section heading.",
      "  --no-check           Skip check after editing.",
      "",
    ];
  }
  return [];
}
