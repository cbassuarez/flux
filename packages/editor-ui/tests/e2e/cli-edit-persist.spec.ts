import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const metaPath = path.join(process.cwd(), "packages/editor-ui/tests/e2e/.cli-edit-path.json");

async function readDocPath(): Promise<string> {
  const raw = await fs.readFile(metaPath, "utf8");
  const parsed = JSON.parse(raw) as { docPath: string };
  return parsed.docPath;
}

test("cli edit persists inspector + slot changes", async ({ page }) => {
  const docPath = await readDocPath();
  let transformHeaders: Record<string, string> | null = null;

  page.on("response", (response) => {
    if (transformHeaders) return;
    if (!response.url().includes("/api/edit/transform")) return;
    transformHeaders = response.headers();
  });

  await page.goto(`/edit?file=${encodeURIComponent(docPath)}&debug=1`);
  await page.waitForSelector(".editor-root");

  const figureOutline = page.locator(".outline-btn:has(.outline-label:has-text(\"figure fig1\"))");
  await figureOutline.click();

  const captionInput = page.getByTestId("inspector-field:caption");
  await captionInput.click();
  await captionInput.fill("Initial caption updated");
  await captionInput.blur();
  await page.waitForTimeout(700);
  await expect(captionInput).toHaveValue("Initial caption updated");

  await page.reload();
  await page.waitForSelector(".editor-root");
  await figureOutline.click();
  await expect(captionInput).toHaveValue("Initial caption updated");

  const slotOutline = page.locator(".outline-btn:has(.outline-label:has-text(\"slot slot1\"))");
  await slotOutline.click();
  const addVariantButton = page.getByTestId("inspector-action:add-variant");
  await addVariantButton.click();
  const variantInput = page.getByTestId("inspector-field:slot-variant-2");
  await variantInput.fill("gamma");

  await figureOutline.click();
  await slotOutline.click();
  await page.waitForTimeout(500);
  await expect(variantInput).toHaveValue("gamma");

  expect(transformHeaders).not.toBeNull();
  expect(transformHeaders?.["x-flux-edit-applied"]).toBe("1");
  expect(transformHeaders?.["x-flux-edit-before"]).toBeTruthy();
  expect(transformHeaders?.["x-flux-edit-after"]).toBeTruthy();
});
