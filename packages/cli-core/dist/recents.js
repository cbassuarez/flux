import path from "node:path";
import { ensureDir, fallbackStatePath, findGitRoot, readJsonFile, repoStatePath, writeJsonFile } from "./fs.js";
export async function getRecentsStore(cwd) {
    const repoRoot = await findGitRoot(cwd);
    const baseDir = repoRoot ? repoStatePath(repoRoot) : fallbackStatePath(cwd);
    const storePath = path.join(baseDir, "recents.json");
    const entries = (await readJsonFile(storePath)) ?? [];
    return {
        entries: Array.isArray(entries) ? entries : [],
        storePath,
        repoRoot,
        fallback: !repoRoot,
    };
}
export async function updateRecents(cwd, docPath) {
    const store = await getRecentsStore(cwd);
    const now = new Date().toISOString();
    const normalized = path.resolve(docPath);
    const next = [
        { path: normalized, lastOpened: now },
        ...store.entries.filter((entry) => path.resolve(entry.path) !== normalized),
    ].slice(0, 2);
    await ensureDir(path.dirname(store.storePath));
    await writeJsonFile(store.storePath, next);
    return { ...store, entries: next };
}
//# sourceMappingURL=recents.js.map