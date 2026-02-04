import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_ROOT = resolve(__dirname, "..");
const CLI_BIN = resolve(CLI_ROOT, "dist", "bin", "flux.js");

describe("dist/bin/flux.js UI wiring", () => {
  it("includes the Ink UI entrypoint", async () => {
    const contents = await readFile(CLI_BIN, "utf8");
    expect(contents).toContain("@flux-lang/cli-ui");
    expect(contents).toContain("runCliUi");
  });
});
