import { test, expect, type ConsoleMessage } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { startViewerServer } from "@flux-lang/viewer";

type DocEventPayload = {
  reason?: string;
  docRev?: number;
  sourceRev?: number;
  dirty?: boolean;
  writeId?: string;
  tag?: string;
};

const buildFixtureSource = () =>
  [
    "document {",
    "  page page1 {",
    "    section section1 {",
    "      figure fig1 {",
    "        caption: \"Initial caption\"",
    "      }",
    "      slot slot1 {",
    "        text slotText { content: \"alpha\" }",
    "      }",
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");

async function ensureEditorDist(): Promise<string> {
  const editorDist = path.resolve(process.cwd(), "packages/editor-ui/dist");
  try {
    await fs.stat(path.join(editorDist, "index.html"));
  } catch {
    throw new Error("Editor dist not built. Run `npm run build --workspace @flux-lang/editor-ui`." );
  }
  return editorDist;
}

function recordDocEvent(msg: ConsoleMessage, storage: DocEventPayload[], pending: Promise<void>[]) {
  if (!msg.text().includes("[doc-event]")) return;
  const args = msg.args();
  if (args.length > 1) {
    pending.push(
      args[1].jsonValue().then((value) => {
        storage.push(value as DocEventPayload);
      }),
    );
  }
}

test.describe("inspector persistence", () => {
  test("caption edits persist across blur and reload", async ({ page }) => {
    const tmpDir = path.join(process.cwd(), "tmp-e2e");
    await fs.mkdir(tmpDir, { recursive: true });
    const docPath = path.join(tmpDir, "inspector-caption.flux");
    await fs.writeFile(docPath, buildFixtureSource(), "utf8");

    const editorDist = await ensureEditorDist();
    const server = await startViewerServer({ docPath, editorDist });

    const docEvents: DocEventPayload[] = [];
    const docEventPromises: Promise<void>[] = [];
    let transformHeaders: Record<string, string> | null = null;

    page.on("console", (msg) => recordDocEvent(msg, docEvents, docEventPromises));
    page.on("response", (response) => {
      if (transformHeaders) return;
      if (!response.url().includes("/api/edit/transform")) return;
      transformHeaders = response.headers();
    });

    try {
      await page.goto(`${server.url}/edit?file=${encodeURIComponent(docPath)}&debug=1`);
      await page.waitForSelector(".editor-root");

      const figureOutline = page.locator(
        ".outline-btn:has(.outline-label:has-text(\"figure fig1\"))",
      );
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

      await Promise.all(docEventPromises);

      expect(transformHeaders).not.toBeNull();
      expect(transformHeaders?.["x-flux-edit-applied"]).toBe("1");
      expect(transformHeaders?.["x-flux-edit-before"]).toBeTruthy();
      expect(transformHeaders?.["x-flux-edit-after"]).toBeTruthy();
      expect(transformHeaders?.["x-flux-edit-before"]).not.toBe(transformHeaders?.["x-flux-edit-after"]);

      const hasExternalReload = docEvents.some((event) => event.reason === "externalChange");
      expect(hasExternalReload).toBe(false);
    } finally {
      const traceStrip = await page.locator(".health-strip").innerText().catch(() => "(missing)");
      console.log("[trace-strip]", traceStrip);
      console.log("[transform-headers]", transformHeaders ?? "(none)");
      await Promise.all(docEventPromises).catch(() => undefined);
      console.log("[doc-events]", docEvents);
      await server.close();
    }
  });

  test("slot variants persist across selection changes", async ({ page }) => {
    const tmpDir = path.join(process.cwd(), "tmp-e2e");
    await fs.mkdir(tmpDir, { recursive: true });
    const docPath = path.join(tmpDir, "inspector-slot.flux");
    await fs.writeFile(docPath, buildFixtureSource(), "utf8");

    const editorDist = await ensureEditorDist();
    const server = await startViewerServer({ docPath, editorDist });

    try {
      await page.goto(`${server.url}/edit?file=${encodeURIComponent(docPath)}&debug=1`);
      await page.waitForSelector(".editor-root");

      const slotOutline = page.locator(
        ".outline-btn:has(.outline-label:has-text(\"slot slot1\"))",
      );
      await slotOutline.click();

      const addVariantButton = page.getByTestId("inspector-action:add-variant");
      await addVariantButton.click();
      const variantInput = page.getByTestId("inspector-field:slot-variant-1");
      await variantInput.fill("beta");

      const figureOutline = page.locator(
        ".outline-btn:has(.outline-label:has-text(\"figure fig1\"))",
      );
      await figureOutline.click();
      await slotOutline.click();
      await page.waitForTimeout(500);

      await expect(variantInput).toHaveValue("beta");
    } finally {
      await server.close();
    }
  });
});
