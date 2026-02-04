import path from "node:path";
import { startViewerServer, type ViewerServer, type ViewerServerOptions } from "@flux-lang/viewer";
import { ensureDir, fallbackStatePath, findGitRoot, readJsonFile, writeJsonFile } from "../fs.js";

export interface ViewerRegistryEntry {
  docPath: string;
  url: string;
  port: number;
  pid?: number;
  startedAt: string;
  lastSeen: string;
}

export interface ViewerRegistry {
  entries: ViewerRegistryEntry[];
  filePath: string;
  repoRoot: string | null;
  fallback: boolean;
}

export interface ViewerSession {
  docPath: string;
  url: string;
  port: number;
  attached: boolean;
  server?: ViewerServer;
  close?: () => Promise<void>;
}

export interface ViewerStartOptions extends ViewerServerOptions {
  cwd: string;
}

const REGISTRY_FILE = "servers.json";

async function getRegistry(cwd: string): Promise<ViewerRegistry> {
  const repoRoot = await findGitRoot(cwd);
  const baseDir = repoRoot ? path.join(repoRoot, ".git", "flux") : fallbackStatePath(cwd);
  const filePath = path.join(baseDir, REGISTRY_FILE);
  const entries = (await readJsonFile<ViewerRegistryEntry[]>(filePath)) ?? [];
  return {
    entries: Array.isArray(entries) ? entries : [],
    filePath,
    repoRoot,
    fallback: !repoRoot,
  };
}

async function saveRegistry(registry: ViewerRegistry): Promise<void> {
  await ensureDir(path.dirname(registry.filePath));
  await writeJsonFile(registry.filePath, registry.entries);
}

async function probeServer(url: string, timeoutMs = 600): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/api/config`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function attachOrStartViewer(options: ViewerStartOptions): Promise<ViewerSession> {
  const docPath = path.resolve(options.docPath);
  const registry = await getRegistry(options.cwd);
  const now = new Date().toISOString();

  // try attach
  for (const entry of registry.entries) {
    if (path.resolve(entry.docPath) !== docPath) continue;
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
  const entry: ViewerRegistryEntry = {
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

  const close = async (): Promise<void> => {
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

export async function updateViewerTicker(url: string, payload: { running?: boolean; docstepMs?: number }): Promise<boolean> {
  const res = await fetch(`${url}/api/ticker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

export async function updateViewerRuntime(
  url: string,
  payload: { seed?: number; docstep?: number; time?: number },
): Promise<boolean> {
  const res = await fetch(`${url}/api/runtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

export async function fetchViewerStatus(url: string): Promise<any> {
  const res = await fetch(`${url}/api/config`, { cache: "no-store" as RequestCache });
  if (!res.ok) throw new Error(`Viewer status failed: ${res.status}`);
  return res.json();
}

export async function fetchViewerPatch(url: string): Promise<any> {
  const res = await fetch(`${url}/api/patches`, { cache: "no-store" as RequestCache });
  if (!res.ok) throw new Error(`Viewer patch failed: ${res.status}`);
  return res.json();
}

export async function fetchViewerRender(url: string): Promise<any> {
  const res = await fetch(`${url}/api/render`, { cache: "no-store" as RequestCache });
  if (!res.ok) throw new Error(`Viewer render failed: ${res.status}`);
  return res.json();
}

export async function requestViewerPdf(url: string): Promise<Uint8Array> {
  const res = await fetch(`${url}/api/pdf`);
  if (!res.ok) {
    throw new Error(`Viewer PDF failed: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}
