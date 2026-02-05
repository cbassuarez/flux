import path from "node:path";
import { ensureDir, fallbackStatePath, findGitRoot, readJsonFile, repoStatePath, writeJsonFile } from "./fs.js";
const MAX_PINNED = 5;
export async function getPinnedDirsStore(cwd) {
    const repoRoot = await findGitRoot(cwd);
    const baseDir = repoRoot ? repoStatePath(repoRoot) : fallbackStatePath(cwd);
    const storePath = path.join(baseDir, "pinned-dirs.json");
    const entries = (await readJsonFile(storePath)) ?? [];
    return {
        entries: Array.isArray(entries) ? entries : [],
        storePath,
        repoRoot,
        fallback: !repoRoot,
    };
}
export async function addPinnedDir(cwd, dir, maxEntries = MAX_PINNED) {
    const store = await getPinnedDirsStore(cwd);
    const normalized = path.resolve(dir);
    const next = [normalized, ...store.entries.filter((entry) => path.resolve(entry) !== normalized)]
        .slice(0, Math.max(1, maxEntries));
    await ensureDir(path.dirname(store.storePath));
    await writeJsonFile(store.storePath, next);
    return { ...store, entries: next };
}
export async function removePinnedDir(cwd, dir) {
    const store = await getPinnedDirsStore(cwd);
    const normalized = path.resolve(dir);
    const next = store.entries.filter((entry) => path.resolve(entry) !== normalized);
    await ensureDir(path.dirname(store.storePath));
    await writeJsonFile(store.storePath, next);
    return { ...store, entries: next };
}
export async function togglePinnedDir(cwd, dir, maxEntries = MAX_PINNED) {
    const store = await getPinnedDirsStore(cwd);
    const normalized = path.resolve(dir);
    if (store.entries.some((entry) => path.resolve(entry) === normalized)) {
        return removePinnedDir(cwd, normalized);
    }
    return addPinnedDir(cwd, normalized, maxEntries);
}
export function isPinnedDir(store, dir) {
    const normalized = path.resolve(dir);
    return store.entries.some((entry) => path.resolve(entry) === normalized);
}
//# sourceMappingURL=pinned.js.map