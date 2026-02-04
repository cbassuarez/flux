import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  parseDocument,
  checkDocument,
  createDocumentRuntimeIR,
  type RenderDocumentIR,
} from "@flux-lang/core";
import { renderHtml, type RenderHtmlResult } from "@flux-lang/render-html";
import { createTypesetterBackend } from "@flux-lang/typesetter";

export interface ViewerServerOptions {
  docPath: string;
  port?: number;
  docstepMs?: number;
  seed?: number;
  allowNet?: string[];
  docstepStart?: number;
}

export interface ViewerServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

interface ViewerState {
  docPath: string;
  docRoot: string;
  ir: RenderDocumentIR;
  render: RenderHtmlResult;
  errors: string[];
}

const DEFAULT_DOCSTEP_MS = 1000;
const MAX_REMOTE_BYTES = 8 * 1024 * 1024;
const REMOTE_TIMEOUT_MS = 5000;

export async function startViewerServer(options: ViewerServerOptions): Promise<ViewerServer> {
  const docPath = path.resolve(options.docPath);
  const docRoot = path.dirname(docPath);
  const source = await fs.readFile(docPath, "utf8");
  let doc: ReturnType<typeof parseDocument> | null = null;
  let errors: string[] = [];
  try {
    doc = parseDocument(source);
    errors = checkDocument(docPath, doc);
  } catch (err) {
    errors = [String((err as Error)?.message ?? err)];
  }

  const runtime = doc
    ? createDocumentRuntimeIR(doc, {
        seed: options.seed ?? 0,
        docstep: options.docstepStart ?? 0,
        assetCwd: docRoot,
      })
    : null;

  const initialIr = runtime ? runtime.render() : buildEmptyIR();
  const renderOptions = {
    assetUrl: (assetId: string) => `/assets/${encodeURIComponent(assetId)}`,
    rawUrl: (raw: string) => `/asset?src=${encodeURIComponent(raw)}`,
  };

  let current: ViewerState = {
    docPath,
    docRoot,
    ir: initialIr,
    render: renderHtml(initialIr, renderOptions),
    errors,
  };

  let running = runtime !== null && errors.length === 0;
  let intervalMs = options.docstepMs ?? DEFAULT_DOCSTEP_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let nextTickAt = Date.now() + intervalMs;

  const tick = (): void => {
    if (!running) return;
    if (!runtime) return;
    const nextIr = runtime.step(1);
    current = {
      ...current,
      ir: nextIr,
      render: renderHtml(nextIr, renderOptions),
    };
    nextTickAt += intervalMs;
    scheduleTick();
  };

  const scheduleTick = (): void => {
    if (!running) return;
    if (timer) clearTimeout(timer);
    const delay = Math.max(0, nextTickAt - Date.now());
    timer = setTimeout(tick, delay);
  };

  const stopTicking = (): void => {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const startTicking = (): void => {
    if (!runtime || current.errors.length) return;
    if (running) return;
    running = true;
    nextTickAt = Date.now() + intervalMs;
    scheduleTick();
  };

  scheduleTick();

  const allowNet = new Set((options.allowNet ?? []).map((origin) => origin.trim()).filter(Boolean));

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      applyCsp(res);

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

      if (url.pathname === "/api/config") {
        sendJson(res, {
          docPath,
          docstepMs: intervalMs,
          running,
        });
        return;
      }

      if (url.pathname === "/api/render") {
        if (current.errors.length) {
          sendJson(res, {
            html: buildErrorHtml(current.errors),
            docstep: current.ir.docstep,
            errors: current.errors,
          });
        } else {
          sendJson(res, {
            html: current.render.html,
            docstep: current.ir.docstep,
          });
        }
        return;
      }

      if (url.pathname === "/api/ir") {
        if (current.errors.length) {
          sendJson(res, { errors: current.errors });
        } else {
          sendJson(res, {
            ir: current.ir,
            slots: current.render.slots,
          });
        }
        return;
      }

      if (url.pathname === "/api/ticker" && req.method === "POST") {
        const payload = await readJson(req);
        if (typeof payload?.docstepMs === "number" && Number.isFinite(payload.docstepMs)) {
          intervalMs = Math.max(50, payload.docstepMs);
          if (running) {
            nextTickAt = Date.now() + intervalMs;
            scheduleTick();
          }
        }
        if (typeof payload?.running === "boolean") {
          if (payload.running) startTicking();
          else stopTicking();
        }
        sendJson(res, { ok: true, running, docstepMs: intervalMs });
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
          baseUrl: `http://localhost:${(server.address() as any).port}`,
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
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(String((err as Error)?.message ?? err));
    }
  });

  const port = options.port ?? 0;
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start viewer server");
  }

  return {
    port: address.port,
    url: `http://localhost:${address.port}`,
    close: async () => {
      stopTicking();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function buildIndexHtml(title: string): string {
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
    "    <div class=\"viewer-title\">Flux Viewer</div>",
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

function getViewerCss(): string {
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

.viewer-title {
  font-size: 14px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #cdbf9f;
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

function getViewerJs(): string {
  return `
(() => {
  const docRoot = document.getElementById("viewer-doc");
  const toggleBtn = document.getElementById("viewer-toggle");
  const intervalInput = document.getElementById("viewer-interval");
  const exportBtn = document.getElementById("viewer-export");

  let currentIr = null;
  let currentSlots = {};
  let running = true;
  let pollTimer = null;

  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
  };

  const applyAssets = (root = document) => {
    root.querySelectorAll("img[data-flux-asset-id]").forEach((img) => {
      const id = img.getAttribute("data-flux-asset-id");
      if (id) img.src = "/assets/" + id;
    });
    root.querySelectorAll("img[data-flux-src]").forEach((img) => {
      const raw = img.getAttribute("data-flux-src");
      if (raw) img.src = "/asset?src=" + encodeURIComponent(raw);
    });
  };

  const collectSlots = (node, map = new Map()) => {
    if (!node) return map;
    if (node.kind === "slot" || node.kind === "inline_slot") {
      map.set(node.nodeId, JSON.stringify(node));
    }
    (node.children || []).forEach((child) => collectSlots(child, map));
    return map;
  };

  const diffSlots = (prev, next) => {
    const changed = [];
    next.forEach((hash, id) => {
      if (prev.get(id) !== hash) changed.push(id);
    });
    return changed;
  };

  const fitsWithin = (container, inner) => {
    return inner.scrollWidth <= container.clientWidth && inner.scrollHeight <= container.clientHeight;
  };

  const applyFit = (slot) => {
    const fit = slot.getAttribute("data-flux-fit");
    const inner = slot.querySelector(".flux-slot-inner");
    if (!inner) return;
    inner.style.transform = "";
    inner.style.fontSize = "";
    if (fit === "shrink") {
      const style = window.getComputedStyle(inner);
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
      const lineHeight = parseFloat(window.getComputedStyle(inner).lineHeight) || 16;
      const maxLines = Math.max(1, Math.floor(slot.clientHeight / lineHeight));
      inner.style.display = "-webkit-box";
      inner.style.webkitBoxOrient = "vertical";
      inner.style.webkitLineClamp = String(maxLines);
      inner.style.overflow = "hidden";
    }
  };

  const applyFits = (root = document) => {
    root.querySelectorAll("[data-flux-fit]").forEach((slot) => applyFit(slot));
  };

  const patchSlots = (slots, changedIds) => {
    changedIds.forEach((id) => {
      const slot = document.querySelector('[data-flux-id="' + id + '"]');
      if (!slot) return;
      const inner = slot.querySelector(".flux-slot-inner");
      if (!inner) return;
      inner.innerHTML = slots[id] || "";
      applyAssets(inner);
      requestAnimationFrame(() => applyFit(slot));
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

  const loadInitial = async () => {
    const config = await fetchJson("/api/config");
    running = config.running;
    intervalInput.value = String(config.docstepMs);
    toggleBtn.textContent = running ? "Pause" : "Start";

    const render = await fetchJson("/api/render");
    docRoot.innerHTML = render.html;
    applyAssets(docRoot);
    requestAnimationFrame(() => applyFits(docRoot));

    const irPayload = await fetchJson("/api/ir");
    if (irPayload.errors) {
      showError(irPayload.errors);
      return;
    }
    currentIr = irPayload.ir;
    currentSlots = irPayload.slots || {};
  };

  const poll = async () => {
    try {
      const payload = await fetchJson("/api/ir");
      if (payload.errors) {
        showError(payload.errors);
        return;
      }
      if (!currentIr) {
        currentIr = payload.ir;
        currentSlots = payload.slots || {};
        return;
      }
      const prevMap = collectSlots(currentIr);
      const nextMap = collectSlots(payload.ir);
      const changed = diffSlots(prevMap, nextMap);
      if (changed.length) {
        patchSlots(payload.slots || {}, changed);
      }
      currentIr = payload.ir;
      currentSlots = payload.slots || {};
    } catch (err) {
      console.warn("poll failed", err);
    }
  };

  const startPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, 500);
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

  loadInitial().then(startPolling);
})();
`.trim();
}

function applyCsp(res: http.ServerResponse): void {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
}

function sendJson(res: http.ServerResponse, payload: unknown): void {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function resolveAssetPath(ir: RenderDocumentIR, id: string, docRoot: string): string | null {
  const asset = ir.assets.find((entry) => entry.id === id);
  if (!asset || !asset.path) return null;
  if (path.isAbsolute(asset.path)) return asset.path;
  return path.resolve(docRoot, asset.path);
}

function isWithin(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function serveFile(res: http.ServerResponse, filePath: string): Promise<void> {
  const stat = await fs.stat(filePath);
  res.writeHead(200, {
    "Content-Type": guessMime(filePath),
    "Content-Length": String(stat.size),
  });
  const stream = (await import("node:fs")).createReadStream(filePath);
  stream.pipe(res);
}

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
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

async function resolveRawAsset(
  raw: string,
  docRoot: string,
  allowNet: Set<string>,
): Promise<
  | { ok: true; type: "local"; path: string }
  | { ok: true; type: "remote"; bytes: ArrayBuffer; contentType: string }
  | { ok: false; status: number; message: string }
> {
  if (!raw) return { ok: false, status: 400, message: "Missing src" };
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
    } finally {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmptyIR(): RenderDocumentIR {
  return {
    meta: { version: "0.2.0" },
    seed: 0,
    time: 0,
    docstep: 0,
    assets: [],
    body: [],
  };
}

function buildErrorHtml(errors: string[]): string {
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
