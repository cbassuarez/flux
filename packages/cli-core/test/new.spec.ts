import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { newCommand } from "../src/commands/new.js";


describe("flux new", () => {
  it("creates template output", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-new-"));
    const result = await newCommand({ cwd: dir, template: "demo" });
    expect(result.ok).toBe(true);
    const docPath = result.data?.docPath as string;
    const readmePath = path.join(dir, "README.md");
    const doc = await fs.readFile(docPath, "utf8");
    const readme = await fs.readFile(readmePath, "utf8");
    expect(doc).toContain("document {");
    expect(readme).toContain("Flux Document");
  });
});
