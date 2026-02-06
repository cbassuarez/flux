#!/usr/bin/env node
/**
 * Update workspace package versions to a canary build and pin internal deps.
 *
 * - Derives base version from @flux-lang/cli/package.json
 * - Produces ${base}-canary.<shortSha>
 * - Applies to the publish set defined below
 * - Rewrites internal workspace references to exact canary version
 * - Does NOT touch lockfiles
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const publishSet = [
  "@flux-lang/cli",
  "@flux-lang/cli-core",
  "@flux-lang/viewer",
  "@flux-lang/flux",
];

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  const next = JSON.stringify(data, null, 2) + "\n";
  await fs.writeFile(filePath, next, "utf8");
}

function shortSha(sha) {
  if (!sha) return "dev";
  return sha.slice(0, 9);
}

async function main() {
  const sha = process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || "local";
  const basePkgPath = path.join(repoRoot, "packages", "cli", "package.json");
  const basePkg = await readJson(basePkgPath);
  const baseVersion = basePkg.version;
  if (!baseVersion) {
    throw new Error("Base version missing in packages/cli/package.json");
  }
  const canaryVersion = `${baseVersion}-canary.${shortSha(sha)}`;

  const summaries = [];

  for (const pkgName of publishSet) {
    const dirName = pkgName.split("/").pop();
    const pkgPath = path.join(repoRoot, "packages", dirName, "package.json");
    const pkg = await readJson(pkgPath);

    pkg.version = canaryVersion;
    const fields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
    for (const field of fields) {
      const deps = pkg[field];
      if (!deps) continue;
      for (const depName of Object.keys(deps)) {
        if (publishSet.includes(depName)) {
          deps[depName] = canaryVersion;
        }
        if (depName.startsWith("@flux-lang/") && deps[depName].startsWith("workspace:")) {
          deps[depName] = canaryVersion;
        }
        if (depName.startsWith("@flux-lang/") && /^[~^]/.test(deps[depName])) {
          deps[depName] = deps[depName].replace(/^[~^]/, "");
        }
      }
    }

    await writeJson(pkgPath, pkg);
    summaries.push({ pkg: pkgName, path: pkgPath });
  }

  console.log(`[canary] version ${canaryVersion}`);
  for (const s of summaries) {
    console.log(`[canary] updated ${s.pkg} (${s.path})`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? String(err));
  process.exit(1);
});
