import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { startViewerServer } from "@flux-lang/viewer";

test.describe("flux edit integration", () => {
  test("served editor keeps text edits", async ({ page }) => {
    const tmpDir = path.join(process.cwd(), "tmp-e2e");
    await fs.mkdir(tmpDir, { recursive: true });
    const docPath = path.join(tmpDir, "integration.flux");
    await fs.writeFile(
      docPath,
      [
        "document {",
        '  paragraph { content: "Hello world" }',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const editorDist = path.resolve(process.cwd(), "packages/editor-ui/dist");
    try {
      await fs.stat(path.join(editorDist, "index.html"));
    } catch {
      throw new Error("Editor dist not built. Run `npm run build --workspace @flux-lang/editor-ui`.");
    }

    const server = await startViewerServer({ docPath, editorDist });
    try {
      await page.goto(`${server.url}/edit?file=${encodeURIComponent(docPath)}`);
      const editor = page.locator(".rich-text-editor .ProseMirror");
      await editor.click();
      await page.keyboard.type("!");
      await page.waitForTimeout(800);
      await expect(editor).toContainText("Hello world!");
    } finally {
      await server.close();
    }
  });
});
