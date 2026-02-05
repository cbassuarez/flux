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

  itNetwork("sets text for a heading node", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-edit-text-"));
    const docPath = await writeDoc(
      tmpDir,
      `
        document {
          meta { version = "0.2.0"; }
          body {
            page p1 {
              section s1 {
                text heading1 { style = "H2"; content = "Old Heading"; }
              }
            }
          }
        }
      `,
    );

    const server = await startViewerServer({ docPath });
    try {
      const res = await fetch(`${server.url}/api/edit/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "setText", args: { id: "heading1", text: "New Heading" } }),
      });
      expect(res.ok).toBe(true);
      const payload = await res.json();
      expect(payload.ok).toBe(true);
      const updated = await fs.readFile(docPath, "utf8");
      expect(updated).toContain('content = "New Heading"');
    } finally {
      await server.close();
    }
  });

  itNetwork("sets text for a paragraph node", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-edit-para-"));
    const docPath = await writeDoc(
      tmpDir,
      `
        document {
          meta { version = "0.2.0"; }
          body {
            page p1 {
              section s1 {
                text p1 { content = "Old paragraph"; }
              }
            }
          }
        }
      `,
    );

    const server = await startViewerServer({ docPath });
    try {
      const res = await fetch(`${server.url}/api/edit/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "setText", args: { id: "p1", text: "Updated paragraph" } }),
      });
      expect(res.ok).toBe(true);
      const payload = await res.json();
      expect(payload.ok).toBe(true);
      const updated = await fs.readFile(docPath, "utf8");
      expect(updated).toContain('content = "Updated paragraph"');
    } finally {
      await server.close();
    }
  });

  itNetwork("rejects setText for unknown id without writing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-edit-missing-"));
    const originalSource = `
        document {
          meta { version = "0.2.0"; }
          body {
            page p1 {
              section s1 {
                text p1 { content = "Keep me"; }
              }
            }
          }
        }
      `;
    const docPath = await writeDoc(tmpDir, originalSource);

    const server = await startViewerServer({ docPath });
    try {
      const res = await fetch(`${server.url}/api/edit/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "setText", args: { id: "missing", text: "Nope" } }),
      });
      expect(res.ok).toBe(true);
      const payload = await res.json();
      expect(payload.ok).toBe(false);
      expect(payload.diagnostics?.items?.length ?? 0).toBeGreaterThan(0);
      const updated = await fs.readFile(docPath, "utf8");
      expect(updated).toContain("Keep me");
    } finally {
      await server.close();
    }
  });

  itNetwork("reports diagnostics with spans on parse errors", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "flux-edit-diag-"));
    const docPath = await writeDoc(
      tmpDir,
      `
        document {
          meta { version = "0.2.0"; }
          body {
            page p1 {
              text t1 { content = "Missing brace" }
            }
          }
        }
      `,
    );

    const server = await startViewerServer({ docPath });
    try {
      const res = await fetch(`${server.url}/api/edit/state`);
      expect(res.ok).toBe(true);
      const payload = await res.json();
      const diagnostics = payload.diagnostics;
      expect(diagnostics?.items?.length ?? 0).toBeGreaterThan(0);
      const first = diagnostics.items[0];
      expect(first.range?.start?.line ?? 0).toBeGreaterThan(0);
      expect(first.range?.start?.column ?? 0).toBeGreaterThan(0);
      expect(typeof first.excerpt?.text).toBe("string");
      expect(typeof first.excerpt?.caret).toBe("string");
    } finally {
      await server.close();
    }
  });
});
