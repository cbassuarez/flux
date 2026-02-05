#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    if (value !== undefined) {
      argMap.set(key, value);
    } else {
      argMap.set(key, args[i + 1]);
      i += 1;
    }
  } else if (!argMap.has("from")) {
    argMap.set("from", arg);
  }
}

const repoRoot = process.cwd();
const from = argMap.get("from")
  ? path.resolve(repoRoot, argMap.get("from"))
  : path.resolve(repoRoot, "..", "flux-site", "dist");
const to = path.resolve(repoRoot, "packages", "viewer", "editor-dist");

async function main() {
  try {
    const stat = await fs.stat(from);
    if (!stat.isDirectory()) {
      throw new Error(`Source is not a directory: ${from}`);
    }
  } catch (err) {
    console.error(`Missing editor dist at ${from}`);
    console.error("Provide a path with --from <path> or place flux-site next to this repo.");
    process.exit(1);
  }

  await fs.rm(to, { recursive: true, force: true });
  await fs.mkdir(to, { recursive: true });
  await fs.cp(from, to, { recursive: true });
  console.log(`Synced editor dist from ${from} to ${to}`);
}

main().catch((err) => {
  console.error(err?.message ?? String(err));
  process.exit(1);
});
