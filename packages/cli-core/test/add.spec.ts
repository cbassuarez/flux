import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import os from "node:os";
import { addCommand } from "../src/commands/add.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixture = path.resolve(__dirname, "fixtures", "minimal.flux");

describe("flux add", () => {
  it("inserts a section", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-add-"));
    const target = path.join(dir, "doc.flux");
    await fs.copyFile(fixture, target);

    const result = await addCommand({ cwd: dir, file: target, kind: "section" });
    expect(result.ok).toBe(true);

    const updated = await fs.readFile(target, "utf8");
    expect(updated).toContain("section section");
    expect(updated).toContain("Section Heading");
  });
});
