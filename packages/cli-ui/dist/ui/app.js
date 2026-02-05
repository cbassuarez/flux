import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import path from "node:path";
import fs from "node:fs/promises";
import { getRecentsStore, updateRecents, resolveConfig, configCommand, viewCommand, pdfCommand, checkCommand, formatCommand, addCommand, newCommand, updateViewerTicker, updateViewerRuntime, fetchViewerPatch, fetchViewerStatus, requestViewerPdf, } from "@flux-lang/cli-core";
import { AppFrame } from "../components/AppFrame.js";
import { NavList } from "../components/NavList.js";
import { CommandPaletteModal } from "../components/CommandPaletteModal.js";
import { ToastHost } from "../components/ToastHost.js";
import { PromptModal } from "../components/PromptModal.js";
import { Card } from "../components/Card.js";
import { HelpOverlay } from "../components/HelpOverlay.js";
import { DashboardScreen } from "../screens/DashboardScreen.js";
import { NewWizardScreen } from "../screens/NewWizardScreen.js";
import { ViewerControlScreen } from "../screens/ViewerControlScreen.js";
import { SettingsScreen } from "../screens/SettingsScreen.js";
import { AddWizardScreen } from "../screens/AddWizardScreen.js";
import { MouseProvider } from "../state/mouse.js";
import { useToasts } from "../state/toasts.js";
import { useProgress } from "../state/progress.js";
import { buildPaletteItems, filterPaletteItems, groupPaletteItems } from "../palette/index.js";
import { accent, color } from "../theme/index.js";
const TEMPLATE_OPTIONS = [
    { label: "Demo", value: "demo", hint: "Live slots + assets + annotations" },
    { label: "Article", value: "article", hint: "Narrative article starter" },
    { label: "Spec", value: "spec", hint: "Technical spec layout" },
    { label: "Zine", value: "zine", hint: "Visual zine layout" },
    { label: "Paper", value: "paper", hint: "Academic paper with abstract" },
];
const PAGE_OPTIONS = [
    { label: "Letter", value: "Letter" },
    { label: "A4", value: "A4" },
];
const THEME_OPTIONS = [
    { label: "Screen", value: "screen" },
    { label: "Print", value: "print" },
    { label: "Both", value: "both" },
];
const FONT_OPTIONS = [
    { label: "Tech", value: "tech", hint: "Inter + IBM Plex Sans + JetBrains Mono" },
    { label: "Bookish", value: "bookish", hint: "Iowan Old Style + serif body" },
];
const FALLBACK_OPTIONS = [
    { label: "System fallback", value: "system", hint: "Full stack with safe fallbacks" },
    { label: "Primary only", value: "none", hint: "Use primary fonts only" },
];
const YES_NO_OPTIONS = [
    { label: "Yes", value: true },
    { label: "No", value: false },
];
const CHAPTER_OPTIONS = [
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
];
const BACKEND_LABEL = "typesetter";
export function App(props) {
    const { exit } = useApp();
    const [recents, setRecents] = useState([]);
    const [recentsPath, setRecentsPath] = useState(undefined);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeDoc, setActiveDoc] = useState(null);
    const [logs, setLogs] = useState([]);
    const [logsOpen, setLogsOpen] = useState(false);
    const { toasts, push: pushToast } = useToasts();
    const { progress, start: startProgress, stop: stopProgress } = useProgress();
    const [busy, setBusy] = useState(null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteQuery, setPaletteQuery] = useState("");
    const [paletteIndex, setPaletteIndex] = useState(0);
    const [helpOpen, setHelpOpen] = useState(Boolean(props.helpCommand));
    const [versionOpen, setVersionOpen] = useState(Boolean(props.version));
    const [wizardOpen, setWizardOpen] = useState(props.mode === "new");
    const [wizardStep, setWizardStep] = useState(0);
    const [wizardValues, setWizardValues] = useState({
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
    const [wizardIndexes, setWizardIndexes] = useState({
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
    const [wizardCreated, setWizardCreated] = useState(null);
    const [wizardOpenChoice, setWizardOpenChoice] = useState(0);
    const [wizardLiveTouched, setWizardLiveTouched] = useState(false);
    const [wizardOutDir, setWizardOutDir] = useState(undefined);
    const [wizardDefaultsApplied, setWizardDefaultsApplied] = useState(false);
    const [initialRouteHandled, setInitialRouteHandled] = useState(false);
    const [viewerSession, setViewerSession] = useState(null);
    const [viewerStatus, setViewerStatus] = useState(null);
    const [streamOk, setStreamOk] = useState(false);
    const [prompt, setPrompt] = useState(null);
    const [promptValue, setPromptValue] = useState("");
    const [config, setConfig] = useState(null);
    const [fluxFiles, setFluxFiles] = useState([]);
    const [cols, setCols] = useState(() => process.stdout.columns ?? 80);
    const [rows, setRows] = useState(() => process.stdout.rows ?? 24);
    const [debugLayout, setDebugLayout] = useState(false);
    const navItems = useMemo(() => {
        const items = [];
        items.push({ type: "section", label: "Recents" });
        items.push(...recents);
        items.push({ type: "section", label: "Primary" });
        items.push({ type: "action", id: "new", label: "New" });
        items.push({ type: "action", id: "open", label: "Open" });
        items.push({ type: "action", id: "view", label: "View" });
        items.push({ type: "action", id: "export", label: "Export PDF" });
        items.push({ type: "section", label: "Secondary" });
        items.push({ type: "action", id: "check", label: "Check" });
        items.push({ type: "action", id: "format", label: "Format" });
        items.push({ type: "action", id: "add", label: "Add…" });
        items.push({ type: "action", id: "settings", label: "Settings" });
        return items;
    }, [recents]);
    const selectedItem = navItems[selectedIndex];
    const paletteItems = useMemo(() => buildPaletteItems({
        recents: recents.filter((item) => item.type === "doc"),
        fluxFiles,
        activeDoc,
    }), [recents, fluxFiles, activeDoc]);
    const filteredPalette = useMemo(() => filterPaletteItems(paletteItems, paletteQuery), [paletteItems, paletteQuery]);
    const limitedPalette = useMemo(() => filteredPalette.slice(0, 12), [filteredPalette]);
    const paletteGroups = useMemo(() => groupPaletteItems(limitedPalette), [limitedPalette]);
    const innerWidth = Math.max(20, cols - 4);
    const overlayWidth = Math.max(28, Math.min(72, innerWidth - 4));
    const navWidth = Math.min(32, Math.max(20, Math.floor(innerWidth * 0.34)));
    const detailWidth = Math.max(20, innerWidth - navWidth - 2);
    const navListHeight = Math.max(8, rows - 12);
    const mouseDisabled = paletteOpen || helpOpen || versionOpen || Boolean(prompt);
    const openPrompt = useCallback((label, onSubmit) => {
        setPromptValue("");
        setPrompt({ label, onSubmit });
    }, []);
    useEffect(() => {
        const stdout = process.stdout;
        if (!stdout?.on || !stdout?.off)
            return;
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
        void refreshConfig();
        void loadFluxFiles();
        setWizardDefaultsApplied(false);
    }, [props.cwd]);
    useEffect(() => {
        if (!config || wizardDefaultsApplied)
            return;
        const defaults = buildWizardDefaults(config);
        applyWizardValues(defaults, config);
        setWizardDefaultsApplied(true);
    }, [config, wizardDefaultsApplied]);
    useEffect(() => {
        if (initialRouteHandled)
            return;
        if (!config)
            return;
        if (helpOpen || versionOpen) {
            setInitialRouteHandled(true);
            return;
        }
        const initialArgs = props.initialArgs ?? [];
        if (initialArgs.length === 0) {
            if (props.mode === "new")
                openWizard();
            setInitialRouteHandled(true);
            return;
        }
        void handleInitialRoute(initialArgs).finally(() => setInitialRouteHandled(true));
    }, [config, helpOpen, versionOpen, initialRouteHandled, props.initialArgs, props.mode]);
    useEffect(() => {
        if (!viewerSession)
            return;
        let alive = true;
        const tick = async () => {
            try {
                const payload = await fetchViewerPatch(viewerSession.url);
                if (!alive)
                    return;
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
            }
            catch {
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
        if (selectedIndex >= navItems.length) {
            setSelectedIndex(Math.max(0, navItems.length - 1));
        }
        if (navItems[selectedIndex]?.type === "section") {
            moveSelection(1);
        }
    }, [navItems, selectedIndex]);
    useInput(async (input, key) => {
        if (key.ctrl && input === "c") {
            exit();
            return;
        }
        if (input && input.includes("\u001b[<")) {
            return;
        }
        if (input?.toLowerCase() === "q" && !paletteOpen && !helpOpen && !versionOpen && !prompt) {
            exit();
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
                openPrompt("Set interval (ms)", async (value) => {
                    const next = Number(value);
                    if (!Number.isFinite(next)) {
                        showToast("Invalid interval", "error");
                        return;
                    }
                    await updateViewerTicker(viewerSession.url, { docstepMs: next });
                    setViewerStatus((prev) => prev ? { ...prev, docstepMs: next } : prev);
                    showToast("Interval updated", "success");
                });
                return;
            }
            if (input?.toLowerCase() === "s") {
                openPrompt("Set seed", async (value) => {
                    const next = Number(value);
                    if (!Number.isFinite(next)) {
                        showToast("Invalid seed", "error");
                        return;
                    }
                    await updateViewerRuntime(viewerSession.url, { seed: next });
                    setViewerStatus((prev) => prev ? { ...prev, seed: next } : prev);
                    showToast("Seed updated", "success");
                });
                return;
            }
            if (input?.toLowerCase() === "j") {
                openPrompt("Jump docstep", async (value) => {
                    const next = Number(value);
                    if (!Number.isFinite(next)) {
                        showToast("Invalid docstep", "error");
                        return;
                    }
                    await updateViewerRuntime(viewerSession.url, { docstep: next });
                    setViewerStatus((prev) => prev ? { ...prev, docstep: next } : prev);
                    showToast("Docstep updated", "success");
                });
                return;
            }
            if (input?.toLowerCase() === "e") {
                await handleExport();
                return;
            }
        }
        if (selectedItem?.type === "action" && selectedItem.id === "settings") {
            if (input?.toLowerCase() === "i") {
                await initConfig();
                return;
            }
            if (input?.toLowerCase() === "t") {
                setDebugLayout((prev) => !prev);
                return;
            }
            if (input?.toLowerCase() === "d") {
                openPrompt("Set docstepMs", async (value) => {
                    const next = Number(value);
                    if (!Number.isFinite(next)) {
                        showToast("Invalid number", "error");
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
                    showToast("Config updated", "success");
                });
                return;
            }
        }
        if (activeDoc) {
            if (input?.toLowerCase() === "o") {
                revealInFinder(activeDoc);
                showToast("Opened in file explorer", "success");
                return;
            }
            if (input?.toLowerCase() === "y") {
                const ok = await copyToClipboard(activeDoc);
                showToast(ok ? "Copied path" : "Copy failed", ok ? "success" : "error");
                return;
            }
            if (input?.toLowerCase() === "l") {
                setLogsOpen((prev) => !prev);
                return;
            }
        }
        if (key.downArrow) {
            moveSelection(1);
            return;
        }
        if (key.upArrow) {
            moveSelection(-1);
            return;
        }
        if (key.return) {
            if (logs.length > 0 && selectedItem?.type === "doc") {
                setLogsOpen((prev) => !prev);
                return;
            }
            const item = navItems[selectedIndex];
            if (item)
                await activateNavItem(item);
        }
    });
    const wizardSteps = useMemo(() => {
        const steps = [
            { kind: "select", key: "template", label: "Template", options: TEMPLATE_OPTIONS },
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
    const actionItems = useMemo(() => {
        const selectedActionId = selectedItem?.type === "action" ? selectedItem.id : undefined;
        return [
            { id: "view", label: "View", icon: "◻︎", onClick: () => void handleView(), active: selectedActionId === "view" },
            { id: "export", label: "Export PDF", icon: "⇩", onClick: () => void handleExport(), active: selectedActionId === "export" },
            { id: "check", label: "Check", icon: "✓", onClick: () => void handleCheck(), active: selectedActionId === "check" },
            { id: "format", label: "Format", icon: "≡", onClick: () => void handleFormat(), active: selectedActionId === "format" },
        ];
    }, [selectedItem, activeDoc, config, viewerSession]);
    const rightPane = (() => {
        if (wizardOpen) {
            const step = wizardSteps[wizardStep] ?? null;
            return (_jsx(NewWizardScreen, { width: detailWidth, step: step, stepIndex: wizardStep, stepsCount: wizardSteps.length, values: wizardValues, selectedIndex: step?.kind === "select" ? wizardIndexes[step.key] ?? 0 : 0, created: wizardCreated, openChoice: wizardOpenChoice, outputDir: resolveWizardOutDir() ?? props.cwd, debug: debugLayout }));
        }
        if (selectedItem?.type === "action" && selectedItem.id === "settings") {
            return (_jsx(SettingsScreen, { width: detailWidth, config: config, debugLayout: debugLayout, onToggleDebug: () => setDebugLayout((prev) => !prev), debug: debugLayout }));
        }
        if (selectedItem?.type === "action" && selectedItem.id === "add") {
            return _jsx(AddWizardScreen, { width: detailWidth, debug: debugLayout });
        }
        if (viewerSession) {
            return (_jsx(ViewerControlScreen, { width: detailWidth, activeDoc: activeDoc, viewerUrl: viewerSession.url, viewerStatus: viewerStatus, streamOk: streamOk, backend: BACKEND_LABEL, debug: debugLayout }));
        }
        return (_jsx(DashboardScreen, { width: detailWidth, activeDoc: activeDoc, backend: BACKEND_LABEL, viewerStatus: viewerStatus, streamOk: streamOk, logs: logs, logsOpen: logsOpen, onToggleLogs: () => setLogsOpen((prev) => !prev), actionItems: actionItems, showEmptyState: recents.length === 0 && !activeDoc, onEmptyAction: (action) => {
                if (action === "new")
                    openWizard();
                if (action === "open") {
                    openPrompt("Open .flux path", async (value) => {
                        if (!value)
                            return;
                        setActiveDoc(value);
                        await updateRecents(props.cwd, value);
                        showToast("Document selected", "success");
                    });
                }
            }, debug: debugLayout }));
    })();
    return (_jsx(MouseProvider, { disabled: mouseDisabled, children: _jsxs(AppFrame, { debug: debugLayout, children: [_jsxs(Box, { flexDirection: "row", gap: 2, height: "100%", children: [_jsxs(Box, { width: navWidth, flexDirection: "column", gap: 1, children: [_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { children: accent("FLUX") }), _jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsx(Text, { color: streamOk ? "green" : color.muted, children: streamOk ? "●" : "○" }), _jsx(Text, { color: color.muted, children: `Flux ${props.version ?? "0.x"} · ${streamOk ? "online" : "offline"} · backend: ${BACKEND_LABEL}` })] })] }), _jsx(Box, { flexDirection: "column", gap: 1, children: _jsx(Card, { title: "Navigation", meta: "", accent: true, ruleWidth: navWidth - 6, debug: debugLayout, footer: (_jsx(Text, { color: color.muted, children: "/ palette \u00B7 q quit \u00B7 ? help" })), children: _jsx(NavList, { items: navItems, selectedIndex: selectedIndex, onSelect: (index) => {
                                                setSelectedIndex(index);
                                                const item = navItems[index];
                                                if (item)
                                                    void activateNavItem(item);
                                            }, width: navWidth - 4, maxHeight: navListHeight, debug: debugLayout }) }) })] }), _jsx(Box, { flexDirection: "column", flexGrow: 1, gap: 1, children: rightPane })] }), _jsx(Box, { marginTop: 1, children: _jsx(ToastHost, { toasts: toasts, busy: busy, progress: progress }) }), paletteOpen ? (_jsx(Box, { position: "absolute", marginTop: 2, marginLeft: Math.max(2, Math.floor((innerWidth - overlayWidth) / 2)), children: _jsx(CommandPaletteModal, { query: paletteQuery, groups: paletteGroups, selectedId: limitedPalette[paletteIndex]?.id, width: overlayWidth, debug: debugLayout }) })) : null, prompt ? (_jsx(Box, { position: "absolute", marginTop: 2, marginLeft: Math.max(2, Math.floor((innerWidth - overlayWidth) / 2)), children: _jsx(PromptModal, { label: prompt.label, value: promptValue, width: overlayWidth, debug: debugLayout }) })) : null, helpOpen ? (_jsx(Box, { position: "absolute", marginTop: 2, marginLeft: Math.max(2, Math.floor((innerWidth - overlayWidth) / 2)), children: _jsx(HelpOverlay, { width: overlayWidth, version: props.version, recentsPath: recentsPath, backend: BACKEND_LABEL, extraLines: props.helpCommand ? getHelpLines(props.helpCommand) : undefined }) })) : null, versionOpen ? (_jsx(Box, { position: "absolute", marginTop: 2, marginLeft: Math.max(2, Math.floor((innerWidth - overlayWidth) / 2)), children: _jsxs(Card, { title: "Flux CLI", meta: "", accent: true, ruleWidth: overlayWidth - 6, debug: debugLayout, children: [_jsx(Text, { color: color.muted, children: props.version ?? "version unknown" }), _jsx(Text, { color: color.muted, children: "Press Esc to close" })] }) })) : null] }) }));
    async function refreshRecents() {
        const store = await getRecentsStore(props.cwd);
        const list = store.entries.map((entry) => ({
            type: "doc",
            label: path.basename(entry.path),
            path: entry.path,
            lastOpened: entry.lastOpened,
        }));
        setRecents(list);
        setRecentsPath(store.storePath);
        if (!activeDoc && list.length && list[0].type === "doc") {
            setActiveDoc(list[0].path);
        }
    }
    async function refreshConfig() {
        const resolved = await resolveConfig({ cwd: props.cwd, env: process.env });
        setConfig(resolved.config);
    }
    async function loadFluxFiles() {
        const files = [];
        await walk(props.cwd, files, 3);
        setFluxFiles(files.slice(0, 20));
    }
    function moveSelection(delta) {
        let next = selectedIndex + delta;
        while (next >= 0 && next < navItems.length) {
            const item = navItems[next];
            if (item && item.type !== "section") {
                setSelectedIndex(next);
                return;
            }
            next += delta;
        }
    }
    async function activateNavItem(item) {
        if (item.type === "doc") {
            setActiveDoc(item.path);
            return;
        }
        if (item.type === "action") {
            switch (item.id) {
                case "open":
                    openPrompt("Open .flux path", async (value) => {
                        if (!value)
                            return;
                        setActiveDoc(value);
                        await updateRecents(props.cwd, value);
                        showToast("Document selected", "success");
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
                    setPaletteQuery("");
                    setPaletteIndex(0);
                    return;
                case "settings":
                    return;
                default:
                    return;
            }
        }
    }
    async function handleView(docPath, overrides) {
        const target = docPath ?? activeDoc;
        if (!target) {
            showToast("Select a document first.", "error");
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
            showToast(result.error?.message ?? "Viewer failed", "error");
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
        }
        catch {
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
        showToast(result.data.session.attached ? "Attached to viewer" : "Viewer running", "success");
    }
    async function handleExport() {
        if (!activeDoc) {
            showToast("Select a document first.", "error");
            return;
        }
        const defaultOut = activeDoc.replace(/\.flux$/i, ".pdf");
        setBusy("Exporting PDF...");
        startProgress("Export PDF");
        try {
            const result = viewerSession
                ? await requestViewerPdf(viewerSession.url)
                : null;
            if (result) {
                await fs.writeFile(defaultOut, result);
            }
            else {
                await pdfCommand({ file: activeDoc, outPath: defaultOut });
            }
            showToast(`Exported ${path.basename(defaultOut)}`, "success");
        }
        catch (error) {
            showToast(`Export failed: ${error.message}`, "error");
        }
        finally {
            stopProgress();
            setBusy(null);
        }
    }
    async function handleCheck(docPath) {
        const target = docPath ?? activeDoc;
        if (!target) {
            showToast("Select a document first.", "error");
            return;
        }
        setBusy("Checking...");
        const result = await checkCommand({ files: [target] });
        setBusy(null);
        if (!result.ok || !result.data) {
            showToast("Check failed", "error");
            return;
        }
        const failures = result.data.results.filter((r) => !r.ok);
        if (failures.length) {
            showToast(`Check failed (${failures.length})`, "error");
            setLogs(failures.flatMap((r) => r.errors ?? []));
            setLogsOpen(false);
        }
        else {
            showToast("All checks passed", "success");
            setLogs([]);
        }
    }
    async function handleFormat(docPath) {
        const target = docPath ?? activeDoc;
        if (!target) {
            showToast("Select a document first.", "error");
            return;
        }
        setBusy("Formatting...");
        const result = await formatCommand({ file: target });
        setBusy(null);
        if (!result.ok) {
            showToast(result.error?.message ?? "Format failed", "error");
            return;
        }
        showToast("Formatted document", "success");
    }
    async function handlePaletteSelect(item) {
        if (item.kind === "template") {
            await runTemplate(item.payload.template);
            return;
        }
        if (item.kind === "doc" || item.kind === "file") {
            setActiveDoc(item.payload.path);
            return;
        }
        if (item.kind === "action") {
            if (item.payload.action === "open") {
                openPrompt("Open .flux path", async (value) => {
                    if (!value)
                        return;
                    setActiveDoc(value);
                    await updateRecents(props.cwd, value);
                    showToast("Document selected", "success");
                });
                return;
            }
            if (item.payload.action === "new") {
                openWizard();
                return;
            }
            if (item.payload.action === "view")
                await handleView();
            if (item.payload.action === "export")
                await handleExport();
            if (item.payload.action === "check")
                await handleCheck();
            if (item.payload.action === "format")
                await handleFormat();
            if (item.payload.action === "add") {
                await runAdd(item.payload.kind);
            }
            if (item.payload.action === "settings") {
                const idx = navItems.findIndex((entry) => entry.type === "action" && entry.id === "settings");
                if (idx >= 0)
                    setSelectedIndex(idx);
            }
        }
    }
    async function runAdd(kind, docPath, options) {
        const target = docPath ?? activeDoc;
        if (!target) {
            showToast("Select a document first.", "error");
            return;
        }
        setBusy(`Adding ${kind}...`);
        const result = await addCommand({
            cwd: props.cwd,
            file: target,
            kind: kind,
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
    async function runTemplate(template) {
        setBusy(`Creating ${template}...`);
        const result = await newCommand({
            cwd: props.cwd,
            template: template,
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
            showToast(result.error?.message ?? "New failed", "error");
            return;
        }
        setActiveDoc(result.data.docPath);
        await updateRecents(props.cwd, result.data.docPath);
        showToast("Document created", "success");
    }
    function buildWizardDefaults(cfg) {
        const template = "demo";
        return {
            template,
            page: (cfg?.defaultPageSize ?? "Letter"),
            theme: (cfg?.defaultTheme ?? "screen"),
            fonts: (cfg?.defaultFonts ?? "tech"),
            fontFallback: "system",
            assets: true,
            chaptersEnabled: false,
            chapters: 2,
            live: template === "demo",
        };
    }
    function resolveWizardOutDir(outDir) {
        if (outDir)
            return outDir;
        if (wizardOutDir)
            return wizardOutDir;
        if (config?.defaultOutputDir && config.defaultOutputDir !== ".") {
            return config.defaultOutputDir;
        }
        return undefined;
    }
    function indexForValue(options, value) {
        const idx = options.findIndex((opt) => opt.value === value);
        return idx >= 0 ? idx : 0;
    }
    function applyWizardValues(nextValues, cfg, outDir) {
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
    function updateWizardChoice(direction) {
        const step = wizardSteps[wizardStep];
        if (!step || step.kind !== "select")
            return;
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
        if (!step)
            return;
        if (step.kind === "summary") {
            await submitWizard();
            return;
        }
        if (wizardStep < wizardSteps.length - 1) {
            setWizardStep((prev) => prev + 1);
        }
    }
    async function submitWizard(valuesOverride, outDirOverride) {
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
            showToast(result.error?.message ?? "New failed", "error");
            return;
        }
        setActiveDoc(result.data.docPath);
        await updateRecents(props.cwd, result.data.docPath);
        setWizardCreated(result.data);
        setWizardOpenChoice(0);
        showToast("Document created", "success");
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
    function selectNavAction(id) {
        const idx = navItems.findIndex((entry) => entry.type === "action" && entry.id === id);
        if (idx >= 0)
            setSelectedIndex(idx);
    }
    async function handleInitialRoute(initialArgs) {
        const [command, ...rest] = initialArgs;
        if (!command)
            return;
        switch (command) {
            case "new": {
                const parsed = parseNewArgsForUi(rest);
                if (parsed.unknownTemplate) {
                    showToast(`Unknown template '${parsed.unknownTemplate}'.`, "error");
                }
                const defaults = buildWizardDefaults(config);
                const next = { ...defaults };
                if (parsed.template) {
                    next.template = parsed.template;
                    next.live = parsed.live ?? (parsed.template === "demo");
                }
                if (parsed.page)
                    next.page = parsed.page;
                if (parsed.theme)
                    next.theme = parsed.theme;
                if (parsed.fonts)
                    next.fonts = parsed.fonts;
                if (parsed.fontFallback)
                    next.fontFallback = parsed.fontFallback;
                if (parsed.assets !== undefined)
                    next.assets = parsed.assets;
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
                    showToast("flux view: missing <file>", "error");
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
                    showToast("flux check: missing <file>", "error");
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
                    showToast("flux fmt: missing <file>", "error");
                    return;
                }
                setActiveDoc(target);
                await handleFormat(target);
                return;
            }
            case "add": {
                selectNavAction("add");
                const parsed = parseAddArgsForUi(rest);
                if (parsed.file)
                    setActiveDoc(parsed.file);
                if (parsed.kind) {
                    await runAdd(parsed.kind, parsed.file, parsed);
                }
                else {
                    setPaletteOpen(true);
                }
                return;
            }
            case "pdf": {
                selectNavAction("export");
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
                showToast("Use --no-ui for JSON output.", "error");
                return;
            }
            default:
                return;
        }
    }
    function showToast(message, kind = "info") {
        pushToast(message, kind);
    }
    async function toggleViewer() {
        if (!viewerSession)
            return;
        const running = !(viewerStatus?.running ?? true);
        await updateViewerTicker(viewerSession.url, { running });
        setViewerStatus((prev) => prev ? { ...prev, running } : prev);
        showToast(running ? "Viewer running" : "Viewer paused", "success");
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
        showToast("Config initialized", "success");
    }
}
function openBrowser(url) {
    const command = process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
            ? "cmd"
            : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", url.replace(/&/g, "^&")] : [url];
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    import("node:child_process").then(({ spawn }) => {
        spawn(command, args, { stdio: "ignore", detached: true });
    });
}
function revealInFinder(target) {
    const resolved = path.resolve(target);
    const command = process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
            ? "explorer"
            : "xdg-open";
    const args = process.platform === "darwin"
        ? ["-R", resolved]
        : process.platform === "win32"
            ? ["/select,", resolved]
            : [path.dirname(resolved)];
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    import("node:child_process").then(({ spawn }) => {
        spawn(command, args, { stdio: "ignore", detached: true });
    });
}
async function copyToClipboard(value) {
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
    }
    catch {
        return false;
    }
}
async function walk(dir, out, depth) {
    if (depth < 0)
        return;
    let entries;
    try {
        entries = (await fs.readdir(dir, { withFileTypes: true, encoding: "utf8" }));
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name.startsWith("."))
                continue;
            await walk(full, out, depth - 1);
        }
        else if (entry.isFile() && full.endsWith(".flux")) {
            out.push(full);
        }
    }
}
function parseNewArgsForUi(args) {
    const provided = {
        page: false,
        theme: false,
        fonts: false,
        fontFallback: false,
        assets: false,
        chapters: false,
        live: false,
    };
    let template;
    let unknownTemplate;
    let out;
    let page;
    let theme;
    let fonts;
    let fontFallback;
    let assets;
    let chapters;
    let live;
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (!arg.startsWith("-") && !template && !unknownTemplate) {
            if (isTemplateName(arg)) {
                template = arg;
            }
            else {
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
function parseViewArgsForUi(args) {
    let file;
    let port;
    let docstepMs;
    let seed;
    let advanceTime;
    const allowNet = [];
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
function parseAddArgsForUi(args) {
    let kind;
    let file;
    let text;
    let heading;
    let label;
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
function parsePdfArgsForUi(args) {
    let outPath;
    let seed;
    let docstep;
    let file;
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
function firstFileArg(args) {
    return args.find((arg) => !arg.startsWith("-"));
}
function normalizePage(raw) {
    return raw === "A4" ? "A4" : raw === "Letter" ? "Letter" : undefined;
}
function normalizeTheme(raw) {
    if (raw === "screen" || raw === "print" || raw === "both")
        return raw;
    return undefined;
}
function normalizeFonts(raw) {
    if (raw === "tech" || raw === "bookish")
        return raw;
    return undefined;
}
function normalizeFallback(raw) {
    if (!raw)
        return undefined;
    if (raw === "none" || raw === "off" || raw === "false" || raw === "0")
        return "none";
    if (raw === "system")
        return "system";
    return undefined;
}
function parseYesNoArg(raw) {
    if (!raw)
        return true;
    return !(raw === "no" || raw === "false" || raw === "0");
}
function parseNumberArg(raw) {
    if (!raw)
        return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}
function isTemplateName(raw) {
    return raw === "demo" || raw === "article" || raw === "spec" || raw === "zine" || raw === "paper";
}
function getHelpLines(command) {
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
    return [];
}
//# sourceMappingURL=app.js.map