import path from "node:path";
import { ensureDir, fallbackStatePath, findGitRoot, readJsonFile, repoStatePath, writeJsonFile } from "./fs.js";

export interface PinnedDirsStore {
  entries: string[];
  storePath: string;
  repoRoot: string | null;
  fallback: boolean;
}

const MAX_PINNED = 5;

export async function getPinnedDirsStore(cwd: string): Promise<PinnedDirsStore> {
  const repoRoot = await findGitRoot(cwd);
  const baseDir = repoRoot ? repoStatePath(repoRoot) : fallbackStatePath(cwd);
  const storePath = path.join(baseDir, "pinned-dirs.json");
  const entries = (await readJsonFile<string[]>(storePath)) ?? [];
  return {
    entries: Array.isArray(entries) ? entries : [],
    storePath,
    repoRoot,
    fallback: !repoRoot,
  };
}

export async function addPinnedDir(cwd: string, dir: string, maxEntries = MAX_PINNED): Promise<PinnedDirsStore> {
  const store = await getPinnedDirsStore(cwd);
  const normalized = path.resolve(dir);
  const next = [normalized, ...store.entries.filter((entry) => path.resolve(entry) !== normalized)]
    .slice(0, Math.max(1, maxEntries));
  await ensureDir(path.dirname(store.storePath));
  await writeJsonFile(store.storePath, next);
  return { ...store, entries: next };
}

export async function removePinnedDir(cwd: string, dir: string): Promise<PinnedDirsStore> {
  const store = await getPinnedDirsStore(cwd);
  const normalized = path.resolve(dir);
  const next = store.entries.filter((entry) => path.resolve(entry) !== normalized);
  await ensureDir(path.dirname(store.storePath));
  await writeJsonFile(store.storePath, next);
  return { ...store, entries: next };
}

export async function togglePinnedDir(cwd: string, dir: string, maxEntries = MAX_PINNED): Promise<PinnedDirsStore> {
  const store = await getPinnedDirsStore(cwd);
  const normalized = path.resolve(dir);
  if (store.entries.some((entry) => path.resolve(entry) === normalized)) {
    return removePinnedDir(cwd, normalized);
  }
  return addPinnedDir(cwd, normalized, maxEntries);
}

export function isPinnedDir(store: PinnedDirsStore, dir: string): boolean {
  const normalized = path.resolve(dir);
  return store.entries.some((entry) => path.resolve(entry) === normalized);
}
