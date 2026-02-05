import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { getRecentsStore, updateRecents } from "../src/recents.js";

async function makeRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-recents-"));
  await fs.mkdir(path.join(dir, ".git"), { recursive: true });
  return dir;
}

describe("recents storage", () => {
  it("uses .git/flux when in repo", async () => {
    const repo = await makeRepo();
    const store = await getRecentsStore(repo);
    expect(store.storePath).toBe(path.join(repo, ".git", "flux", "recents.json"));
    expect(store.fallback).toBe(false);
  });

  it("falls back to .flux when no repo", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-norepo-"));
    const store = await getRecentsStore(dir);
    expect(store.storePath).toBe(path.join(dir, ".flux", "recents.json"));
    expect(store.fallback).toBe(true);
  });

  it("caps recents at 2 entries", async () => {
    const repo = await makeRepo();
    await updateRecents(repo, path.join(repo, "one.flux"));
    await updateRecents(repo, path.join(repo, "two.flux"));
    const store = await updateRecents(repo, path.join(repo, "three.flux"));
    expect(store.entries.length).toBe(2);
    expect(store.entries[0]?.path).toBe(path.join(repo, "three.flux"));
    expect(store.entries[1]?.path).toBe(path.join(repo, "two.flux"));
  });
});
