import path from "node:path";
import { ensureDir, fallbackStatePath, findGitRoot, readJsonFile, repoStatePath, writeJsonFile } from "./fs.js";

export interface LastUsedDirStore {
  dir: string | null;
  storePath: string;
  repoRoot: string | null;
  fallback: boolean;
}

export async function getLastUsedDirStore(cwd: string): Promise<LastUsedDirStore> {
  const repoRoot = await findGitRoot(cwd);
  const baseDir = repoRoot ? repoStatePath(repoRoot) : fallbackStatePath(cwd);
  const storePath = path.join(baseDir, "last-used-dir.json");
  const raw = await readJsonFile<{ dir?: string } | string>(storePath);
  const dir = typeof raw === "string" ? raw : raw?.dir ?? null;
  return {
    dir: dir ? path.resolve(dir) : null,
    storePath,
    repoRoot,
    fallback: !repoRoot,
  };
}

export async function setLastUsedDir(cwd: string, dir: string): Promise<LastUsedDirStore> {
  const store = await getLastUsedDirStore(cwd);
  const normalized = path.resolve(dir);
  await ensureDir(path.dirname(store.storePath));
  await writeJsonFile(store.storePath, { dir: normalized });
  return { ...store, dir: normalized };
}
