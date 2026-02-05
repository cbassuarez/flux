import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseDocument, checkDocument, createDocumentRuntimeIR, applyAddTransform, formatFluxSource, } from "@flux-lang/core";
import { renderHtml } from "@flux-lang/render-html";
import { createTypesetterBackend } from "@flux-lang/typesetter";
import { buildEditorMissingHtml, resolveEditorDist } from "./editor-dist.js";
const DEFAULT_DOCSTEP_MS = 1000;
const MAX_TICK_SECONDS = 1;
const NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
};
export function noCacheHeaders(extra = {}) {
    return { ...NO_CACHE_HEADERS, ...extra };
}
export function advanceViewerRuntime(runtime, renderOptions, advanceTime, dtSeconds) {
    if (advanceTime && dtSeconds > 0) {
        runtime.tick(dtSeconds);
    }
    const nextIr = runtime.step(1);
    return {
        ir: nextIr,
        render: renderHtml(nextIr, renderOptions),
    };
}
const MAX_REMOTE_BYTES = 8 * 1024 * 1024;
const REMOTE_TIMEOUT_MS = 5000;
export async function startViewerServer(options) {
    const docPath = path.resolve(options.docPath);
    const docRoot = path.dirname(docPath);
    let currentSource = await fs.readFile(docPath, "utf8");
    let baseDoc = null;
    let errors = [];
    let diagnostics = buildDiagnosticsBundle([]);
    let revision = 0;
    let lastValidRevision = 0;
    const parseSource = (source) => {
        try {
            const parsed = parseDocument(source, {
                sourcePath: docPath,
                docRoot,
                resolveIncludes: true,
            });
            const checkErrors = checkDocument(docPath, parsed);
            const parsedDiagnostics = buildDiagnosticsBundle(checkErrors.map((message) => buildDiagnosticFromMessage(message, source, docPath)));
            return { doc: parsed, errors: checkErrors, diagnostics: parsedDiagnostics };
        }
        catch (err) {
            const message = String(err?.message ?? err);
            const parsedDiagnostics = buildDiagnosticsBundle([buildDiagnosticFromMessage(message, source, docPath, "fail")]);
            return { doc: null, errors: [message], diagnostics: parsedDiagnostics };
        }
    };
    ({ doc: baseDoc, errors, diagnostics } = parseSource(currentSource));
    if (!errors.length && baseDoc) {
        lastValidRevision = revision;
    }
    const buildRuntime = (doc, overrides = {}) => createDocumentRuntimeIR(doc, {
        seed: overrides.seed ?? options.seed ?? 0,
        docstep: overrides.docstep ?? options.docstepStart ?? 0,
        time: overrides.time ?? 0,
        assetCwd: docRoot,
    });
    let runtime = baseDoc ? buildRuntime(baseDoc) : null;
    const initialIr = runtime ? runtime.render() : buildEmptyIR();
    const renderOptions = {
        assetUrl: (assetId) => `/assets/${encodeURIComponent(assetId)}`,
        rawUrl: (raw) => `/asset?src=${encodeURIComponent(raw)}`,
    };
    const editorDist = await resolveEditorDist({ editorDist: options.editorDist });
    let current = {
        docPath,
        docRoot,
        ir: initialIr,
        render: renderHtml(initialIr, renderOptions),
        errors,
        diagnostics,
    };
    let running = runtime !== null && errors.length === 0;
    let intervalMs = options.docstepMs ?? DEFAULT_DOCSTEP_MS;
    let timer = null;
    let nextTickAt = Date.now() + intervalMs;
    let lastTickAt = Date.now();
    const advanceTime = options.advanceTime !== false;
    const sseClients = new Set();
    let keepAliveTimer = null;
    const diffSlotPatches = (prev, next) => {
        const patches = {};
        const seen = new Set();
        for (const [id, html] of Object.entries(next)) {
            seen.add(id);
            if (prev[id] !== html)
                patches[id] = html;
        }
        for (const id of Object.keys(prev)) {
            if (!seen.has(id))
                patches[id] = "";
        }
        return patches;
    };
    const buildPatchPayload = (slotPatches) => {
        if (current.errors.length) {
            return { errors: current.errors };
        }
        return { docstep: current.ir.docstep, time: current.ir.time, slotPatches };
    };
    let lastSlotMap = current.render.slots;
    let lastPatchPayload = buildPatchPayload(current.render.slots);
    const rebuildCurrent = (nextRuntime, nextErrors, nextDiagnostics) => {
        const nextIr = nextRuntime ? nextRuntime.render() : buildEmptyIR();
        const nextRender = renderHtml(nextIr, renderOptions);
        current = {
            ...current,
            ir: nextIr,
            render: nextRender,
            errors: nextErrors,
            diagnostics: nextDiagnostics,
        };
        lastSlotMap = nextRender.slots;
        lastPatchPayload = buildPatchPayload(nextRender.slots);
    };
    const rebuildFromSource = (nextSource) => {
        const parsed = parseSource(nextSource);
        baseDoc = parsed.doc;
        errors = parsed.errors;
        diagnostics = parsed.diagnostics;
        if (!errors.length && baseDoc) {
            lastValidRevision = revision;
        }
        const wasRunning = running;
        runtime = baseDoc
            ? buildRuntime(baseDoc, {
                seed: runtime?.seed ?? options.seed ?? 0,
                docstep: runtime?.docstep ?? options.docstepStart ?? 0,
                time: runtime?.time ?? 0,
            })
            : null;
        rebuildCurrent(runtime, errors, diagnostics);
        const canRun = runtime !== null && errors.length === 0;
        running = wasRunning && canRun;
        if (running) {
            lastTickAt = Date.now();
            nextTickAt = Date.now() + intervalMs;
            scheduleTick();
        }
        else {
            stopTicking();
        }
    };
    const resetRuntime = (payload) => {
        if (!baseDoc || errors.length)
            return false;
        const next = buildRuntime(baseDoc, {
            seed: payload.seed ?? runtime?.seed ?? options.seed ?? 0,
            docstep: payload.docstep ?? runtime?.docstep ?? options.docstepStart ?? 0,
            time: payload.time ?? runtime?.time ?? 0,
        });
        runtime = next;
        rebuildCurrent(next, errors, diagnostics);
        lastTickAt = Date.now();
        nextTickAt = Date.now() + intervalMs;
        broadcastPatchUpdate(lastPatchPayload);
        return true;
    };
    const broadcastPatchUpdate = (payload = lastPatchPayload) => {
        if (sseClients.size === 0)
            return;
        const message = `data: ${JSON.stringify(payload)}\n\n`;
        for (const client of sseClients) {
            client.write(message);
        }
    };
    const broadcastDocChanged = () => {
        if (sseClients.size === 0)
            return;
        const payload = { docstep: current.ir.docstep, time: current.ir.time };
        const message = `event: doc-changed\ndata: ${JSON.stringify(payload)}\n\n`;
        for (const client of sseClients) {
            client.write(message);
        }
    };
    const startKeepAlive = () => {
        if (keepAliveTimer)
            return;
        keepAliveTimer = setInterval(() => {
            for (const client of sseClients) {
                client.write(": ping\n\n");
            }
        }, 15000);
    };
    const stopKeepAlive = () => {
        if (!keepAliveTimer)
            return;
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    };
    const tick = () => {
        if (!running)
            return;
        if (!runtime)
            return;
        const now = Date.now();
        const elapsedMs = Math.max(0, now - lastTickAt);
        lastTickAt = now;
        const dtSeconds = Math.min(elapsedMs / 1000, MAX_TICK_SECONDS);
        const next = advanceViewerRuntime(runtime, renderOptions, advanceTime, dtSeconds);
        const slotPatches = diffSlotPatches(lastSlotMap, next.render.slots);
        lastSlotMap = next.render.slots;
        current = {
            ...current,
            ir: next.ir,
            render: next.render,
        };
        lastPatchPayload = buildPatchPayload(slotPatches);
        broadcastPatchUpdate(lastPatchPayload);
        nextTickAt += intervalMs;
        scheduleTick();
    };
    const scheduleTick = () => {
        if (!running)
            return;
        if (timer)
            clearTimeout(timer);
        const delay = Math.max(0, nextTickAt - Date.now());
        timer = setTimeout(tick, delay);
    };
    const stopTicking = () => {
        running = false;
        if (timer)
            clearTimeout(timer);
        timer = null;
    };
    const startTicking = () => {
        if (!runtime || current.errors.length)
            return;
        if (running)
            return;
        running = true;
        lastTickAt = Date.now();
        nextTickAt = Date.now() + intervalMs;
        scheduleTick();
    };
    const buildEditState = async () => {
        const stats = await fs.stat(docPath).catch(() => null);
        const title = baseDoc?.meta?.title ?? path.basename(docPath);
        const version = baseDoc?.meta?.version ?? null;
        const banks = baseDoc?.assets?.banks?.map((bank) => ({
            name: bank.name,
            kind: bank.kind,
            root: bank.root,
            include: bank.include,
            tags: bank.tags ?? [],
            strategy: bank.strategy ?? null,
            bankTag: `bank:${bank.name}`,
        }));
        return {
            title,
            path: docPath,
            docPath,
            meta: { title, version },
            file: {
                path: docPath,
                mtime: stats ? new Date(stats.mtimeMs).toISOString() : null,
            },
            lastModified: stats ? new Date(stats.mtimeMs).toISOString() : null,
            revision,
            lastValidRevision,
            diagnostics: current.diagnostics,
            previewPath: "/preview",
            outline: buildOutline(),
            assetsBanks: banks ?? [],
            capabilities: {
                setText: true,
                addSection: true,
                addParagraph: true,
                addFigure: true,
                addCallout: true,
                addTable: true,
                transforms: {
                    setText: true,
                    addSection: true,
                    addParagraph: true,
                    addFigure: true,
                    addCallout: true,
                    addTable: true,
                },
            },
        };
    };
    const buildOutline = () => {
        if (!baseDoc?.body?.nodes)
            return [];
        const inlineKinds = new Set([
            "em",
            "strong",
            "code",
            "smallcaps",
            "sub",
            "sup",
            "mark",
            "link",
            "inline_slot",
        ]);
        const flattenKinds = new Set(["row", "column"]);
        const outlineFromNodes = (nodes) => {
            const result = [];
            for (const node of nodes ?? []) {
                if (node.kind === "page" || node.kind === "section") {
                    const childNodes = outlineFromNodes(node.children ?? []);
                    result.push({
                        id: node.id,
                        kind: node.kind,
                        label: deriveOutlineLabel(node),
                        children: childNodes.length ? childNodes : undefined,
                    });
                    continue;
                }
                if (inlineKinds.has(node.kind)) {
                    continue;
                }
                if (flattenKinds.has(node.kind)) {
                    result.push(...outlineFromNodes(node.children ?? []));
                    continue;
                }
                result.push({
                    id: node.id,
                    kind: node.kind,
                    label: deriveOutlineLabel(node),
                });
            }
            return result;
        };
        return outlineFromNodes(baseDoc.body.nodes);
    };
    scheduleTick();
    startKeepAlive();
    const allowNet = new Set((options.allowNet ?? []).map((origin) => origin.trim()).filter(Boolean));
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url ?? "/", "http://localhost");
            applyCsp(res);
            if (url.pathname.startsWith("/api/edit/")) {
                const requestedFile = url.searchParams.get("file");
                if (requestedFile && path.resolve(requestedFile) !== docPath) {
                    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
                    res.end(JSON.stringify({ ok: false, error: "Document path not allowed" }));
                    return;
                }
            }
            if (url.pathname === "/edit" || url.pathname.startsWith("/edit/")) {
                if (!editorDist.dir || !editorDist.indexPath) {
                    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...noCacheHeaders() });
                    res.end(buildEditorMissingHtml(editorDist));
                    return;
                }
                const relative = url.pathname === "/edit" ? "" : url.pathname.slice("/edit/".length);
                const decoded = decodeURIComponent(relative);
                const target = path.resolve(editorDist.dir, decoded);
                if (!isWithinOrEqual(editorDist.dir, target)) {
                    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
                    res.end("Forbidden");
                    return;
                }
                const resolvedPath = await resolveStaticPath(editorDist.dir, target);
                await serveFile(res, resolvedPath ?? editorDist.indexPath, noCacheHeaders());
                return;
            }
            if (editorDist.dir && editorDist.indexPath) {
                const rawPath = url.pathname;
                if (rawPath !== "/" &&
                    !rawPath.startsWith("/api/") &&
                    !rawPath.startsWith("/assets/") &&
                    rawPath !== "/asset" &&
                    rawPath !== "/viewer.js" &&
                    rawPath !== "/viewer.css" &&
                    rawPath !== "/render.css") {
                    const decoded = decodeURIComponent(rawPath.slice(1));
                    const candidate = path.resolve(editorDist.dir, decoded);
                    const resolved = await resolveStaticPath(editorDist.dir, candidate);
                    if (resolved) {
                        await serveFile(res, resolved, noCacheHeaders());
                        return;
                    }
                }
            }
            if (url.pathname === "/") {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(buildIndexHtml(path.basename(docPath)));
                return;
            }
            if (url.pathname === "/viewer.css") {
                res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
                res.end(getViewerCss());
                return;
            }
            if (url.pathname === "/viewer.js") {
                res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
                res.end(getViewerJs());
                return;
            }
            if (url.pathname === "/render.css") {
                res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
                res.end(current.render.css);
                return;
            }
            if (url.pathname === "/preview") {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...noCacheHeaders() });
                res.end(buildPreviewHtml(current));
                return;
            }
            if (url.pathname === "/preview.js") {
                res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", ...noCacheHeaders() });
                res.end(getPreviewJs());
                return;
            }
            if (url.pathname === "/api/config") {
                sendJson(res, {
                    docPath,
                    docstepMs: intervalMs,
                    running,
                    seed: runtime?.seed ?? 0,
                    docstep: runtime?.docstep ?? 0,
                    time: runtime?.time ?? 0,
                });
                return;
            }
            if (url.pathname === "/api/edit/state") {
                const state = await buildEditState();
                sendJson(res, state);
                return;
            }
            if (url.pathname === "/api/edit/outline") {
                sendJson(res, { outline: buildOutline() });
                return;
            }
            if (url.pathname === "/api/edit/node") {
                const id = url.searchParams.get("id");
                if (!id) {
                    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
                    res.end(JSON.stringify({ ok: false, error: "Missing node id" }));
                    return;
                }
                if (!baseDoc) {
                    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
                    res.end(JSON.stringify({ ok: false, error: "Document not loaded", diagnostics: current.diagnostics }));
                    return;
                }
                const node = findNodeById(baseDoc.body?.nodes ?? [], id);
                if (!node) {
                    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
                    res.end(JSON.stringify({ ok: false, error: "Node not found" }));
                    return;
                }
                sendJson(res, buildInspectorPayload(node));
                return;
            }
            if (url.pathname === "/api/edit/transform" && req.method === "POST") {
                const payload = await readJson(req);
                const requestedPath = typeof payload?.file === "string" ? payload.file : payload?.docPath;
                if (requestedPath && path.resolve(requestedPath) !== docPath) {
                    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
                    res.end(JSON.stringify({ ok: false, error: "Document path not allowed" }));
                    return;
                }
                const op = payload?.op;
                const args = payload?.args ?? {};
                const source = await fs.readFile(docPath, "utf8");
                const parsed = parseSource(source);
                if (!parsed.doc || parsed.errors.length) {
                    sendJson(res, {
                        ok: false,
                        diagnostics: parsed.diagnostics,
                        error: parsed.errors.join("; "),
                    });
                    return;
                }
                let nextSource = null;
                let selectedId;
                if (op === "setText") {
                    const id = typeof args.id === "string" ? args.id : "";
                    const text = typeof args.text === "string" ? args.text : "";
                    const result = applySetTextTransform(source, parsed.doc, id, text, docPath);
                    if (!result.ok) {
                        sendJson(res, { ok: false, diagnostics: buildDiagnosticsBundle([result.diagnostic]) });
                        return;
                    }
                    nextSource = formatFluxSource(result.source);
                    selectedId = id;
                }
                else {
                    const toOptions = () => {
                        if (op === "addSection") {
                            return {
                                kind: "section",
                                heading: typeof args.heading === "string" ? args.heading : undefined,
                                noHeading: typeof args.noHeading === "boolean" ? args.noHeading : undefined,
                            };
                        }
                        if (op === "addParagraph") {
                            return {
                                kind: "paragraph",
                                text: typeof args.text === "string" ? args.text : undefined,
                            };
                        }
                        if (op === "addFigure") {
                            return {
                                kind: "figure",
                                bankName: typeof args.bankName === "string" ? args.bankName : undefined,
                                tags: Array.isArray(args.tags) ? args.tags.map((tag) => String(tag)) : undefined,
                                caption: typeof args.caption === "string" ? args.caption : undefined,
                                label: typeof args.label === "string" ? args.label : undefined,
                                reserve: args.reserve,
                                fit: typeof args.fit === "string" ? args.fit : undefined,
                            };
                        }
                        if (op === "addCallout") {
                            return {
                                kind: "callout",
                                label: typeof args.tone === "string" ? args.tone : undefined,
                                text: typeof args.text === "string" ? args.text : undefined,
                            };
                        }
                        if (op === "addTable") {
                            return { kind: "table" };
                        }
                        throw new Error("Unsupported edit operation");
                    };
                    try {
                        nextSource = formatFluxSource(applyAddTransform(source, parsed.doc, toOptions()));
                    }
                    catch (err) {
                        sendJson(res, {
                            ok: false,
                            diagnostics: buildDiagnosticsBundle([
                                buildDiagnosticFromMessage(String(err?.message ?? err), source, docPath, "fail"),
                            ]),
                        });
                        return;
                    }
                }
                if (!nextSource) {
                    sendJson(res, { ok: false, diagnostics: buildDiagnosticsBundle([]), error: "No changes produced" });
                    return;
                }
                const validated = parseSource(nextSource);
                if (!validated.doc || validated.errors.length) {
                    sendJson(res, {
                        ok: false,
                        diagnostics: validated.diagnostics,
                        error: validated.errors.join("; "),
                    });
                    return;
                }
                await writeFileAtomic(docPath, nextSource);
                currentSource = nextSource;
                revision += 1;
                lastValidRevision = revision;
                rebuildFromSource(nextSource);
                broadcastDocChanged();
                sendJson(res, {
                    ok: current.errors.length === 0,
                    newRevision: revision,
                    diagnostics: current.diagnostics,
                    outline: buildOutline(),
                    selectedId,
                    state: await buildEditState(),
                });
                return;
            }
            if (url.pathname === "/api/render") {
                if (current.errors.length) {
                    sendJson(res, {
                        html: buildErrorHtml(current.errors),
                        docstep: current.ir.docstep,
                        time: current.ir.time,
                        errors: current.errors,
                    });
                }
                else {
                    sendJson(res, {
                        html: current.render.html,
                        docstep: current.ir.docstep,
                        time: current.ir.time,
                    });
                }
                return;
            }
            if (url.pathname === "/api/ir") {
                if (current.errors.length) {
                    sendJson(res, { errors: current.errors });
                }
                else {
                    sendJson(res, {
                        ir: current.ir,
                        slots: current.render.slots,
                    });
                }
                return;
            }
            if (url.pathname === "/api/patches") {
                sendJson(res, lastPatchPayload);
                return;
            }
            if (url.pathname === "/api/stream" || url.pathname === "/api/events") {
                res.writeHead(200, {
                    "Content-Type": "text/event-stream; charset=utf-8",
                    Connection: "keep-alive",
                    ...noCacheHeaders(),
                });
                res.write(": connected\n\n");
                sseClients.add(res);
                res.write(`data: ${JSON.stringify(buildPatchPayload(current.render.slots))}\n\n`);
                req.on("close", () => {
                    sseClients.delete(res);
                    res.end();
                });
                return;
            }
            if (url.pathname === "/api/ticker" && req.method === "POST") {
                const payload = await readJson(req);
                if (typeof payload?.docstepMs === "number" && Number.isFinite(payload.docstepMs)) {
                    intervalMs = Math.max(50, payload.docstepMs);
                    if (running) {
                        lastTickAt = Date.now();
                        nextTickAt = Date.now() + intervalMs;
                        scheduleTick();
                    }
                }
                if (typeof payload?.running === "boolean") {
                    if (payload.running)
                        startTicking();
                    else
                        stopTicking();
                }
                sendJson(res, { ok: true, running, docstepMs: intervalMs });
                return;
            }
            if (url.pathname === "/api/runtime" && req.method === "POST") {
                const payload = await readJson(req);
                const updated = resetRuntime({
                    seed: typeof payload?.seed === "number" ? payload.seed : undefined,
                    docstep: typeof payload?.docstep === "number" ? payload.docstep : undefined,
                    time: typeof payload?.time === "number" ? payload.time : undefined,
                });
                if (!updated) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: false, error: "Document not loaded" }));
                    return;
                }
                sendJson(res, {
                    ok: true,
                    seed: runtime?.seed ?? 0,
                    docstep: runtime?.docstep ?? 0,
                    time: runtime?.time ?? 0,
                });
                return;
            }
            if (url.pathname === "/api/pdf") {
                if (current.errors.length) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ errors: current.errors }));
                    return;
                }
                if (!runtime) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ errors: ["Document failed to load."] }));
                    return;
                }
                const typesetter = createTypesetterBackend();
                const pdf = await typesetter.pdf(current.render.html, current.render.css, {
                    baseUrl: `http://localhost:${server.address().port}`,
                });
                res.writeHead(200, {
                    "Content-Type": "application/pdf",
                    "Content-Length": String(pdf.byteLength),
                });
                res.end(Buffer.from(pdf));
                return;
            }
            if (url.pathname.startsWith("/assets/")) {
                const id = url.pathname.replace("/assets/", "");
                const assetPath = resolveAssetPath(current.ir, id, docRoot);
                if (!assetPath) {
                    res.writeHead(404);
                    res.end("Asset not found");
                    return;
                }
                const safe = isWithin(docRoot, assetPath);
                if (!safe) {
                    res.writeHead(403);
                    res.end("Forbidden");
                    return;
                }
                await serveFile(res, assetPath);
                return;
            }
            if (url.pathname === "/asset") {
                const raw = url.searchParams.get("src") ?? "";
                const result = await resolveRawAsset(raw, docRoot, allowNet);
                if (!result.ok) {
                    res.writeHead(result.status);
                    res.end(result.message);
                    return;
                }
                if (result.type === "local") {
                    await serveFile(res, result.path);
                    return;
                }
                res.writeHead(200, { "Content-Type": result.contentType });
                res.end(Buffer.from(result.bytes));
                return;
            }
            res.writeHead(404);
            res.end("Not found");
        }
        catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(String(err?.message ?? err));
        }
    });
    const port = options.port ?? 0;
    const host = options.host ?? "127.0.0.1";
    await new Promise((resolve) => server.listen(port, host, resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Failed to start viewer server");
    }
    const displayHost = host === "0.0.0.0" ? "localhost" : host;
    return {
        port: address.port,
        url: `http://${displayHost}:${address.port}`,
        close: async () => {
            stopTicking();
            stopKeepAlive();
            await new Promise((resolve) => server.close(() => resolve()));
        },
    };
}
function buildIndexHtml(title) {
    return [
        "<!doctype html>",
        "<html>",
        "<head>",
        '<meta charset="utf-8">',
        `<title>${escapeHtml(title)} · Flux Viewer</title>`,
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<link rel="stylesheet" href="/viewer.css">',
        '<link rel="stylesheet" href="/render.css">',
        "</head>",
        "<body>",
        "<div id=\"app\">",
        "  <header class=\"viewer-toolbar\">",
        "    <div class=\"viewer-title-group\">",
        "      <div class=\"viewer-title\">Flux Viewer</div>",
        "      <div class=\"viewer-status\" id=\"viewer-status\">Live: docstep 0 · t=0.00</div>",
        "    </div>",
        "    <div class=\"viewer-controls\">",
        "      <button id=\"viewer-toggle\">Pause</button>",
        "      <label>Interval <input id=\"viewer-interval\" type=\"number\" min=\"50\" step=\"50\"></label>",
        "      <button id=\"viewer-export\">Export PDF</button>",
        "    </div>",
        "  </header>",
        "  <main id=\"viewer-doc\"></main>",
        "</div>",
        '<script src="/viewer.js" defer></script>',
        "</body>",
        "</html>",
    ].join("\n");
}
function getViewerCss() {
    return `
body {
  margin: 0;
  background: #1b1a18;
  color: #ece7df;
  font-family: "Source Sans 3", "Segoe UI", sans-serif;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #141311;
  border-bottom: 1px solid #2b2925;
}

.viewer-title-group {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.viewer-title {
  font-size: 14px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #cdbf9f;
}

.viewer-status {
  font-size: 12px;
  color: #9f9788;
  letter-spacing: 0.08em;
}

.viewer-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
}

.viewer-controls button {
  background: #cdbf9f;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  color: #241f16;
  font-weight: 600;
  cursor: pointer;
}

.viewer-controls input {
  width: 90px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid #6b655a;
  background: #24211c;
  color: #ece7df;
}

#viewer-doc {
  flex: 1;
}

.viewer-error {
  padding: 32px;
  color: #f6d1d1;
}

.viewer-error h2 {
  margin-top: 0;
  color: #f2b2b2;
}
`.trim();
}
export function getViewerJs() {
    return `
(() => {
  const docRoot = document.getElementById("viewer-doc");
  const toggleBtn = document.getElementById("viewer-toggle");
  const intervalInput = document.getElementById("viewer-interval");
  const exportBtn = document.getElementById("viewer-export");
  const statusEl = document.getElementById("viewer-status");

  let running = true;
  let pollTimer = null;
  let sse = null;

  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
  };

  const getPreviewDocument = () => {
    const frame = docRoot ? docRoot.querySelector("iframe#preview, iframe") : null;
    if (frame && frame.contentDocument) {
      return frame.contentDocument;
    }
    return document;
  };

  const getPreviewWindow = () => {
    const frame = docRoot ? docRoot.querySelector("iframe#preview, iframe") : null;
    if (frame && frame.contentWindow) {
      return frame.contentWindow;
    }
    return window;
  };

  const applyAssets = (root) => {
    root.querySelectorAll("img[data-flux-asset-id]").forEach((img) => {
      const id = img.getAttribute("data-flux-asset-id");
      if (id) img.src = "/assets/" + id;
    });
    root.querySelectorAll("img[data-flux-src]").forEach((img) => {
      const raw = img.getAttribute("data-flux-src");
      if (raw) img.src = "/asset?src=" + encodeURIComponent(raw);
    });
  };

  const fitsWithin = (container, inner) => {
    return inner.scrollWidth <= container.clientWidth && inner.scrollHeight <= container.clientHeight;
  };

  const applyFit = (slot, win = window) => {
    const fit = slot.getAttribute("data-flux-fit");
    const inner = slot.querySelector("[data-flux-slot-inner]");
    if (!inner) return;
    const isInline = slot.getAttribute("data-flux-inline") === "true";
    inner.style.transform = "";
    inner.style.fontSize = "";
    inner.style.whiteSpace = "";
    inner.style.textOverflow = "";
    inner.style.webkitLineClamp = "";
    inner.style.webkitBoxOrient = "";
    inner.style.display = "";
    if (fit === "shrink") {
      const style = win.getComputedStyle(inner);
      const base = parseFloat(style.fontSize) || 14;
      let lo = 6;
      let hi = base;
      let best = base;
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        inner.style.fontSize = mid + "px";
        if (fitsWithin(slot, inner)) {
          best = mid;
          lo = mid + 0.1;
        } else {
          hi = mid - 0.1;
        }
      }
      inner.style.fontSize = best + "px";
    } else if (fit === "scaleDown") {
      inner.style.transformOrigin = "top left";
      const scaleX = slot.clientWidth / inner.scrollWidth;
      const scaleY = slot.clientHeight / inner.scrollHeight;
      const scale = Math.min(1, scaleX, scaleY);
      inner.style.transform = "scale(" + scale + ")";
    } else if (fit === "ellipsis") {
      if (isInline) {
        inner.style.display = "inline-block";
        inner.style.whiteSpace = "nowrap";
        inner.style.textOverflow = "ellipsis";
        inner.style.overflow = "hidden";
      } else {
        const lineHeight = parseFloat(win.getComputedStyle(inner).lineHeight) || 16;
        const maxLines = Math.max(1, Math.floor(slot.clientHeight / lineHeight));
        inner.style.display = "-webkit-box";
        inner.style.webkitBoxOrient = "vertical";
        inner.style.webkitLineClamp = String(maxLines);
        inner.style.overflow = "hidden";
      }
    }
  };

  const applyFits = (root, win) => {
    root.querySelectorAll("[data-flux-fit]").forEach((slot) => applyFit(slot, win));
  };

  const escapeSelector = (value) => {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[\"\\\\]/g, "\\\\$&");
  };

  const missingSlotIds = new Set();
  let missingSlotTimer = null;
  const warnMissingSlot = (id) => {
    if (missingSlotIds.has(id)) return;
    missingSlotIds.add(id);
    if (missingSlotTimer) return;
    missingSlotTimer = setTimeout(() => {
      if (missingSlotIds.size) {
        console.warn("preview slot root not found", Array.from(missingSlotIds));
        missingSlotIds.clear();
      }
      missingSlotTimer = null;
    }, 250);
  };

  const applySlotPatches = (slotPatches) => {
    if (!slotPatches) return;
    const root = getPreviewDocument();
    const win = getPreviewWindow();
    Object.entries(slotPatches).forEach(([id, html]) => {
      const selector = '[data-flux-id="' + escapeSelector(id) + '"]';
      const slot = root.querySelector(selector);
      if (!slot) {
        warnMissingSlot(id);
        return;
      }
      const inner = slot.querySelector("[data-flux-slot-inner]");
      if (!inner) {
        warnMissingSlot(id);
        return;
      }
      inner.innerHTML = html || "";
      applyAssets(inner);
      requestAnimationFrame(() => applyFit(slot, win));
    });
  };

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

  const showError = (errors) => {
    const list = errors.map((err) => "<li>" + escapeHtml(err) + "</li>").join("");
    docRoot.innerHTML =
      '<div class="viewer-error"><h2>Flux document error</h2><ul>' +
      list +
      "</ul></div>";
  };

  const updateStatus = (payload) => {
    if (!statusEl || !payload) return;
    const docstep = typeof payload.docstep === "number" ? payload.docstep : 0;
    const time = typeof payload.time === "number" ? payload.time : 0;
    statusEl.textContent = "Live: docstep " + docstep + " · t=" + time.toFixed(2);
  };

  const applyPatchPayload = (payload) => {
    if (!payload) return;
    if (payload.errors) {
      showError(payload.errors);
      return;
    }
    updateStatus(payload);
    if (payload.slotPatches) {
      applySlotPatches(payload.slotPatches);
    }
  };

  const loadInitial = async () => {
    const config = await fetchJson("/api/config");
    running = config.running;
    intervalInput.value = String(config.docstepMs);
    toggleBtn.textContent = running ? "Pause" : "Start";

    const render = await fetchJson("/api/render");
    docRoot.innerHTML = render.html;
    const root = getPreviewDocument();
    const win = getPreviewWindow();
    applyAssets(root);
    requestAnimationFrame(() => applyFits(root, win));
    updateStatus(render);
  };

  const poll = async () => {
    try {
      const payload = await fetchJson("/api/patches", { cache: "no-store" });
      applyPatchPayload(payload);
    } catch (err) {
      console.warn("poll failed", err);
    }
  };

  const startPolling = (interval = 250) => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, interval);
  };

  const startSse = () => {
    if (typeof EventSource === "undefined") {
      startPolling();
      return;
    }
    if (sse) sse.close();
    sse = new EventSource("/api/stream");
    sse.onopen = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    sse.addEventListener("doc-changed", () => {
      loadInitial().catch((err) => {
        console.warn("doc reload failed", err);
      });
    });
    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        applyPatchPayload(payload);
      } catch (err) {
        console.warn("stream parse failed", err);
      }
    };
    sse.onerror = () => {
      if (!pollTimer) startPolling();
    };
  };

  toggleBtn.addEventListener("click", async () => {
    running = !running;
    toggleBtn.textContent = running ? "Pause" : "Start";
    await fetchJson("/api/ticker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ running }),
    });
  });

  intervalInput.addEventListener("change", async () => {
    const value = Number(intervalInput.value);
    if (!Number.isFinite(value)) return;
    await fetchJson("/api/ticker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docstepMs: value }),
    });
  });

  exportBtn.addEventListener("click", () => {
    window.open("/api/pdf", "_blank");
  });

  loadInitial().then(startSse);
})();
`.trim();
}
function applyCsp(res) {
    res.setHeader("Content-Security-Policy", [
        "default-src 'self'",
        "img-src 'self' data:",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'self'",
    ].join("; "));
}
function sendJson(res, payload) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", ...noCacheHeaders() });
    res.end(JSON.stringify(payload));
}
async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
    }
    if (!chunks.length)
        return null;
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function resolveAssetPath(ir, id, docRoot) {
    const asset = ir.assets.find((entry) => entry.id === id);
    if (!asset || !asset.path)
        return null;
    if (path.isAbsolute(asset.path))
        return asset.path;
    return path.resolve(docRoot, asset.path);
}
function isWithin(root, target) {
    const rel = path.relative(root, target);
    return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}
function isWithinOrEqual(root, target) {
    const rel = path.relative(root, target);
    if (rel === "")
        return true;
    return !rel.startsWith("..") && !path.isAbsolute(rel);
}
async function resolveStaticPath(root, target) {
    if (!isWithinOrEqual(root, target))
        return null;
    try {
        const stat = await fs.stat(target);
        if (stat.isFile())
            return target;
    }
    catch {
        return null;
    }
    return null;
}
async function serveFile(res, filePath, headers = {}) {
    const stat = await fs.stat(filePath);
    res.writeHead(200, {
        "Content-Type": guessMime(filePath),
        "Content-Length": String(stat.size),
        ...headers,
    });
    const stream = (await import("node:fs")).createReadStream(filePath);
    stream.pipe(res);
}
function guessMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case ".html":
            return "text/html; charset=utf-8";
        case ".css":
            return "text/css; charset=utf-8";
        case ".js":
        case ".mjs":
            return "application/javascript; charset=utf-8";
        case ".json":
        case ".map":
            return "application/json; charset=utf-8";
        case ".txt":
            return "text/plain; charset=utf-8";
        case ".ico":
            return "image/x-icon";
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".gif":
            return "image/gif";
        case ".webp":
            return "image/webp";
        case ".svg":
            return "image/svg+xml";
        case ".woff":
            return "font/woff";
        case ".woff2":
            return "font/woff2";
        case ".ttf":
            return "font/ttf";
        case ".otf":
            return "font/otf";
        default:
            return "application/octet-stream";
    }
}
async function resolveRawAsset(raw, docRoot, allowNet) {
    if (!raw)
        return { ok: false, status: 400, message: "Missing src" };
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const url = new URL(raw);
        if (!allowNet.has(url.origin)) {
            return { ok: false, status: 403, message: "Remote origin not allowed" };
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
        try {
            const res = await fetch(raw, { signal: controller.signal });
            if (!res.ok) {
                return { ok: false, status: res.status, message: "Remote fetch failed" };
            }
            const type = res.headers.get("content-type") ?? "";
            if (!type.startsWith("image/") && !type.startsWith("font/")) {
                return { ok: false, status: 415, message: "Unsupported content type" };
            }
            const buffer = await res.arrayBuffer();
            if (buffer.byteLength > MAX_REMOTE_BYTES) {
                return { ok: false, status: 413, message: "Remote asset too large" };
            }
            return { ok: true, type: "remote", bytes: buffer, contentType: type };
        }
        finally {
            clearTimeout(timer);
        }
    }
    if (raw.startsWith("file://")) {
        return { ok: false, status: 403, message: "File scheme not allowed" };
    }
    const resolved = path.resolve(docRoot, raw);
    if (!isWithin(docRoot, resolved)) {
        return { ok: false, status: 403, message: "Forbidden" };
    }
    return { ok: true, type: "local", path: resolved };
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function buildEmptyIR() {
    return {
        meta: { version: "0.2.0" },
        seed: 0,
        time: 0,
        docstep: 0,
        assets: [],
        body: [],
    };
}
function buildPreviewHtml(state) {
    const content = state.errors.length ? buildErrorHtml(state.errors) : state.render.html;
    return [
        "<!doctype html>",
        "<html>",
        "<head>",
        '<meta charset="utf-8">',
        "<title>Flux Preview</title>",
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<link rel="stylesheet" href="/render.css">',
        "<style>",
        "  body { margin: 0; background: #111827; color: #f8fafc; }",
        "  .preview-shell { min-height: 100vh; padding: 24px 20px 40px; display: flex; justify-content: center; }",
        "  .preview-shell .flux-doc { max-width: 100%; }",
        "  .preview-shell .flux-page { margin-bottom: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.35); }",
        "  @media (max-width: 900px) { .preview-shell { padding: 16px; } }",
        "</style>",
        "</head>",
        "<body>",
        `<div class="preview-shell">${content}</div>`,
        '<script src="/preview.js" defer></script>',
        "</body>",
        "</html>",
    ].join("\n");
}
function getPreviewJs() {
    return `
(() => {
  const fitsWithin = (container, inner) => inner.scrollWidth <= container.clientWidth && inner.scrollHeight <= container.clientHeight;

  const applyFit = (slot) => {
    const fit = slot.getAttribute("data-flux-fit");
    const inner = slot.querySelector("[data-flux-slot-inner]");
    if (!inner) return;
    const isInline = slot.getAttribute("data-flux-inline") === "true";
    inner.style.transform = "";
    inner.style.fontSize = "";
    inner.style.whiteSpace = "";
    inner.style.textOverflow = "";
    inner.style.webkitLineClamp = "";
    inner.style.webkitBoxOrient = "";
    inner.style.display = "";

    if (fit === "shrink") {
      const style = window.getComputedStyle(inner);
      const base = parseFloat(style.fontSize) || 14;
      let lo = 6;
      let hi = base;
      let best = base;
      for (let i = 0; i < 10; i += 1) {
        const mid = (lo + hi) / 2;
        inner.style.fontSize = mid + "px";
        if (fitsWithin(slot, inner)) {
          best = mid;
          lo = mid + 0.1;
        } else {
          hi = mid - 0.1;
        }
      }
      inner.style.fontSize = best + "px";
    } else if (fit === "scaleDown") {
      inner.style.transformOrigin = "top left";
      const scaleX = slot.clientWidth / inner.scrollWidth;
      const scaleY = slot.clientHeight / inner.scrollHeight;
      const scale = Math.min(1, scaleX, scaleY);
      inner.style.transform = "scale(" + scale + ")";
    } else if (fit === "ellipsis") {
      if (isInline) {
        inner.style.display = "inline-block";
        inner.style.whiteSpace = "nowrap";
        inner.style.textOverflow = "ellipsis";
        inner.style.overflow = "hidden";
      } else {
        const lineHeight = parseFloat(window.getComputedStyle(inner).lineHeight) || 16;
        const maxLines = Math.max(1, Math.floor(slot.clientHeight / lineHeight));
        inner.style.display = "-webkit-box";
        inner.style.webkitBoxOrient = "vertical";
        inner.style.webkitLineClamp = String(maxLines);
        inner.style.overflow = "hidden";
      }
    }
  };

  const applyFits = () => {
    document.querySelectorAll("[data-flux-fit]").forEach((slot) => applyFit(slot));
  };

  window.addEventListener("load", () => {
    requestAnimationFrame(applyFits);
  });
})();
`.trim();
}
function buildErrorHtml(errors) {
    const items = errors.map((err) => `<li>${escapeHtml(err)}</li>`).join("");
    return [
        `<main class="flux-doc">`,
        `<section class="flux-page">`,
        `<div class="flux-page-inner">`,
        `<h2>Flux document error</h2>`,
        `<ul>${items}</ul>`,
        `</div>`,
        `</section>`,
        `</main>`,
    ].join("");
}
function deriveOutlineLabel(node) {
    if (node.kind === "figure") {
        const label = getLiteralString(node.props?.label);
        if (label && label.trim())
            return label;
    }
    const content = findFirstTextContent(node);
    if (content)
        return content;
    return node.id;
}
function findFirstTextContent(node) {
    if (node.kind === "text") {
        const content = getLiteralString(node.props?.content);
        if (content && content.trim())
            return content;
    }
    for (const child of node.children ?? []) {
        const content = findFirstTextContent(child);
        if (content)
            return content;
    }
    return null;
}
function getLiteralString(value) {
    if (!value || value.kind !== "LiteralValue")
        return null;
    return typeof value.value === "string" ? value.value : null;
}
function buildDiagnosticsBundle(items) {
    const summary = { pass: 0, warn: 0, fail: 0 };
    for (const item of items) {
        summary[item.level] += 1;
    }
    return { summary, items };
}
function buildDiagnosticFromMessage(message, source, fallbackFile, level = "fail") {
    let file = fallbackFile;
    let line = null;
    let column = null;
    let endLine = null;
    let endColumn = null;
    let detail = message;
    const checkMatch = message.match(/^(.*?):(\d+):(\d+):\s*(.*)$/);
    if (checkMatch) {
        file = checkMatch[1];
        line = Number(checkMatch[2]);
        column = Number(checkMatch[3]);
        detail = checkMatch[4];
    }
    const parseMatch = message.match(/Parse error at (\d+):(\d+) near '([^']*)':\s*(.*)$/);
    if (parseMatch) {
        line = Number(parseMatch[1]);
        column = Number(parseMatch[2]);
        detail = `Parse error near '${parseMatch[3]}': ${parseMatch[4]}`;
    }
    const lexMatch = message.match(/Lexer error at (\d+):(\d+)\s*-\s*(.*)$/);
    if (lexMatch) {
        line = Number(lexMatch[1]);
        column = Number(lexMatch[2]);
        detail = `Lexer error: ${lexMatch[3]}`;
    }
    if (line != null && column != null) {
        return buildDiagnosticFromSpan({ level, message: detail, file }, source, { line, column, endLine, endColumn });
    }
    if (source.trim().length) {
        return buildDiagnosticFromSpan({ level, message: detail, file }, source, { line: 1, column: 1 });
    }
    return { level, message: detail, file, location: file };
}
function buildDiagnosticFromSpan(base, source, span) {
    const startLine = Math.max(1, span.line);
    const startColumn = Math.max(1, span.column);
    const endLine = Math.max(startLine, span.endLine ?? span.line);
    const endColumn = Math.max(startColumn + 1, span.endColumn ?? startColumn + 1);
    const range = {
        start: {
            line: startLine,
            column: startColumn,
            offset: lineColumnToOffset(source, startLine, startColumn),
        },
        end: {
            line: endLine,
            column: endColumn,
            offset: lineColumnToOffset(source, endLine, endColumn),
        },
    };
    const excerpt = buildExcerpt(source, startLine, startColumn, endLine, endColumn);
    const location = base.file
        ? `${base.file}:${startLine}:${startColumn}-${endLine}:${endColumn}`
        : `${startLine}:${startColumn}-${endLine}:${endColumn}`;
    return { ...base, range, excerpt, location };
}
function buildExcerpt(source, line, column, endLine, endColumn) {
    const lines = source.split("\n");
    const lineIndex = Math.max(1, Math.min(line, lines.length));
    const textLine = lines[lineIndex - 1] ?? "";
    const startCol = Math.max(1, Math.min(column, textLine.length + 1));
    const endCol = endLine === lineIndex ? Math.max(startCol + 1, Math.min(endColumn, textLine.length + 1)) : textLine.length + 1;
    const caretLength = Math.max(1, endCol - startCol);
    const caret = `${" ".repeat(Math.max(0, startCol - 1))}${"^".repeat(caretLength)}`;
    return { line: lineIndex, text: textLine, caret };
}
function lineColumnToOffset(source, line, column) {
    const lines = source.split("\n");
    const clampedLine = Math.max(1, Math.min(line, lines.length));
    let offset = 0;
    for (let i = 0; i < clampedLine - 1; i += 1) {
        offset += lines[i].length + 1;
    }
    const colIndex = Math.max(1, column) - 1;
    return offset + colIndex;
}
function offsetToLineColumn(source, offset) {
    const lines = source.split("\n");
    let remaining = Math.max(0, offset);
    for (let i = 0; i < lines.length; i += 1) {
        const lineLength = lines[i].length + 1;
        if (remaining < lineLength) {
            return { line: i + 1, column: remaining + 1 };
        }
        remaining -= lineLength;
    }
    const lastLine = Math.max(1, lines.length);
    return { line: lastLine, column: (lines[lastLine - 1]?.length ?? 0) + 1 };
}
function findNodeById(nodes, id) {
    for (const node of nodes ?? []) {
        if (node.id === id)
            return node;
        const child = findNodeById(node.children ?? [], id);
        if (child)
            return child;
    }
    return null;
}
function buildInspectorPayload(node) {
    const content = getLiteralString(node.props?.content);
    const isEditable = node.kind === "text" && content != null && (!node.children || node.children.length === 0);
    const style = getLiteralString(node.props?.style);
    const role = getLiteralString(node.props?.role);
    const isHeading = Boolean(style && /^H\d/.test(style)) || Boolean(role && ["title", "subtitle", "heading"].includes(role));
    return {
        id: node.id,
        kind: node.kind,
        props: node.props,
        text: content ?? null,
        editable: isEditable,
        textKind: isEditable ? (isHeading ? "heading" : "paragraph") : null,
        childCount: node.children?.length ?? 0,
    };
}
function applySetTextTransform(source, doc, id, text, docPath) {
    if (!id) {
        return {
            ok: false,
            diagnostic: buildDiagnosticFromMessage("Missing node id", source, docPath, "fail"),
        };
    }
    const node = findNodeById(doc.body?.nodes ?? [], id);
    if (!node) {
        const found = findIdInSource(source, id);
        if (found) {
            return {
                ok: false,
                diagnostic: buildDiagnosticFromSpan({
                    level: "fail",
                    message: `Node '${id}' was not found in the document.`,
                    file: docPath,
                    suggestion: "Check the outline for a valid node id.",
                }, source, { line: found.line, column: found.column }),
            };
        }
        return {
            ok: false,
            diagnostic: {
                level: "fail",
                message: `Node '${id}' was not found in the document.`,
                file: docPath,
                suggestion: "Check the outline for a valid node id.",
                location: docPath,
            },
        };
    }
    if (node.kind !== "text") {
        return {
            ok: false,
            diagnostic: buildDiagnosticFromNode(node, source, docPath, `Only text nodes can be edited in Phase 1 (selected ${node.kind}).`),
        };
    }
    if (node.children && node.children.length > 0) {
        return {
            ok: false,
            diagnostic: buildDiagnosticFromNode(node, source, docPath, "Rich text nodes with inline children are not editable yet."),
        };
    }
    const content = getLiteralString(node.props?.content);
    if (content == null) {
        return {
            ok: false,
            diagnostic: buildDiagnosticFromNode(node, source, docPath, "Text nodes without a literal content value cannot be edited yet."),
        };
    }
    const loc = node.loc;
    if (!loc?.line || !loc?.column || !loc.endLine || !loc.endColumn) {
        return {
            ok: false,
            diagnostic: buildDiagnosticFromMessage(`Missing source span for node '${id}'.`, source, docPath, "fail"),
        };
    }
    const startIndex = lineColumnToOffset(source, loc.line, loc.column);
    const endIndex = lineColumnToOffset(source, loc.endLine, loc.endColumn);
    const block = source.slice(startIndex, endIndex);
    const updatedBlock = replaceContentLiteral(block, text);
    if (!updatedBlock) {
        return {
            ok: false,
            diagnostic: buildDiagnosticFromNode(node, source, docPath, "Unable to locate content property for this node."),
        };
    }
    const nextSource = source.slice(0, startIndex) + updatedBlock + source.slice(endIndex);
    return { ok: true, source: nextSource };
}
function replaceContentLiteral(block, text) {
    const contentRegex = /(content\s*=\s*)(\"(?:\\.|[^"])*\"|'(?:\\.|[^'])*')/s;
    if (!contentRegex.test(block))
        return null;
    const escaped = escapeStringLiteral(text);
    return block.replace(contentRegex, `$1"${escaped}"`);
}
function escapeStringLiteral(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
function buildDiagnosticFromNode(node, source, docPath, message, suggestion) {
    const loc = node.loc;
    if (!loc?.line || !loc?.column) {
        return {
            level: "fail",
            message,
            file: docPath,
            suggestion,
            location: docPath,
            nodeId: node.id,
        };
    }
    return buildDiagnosticFromSpan({ level: "fail", message, file: docPath, suggestion, nodeId: node.id }, source, { line: loc.line, column: loc.column, endLine: loc.endLine, endColumn: loc.endColumn });
}
function findIdInSource(source, id) {
    if (!id)
        return null;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`);
    const match = regex.exec(source);
    if (!match || match.index == null)
        return null;
    return offsetToLineColumn(source, match.index);
}
async function writeFileAtomic(filePath, contents) {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const tempPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(tempPath, contents, "utf8");
    await fs.rename(tempPath, filePath);
}
//# sourceMappingURL=index.js.map