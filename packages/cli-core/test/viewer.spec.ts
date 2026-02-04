import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachOrStartViewer, fetchViewerStatus } from "../src/viewer/manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixture = path.resolve(__dirname, "..", "..", "examples", "viewer-demo.flux");

describe("viewer manager", () => {
  it("starts server and responds to status", async () => {
    const repoRoot = path.resolve(__dirname, "..", "..");
    const session = await attachOrStartViewer({ cwd: repoRoot, docPath: fixture });
    const status = await fetchViewerStatus(session.url);
    expect(status.docPath).toContain("viewer-demo.flux");
    expect(typeof status.docstepMs).toBe("number");
    if (session.close) {
      await session.close();
    }
  });
});
