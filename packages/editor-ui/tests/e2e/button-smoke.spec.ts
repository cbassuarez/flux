import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

// Drives the real served editor and clicks every enabled menu command, asserting
// that no command crashes the app, throws an uncaught error, logs a console
// error, or trips the global error banner. This is the empirical guard against
// "buttons that do nothing or fail silently" — unit tests can't catch a button
// that looks fine but breaks at runtime.

const metaPath = path.join(process.cwd(), "packages/editor-ui/tests/e2e/.cli-edit-path.json");

async function readDocPath(): Promise<string> {
  const raw = await fs.readFile(metaPath, "utf8");
  return (JSON.parse(raw) as { docPath: string }).docPath;
}

// Console noise that isn't an editor failure.
// The DialogTitle advisory comes from cmdk's bundled Radix Dialog. We pass an
// accessible `label` to Command.Dialog (so the menu is named for screen
// readers), but Radix specifically wants a <Dialog.Title> element, which only
// a cmdk upgrade exposes. Tracked as a dependency follow-up.
const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /ResizeObserver/i,
  /Download the React DevTools/i,
  /requires a `?DialogTitle/i,
];

function isIgnorable(message: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(message));
}

const MENU_LABELS = ["File", "Edit", "Insert", "Format", "View", "Runtime", "Window", "Help"];

// Enabled, clickable leaf items (regular + checkbox), excluding submenu triggers.
const ENABLED_ITEM = ".menubar-content .menubar-item:not(.menubar-subtrigger):not([data-disabled])";

async function openMenu(page: Page, label: string): Promise<void> {
  await page.locator(".menubar-trigger", { hasText: label }).first().click();
  await page.locator(".menubar-content").first().waitFor({ state: "visible" });
}

async function enabledItemLabels(page: Page, menu: string): Promise<string[]> {
  await openMenu(page, menu);
  const labels = await page.locator(`${ENABLED_ITEM} .menubar-label`).allInnerTexts();
  await page.keyboard.press("Escape");
  return labels.map((l) => l.trim()).filter(Boolean);
}

test("every enabled menu command runs without crashing or erroring", async ({ page, context }) => {
  test.setTimeout(180_000);

  const failures: string[] = [];
  let active = "(load)";

  page.on("pageerror", (err) => failures.push(`${active}: pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!isIgnorable(text)) failures.push(`${active}: console.error: ${text}`);
  });
  // Auto-dismiss native prompts (Set Seed / Jump Time) and auto-close popups
  // (Export PDF) so the sweep doesn't hang.
  page.on("dialog", (dialog) => void dialog.dismiss().catch(() => {}));
  context.on("page", (popup) => void popup.close().catch(() => {}));

  const docPath = await readDocPath();
  await page.goto(`/edit?file=${encodeURIComponent(docPath)}`);
  await page.waitForSelector(".editor-root");
  await page.waitForSelector(".editor-menubar");

  // Select the first outline node so selection-gated commands (Duplicate/Delete)
  // are exercised. Best-effort: if the outline is empty we simply skip them.
  const firstOutlineNode = page.locator(".outline-btn").first();
  if ((await firstOutlineNode.count()) > 0) {
    await firstOutlineNode.click({ timeout: 10_000 }).catch(() => {});
  }

  for (const menu of MENU_LABELS) {
    const labels = await enabledItemLabels(page, menu);
    for (const label of labels) {
      active = `${menu} › ${label}`;
      try {
        await openMenu(page, menu);
        await page
          .locator(ENABLED_ITEM)
          .filter({ has: page.locator(".menubar-label", { hasText: label }) })
          .first()
          .click({ timeout: 5000 });
      } catch (err) {
        failures.push(`${active}: click failed: ${(err as Error).message}`);
        await page.keyboard.press("Escape").catch(() => {});
        continue;
      }

      // Let the action settle, then assert the app is still alive and quiet.
      await page.waitForTimeout(120);
      if ((await page.locator(".editor-root").count()) === 0) {
        failures.push(`${active}: editor blanked (no .editor-root)`);
        break;
      }
      const banner = page.locator("#flux-global-error-banner");
      if ((await banner.count()) > 0) {
        failures.push(`${active}: global error banner: ${await banner.innerText()}`);
      }
      await page.keyboard.press("Escape").catch(() => {});
    }
  }

  expect(failures, `Broken commands:\n${failures.join("\n")}`).toEqual([]);
});
