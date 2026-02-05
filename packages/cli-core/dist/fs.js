import fs from "node:fs/promises";
import path from "node:path";
export async function readFileText(filePath) {
    return fs.readFile(filePath, "utf8");
}
export async function writeFileText(filePath, text) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, text, "utf8");
}
export async function readJsonFile(filePath) {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        return JSON.parse(raw);
    }
    catch (err) {
        if (err.code === "ENOENT")
            return null;
        throw err;
    }
}
export async function writeJsonFile(filePath, value) {
    const json = JSON.stringify(value, null, 2) + "\n";
    await writeFileText(filePath, json);
}
export async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
export async function findGitRoot(startDir) {
    let current = path.resolve(startDir);
    while (true) {
        const gitPath = path.join(current, ".git");
        if (await pathExists(gitPath)) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return null;
}
export async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
export function repoStatePath(repoRoot) {
    return path.join(repoRoot, ".git", "flux");
}
export function fallbackStatePath(cwd) {
    return path.join(cwd, ".flux");
}
//# sourceMappingURL=fs.js.map