import fs from "node:fs/promises";
import path from "node:path";

export type WorkspacePackage = {
  name: string;
  dir: string;
  private: boolean;
  version?: string;
};

const ROOT = process.cwd();

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function resolveWorkspaceDirs(patterns: string[]): Promise<string[]> {
  const dirs = new Set<string>();
  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      const base = path.resolve(ROOT, pattern.slice(0, -2));
      const entries = await fs.readdir(base, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirs.add(path.join(base, entry.name));
        }
      }
      continue;
    }
    dirs.add(path.resolve(ROOT, pattern));
  }
  return Array.from(dirs);
}

export async function getPublishablePackages(): Promise<WorkspacePackage[]> {
  const rootPackage = await readJson<{ workspaces?: string[] }>(path.join(ROOT, "package.json"));
  const workspacePatterns = rootPackage.workspaces ?? [];
  const workspaceDirs = await resolveWorkspaceDirs(workspacePatterns);

  const packages: WorkspacePackage[] = [];
  for (const dir of workspaceDirs) {
    const pkgPath = path.join(dir, "package.json");
    try {
      const pkg = await readJson<{ name?: string; private?: boolean; version?: string }>(pkgPath);
      if (!pkg.name) continue;
      packages.push({ name: pkg.name, dir, private: Boolean(pkg.private), version: pkg.version });
    } catch {
      // ignore non-packages
    }
  }

  return packages.filter((pkg) => !pkg.private);
}
