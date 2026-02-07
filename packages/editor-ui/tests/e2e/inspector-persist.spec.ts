import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const metaPath = path.join(process.cwd(), "packages/editor-ui/tests/e2e/.cli-edit-path.json");

async function readDocPath(): Promise<string> {
  const raw = await fs.readFile(metaPath, "utf8");
  const parsed = JSON.parse(raw) as { docPath: string };
  return parsed.docPath;
}

test.describe("inspector persistence", () => {
  test("caption edits persist across blur and reload", async ({ page }) => {
    const docPath = await readDocPath();
    await page.goto(`/edit?file=${encodeURIComponent(docPath)}&debug=1`);
    await page.waitForSelector(".editor-root");

    const figureOutline = page.locator(".outline-btn:has(.outline-label:has-text(\"figure fig1\"))");
    await figureOutline.click();

    const captionInput = page.getByTestId("inspector-field:caption");
    const suffix = " (edited)";
    await captionInput.click();
    await captionInput.press("End");
    await page.keyboard.type(suffix);
    await page.locator(".page-stage").click();
    await page.waitForTimeout(700);

    await expect(captionInput).toHaveValue(`Initial caption${suffix}`);

    const diskAfterBlur = await fs.readFile(docPath, "utf8");
    expect(diskAfterBlur).toContain(suffix);

    await page.reload();
    await page.waitForSelector(".editor-root");
    await figureOutline.click();
    await expect(captionInput).toHaveValue(`Initial caption${suffix}`);
  });

  test("slot variants persist across selection changes", async ({ page }) => {
    const docPath = await readDocPath();
    await page.goto(`/edit?file=${encodeURIComponent(docPath)}&debug=1`);
    await page.waitForSelector(".editor-root");

    const slotOutline = page.locator(".outline-btn:has(.outline-label:has-text(\"slot slot1\"))");
    await slotOutline.click();

    const addVariantButton = page.getByTestId("inspector-action:add-variant");
    await addVariantButton.click();
    const variantInput = page.getByTestId("inspector-field:slot-variant-2");
    await variantInput.fill("gamma");

    const figureOutline = page.locator(".outline-btn:has(.outline-label:has-text(\"figure fig1\"))");
    await figureOutline.click();
    await slotOutline.click();
    await page.waitForTimeout(500);

    await expect(variantInput).toHaveValue("gamma");
  });
});
