import fs from "node:fs/promises";
import path from "node:path";

export async function readFileText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function writeFileText(filePath: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf8");
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  const json = JSON.stringify(value, null, 2) + "\n";
  await writeFileText(filePath, json);
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findGitRoot(startDir: string): Promise<string | null> {
  let current = path.resolve(startDir);
  while (true) {
    const gitPath = path.join(current, ".git");
    if (await pathExists(gitPath)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export function repoStatePath(repoRoot: string): string {
  return path.join(repoRoot, ".git", "flux");
}

export function fallbackStatePath(cwd: string): string {
  return path.join(cwd, ".flux");
}
