import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, vi } from "vitest";
import { attachOrStartViewer, fetchViewerStatus } from "../src/viewer/manager.js";
import * as viewerMod from "@flux-lang/viewer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const fixture = path.resolve(repoRoot, "examples", "viewer-demo.flux");

describe("viewer manager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts server and responds to status (stubbed)", async () => {
    const embeddedDir = viewerMod.defaultEmbeddedDir();
    const embeddedIndex = path.join(embeddedDir, "index.html");
    const expectedEditor = await viewerMod.computeBuildId(embeddedDir, embeddedIndex);
    const fakeCwd = path.join(os.tmpdir(), "flux-viewer-test");

    const startSpy = vi
      .spyOn(viewerMod, "startViewerServer")
      .mockResolvedValue({
        port: 1234,
        url: "http://127.0.0.1:1234",
        buildId: expectedEditor,
        editorDist: "/tmp/editor",
        close: async () => {},
      } as any);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/api/health")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: {
              "x-flux-viewer-version": viewerMod.VIEWER_VERSION,
              "x-flux-editor-build": expectedEditor ?? "unknown",
            },
          });
        }
        return new Response(JSON.stringify({ docPath: fixture, docstepMs: 1000 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as any,
    );

    const session = await attachOrStartViewer({ cwd: fakeCwd, docPath: fixture });
    const status = await fetchViewerStatus(session.url);
    expect(status.docPath).toContain("viewer-demo.flux");
    expect(typeof status.docstepMs).toBe("number");
  }, 10000);
});
