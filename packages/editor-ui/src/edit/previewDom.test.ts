// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { patchSlotText, sanitizeSlotText } from "./previewDom";

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
});
