#!/usr/bin/env node
/**
 * Publish the canary packages with --tag canary.
 * Assumes scripts/canary.mjs already ran in the workspace.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const publishOrder = [
  "@flux-lang/cli-core",
  "@flux-lang/viewer",
  "@flux-lang/cli",
  "@flux-lang/flux",
];

async function pkgVersion(pkg) {
  const pkgPath = path.join(repoRoot, "packages", pkg.split("/").pop(), "package.json");
  const json = await import(pkgPath, { assert: { type: "json" } });
  return json.default?.version ?? json.version;
}

async function existsOnNpm(pkg, version) {
  try {
    await execFileAsync("npm", ["view", `${pkg}@${version}`, "version"], {
      env: process.env,
    });
    return true;
  } catch {
    return false;
  }
}

async function publishWorkspace(pkg) {
  const version = await pkgVersion(pkg);
  if (!version) {
    throw new Error(`Missing version for ${pkg}`);
  }
  if (await existsOnNpm(pkg, version)) {
    console.log(`[publish] skip ${pkg}@${version} (already published)`);
    return;
  }
  const workspace = pkg;
  console.log(`[publish] npm publish -w ${workspace} --tag canary`);
  await execFileAsync("npm", ["publish", "-w", workspace, "--tag", "canary", "--access", "public"], {
    env: process.env,
    cwd: repoRoot,
  });
}

async function main() {
  for (const pkg of publishOrder) {
    await publishWorkspace(pkg);
  }
}

main().catch((err) => {
  console.error(err?.message ?? String(err));
  process.exit(1);
});
