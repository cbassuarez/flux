import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput, useApp, measureElement, } from "ink";
import path from "node:path";
import fs from "node:fs/promises";
import { getRecentsStore, updateRecents, resolveConfig, configCommand, viewCommand, pdfCommand, checkCommand, formatCommand, addCommand, newCommand, updateViewerTicker, updateViewerRuntime, fetchViewerPatch, fetchViewerStatus, requestViewerPdf, } from "@flux-lang/cli-core";
const ACCENT = "cyan";
const ACCENT_ALT = "green";
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
export function App(props) {
    const { exit } = useApp();
    const [recents, setRecents] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeDoc, setActiveDoc] = useState(null);
    const [logs, setLogs] = useState([]);
    const [toast, setToast] = useState(null);
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
    const [showLogs, setShowLogs] = useState(true);
    const [prompt, setPrompt] = useState(null);
    const [promptValue, setPromptValue] = useState("");
    const [config, setConfig] = useState(null);
    const [fluxFiles, setFluxFiles] = useState([]);
    const listRef = useRef(null);
    const [listBounds, setListBounds] = useState(null);
    const [cols, setCols] = useState(() => process.stdout.columns ?? 80);
    const navItems = useMemo(() => {
        const items = [];
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
    const handleMouseInput = useCallback((input) => {
        if (!listBounds)
            return;
        if (wizardOpen || paletteOpen || prompt || helpOpen || versionOpen)
            return;
        const events = parseMouseSequences(input);
        for (const event of events) {
            if (!event.pressed || event.button !== 0)
                continue;
            const row = event.y - 1;
            if (row < listBounds.y || row >= listBounds.y + navItems.length)
                continue;
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
        if (!config || wizardDefaultsApplied)
            return;
        const defaults = buildWizardDefaults(config);
        applyWizardValues(defaults, config);
        setWizardDefaultsApplied(true);
    }, [config, wizardDefaultsApplied]);
    useEffect(() => {
        const stdout = process.stdout;
        if (!stdout?.on || !stdout?.off)
            return;
        const handleResize = () => setCols(stdout.columns ?? 80);
        stdout.on("resize", handleResize);
        return () => {
            stdout.off("resize", handleResize);
        };
    }, []);
    useEffect(() => {
        const stdout = process.stdout;
        if (!stdout?.isTTY)
            return;
        stdout.write("\u001b[?1000h\u001b[?1006h");
        return () => {
            stdout.write("\u001b[?1000l\u001b[?1006l");
        };
    }, []);
    useEffect(() => {
        if (!listRef.current)
            return;
        try {
            const bounds = measureElement(listRef.current);
            setListBounds({ y: bounds.y ?? 0, height: bounds.height ?? 0 });
        }
        catch {
            // ignore
        }
    }, [recents, selectedIndex]);
    useEffect(() => {
        const stdin = process.stdin;
        if (!stdin?.on || !stdin.isTTY)
            return;
        const handleData = (data) => {
            handleMouseInput(data.toString("utf8"));
        };
        stdin.on("data", handleData);
        return () => {
            stdin.off("data", handleData);
        };
    }, [handleMouseInput]);
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
            if (item)
                await activateNavItem(item);
            return;
        }
    });
    const paletteItems = useMemo(() => {
        const items = [];
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
        if (!query)
            return paletteItems;
        return paletteItems
            .map((item) => {
            const score = fuzzyScore(query, item.label.toLowerCase());
            return score === null ? null : { item, score };
        })
            .filter((item) => item !== null)
            .sort((a, b) => a.score - b.score)
            .map((entry) => entry.item);
    }, [paletteItems, paletteQuery]);
    useEffect(() => {
        setPaletteIndex((prev) => Math.max(0, Math.min(prev, filteredPalette.length - 1)));
    }, [filteredPalette.length]);
    async function refreshRecents() {
        const store = await getRecentsStore(props.cwd);
        const list = store.entries.map((entry) => ({
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
        const files = [];
        await walk(props.cwd, files, 3);
        setFluxFiles(files.slice(0, 20));
    }
    async function activateNavItem(item) {
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
                            if (!value)
                                return;
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
    async function handleView(docPath, overrides) {
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
            }
            else {
                await pdfCommand({ file: activeDoc, outPath: defaultOut });
            }
            showToast(`Exported ${path.basename(defaultOut)}`);
        }
        catch (error) {
            showToast(`Export failed: ${error.message}`);
        }
        finally {
            setBusy(null);
        }
    }
    async function handleCheck(docPath) {
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
        }
        else {
            showToast("All checks passed");
        }
    }
    async function handleFormat(docPath) {
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
    async function handlePaletteSelect(item) {
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
                        if (!value)
                            return;
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
            showToast("Select a document first.");
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
            showToast(result.error?.message ?? "Add failed");
            return;
        }
        showToast(`Added ${kind}`);
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
            showToast(result.error?.message ?? "New failed");
            return;
        }
        setActiveDoc(result.data.docPath);
        await updateRecents(props.cwd, result.data.docPath);
        showToast("Document created");
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
    const wizardSteps = useMemo(() => {
        const steps = [
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
                    showToast(`Unknown template '${parsed.unknownTemplate}'.`);
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
    function showToast(message) {
        setToast(message);
        setTimeout(() => setToast(null), 2500);
    }
    async function toggleViewer() {
        if (!viewerSession)
            return;
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
            return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "Open document" }), _jsx(Text, { children: "Use Enter to paste a path, or open the palette (/)." })] }));
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
        return (_jsx(Box, { flexDirection: "column", children: _jsx(Text, { color: ACCENT, children: "Select a document" }) }));
    }
    function renderWizardPane() {
        if (wizardCreated) {
            return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "Document created" }), _jsx(Text, { children: wizardCreated.docPath }), _jsx(Text, { dimColor: true, children: "Next steps" }), _jsxs(Text, { dimColor: true, children: ["flux view ", wizardCreated.docPath] }), _jsxs(Text, { dimColor: true, children: ["flux check ", wizardCreated.docPath] }), _jsxs(Text, { dimColor: true, children: ["flux pdf ", wizardCreated.docPath, " --out ", wizardCreated.docPath.replace(/\.flux$/i, ".pdf")] }), _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { children: "Open viewer now?" }), _jsxs(Text, { color: wizardOpenChoice === 0 ? ACCENT_ALT : undefined, children: [wizardOpenChoice === 0 ? ">" : " ", " Yes"] }), _jsxs(Text, { color: wizardOpenChoice === 1 ? ACCENT_ALT : undefined, children: [wizardOpenChoice === 1 ? ">" : " ", " No"] })] }), _jsx(Text, { dimColor: true, children: "Enter to confirm - Esc to close" })] }));
        }
        const step = wizardSteps[wizardStep];
        if (!step) {
            return (_jsx(Box, { flexDirection: "column", children: _jsx(Text, { color: ACCENT, children: "Wizard loading..." }) }));
        }
        if (step.kind === "summary") {
            return renderWizardSummary();
        }
        const index = wizardIndexes[step.key] ?? 0;
        return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "New document wizard" }), _jsxs(Text, { children: [step.label, " (", wizardStep + 1, "/", wizardSteps.length, ")"] }), step.options.map((opt, idx) => (_jsxs(Text, { color: idx === index ? ACCENT_ALT : undefined, children: [idx === index ? ">" : " ", " ", opt.label, opt.hint ? ` - ${opt.hint}` : ""] }, `${step.key}-${opt.label}`))), _jsx(Text, { dimColor: true, children: "Enter to continue - Backspace to go back - Esc to cancel" })] }));
    }
    function renderWizardSummary() {
        const outDir = resolveWizardOutDir();
        const title = templateTitle(wizardValues.template);
        const slug = slugify(title);
        const outIsFile = Boolean(outDir && outDir.endsWith(".flux"));
        const outputDir = outIsFile && outDir ? path.dirname(outDir) : (outDir ?? props.cwd);
        const fileName = outIsFile && outDir ? path.basename(outDir) : `${slug}.flux`;
        return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "Summary" }), _jsxs(Text, { children: ["Template: ", wizardValues.template] }), _jsxs(Text, { children: ["Page size: ", wizardValues.page] }), _jsxs(Text, { children: ["Theme: ", wizardValues.theme] }), _jsxs(Text, { children: ["Fonts: ", wizardValues.fonts] }), _jsxs(Text, { children: ["Font fallback: ", wizardValues.fontFallback === "system" ? "system stack" : "primary only"] }), _jsxs(Text, { children: ["Assets folder: ", wizardValues.assets ? "yes" : "no"] }), _jsxs(Text, { children: ["Chapters: ", wizardValues.chaptersEnabled ? wizardValues.chapters : "no"] }), _jsxs(Text, { children: ["Live slots: ", wizardValues.live ? "yes" : "no"] }), _jsxs(Text, { children: ["Output dir: ", outputDir] }), _jsxs(Text, { children: ["File: ", fileName] }), _jsx(Text, { dimColor: true, children: "Enter to create - Backspace to go back - Esc to cancel" })] }));
    }
    function renderHelpPane() {
        const lines = getHelpLines(props.helpCommand);
        return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "Flux help" }), lines.map((line, idx) => (_jsx(Text, { dimColor: !line.trim(), children: line }, `help-${idx}`))), _jsx(Text, { dimColor: true, children: "Press Esc to close" })] }));
    }
    function renderVersionPane() {
        return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "Flux CLI" }), _jsx(Text, { children: props.version ?? "version unknown" }), _jsx(Text, { dimColor: true, children: "Press Esc to close" })] }));
    }
    function renderDocPanel() {
        return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "Document" }), _jsx(Text, { children: activeDoc }), _jsx(Text, { dimColor: true, children: "Actions: View, Export PDF, Check, Add..." }), _jsx(Text, { dimColor: true, children: "Press O to reveal - Y to copy path" })] }));
    }
    function renderViewerPanel() {
        return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "Viewer" }), _jsxs(Text, { children: ["Path: ", activeDoc ?? viewerSession?.docPath ?? "unknown"] }), _jsxs(Text, { children: ["URL: ", viewerSession?.url] }), _jsxs(Text, { children: ["Docstep: ", viewerStatus?.docstep ?? 0, " - Time: ", viewerStatus?.time?.toFixed?.(2) ?? "0.00"] }), _jsxs(Text, { children: ["Interval: ", viewerStatus?.docstepMs ?? config?.docstepMs ?? 1000, "ms"] }), _jsxs(Text, { children: ["Seed: ", viewerStatus?.seed ?? 0] }), _jsxs(Text, { children: ["Running: ", viewerStatus?.running ? "yes" : "no"] }), _jsx(Text, { children: "Backend: typesetter" }), _jsxs(Text, { children: ["Stream: ", streamOk ? "connected" : "waiting"] }), _jsx(Text, { dimColor: true, children: "Controls: P pause/resume - I interval - S seed - J docstep - E export" })] }));
    }
    function renderSettings() {
        if (!config) {
            return (_jsx(Box, { flexDirection: "column", children: _jsx(Text, { children: "Loading config..." }) }));
        }
        return (_jsxs(Box, { flexDirection: "column", gap: 1, children: [_jsx(Text, { color: ACCENT, children: "Settings" }), _jsxs(Text, { children: ["docstepMs: ", config.docstepMs] }), _jsxs(Text, { children: ["advanceTime: ", config.advanceTime ? "yes" : "no"] }), _jsxs(Text, { children: ["defaultPage: ", config.defaultPageSize] }), _jsxs(Text, { children: ["defaultTheme: ", config.defaultTheme] }), _jsxs(Text, { children: ["defaultFonts: ", config.defaultFonts] }), _jsx(Text, { dimColor: true, children: "Press I to initialize config - D to set docstepMs" })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", height: "100%", children: [_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsxs(Box, { ref: listRef, flexDirection: "column", borderStyle: "round", borderColor: ACCENT, width: Math.min(30, Math.floor(cols * 0.3)), padding: 1, children: [_jsx(Text, { color: ACCENT_ALT, children: "Flux 2026" }), navItems.map((item, idx) => {
                                if (item.type === "section") {
                                    return (_jsx(Text, { dimColor: true, children: item.label }, `${item.label}-${idx}`));
                                }
                                const selected = idx === selectedIndex;
                                const label = item.label;
                                return (_jsxs(Text, { color: selected ? ACCENT_ALT : undefined, children: [selected ? ">" : " ", " ", label] }, `${item.label}-${idx}`));
                            }), _jsx(Text, { dimColor: true, children: "/: palette - Ctrl+C: exit" })] }), _jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: ACCENT_ALT, flexGrow: 1, padding: 1, children: [busy && (_jsxs(Text, { color: ACCENT_ALT, children: ["[busy] ", busy] })), rightPane, showLogs && logs.length > 0 && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "red", children: "Diagnostics" }), logs.slice(0, 6).map((line, idx) => (_jsx(Text, { dimColor: true, children: line }, `${line}-${idx}`)))] }))] })] }), toast && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: ACCENT_ALT, children: toast }) })), paletteOpen && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: ACCENT_ALT, padding: 1, marginTop: 1, children: [_jsx(Text, { color: ACCENT, children: "Command palette" }), _jsxs(Text, { children: ["Search: ", paletteQuery || ""] }), filteredPalette.slice(0, 8).map((item, idx) => (_jsxs(Text, { color: idx === paletteIndex ? ACCENT_ALT : undefined, children: [idx === paletteIndex ? ">" : " ", " ", item.label] }, item.id)))] })), prompt && (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: ACCENT, children: [prompt.label, ": ", promptValue] }) }))] }));
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
function isMouseSequence(input) {
    return input.includes("\u001b[<");
}
function parseMouseSequences(input) {
    const events = [];
    const regex = /\u001b\[<(\d+);(\d+);(\d+)([mM])/g;
    let match;
    while ((match = regex.exec(input)) !== null) {
        const buttonCode = Number(match[1]);
        const x = Number(match[2]);
        const y = Number(match[3]);
        const pressed = match[4] === "M";
        const isScroll = buttonCode >= 64;
        const isMove = (buttonCode & 32) === 32;
        if (isScroll || isMove)
            continue;
        const button = buttonCode & 3;
        events.push({ button, x, y, pressed });
    }
    return events;
}
function fuzzyScore(query, target) {
    if (!query)
        return 0;
    let score = 0;
    let lastIndex = -1;
    for (const ch of query) {
        const idx = target.indexOf(ch, lastIndex + 1);
        if (idx === -1)
            return null;
        score += idx - lastIndex - 1;
        lastIndex = idx;
    }
    return score + (target.length - query.length);
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
function templateTitle(template) {
    const map = {
        demo: "Flux Demo",
        article: "Flux Article",
        spec: "Flux Spec",
        zine: "Flux Zine",
        paper: "Flux Paper",
    };
    return map[template] ?? "Flux Document";
}
function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "flux-document";
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
//# sourceMappingURL=app.js.map