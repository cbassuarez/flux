import { test, expect, Page, Route } from "@playwright/test";
import type { DocumentNode, FluxDocument } from "@flux-lang/core";

type SlotGenerator = { kind: "choose"; values: string[] };

type MutableDoc = { doc: FluxDocument; revision: number };

const buildFixtureDoc = (): FluxDocument => ({
  body: {
    nodes: [
      {
        id: "page1",
        kind: "page",
        props: {},
        children: [
          {
            id: "section1",
            kind: "section",
            props: {},
            children: [
              {
                id: "text1",
                kind: "text",
                props: { content: { kind: "LiteralValue", value: "Hello world" } },
                children: [],
              },
              {
                id: "figure1",
                kind: "figure",
                props: { caption: { kind: "LiteralValue", value: "Initial caption" } },
                children: [],
              },
              {
                id: "slot1",
                kind: "inline_slot",
                props: {
                  generator: { kind: "choose", values: ["red", "blue"] } as SlotGenerator,
                  reserve: { kind: "LiteralValue", value: "fixedWidth(8, ch)" },
                  fit: { kind: "LiteralValue", value: "ellipsis" },
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
});

function cloneDoc(doc: FluxDocument): FluxDocument {
  return JSON.parse(JSON.stringify(doc));
}

function updateNode(doc: FluxDocument, id: string, updater: (node: DocumentNode) => void): FluxDocument {
  const next = cloneDoc(doc);
  const visit = (node?: DocumentNode): boolean => {
    if (!node) return false;
    if (node.id === id) {
      updater(node);
      return true;
    }
    return (node.children ?? []).some((child) => visit(child));
  };
  next.body?.nodes?.some((node) => visit(node));
  return next;
}

async function mockApi(page: Page, state: MutableDoc) {
  await page.route("**/api/edit/state**", async (route: Route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ doc: state.doc, assets: [], revision: state.revision }),
    });
  });

  await page.route("**/api/edit/source**", async (route: Route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ source: "", revision: state.revision, docPath: "doc.flux" }),
    });
  });

  await page.route("**/api/edit/transform**", async (route: Route) => {
    const payload = await route.request().postDataJSON();
    const args = (payload as any)?.args ?? {};
    let nextDoc = state.doc;

    if (payload.op === "setTextNodeContent") {
      const text = args.text ?? "";
      nextDoc = updateNode(state.doc, args.id, (node) => {
        (node.props as any).content = { kind: "LiteralValue", value: text };
      });
    } else if (payload.op === "setNodeProps") {
      const props = args.props ?? {};
      nextDoc = updateNode(state.doc, args.id, (node) => {
        node.props = { ...(node.props ?? {}), ...props };
      });
    } else if (payload.op === "setSlotGenerator") {
      nextDoc = updateNode(state.doc, args.id, (node) => {
        node.props = { ...(node.props ?? {}), generator: args.generator };
      });
    }

    state.doc = nextDoc;
    state.revision += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, doc: nextDoc, source: "", revision: state.revision }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page, { doc: buildFixtureDoc(), revision: 1 });
});

test("inspector edit persists", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".editor-root");
  await page.evaluate(() => window.postMessage({ type: "flux-select", nodeId: "figure1" }, "*"));
  const captionInput = page.locator(".inspector-section input");
  await captionInput.click();
  await captionInput.fill("Updated caption");
  await captionInput.blur();
  await page.waitForTimeout(700);
  await expect(captionInput).toHaveValue("Updated caption");
});

test("text edit persists", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".editor-root");
  await page.click("text=Edit Text");
  await page.evaluate(() => window.postMessage({ type: "flux-select", nodeId: "text1" }, "*"));
  const editor = page.locator(".rich-text-editor .ProseMirror");
  await editor.click();
  await page.keyboard.type("!");
  await page.waitForTimeout(700);
  await expect(editor).toContainText("Hello world!");
});

test("slot variants persist", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".editor-root");
  await page.evaluate(() => window.postMessage({ type: "flux-select", nodeId: "slot1" }, "*"));
  const addButton = page.locator(".variant-list button:has-text('Add variant')");
  await addButton.click();
  const rows = page.locator(".variant-row input");
  const last = rows.nth(await rows.count() - 1);
  await last.fill("green");
  // Switch selection away and back
  await page.evaluate(() => window.postMessage({ type: "flux-select", nodeId: "text1" }, "*"));
  await page.evaluate(() => window.postMessage({ type: "flux-select", nodeId: "slot1" }, "*"));
  await page.waitForTimeout(500);
  await expect(rows.nth((await rows.count()) - 1)).toHaveValue("green");
});
