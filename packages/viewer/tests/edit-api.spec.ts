import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { startViewerServer } from "../src/index";

async function writeDoc(dir: string, source: string): Promise<string> {
  const docPath = path.join(dir, "doc.flux");
  await fs.writeFile(docPath, source);
  return docPath;
}

describe("editor API transforms", () => {
  const networkDisabled = process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1";
  const itNetwork = networkDisabled ? it.skip : it;

  itNetwork("adds a section and writes to disk", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-edit-"));
    const docPath = await writeDoc(
      tmpDir,
      `
        document {
          meta { version = "0.2.0"; }
          body {
            page p1 { }
          }
        }
      `,
    );

    const server = await startViewerServer({ docPath });
    try {
      const res = await fetch(`${server.url}/api/edit/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "addSection", args: { heading: "New Section" } }),
      });
      expect(res.ok).toBe(true);
      const updated = await fs.readFile(docPath, "utf8");
      expect(updated).toContain("section");
      expect(updated).toContain("New Section");
    } finally {
      await server.close();
    }
  });

  itNetwork("adds a figure wired to an asset bank", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-edit-fig-"));
    const docPath = await writeDoc(
      tmpDir,
      `
        document {
          meta { version = "0.2.0"; }
          assets {
            bank media {
              kind = image;
              root = "assets";
              include = "*.png";
              tags = [ hero ];
            }
          }
          body {
            page p1 { }
          }
        }
      `,
    );

    const server = await startViewerServer({ docPath });
    try {
      const res = await fetch(`${server.url}/api/edit/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "addFigure",
          args: { bankName: "media", tags: ["hero"], caption: "Hero figure" },
        }),
      });
      expect(res.ok).toBe(true);
      const updated = await fs.readFile(docPath, "utf8");
      expect(updated).toContain("image");
      expect(updated).toContain("assets.pick");
      expect(updated).toContain("bank:media");
      expect(updated).toContain("Hero figure");
    } finally {
      await server.close();
    }
  });
});
