import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveEditorDist } from "../src/editor-dist";

async function makeDistDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.writeFile(path.join(dir, "index.html"), "<!doctype html><html></html>");
  return dir;
}

describe("editor dist resolver", () => {
  it("prefers explicit flag paths", async () => {
    const flagDir = await makeDistDir("flux-editor-flag-");
    const envDir = await makeDistDir("flux-editor-env-");
    const result = await resolveEditorDist({
      editorDist: flagDir,
      env: { FLUX_EDITOR_DIST: envDir } as NodeJS.ProcessEnv,
    });
    expect(result.source).toBe("flag");
    expect(result.dir).toBe(flagDir);
  });

  it("falls back to env var", async () => {
    const envDir = await makeDistDir("flux-editor-env-");
    const result = await resolveEditorDist({
      env: { FLUX_EDITOR_DIST: envDir } as NodeJS.ProcessEnv,
    });
    expect(result.source).toBe("env");
    expect(result.dir).toBe(envDir);
  });

  it("uses embedded dist when no overrides", async () => {
    const embeddedDir = await makeDistDir("flux-editor-embedded-");
    const result = await resolveEditorDist({
      env: {} as NodeJS.ProcessEnv,
      embeddedDir,
    });
    expect(result.source).toBe("embedded");
    expect(result.dir).toBe(embeddedDir);
  });

  it("reports missing dist when none exist", async () => {
    const missingDir = path.join(os.tmpdir(), "flux-editor-missing");
    const result = await resolveEditorDist({
      env: {} as NodeJS.ProcessEnv,
      embeddedDir: missingDir,
    });
    expect(result.source).toBe("missing");
    expect(result.indexPath).toBeNull();
  });
});
