import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Text,
  useInput,
  useApp,
  measureElement,
} from "ink";
import path from "node:path";
import fs from "node:fs/promises";
import {
  getRecentsStore,
  updateRecents,
  resolveConfig,
  configCommand,
  viewCommand,
  pdfCommand,
  checkCommand,
  formatCommand,
  addCommand,
  newCommand,
  updateViewerTicker,
  updateViewerRuntime,
  fetchViewerPatch,
  fetchViewerStatus,
  requestViewerPdf,
} from "@flux-lang/cli-core";
import type { ViewerSession } from "@flux-lang/cli-core";

interface AppProps {
  cwd: string;
  mode?: "new";
  initialArgs?: string[];
  detach?: boolean;
  helpCommand?: string;
  version?: string;
}

type NavItem =
  | { type: "section"; label: string }
  | { type: "doc"; label: string; path: string; lastOpened?: string }
  | { type: "action"; label: string; id: string };

interface PaletteItem {
  id: string;
  label: string;
  kind: "action" | "template" | "doc";
  payload?: any;
}

interface ViewerStatus {
  docstep: number;
  time: number;
  running: boolean;
  docstepMs: number;
  seed: number;
}

type TemplateName = "demo" | "article" | "spec" | "zine" | "paper";
type PageSizeOption = "Letter" | "A4";
type ThemeOption = "print" | "screen" | "both";
type FontsPreset = "tech" | "bookish";
type FontFallback = "system" | "none";

interface WizardValues {
  template: TemplateName;
  page: PageSizeOption;
  theme: ThemeOption;
  fonts: FontsPreset;
  fontFallback: FontFallback;
  assets: boolean;
  chaptersEnabled: boolean;
  chapters: number;
  live: boolean;
}

type WizardIndexMap = Record<keyof WizardValues, number>;

type WizardStep =
  | {
      kind: "select";
      key: keyof WizardValues;
      label: string;
      options: { label: string; value: any; hint?: string }[];
    }
  | {
      kind: "summary";
      label: string;
    };

const ACCENT = "cyan";
const ACCENT_ALT = "green";

const TEMPLATE_OPTIONS: { label: string; value: TemplateName; hint: string }[] = [
  { label: "Demo", value: "demo", hint: "Live slots + assets + annotations" },
  { label: "Article", value: "article", hint: "Narrative article starter" },
  { label: "Spec", value: "spec", hint: "Technical spec layout" },
  { label: "Zine", value: "zine", hint: "Visual zine layout" },
  { label: "Paper", value: "paper", hint: "Academic paper with abstract" },
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

export function App(props: AppProps) {
  const { exit } = useApp();
  const [recents, setRecents] = useState<NavItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(Boolean(props.helpCommand));
  const [versionOpen, setVersionOpen] = useState(Boolean(props.version));
  const [wizardOpen, setWizardOpen] = useState(props.mode === "new");
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardValues, setWizardValues] = useState<WizardValues>({
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
  const [wizardOpenChoice, setWizardOpenChoice] = useState(0);
  const [wizardLiveTouched, setWizardLiveTouched] = useState(false);
  const [wizardOutDir, setWizardOutDir] = useState<string | undefined>(undefined);
  const [wizardDefaultsApplied, setWizardDefaultsApplied] = useState(false);
  const [initialRouteHandled, setInitialRouteHandled] = useState(false);
  const [viewerSession, setViewerSession] = useState<ViewerSession | null>(null);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus | null>(null);
  const [streamOk, setStreamOk] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  const [prompt, setPrompt] = useState<null | { label: string; onSubmit: (value: string) => Promise<void> }>(null);
  const [promptValue, setPromptValue] = useState("");
  const [config, setConfig] = useState<any>(null);
  const [fluxFiles, setFluxFiles] = useState<string[]>([]);
  const listRef = useRef<any>(null);
  const [listBounds, setListBounds] = useState<{ y: number; height: number } | null>(null);
  const [cols, setCols] = useState(() => process.stdout.columns ?? 80);

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [];
    items.push({ type: "section", label: "Recent" });
    items.push(...recents);
    items.push({ type: "section", label: "Open" });
    items.push({ type: "action", id: "open", label: "Open..." });
    items.push({ type: "section", label: "New" });
    items.push({ type: "action", id: "new", label: "New..." });
    items.push({ type: "section", label: "Actions" });
    items.push({ type: "action", id: "view", label: "View" });
    items.push({ type: "action", id: "export", label: "Export PDF" });
    items.push({ type: "action", id: "check", label: "Check" });
    items.push({ type: "action", id: "format", label: "Format" });
    items.push({ type: "action", id: "add", label: "Add..." });
    items.push({ type: "section", label: "Settings" });
    items.push({ type: "action", id: "settings", label: "Settings" });
    return items;
  }, [recents]);

  const handleMouseInput = useCallback((input: string) => {
    if (!listBounds) return;
    if (wizardOpen || paletteOpen || prompt || helpOpen || versionOpen) return;
    const events = parseMouseSequences(input);
    for (const event of events) {
      if (!event.pressed || event.button !== 0) continue;
      const row = event.y - 1;
      if (row < listBounds.y || row >= listBounds.y + navItems.length) continue;
      const idx = row - listBounds.y;
      if (idx >= 0 && idx < navItems.length) {
        setSelectedIndex(idx);
        const item = navItems[idx];
        if (item) {
          void activateNavItem(item);
        }
      }
    }
  }, [listBounds, wizardOpen, paletteOpen, prompt, helpOpen, versionOpen, navItems, activateNavItem]);

  useEffect(() => {
    void refreshRecents();
    void refreshConfig();
    void loadFluxFiles();
    setWizardDefaultsApplied(false);
  }, [props.cwd]);

  useEffect(() => {
    if (!config || wizardDefaultsApplied) return;
    const defaults = buildWizardDefaults(config);
    applyWizardValues(defaults, config);
    setWizardDefaultsApplied(true);
  }, [config, wizardDefaultsApplied]);

  useEffect(() => {
    const stdout = process.stdout;
    if (!stdout?.on || !stdout?.off) return;
    const handleResize = () => setCols(stdout.columns ?? 80);
    stdout.on("resize", handleResize);
    return () => {
      stdout.off("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const stdout = process.stdout;
    if (!stdout?.isTTY) return;
    stdout.write("\u001b[?1000h\u001b[?1006h");
    return () => {
      stdout.write("\u001b[?1000l\u001b[?1006l");
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    try {
      const bounds = measureElement(listRef.current) as { y?: number; height?: number };
      setListBounds({ y: bounds.y ?? 0, height: bounds.height ?? 0 });
    } catch {
      // ignore
    }
  }, [recents, selectedIndex]);

  useEffect(() => {
    const stdin = process.stdin;
    if (!stdin?.on || !stdin.isTTY) return;
    const handleData = (data: Buffer) => {
      handleMouseInput(data.toString("utf8"));
    };
    stdin.on("data", handleData);
    return () => {
      stdin.off("data", handleData);
    };
  }, [handleMouseInput]);

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
        // ignore
      }
    };
    const timer = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [viewerSession, config]);

  useEffect(() => {
    return () => {
      if (viewerSession?.close && !props.detach) {
        void viewerSession.close();
      }
    };
  }, [viewerSession, props.detach]);

  useInput(async (input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (input && isMouseSequence(input)) {
      return;
    }

    if (versionOpen) {
      if (key.escape || key.return) {
        setVersionOpen(false);
      }
      return;
    }

    if (helpOpen) {
      if (key.escape || key.return) {
        setHelpOpen(false);
      }
      return;
    }

    if (prompt) {
      if (key.escape) {
        setPrompt(null);
        setPromptValue("");
        return;
      }
      if (key.return) {
        const value = promptValue;
        setPrompt(null);
        setPromptValue("");
        await prompt.onSubmit(value);
        return;
      }
      if (key.backspace || key.delete) {
        setPromptValue((prev) => prev.slice(0, -1));
        return;
      }
      if (input) {
        setPromptValue((prev) => prev + input);
      }
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
        const items = filteredPalette;
        const item = items[paletteIndex];
        if (item) {
          await handlePaletteSelect(item);
        }
        setPaletteOpen(false);
        setPaletteQuery("");
        setPaletteIndex(0);
        return;
      }
      if (key.downArrow) {
        setPaletteIndex((prev) => Math.min(prev + 1, filteredPalette.length - 1));
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
      }
      return;
    }

    if (key.ctrl && input === "k") {
      setPaletteOpen(true);
      return;
    }
    if (input === "/") {
      setPaletteOpen(true);
      return;
    }

    if (wizardOpen) {
      if (key.escape) {
        setWizardOpen(false);
        setWizardCreated(null);
        return;
      }
      if (wizardCreated) {
        if (key.downArrow || key.upArrow) {
          setWizardOpenChoice((prev) => (prev === 0 ? 1 : 0));
          return;
        }
        if (key.return) {
          const openNow = wizardOpenChoice === 0;
          const docPath = wizardCreated.docPath;
          setWizardOpen(false);
          setWizardCreated(null);
          if (openNow) {
            await handleView(docPath);
          }
          return;
        }
        return;
      }
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

    if (viewerSession) {
      if (input?.toLowerCase() === "p") {
        await toggleViewer();
        return;
      }
      if (input?.toLowerCase() === "i") {
        setPrompt({
          label: "Set interval (ms)",
          onSubmit: async (value) => {
            const next = Number(value);
            if (!Number.isFinite(next)) {
              showToast("Invalid interval");
              return;
            }
            await updateViewerTicker(viewerSession.url, { docstepMs: next });
            setViewerStatus((prev) => prev ? { ...prev, docstepMs: next } : prev);
            showToast("Interval updated");
          },
        });
        return;
      }
      if (input?.toLowerCase() === "s") {
        setPrompt({
          label: "Set seed",
          onSubmit: async (value) => {
            const next = Number(value);
            if (!Number.isFinite(next)) {
              showToast("Invalid seed");
              return;
            }
            await updateViewerRuntime(viewerSession.url, { seed: next });
            setViewerStatus((prev) => prev ? { ...prev, seed: next } : prev);
            showToast("Seed updated");
          },
        });
        return;
      }
      if (input?.toLowerCase() === "j") {
        setPrompt({
          label: "Jump docstep",
          onSubmit: async (value) => {
            const next = Number(value);
            if (!Number.isFinite(next)) {
              showToast("Invalid docstep");
              return;
            }
            await updateViewerRuntime(viewerSession.url, { docstep: next });
            setViewerStatus((prev) => prev ? { ...prev, docstep: next } : prev);
            showToast("Docstep updated");
          },
        });
        return;
      }
      if (input?.toLowerCase() === "e") {
        await handleExport();
        return;
      }
    }

    const selectedItem = navItems[selectedIndex];
    const inSettings = selectedItem?.type === "action" && selectedItem.id === "settings";

    if (inSettings) {
      if (input?.toLowerCase() === "i") {
        await initConfig();
        return;
      }
      if (input?.toLowerCase() === "d") {
        setPrompt({
          label: "Set docstepMs",
          onSubmit: async (value) => {
            const next = Number(value);
            if (!Number.isFinite(next)) {
              showToast("Invalid number");
              return;
            }
            await configCommand({
              cwd: props.cwd,
              action: "set",
              key: "docstepMs",
              value: next,
              init: true,
              env: process.env,
            });
            await refreshConfig();
            showToast("Config updated");
          },
        });
        return;
      }
    }

    if (activeDoc) {
      if (input?.toLowerCase() === "o") {
        revealInFinder(activeDoc);
        showToast("Opened in file explorer");
        return;
      }
      if (input?.toLowerCase() === "y") {
        const ok = await copyToClipboard(activeDoc);
        showToast(ok ? "Copied path" : "Copy failed");
        return;
      }
      if (input?.toLowerCase() === "l") {
        setShowLogs((prev) => !prev);
        return;
      }
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, navItems.length - 1));
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.return) {
      const item = navItems[selectedIndex];
      if (item) await activateNavItem(item);
      return;
    }

  });

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    items.push({ id: "open", label: "Open document...", kind: "action", payload: { action: "open" } });
    items.push({ id: "new", label: "New document wizard", kind: "action", payload: { action: "new" } });
    items.push({ id: "view", label: "View current document", kind: "action", payload: { action: "view" } });
    items.push({ id: "export", label: "Export PDF", kind: "action", payload: { action: "export" } });
    items.push({ id: "check", label: "Run check", kind: "action", payload: { action: "check" } });
    items.push({ id: "format", label: "Format document", kind: "action", payload: { action: "format" } });
    items.push({ id: "add-section", label: "Add section", kind: "action", payload: { action: "add", kind: "section" } });
    items.push({ id: "add-figure", label: "Add figure", kind: "action", payload: { action: "add", kind: "figure" } });
    items.push({ id: "settings", label: "Open settings", kind: "action", payload: { action: "settings" } });
    items.push({ id: "new-demo", label: "New: demo", kind: "template", payload: { template: "demo" } });
    items.push({ id: "new-article", label: "New: article", kind: "template", payload: { template: "article" } });
    items.push({ id: "new-spec", label: "New: spec", kind: "template", payload: { template: "spec" } });
    items.push({ id: "new-zine", label: "New: zine", kind: "template", payload: { template: "zine" } });
    items.push({ id: "new-paper", label: "New: paper", kind: "template", payload: { template: "paper" } });
    for (const item of recents) {
      if (item.type === "doc") {
        items.push({ id: item.path, label: `Open ${path.basename(item.path)}`, kind: "doc", payload: { path: item.path } });
      }
    }
    for (const file of fluxFiles) {
      items.push({ id: file, label: `File: ${path.basename(file)}`, kind: "doc", payload: { path: file } });
    }
    return items;
  }, [recents, fluxFiles]);

  const filteredPalette = useMemo(() => {
    const query = paletteQuery.trim().toLowerCase();
    if (!query) return paletteItems;
    return paletteItems
      .map((item) => {
        const score = fuzzyScore(query, item.label.toLowerCase());
        return score === null ? null : { item, score };
      })
      .filter((item): item is { item: PaletteItem; score: number } => item !== null)
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.item);
  }, [paletteItems, paletteQuery]);

  useEffect(() => {
    setPaletteIndex((prev) => Math.max(0, Math.min(prev, filteredPalette.length - 1)));
  }, [filteredPalette.length]);

  async function refreshRecents() {
    const store = await getRecentsStore(props.cwd);
    const list: NavItem[] = store.entries.map((entry) => ({
      type: "doc",
      label: path.basename(entry.path),
      path: entry.path,
      lastOpened: entry.lastOpened,
    }));
    setRecents(list);
    if (!activeDoc && list.length && list[0].type === "doc") {
      setActiveDoc(list[0].path);
    }
  }

  async function refreshConfig() {
    const resolved = await resolveConfig({ cwd: props.cwd, env: process.env });
    setConfig(resolved.config);
  }

  async function loadFluxFiles() {
    const files: string[] = [];
    await walk(props.cwd, files, 3);
    setFluxFiles(files.slice(0, 20));
  }

  async function activateNavItem(item: NavItem) {
    if (item.type === "doc") {
      setActiveDoc(item.path);
      return;
    }
    if (item.type === "action") {
      switch (item.id) {
        case "open":
          setPrompt({
            label: "Open .flux path",
            onSubmit: async (value) => {
              if (!value) return;
              setActiveDoc(value);
              await updateRecents(props.cwd, value);
              showToast("Document selected");
            },
          });
          return;
        case "new":
          openWizard();
          return;
        case "view":
          await handleView();
          return;
        case "export":
          await handleExport();
          return;
        case "check":
          await handleCheck();
          return;
        case "format":
          await handleFormat();
          return;
        case "add":
          setPaletteOpen(true);
          return;
        case "settings":
          return;
        default:
          return;
      }
    }
  }

  async function handleView(docPath?: string, overrides?: {
    docstepMs?: number;
    seed?: number;
    allowNet?: string[];
    port?: number;
    advanceTime?: boolean;
  }) {
    const target = docPath ?? activeDoc;
    if (!target) {
      showToast("Select a document first.");
      return;
    }
    setActiveDoc(target);
    setBusy("Starting viewer...");
    const result = await viewCommand({
      cwd: props.cwd,
      docPath: target,
      docstepMs: overrides?.docstepMs ?? config?.docstepMs ?? 1000,
      seed: overrides?.seed ?? 0,
      allowNet: overrides?.allowNet ?? [],
      port: overrides?.port,
      advanceTime: overrides?.advanceTime ?? (config?.advanceTime ?? true),
    });
    setBusy(null);
    if (!result.ok || !result.data) {
      showToast(result.error?.message ?? "Viewer failed");
      return;
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
    await updateRecents(props.cwd, target);
    openBrowser(result.data.session.url);
    showToast(result.data.session.attached ? "Attached to viewer" : "Viewer running");
  }

  async function handleExport() {
    if (!activeDoc) {
      showToast("Select a document first.");
      return;
    }
    const defaultOut = activeDoc.replace(/\.flux$/i, ".pdf");
    setBusy("Exporting PDF...");
    try {
      const result = viewerSession
        ? await requestViewerPdf(viewerSession.url)
        : null;
      if (result) {
        await fs.writeFile(defaultOut, result);
      } else {
        await pdfCommand({ file: activeDoc, outPath: defaultOut });
      }
      showToast(`Exported ${path.basename(defaultOut)}`);
    } catch (error) {
      showToast(`Export failed: ${(error as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleCheck(docPath?: string) {
    const target = docPath ?? activeDoc;
    if (!target) {
      showToast("Select a document first.");
      return;
    }
    setBusy("Checking...");
    const result = await checkCommand({ files: [target] });
    setBusy(null);
    if (!result.ok || !result.data) {
      showToast("Check failed");
      return;
    }
    const failures = result.data.results.filter((r) => !r.ok);
    if (failures.length) {
      showToast(`Check failed (${failures.length})`);
      setLogs(failures.flatMap((r) => r.errors ?? []));
    } else {
      showToast("All checks passed");
    }
  }

  async function handleFormat(docPath?: string) {
    const target = docPath ?? activeDoc;
    if (!target) {
      showToast("Select a document first.");
      return;
    }
    setBusy("Formatting...");
    const result = await formatCommand({ file: target });
    setBusy(null);
    if (!result.ok) {
      showToast(result.error?.message ?? "Format failed");
      return;
    }
    showToast("Formatted document");
  }

  async function handlePaletteSelect(item: PaletteItem) {
    if (item.kind === "template") {
      await runTemplate(item.payload.template);
      return;
    }
    if (item.kind === "doc") {
      setActiveDoc(item.payload.path);
      return;
    }
    if (item.kind === "action") {
      if (item.payload.action === "open") {
        setPrompt({
          label: "Open .flux path",
          onSubmit: async (value) => {
            if (!value) return;
            setActiveDoc(value);
            await updateRecents(props.cwd, value);
            showToast("Document selected");
          },
        });
        return;
      }
      if (item.payload.action === "new") {
        openWizard();
        return;
      }
      if (item.payload.action === "view") await handleView();
      if (item.payload.action === "export") await handleExport();
      if (item.payload.action === "check") await handleCheck();
      if (item.payload.action === "format") await handleFormat();
      if (item.payload.action === "add") {
        await runAdd(item.payload.kind);
      }
      if (item.payload.action === "settings") {
        const idx = navItems.findIndex((entry) => entry.type === "action" && entry.id === "settings");
        if (idx >= 0) setSelectedIndex(idx);
      }
    }
  }

  async function runAdd(
    kind: string,
    docPath?: string,
    options?: { text?: string; heading?: string; label?: string; noHeading?: boolean; noCheck?: boolean },
  ) {
    const target = docPath ?? activeDoc;
    if (!target) {
      showToast("Select a document first.");
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
      showToast(result.error?.message ?? "Add failed");
      return;
    }
    showToast(`Added ${kind}`);
  }

  async function runTemplate(template: string) {
    setBusy(`Creating ${template}...`);
    const result = await newCommand({
      cwd: props.cwd,
      template: template as any,
      out: resolveWizardOutDir(),
      page: config?.defaultPageSize ?? "Letter",
      theme: config?.defaultTheme ?? "screen",
      fonts: config?.defaultFonts ?? "tech",
      fontFallback: "system",
      assets: true,
      chapters: 0,
      live: template === "demo",
    });
    setBusy(null);
    if (!result.ok || !result.data) {
      showToast(result.error?.message ?? "New failed");
      return;
    }
    setActiveDoc(result.data.docPath);
    await updateRecents(props.cwd, result.data.docPath);
    showToast("Document created");
  }

  function buildWizardDefaults(cfg: any): WizardValues {
    const template: TemplateName = "demo";
    return {
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
    if (config?.defaultOutputDir && config.defaultOutputDir !== ".") {
      return config.defaultOutputDir;
    }
    return undefined;
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
    const nextOut = outDir
      ?? (cfg?.defaultOutputDir && cfg.defaultOutputDir !== "." ? cfg.defaultOutputDir : undefined);
    setWizardOutDir(nextOut);
  }

  const wizardSteps = useMemo<WizardStep[]>(() => {
    const steps: WizardStep[] = [
      {
        kind: "select",
        key: "template",
        label: "Template",
        options: TEMPLATE_OPTIONS,
      },
      {
        kind: "select",
        key: "page",
        label: "Page size",
        options: PAGE_OPTIONS,
      },
      {
        kind: "select",
        key: "theme",
        label: "Theme",
        options: THEME_OPTIONS,
      },
      {
        kind: "select",
        key: "fonts",
        label: "Fonts preset",
        options: FONT_OPTIONS,
      },
      {
        kind: "select",
        key: "fontFallback",
        label: "Font fallback",
        options: FALLBACK_OPTIONS,
      },
      {
        kind: "select",
        key: "assets",
        label: "Assets folder",
        options: YES_NO_OPTIONS,
      },
      {
        kind: "select",
        key: "chaptersEnabled",
        label: "Chapters scaffold",
        options: YES_NO_OPTIONS,
      },
    ];
    if (wizardValues.chaptersEnabled) {
      steps.push({
        kind: "select",
        key: "chapters",
        label: "Chapters count",
        options: CHAPTER_OPTIONS,
      });
    }
    steps.push({
      kind: "select",
      key: "live",
      label: "Live slots",
      options: YES_NO_OPTIONS,
    });
    steps.push({ kind: "summary", label: "Summary" });
    return steps;
  }, [wizardValues.chaptersEnabled]);

  useEffect(() => {
    setWizardStep((prev) => Math.max(0, Math.min(prev, wizardSteps.length - 1)));
  }, [wizardSteps.length]);

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
    setBusy("Creating document...");
    const result = await newCommand({
      cwd: props.cwd,
      template: values.template,
      out: resolveWizardOutDir(outDirOverride),
      page: values.page,
      theme: values.theme,
      fonts: values.fonts,
      fontFallback: values.fontFallback,
      assets: values.assets,
      chapters: values.chaptersEnabled ? values.chapters : 0,
      live: values.live,
    });
    setBusy(null);
    if (!result.ok || !result.data) {
      showToast(result.error?.message ?? "New failed");
      return;
    }
    setActiveDoc(result.data.docPath);
    await updateRecents(props.cwd, result.data.docPath);
    setWizardCreated(result.data);
    setWizardOpenChoice(0);
    showToast("Document created");
  }

  function openWizard(reset = true) {
    setWizardOpen(true);
    if (reset) {
      setWizardStep(0);
      setWizardCreated(null);
      setWizardOpenChoice(0);
      setWizardLiveTouched(false);
    }
  }

  function selectNavAction(id: string) {
    const idx = navItems.findIndex((entry) => entry.type === "action" && entry.id === id);
    if (idx >= 0) setSelectedIndex(idx);
  }

  async function handleInitialRoute(initialArgs: string[]) {
    const [command, ...rest] = initialArgs;
    if (!command) return;
    switch (command) {
      case "new": {
        const parsed = parseNewArgsForUi(rest);
        if (parsed.unknownTemplate) {
          showToast(`Unknown template '${parsed.unknownTemplate}'.`);
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
        applyWizardValues(next, config, parsed.out);
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
          await submitWizard(next, parsed.out);
        }
        return;
      }
      case "view": {
        const parsed = parseViewArgsForUi(rest);
        selectNavAction("view");
        const target = parsed.file ?? activeDoc ?? null;
        if (!target) {
          showToast("flux view: missing <file>");
          return;
        }
        await handleView(target, {
          docstepMs: parsed.docstepMs,
          seed: parsed.seed,
          allowNet: parsed.allowNet,
          port: parsed.port,
          advanceTime: parsed.advanceTime,
        });
        return;
      }
      case "check": {
        selectNavAction("check");
        const target = firstFileArg(rest) ?? activeDoc ?? null;
        if (!target) {
          showToast("flux check: missing <file>");
          return;
        }
        setActiveDoc(target);
        await handleCheck(target);
        return;
      }
      case "fmt": {
        selectNavAction("format");
        const target = firstFileArg(rest) ?? activeDoc ?? null;
        if (!target) {
          showToast("flux fmt: missing <file>");
          return;
        }
        setActiveDoc(target);
        await handleFormat(target);
        return;
      }
      case "add": {
        selectNavAction("add");
        const parsed = parseAddArgsForUi(rest);
        if (parsed.file) setActiveDoc(parsed.file);
        if (parsed.kind) {
          await runAdd(parsed.kind, parsed.file, parsed);
        } else {
          setPaletteOpen(true);
        }
        return;
      }
      case "pdf": {
        selectNavAction("export");
        const parsed = parsePdfArgsForUi(rest);
        if (!parsed.file || !parsed.outPath) {
          showToast("flux pdf: missing <file> or --out");
          return;
        }
        setBusy("Exporting PDF...");
        const result = await pdfCommand({ file: parsed.file, outPath: parsed.outPath, seed: parsed.seed, docstep: parsed.docstep });
        setBusy(null);
        if (!result.ok) {
          showToast(result.error?.message ?? "Export failed");
          return;
        }
        showToast(`Wrote ${parsed.outPath}`);
        await updateRecents(props.cwd, parsed.file);
        return;
      }
      case "config": {
        selectNavAction("settings");
        return;
      }
      case "parse":
      case "render":
      case "tick":
      case "step": {
        showToast("Use --no-ui for JSON output.");
        return;
      }
      default:
        return;
    }
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  async function toggleViewer() {
    if (!viewerSession) return;
    const running = !(viewerStatus?.running ?? true);
    await updateViewerTicker(viewerSession.url, { running });
    setViewerStatus((prev) => prev ? { ...prev, running } : prev);
    showToast(running ? "Viewer running" : "Viewer paused");
  }

  async function initConfig() {
    const current = config ?? { docstepMs: 1000 };
    await configCommand({
      cwd: props.cwd,
      action: "set",
      key: "docstepMs",
      value: current.docstepMs ?? 1000,
      init: true,
      env: process.env,
    });
    await refreshConfig();
    showToast("Config initialized");
  }

  const rightPane = renderRightPane();

  function renderRightPane() {
    if (versionOpen) {
      return renderVersionPane();
    }
    if (helpOpen) {
      return renderHelpPane();
    }
    if (wizardOpen) {
      return renderWizardPane();
    }

    const item = navItems[selectedIndex];
    if (item?.type === "action" && item.id === "open") {
      return (
        <Box flexDirection="column" gap={1}>
          <Text color={ACCENT}>Open document</Text>
          <Text>Use Enter to paste a path, or open the palette (/).</Text>
        </Box>
      );
    }

    if (item?.type === "action" && item.id === "settings") {
      return renderSettings();
    }

    if (viewerSession) {
      return renderViewerPanel();
    }

    if (activeDoc) {
      return renderDocPanel();
    }

    return (
      <Box flexDirection="column">
        <Text color={ACCENT}>Select a document</Text>
      </Box>
    );
  }

  function renderWizardPane() {
    if (wizardCreated) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text color={ACCENT}>Document created</Text>
          <Text>{wizardCreated.docPath}</Text>
          <Text dimColor>Next steps</Text>
          <Text dimColor>flux view {wizardCreated.docPath}</Text>
          <Text dimColor>flux check {wizardCreated.docPath}</Text>
          <Text dimColor>flux pdf {wizardCreated.docPath} --out {wizardCreated.docPath.replace(/\.flux$/i, ".pdf")}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text>Open viewer now?</Text>
            <Text color={wizardOpenChoice === 0 ? ACCENT_ALT : undefined}>
              {wizardOpenChoice === 0 ? ">" : " "} Yes
            </Text>
            <Text color={wizardOpenChoice === 1 ? ACCENT_ALT : undefined}>
              {wizardOpenChoice === 1 ? ">" : " "} No
            </Text>
          </Box>
          <Text dimColor>Enter to confirm - Esc to close</Text>
        </Box>
      );
    }

    const step = wizardSteps[wizardStep];
    if (!step) {
      return (
        <Box flexDirection="column">
          <Text color={ACCENT}>Wizard loading...</Text>
        </Box>
      );
    }

    if (step.kind === "summary") {
      return renderWizardSummary();
    }

    const index = wizardIndexes[step.key] ?? 0;
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={ACCENT}>New document wizard</Text>
        <Text>{step.label} ({wizardStep + 1}/{wizardSteps.length})</Text>
        {step.options.map((opt, idx) => (
          <Text key={`${step.key}-${opt.label}`} color={idx === index ? ACCENT_ALT : undefined}>
            {idx === index ? ">" : " "} {opt.label}{opt.hint ? ` - ${opt.hint}` : ""}
          </Text>
        ))}
        <Text dimColor>Enter to continue - Backspace to go back - Esc to cancel</Text>
      </Box>
    );
  }

  function renderWizardSummary() {
    const outDir = resolveWizardOutDir();
    const title = templateTitle(wizardValues.template);
    const slug = slugify(title);
    const outIsFile = Boolean(outDir && outDir.endsWith(".flux"));
    const outputDir = outIsFile && outDir ? path.dirname(outDir) : (outDir ?? props.cwd);
    const fileName = outIsFile && outDir ? path.basename(outDir) : `${slug}.flux`;
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={ACCENT}>Summary</Text>
        <Text>Template: {wizardValues.template}</Text>
        <Text>Page size: {wizardValues.page}</Text>
        <Text>Theme: {wizardValues.theme}</Text>
        <Text>Fonts: {wizardValues.fonts}</Text>
        <Text>Font fallback: {wizardValues.fontFallback === "system" ? "system stack" : "primary only"}</Text>
        <Text>Assets folder: {wizardValues.assets ? "yes" : "no"}</Text>
        <Text>Chapters: {wizardValues.chaptersEnabled ? wizardValues.chapters : "no"}</Text>
        <Text>Live slots: {wizardValues.live ? "yes" : "no"}</Text>
        <Text>Output dir: {outputDir}</Text>
        <Text>File: {fileName}</Text>
        <Text dimColor>Enter to create - Backspace to go back - Esc to cancel</Text>
      </Box>
    );
  }

  function renderHelpPane() {
    const lines = getHelpLines(props.helpCommand);
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={ACCENT}>Flux help</Text>
        {lines.map((line, idx) => (
          <Text key={`help-${idx}`} dimColor={!line.trim()}>
            {line}
          </Text>
        ))}
        <Text dimColor>Press Esc to close</Text>
      </Box>
    );
  }

  function renderVersionPane() {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={ACCENT}>Flux CLI</Text>
        <Text>{props.version ?? "version unknown"}</Text>
        <Text dimColor>Press Esc to close</Text>
      </Box>
    );
  }

  function renderDocPanel() {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={ACCENT}>Document</Text>
        <Text>{activeDoc}</Text>
        <Text dimColor>Actions: View, Export PDF, Check, Add...</Text>
        <Text dimColor>Press O to reveal - Y to copy path</Text>
      </Box>
    );
  }

  function renderViewerPanel() {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={ACCENT}>Viewer</Text>
        <Text>Path: {activeDoc ?? viewerSession?.docPath ?? "unknown"}</Text>
        <Text>URL: {viewerSession?.url}</Text>
        <Text>
          Docstep: {viewerStatus?.docstep ?? 0} - Time: {viewerStatus?.time?.toFixed?.(2) ?? "0.00"}
        </Text>
        <Text>Interval: {viewerStatus?.docstepMs ?? config?.docstepMs ?? 1000}ms</Text>
        <Text>Seed: {viewerStatus?.seed ?? 0}</Text>
        <Text>Running: {viewerStatus?.running ? "yes" : "no"}</Text>
        <Text>Backend: typesetter</Text>
        <Text>Stream: {streamOk ? "connected" : "waiting"}</Text>
        <Text dimColor>Controls: P pause/resume - I interval - S seed - J docstep - E export</Text>
      </Box>
    );
  }

  function renderSettings() {
    if (!config) {
      return (
        <Box flexDirection="column">
          <Text>Loading config...</Text>
        </Box>
      );
    }
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={ACCENT}>Settings</Text>
        <Text>docstepMs: {config.docstepMs}</Text>
        <Text>advanceTime: {config.advanceTime ? "yes" : "no"}</Text>
        <Text>defaultPage: {config.defaultPageSize}</Text>
        <Text>defaultTheme: {config.defaultTheme}</Text>
        <Text>defaultFonts: {config.defaultFonts}</Text>
        <Text dimColor>Press I to initialize config - D to set docstepMs</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box flexDirection="row" gap={1}>
        <Box
          ref={listRef}
          flexDirection="column"
          borderStyle="round"
          borderColor={ACCENT}
          width={Math.min(30, Math.floor(cols * 0.3))}
          padding={1}
        >
          <Text color={ACCENT_ALT}>Flux 2026</Text>
          {navItems.map((item, idx) => {
            if (item.type === "section") {
              return (
                <Text key={`${item.label}-${idx}`} dimColor>
                  {item.label}
                </Text>
              );
            }
            const selected = idx === selectedIndex;
            const label = item.label;
            return (
              <Text key={`${item.label}-${idx}`} color={selected ? ACCENT_ALT : undefined}>
                {selected ? ">" : " "} {label}
              </Text>
            );
          })}
          <Text dimColor>/: palette - Ctrl+C: exit</Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor={ACCENT_ALT} flexGrow={1} padding={1}>
          {busy && (
            <Text color={ACCENT_ALT}>[busy] {busy}</Text>
          )}
          {rightPane}
          {showLogs && logs.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="red">Diagnostics</Text>
              {logs.slice(0, 6).map((line, idx) => (
                <Text key={`${line}-${idx}`} dimColor>
                  {line}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {toast && (
        <Box marginTop={1}>
          <Text color={ACCENT_ALT}>{toast}</Text>
        </Box>
      )}

      {paletteOpen && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={ACCENT_ALT}
          padding={1}
          marginTop={1}
        >
          <Text color={ACCENT}>Command palette</Text>
          <Text>Search: {paletteQuery || ""}</Text>
          {filteredPalette.slice(0, 8).map((item, idx) => (
            <Text key={item.id} color={idx === paletteIndex ? ACCENT_ALT : undefined}>
              {idx === paletteIndex ? ">" : " "} {item.label}
            </Text>
          ))}
        </Box>
      )}

      {prompt && (
        <Box marginTop={1}>
          <Text color={ACCENT}>{prompt.label}: {promptValue}</Text>
        </Box>
      )}
    </Box>
  );
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

async function walk(dir: string, out: string[], depth: number): Promise<void> {
  if (depth < 0) return;
  type WalkEntry = {
    name: string;
    isDirectory: () => boolean;
    isFile: () => boolean;
  };
  let entries: WalkEntry[];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true, encoding: "utf8" })) as WalkEntry[];
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await walk(full, out, depth - 1);
    } else if (entry.isFile() && full.endsWith(".flux")) {
      out.push(full);
    }
  }
}

function isMouseSequence(input: string): boolean {
  return input.includes("\u001b[<");
}

type MouseEvent = { button: number; x: number; y: number; pressed: boolean };

function parseMouseSequences(input: string): MouseEvent[] {
  const events: MouseEvent[] = [];
  const regex = /\u001b\[<(\d+);(\d+);(\d+)([mM])/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const buttonCode = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    const pressed = match[4] === "M";
    const isScroll = buttonCode >= 64;
    const isMove = (buttonCode & 32) === 32;
    if (isScroll || isMove) continue;
    const button = buttonCode & 3;
    events.push({ button, x, y, pressed });
  }
  return events;
}

function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  let score = 0;
  let lastIndex = -1;
  for (const ch of query) {
    const idx = target.indexOf(ch, lastIndex + 1);
    if (idx === -1) return null;
    score += idx - lastIndex - 1;
    lastIndex = idx;
  }
  return score + (target.length - query.length);
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
  return { file, port, docstepMs, seed, allowNet, advanceTime };
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
  return raw === "demo" || raw === "article" || raw === "spec" || raw === "zine" || raw === "paper";
}

function templateTitle(template: TemplateName): string {
  const map: Record<TemplateName, string> = {
    demo: "Flux Demo",
    article: "Flux Article",
    spec: "Flux Spec",
    zine: "Flux Zine",
    paper: "Flux Paper",
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
      "  demo, article, spec, zine, paper",
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

  return [
    "Flux CLI",
    "",
    "Usage:",
    "  flux                (launch UI in TTY)",
    "  flux parse [options] <files...>",
    "  flux check [options] <files...>",
    "  flux render [options] <file>",
    "  flux fmt <file>",
    "  flux tick [options] <file>",
    "  flux step [options] <file>",
    "  flux view <file>",
    "  flux pdf <file> --out <file.pdf>",
    "  flux config [set <key> <value>]",
    "  flux new <template> [options]",
    "  flux add <kind> [options]",
    "",
    "Commands:",
    "  parse   Parse Flux source files and print their IR as JSON.",
    "  check   Parse and run basic static checks.",
    "  render  Render a Flux document to canonical Render IR JSON.",
    "  fmt     Format a Flux document in-place.",
    "  tick    Advance time and render the updated document.",
    "  step    Advance docsteps and render the updated document.",
    "  view    View a Flux document in a local web preview.",
    "  pdf     Export a Flux document snapshot to PDF.",
    "  config  View or edit configuration.",
    "  new     Create a new Flux document.",
    "  add     Apply structured edits to a Flux document.",
    "",
    "Global options:",
    "  -h, --help      Show this help message.",
    "  -v, --version   Show CLI version.",
    "  --no-ui         Disable Ink UI launch.",
    "  --ui            Force Ink UI launch (TTY only).",
    "  --detach        Keep viewer running on UI exit.",
    "  --json          Emit machine-readable JSON where applicable.",
    "  -q, --quiet     Reduce non-essential output.",
    "  -V, --verbose   Show verbose logs.",
    "",
  ];
}
