import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const metaPath = path.join(process.cwd(), "packages/editor-ui/tests/e2e/.cli-edit-path.json");

async function readDocPath(): Promise<string> {
  const raw = await fs.readFile(metaPath, "utf8");
  const parsed = JSON.parse(raw) as { docPath: string };
  return parsed.docPath;
}

test.describe("flux edit integration", () => {
  test("served editor keeps text edits", async ({ page }) => {
    const docPath = await readDocPath();
    await page.goto(`/edit?file=${encodeURIComponent(docPath)}`);
    await page.waitForSelector(".editor-root");

    const textOutline = page.locator(".outline-btn:has(.outline-label:has-text(\"Hello world\"))");
    await textOutline.click();

    const editor = page.locator(".rich-text-editor .ProseMirror");
    await editor.click();
    await page.keyboard.type("!");
    await page.waitForTimeout(800);
    await expect(editor).toContainText("Hello world!");
  });
});
