import React, { useEffect, useMemo, useRef, useState } from "react";
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

const ACCENT = "cyan";
const ACCENT_ALT = "green";

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
  const [wizardOpen, setWizardOpen] = useState(props.mode === "new");
  const [wizardStep, setWizardStep] = useState(0);
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

  useEffect(() => {
    void refreshRecents();
    void refreshConfig();
    void loadFluxFiles();
  }, [props.cwd]);

  useEffect(() => {
    const stdout = process.stdout;
    if (!stdout?.on) return;
    const handleResize = () => setCols(stdout.columns ?? 80);
    stdout.on("resize", handleResize);
    return () => stdout.off("resize", handleResize);
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

    const mouse = (key as any).mouse as { y: number; button?: number } | undefined;
    if (mouse && listBounds) {
      const y = mouse.y;
      if (y >= listBounds.y && y < listBounds.y + navItems.length) {
        const idx = y - listBounds.y;
        if (idx >= 0 && idx < navItems.length) {
          setSelectedIndex(idx);
          if (mouse.button === 0) {
            const item = navItems[idx];
            if (item) await activateNavItem(item);
          }
        }
      }
    }
  });

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [];
    items.push({ type: "section", label: "Recent" });
    items.push(...recents);
    items.push({ type: "action", id: "open", label: "Open..." });
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

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    items.push({ id: "view", label: "View current document", kind: "action", payload: { action: "view" } });
    items.push({ id: "export", label: "Export PDF", kind: "action", payload: { action: "export" } });
    items.push({ id: "check", label: "Run check", kind: "action", payload: { action: "check" } });
    items.push({ id: "add-section", label: "Add section", kind: "action", payload: { action: "add", kind: "section" } });
    items.push({ id: "add-figure", label: "Add figure", kind: "action", payload: { action: "add", kind: "figure" } });
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
    return paletteItems.filter((item) => item.label.toLowerCase().includes(query));
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
          setWizardOpen(true);
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

  async function handleView() {
    if (!activeDoc) {
      showToast("Select a document first.");
      return;
    }
    setBusy("Starting viewer...");
    const result = await viewCommand({
      cwd: props.cwd,
      docPath: activeDoc,
      docstepMs: config?.docstepMs ?? 1000,
      seed: 0,
      advanceTime: config?.advanceTime ?? true,
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
    await updateRecents(props.cwd, activeDoc);
    openBrowser(result.data.session.url);
    showToast("Viewer running");
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

  async function handleCheck() {
    if (!activeDoc) {
      showToast("Select a document first.");
      return;
    }
    setBusy("Checking...");
    const result = await checkCommand({ files: [activeDoc] });
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

  async function handleFormat() {
    if (!activeDoc) {
      showToast("Select a document first.");
      return;
    }
    setBusy("Formatting...");
    const result = await formatCommand({ file: activeDoc });
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
      if (item.payload.action === "view") await handleView();
      if (item.payload.action === "export") await handleExport();
      if (item.payload.action === "check") await handleCheck();
      if (item.payload.action === "add") {
        await runAdd(item.payload.kind);
      }
    }
  }

  async function runAdd(kind: string) {
    if (!activeDoc) {
      showToast("Select a document first.");
      return;
    }
    setBusy(`Adding ${kind}...`);
    const result = await addCommand({ cwd: props.cwd, file: activeDoc, kind: kind as any });
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
      out: config?.defaultOutputDir && config.defaultOutputDir !== "." ? config.defaultOutputDir : undefined,
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

  async function advanceWizard() {
    if (wizardStep < wizardSteps.length - 1) {
      setWizardStep((prev) => prev + 1);
      return;
    }
    const configValues = wizardSteps.reduce((acc, step) => {
      acc[step.key] = step.options[step.index].value;
      return acc;
    }, {} as any);
    setWizardOpen(false);
    setWizardStep(0);
    setBusy("Creating document...");
    const result = await newCommand({
      cwd: props.cwd,
      template: "demo",
      out: config?.defaultOutputDir && config.defaultOutputDir !== "." ? config.defaultOutputDir : undefined,
      page: configValues.page,
      theme: configValues.theme,
      fonts: configValues.fonts,
      assets: configValues.assets,
      chapters: configValues.chapters,
      live: configValues.live,
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

  function updateWizardChoice(direction: number) {
    setWizardSteps((prev) => {
      const next = [...prev];
      const step = { ...next[wizardStep] };
      const max = step.options.length - 1;
      step.index = Math.max(0, Math.min(max, step.index + direction));
      next[wizardStep] = step;
      return next;
    });
  }

  const [wizardSteps, setWizardSteps] = useState(() => [
    {
      key: "page",
      label: "Page size",
      index: 0,
      options: [
        { label: "Letter", value: "Letter" },
        { label: "A4", value: "A4" },
      ],
    },
    {
      key: "theme",
      label: "Theme",
      index: 0,
      options: [
        { label: "Screen", value: "screen" },
        { label: "Print", value: "print" },
        { label: "Both", value: "both" },
      ],
    },
    {
      key: "fonts",
      label: "Fonts",
      index: 0,
      options: [
        { label: "Tech", value: "tech" },
        { label: "Bookish", value: "bookish" },
      ],
    },
    {
      key: "assets",
      label: "Assets folder",
      index: 0,
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    {
      key: "chapters",
      label: "Chapters",
      index: 0,
      options: [
        { label: "0", value: 0 },
        { label: "2", value: 2 },
        { label: "4", value: 4 },
      ],
    },
    {
      key: "live",
      label: "Live slots",
      index: 0,
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
  ]);

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
    if (wizardOpen) {
      const step = wizardSteps[wizardStep];
      return (
        <Box flexDirection="column" gap={1}>
          <Text color={ACCENT}>New document wizard</Text>
          <Text>{step.label}</Text>
          {step.options.map((opt, idx) => (
            <Text key={opt.label} color={idx === step.index ? ACCENT_ALT : undefined}>
              {idx === step.index ? ">" : " "} {opt.label}
            </Text>
          ))}
          <Text dimColor>Enter to continue - Esc to cancel</Text>
        </Box>
      );
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
        <Text>Doc: {activeDoc ?? viewerSession?.docPath ?? "unknown"}</Text>
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
