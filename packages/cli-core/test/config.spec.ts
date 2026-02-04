import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { resolveConfig } from "../src/config.js";

async function makeRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-config-"));
  await fs.mkdir(path.join(dir, ".git"), { recursive: true });
  return dir;
}

describe("config precedence", () => {
  it("flags override env and file", async () => {
    const repo = await makeRepo();
    const configPath = path.join(repo, "flux.config.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({ docstepMs: 500, advanceTime: false, defaultTheme: "print" }, null, 2),
    );

    const result = await resolveConfig({
      cwd: repo,
      env: { FLUX_DOCSTEP_MS: "700", FLUX_ADVANCE_TIME: "true" },
      flags: { docstepMs: 900 },
    });

    expect(result.config.docstepMs).toBe(900);
    expect(result.config.advanceTime).toBe(true);
    expect(result.config.defaultTheme).toBe("print");
  });
});
