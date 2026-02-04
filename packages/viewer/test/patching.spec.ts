import { describe, it, expect } from "vitest";
import { applySlotPatches } from "../src/patching.js";

describe("applySlotPatches", () => {
  it("updates slot innerHTML only", () => {
    const inner = { innerHTML: "" } as any;
    const slot = {
      querySelector: (selector: string) => (selector === "[data-flux-slot-inner]" ? inner : null),
    } as any;
    const root = {
      querySelector: (selector: string) => (selector.includes("data-flux-id=\"slot1\"") ? slot : null),
    } as any;

    const missing = applySlotPatches(root, { slot1: "<span>Hi</span>" });
    expect(missing.length).toBe(0);
    expect(inner.innerHTML).toBe("<span>Hi</span>");
  });

  it("returns missing when no inner", () => {
    const slot = { querySelector: () => null } as any;
    const root = {
      querySelector: (selector: string) => (selector.includes("data-flux-id=\"slot2\"") ? slot : null),
    } as any;

    const missing = applySlotPatches(root, { slot2: "Hi" });
    expect(missing).toContain("slot2");
  });
});
