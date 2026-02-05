import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { startViewerServer } from "../src/index";

describe("editor static hosting", () => {
  const networkDisabled = process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1";
  const itNetwork = networkDisabled ? it.skip : it;

  itNetwork("serves /edit index.html", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-edit-static-"));
    const distDir = path.join(tmpDir, "dist");
    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(path.join(distDir, "index.html"), "<!doctype html><div>EDITOR</div>");
    const docPath = path.join(tmpDir, "doc.flux");
    await fs.writeFile(
      docPath,
      `
        document {
          meta { version = "0.2.0"; }
          body { page p1 { } }
        }
      `,
    );

    const server = await startViewerServer({ docPath, editorDist: distDir });
    try {
      const res = await fetch(`${server.url}/edit`);
      expect(res.ok).toBe(true);
      const body = await res.text();
      expect(body).toContain("EDITOR");
    } finally {
      await server.close();
    }
  });
});
