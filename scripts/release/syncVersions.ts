import fs from "node:fs/promises";
import path from "node:path";
import { getPublishablePackages, type WorkspacePackage } from "./workspaces.js";

const INTERNAL_SCOPE = "@flux-lang/";

type PackageJson = {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

function alignDependencyVersion(current: string | undefined, nextVersion: string): string {
  if (!current) return `^${nextVersion}`;
  if (current.startsWith("workspace:")) {
    return `workspace:${nextVersion}`;
  }
  if (current.startsWith("^")) {
    return `^${nextVersion}`;
  }
  if (current.startsWith("~")) {
    return `~${nextVersion}`;
  }
  return nextVersion;
}

function updateDeps(deps: Record<string, string> | undefined, packages: Set<string>, nextVersion: string): boolean {
  if (!deps) return false;
  let changed = false;
  for (const [name, value] of Object.entries(deps)) {
    if (name.startsWith(INTERNAL_SCOPE) && packages.has(name)) {
      const updated = alignDependencyVersion(value, nextVersion);
      if (updated !== value) {
        deps[name] = updated;
        changed = true;
      }
    }
  }
  return changed;
}

async function readPackageJson(dir: string): Promise<PackageJson> {
  const raw = await fs.readFile(path.join(dir, "package.json"), "utf8");
  return JSON.parse(raw) as PackageJson;
}

async function writePackageJson(dir: string, pkg: PackageJson): Promise<void> {
  await fs.writeFile(path.join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

export async function syncVersions(nextVersion: string): Promise<WorkspacePackage[]> {
  const packages = await getPublishablePackages();
  const packageNames = new Set(packages.map((pkg) => pkg.name));

  for (const pkg of packages) {
    const pkgJson = await readPackageJson(pkg.dir);
    pkgJson.version = nextVersion;
    const changed = updateDeps(pkgJson.dependencies, packageNames, nextVersion);
    updateDeps(pkgJson.devDependencies, packageNames, nextVersion);
    updateDeps(pkgJson.peerDependencies, packageNames, nextVersion);
    updateDeps(pkgJson.optionalDependencies, packageNames, nextVersion);
    await writePackageJson(pkg.dir, pkgJson);
    if (changed) {
      // eslint-disable-next-line no-console
      console.log(`[sync] aligned dependencies for ${pkg.name}`);
    }
  }

  return packages;
}

export async function assertVersionsSynced(expectedVersion: string): Promise<void> {
  const packages = await getPublishablePackages();
  for (const pkg of packages) {
    const pkgJson = await readPackageJson(pkg.dir);
    if (pkgJson.version !== expectedVersion) {
      throw new Error(`Package ${pkg.name} has version ${pkgJson.version}, expected ${expectedVersion}.`);
    }
  }
}
