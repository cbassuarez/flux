import path from "node:path";
import { startViewerServer } from "@flux-lang/viewer";
import { ensureDir, fallbackStatePath, findGitRoot, readJsonFile, writeJsonFile } from "../fs.js";
const REGISTRY_FILE = "servers.json";
async function getRegistry(cwd) {
    const repoRoot = await findGitRoot(cwd);
    const baseDir = repoRoot ? path.join(repoRoot, ".git", "flux") : fallbackStatePath(cwd);
    const filePath = path.join(baseDir, REGISTRY_FILE);
    const entries = (await readJsonFile(filePath)) ?? [];
    return {
        entries: Array.isArray(entries) ? entries : [],
        filePath,
        repoRoot,
        fallback: !repoRoot,
    };
}
async function saveRegistry(registry) {
    await ensureDir(path.dirname(registry.filePath));
    await writeJsonFile(registry.filePath, registry.entries);
}
async function probeServer(url, timeoutMs = 600) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${url}/api/config`, { signal: controller.signal });
        return res.ok;
    }
    catch {
        return false;
    }
    finally {
        clearTimeout(timer);
    }
}
export async function attachOrStartViewer(options) {
    const docPath = path.resolve(options.docPath);
    const registry = await getRegistry(options.cwd);
    const now = new Date().toISOString();
    // try attach
    for (const entry of registry.entries) {
        if (path.resolve(entry.docPath) !== docPath)
            continue;
        if (await probeServer(entry.url)) {
            entry.lastSeen = now;
            await saveRegistry(registry);
            return {
                docPath,
                url: entry.url,
                port: entry.port,
                attached: true,
            };
        }
    }
    // start new server
    const server = await startViewerServer(options);
    const entry = {
        docPath,
        url: server.url,
        port: server.port,
        pid: process.pid,
        startedAt: now,
        lastSeen: now,
    };
    const filtered = registry.entries.filter((e) => path.resolve(e.docPath) !== docPath);
    registry.entries = [entry, ...filtered].slice(0, 8);
    await saveRegistry(registry);
    const close = async () => {
        await server.close();
        const nextRegistry = await getRegistry(options.cwd);
        nextRegistry.entries = nextRegistry.entries.filter((e) => e.url !== server.url);
        await saveRegistry(nextRegistry);
    };
    return {
        docPath,
        url: server.url,
        port: server.port,
        attached: false,
        server,
        close,
    };
}
export async function updateViewerTicker(url, payload) {
    const res = await fetch(`${url}/api/ticker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return res.ok;
}
export async function updateViewerRuntime(url, payload) {
    const res = await fetch(`${url}/api/runtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return res.ok;
}
export async function fetchViewerStatus(url) {
    const res = await fetch(`${url}/api/config`, { cache: "no-store" });
    if (!res.ok)
        throw new Error(`Viewer status failed: ${res.status}`);
    return res.json();
}
export async function fetchViewerPatch(url) {
    const res = await fetch(`${url}/api/patches`, { cache: "no-store" });
    if (!res.ok)
        throw new Error(`Viewer patch failed: ${res.status}`);
    return res.json();
}
export async function fetchViewerRender(url) {
    const res = await fetch(`${url}/api/render`, { cache: "no-store" });
    if (!res.ok)
        throw new Error(`Viewer render failed: ${res.status}`);
    return res.json();
}
export async function requestViewerPdf(url) {
    const res = await fetch(`${url}/api/pdf`);
    if (!res.ok) {
        throw new Error(`Viewer PDF failed: ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
}
//# sourceMappingURL=manager.js.map