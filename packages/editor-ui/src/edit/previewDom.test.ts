// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { AssetItem } from "./docService";
import type { SlotValue } from "./slotRuntime";
import { patchSlotContent, patchSlotText, sanitizeSlotText } from "./previewDom";

describe("preview dom slot patching", () => {
  it("ensures inline_slot inner wrapper is a span with data-flux-slot-inner", () => {
    document.body.innerHTML = `<div data-flux-id="slot1" data-flux-kind="inline_slot">old</div>`;
    const outer = document.querySelector("[data-flux-id=\"slot1\"]") as HTMLElement;
    const normalized = patchSlotText(outer, "updated", true);
    const inner = normalized.querySelector("[data-flux-slot-inner]") as HTMLElement | null;

    expect(normalized.tagName).toBe("SPAN");
    expect(inner).not.toBeNull();
    expect(inner?.tagName).toBe("SPAN");
    expect(inner?.textContent).toBe("updated");
  });

  it("patches text slots without duplicate lines", () => {
    document.body.innerHTML = `<span data-flux-id="slot2" data-flux-kind="inline_slot">legacy</span>`;
    const outer = document.querySelector("[data-flux-id=\"slot2\"]") as HTMLElement;
    patchSlotText(outer, sanitizeSlotText("line1\nline2"), true);

    const inners = outer.querySelectorAll("[data-flux-slot-inner]");
    expect(inners.length).toBe(1);
    expect(outer.textContent).toBe("line1 line2");
  });

  it("renders slot text from runtime values", () => {
    document.body.innerHTML = `<div data-flux-id="slot3" data-flux-kind="slot"></div>`;
    const outer = document.querySelector("[data-flux-id=\"slot3\"]") as HTMLElement;
    const value: SlotValue = { kind: "text", text: "Hello world" };

    patchSlotContent(outer, value, false);

    const inner = outer.querySelector("[data-flux-slot-inner]") as HTMLElement | null;
    expect(inner?.textContent).toBe("Hello world");
  });

  it("renders slot assets from runtime values", () => {
    document.body.innerHTML = `<div data-flux-id="slot4" data-flux-kind="slot"></div>`;
    const outer = document.querySelector("[data-flux-id=\"slot4\"]") as HTMLElement;
    const asset: AssetItem = {
      id: "asset-1",
      name: "Example",
      kind: "image",
      path: "/tmp/example.png",
      tags: [],
    };
    const value: SlotValue = { kind: "asset", asset, label: "Example asset" };

    patchSlotContent(outer, value, false);

    const img = outer.querySelector("img.flux-slot-asset") as HTMLImageElement | null;
    expect(img?.getAttribute("src")).toBe("assets/asset-1");
    expect(img?.getAttribute("alt")).toBe("Example asset");
  });

  it("unrenderable value does not clear existing content", () => {
    document.body.innerHTML = `<div data-flux-id="slot5" data-flux-kind="slot"><span>Placeholder</span></div>`;
    const outer = document.querySelector("[data-flux-id=\"slot5\"]") as HTMLElement;
    const value: SlotValue = { kind: "asset", asset: null, label: "" };

    patchSlotContent(outer, value, false);

    const inner = outer.querySelector("[data-flux-slot-inner]") as HTMLElement | null;
    expect(inner?.textContent).toBe("Placeholder");
  });

  it("base-path asset URLs resolve under /flux", () => {
    document.head.innerHTML = `<base href="http://localhost/flux/preview">`;
    document.body.innerHTML = `<div data-flux-id="slot6" data-flux-kind="slot"></div>`;
    const outer = document.querySelector("[data-flux-id=\"slot6\"]") as HTMLElement;
    const asset: AssetItem = {
      id: "asset-1",
      name: "Example",
      kind: "image",
      path: "/tmp/example.png",
      tags: [],
    };
    const value: SlotValue = { kind: "asset", asset, label: "Example asset" };

    patchSlotContent(outer, value, false);

    const img = outer.querySelector("img.flux-slot-asset") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(new URL(img?.src ?? "").pathname).toBe("/flux/assets/asset-1");
  });
});
