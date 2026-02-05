import { describe, expect, it } from "vitest";
import type { RenderDocumentIR, RenderNodeIR } from "@flux-lang/core";
import { applySlotPatches, collectSlotHashes, diffSlotIds, shrinkToFit, scaleDownToFit } from "../src/patching";

function makeSlot(content: string): RenderNodeIR {
  return {
    nodeId: "root/page:p1:0/slot:s1:0",
    id: "s1",
    kind: "slot",
    props: {},
    refresh: { kind: "docstep" },
    slot: {
      reserve: { kind: "fixed", width: 200, height: 80, units: "px" },
      fit: "clip",
    },
    children: [
      {
        nodeId: "root/page:p1:0/slot:s1:0/text:t1:0",
        id: "t1",
        kind: "text",
        props: { content: content as any },
        refresh: { kind: "docstep" },
        children: [],
      },
    ],
  };
}

function makeDoc(slot: RenderNodeIR, valueHash: string): RenderDocumentIR {
  return {
    meta: { version: "0.2.0" },
    seed: 0,
    time: 0,
    docstep: 0,
    assets: [],
    slotMeta: {
      [slot.nodeId]: {
        valueHash,
        shouldRefresh: false,
        transition: { type: "none", durationMs: 0, ease: "linear" },
      },
    },
    body: [
      {
        nodeId: "root/page:p1:0",
        id: "p1",
        kind: "page",
        props: {},
        refresh: { kind: "never" },
        children: [slot],
      },
    ],
  };
}

describe("viewer patching", () => {
  it("diffs by nodeId and only returns changed slots", () => {
    const first = makeDoc(makeSlot("hello"), "hello");
    const second = makeDoc(makeSlot("world"), "world");
    const prev = collectSlotHashes(first);
    const next = collectSlotHashes(second);
    expect(diffSlotIds(prev, next)).toEqual(["root/page:p1:0/slot:s1:0"]);
  });

  it("shrinks text to fit inside slot", () => {
    const container = { style: {} } as HTMLElement;
    const inner = { style: {} } as HTMLElement;
    const previousWindow = globalThis.window as any;
    (globalThis as any).window = {
      getComputedStyle: (el: HTMLElement) => ({ fontSize: el.style.fontSize || "14px" }),
    };
    container.style.width = "100px";
    container.style.height = "50px";
    inner.style.fontSize = "20px";

    Object.defineProperty(container, "clientWidth", { value: 100 });
    Object.defineProperty(container, "clientHeight", { value: 50 });
    Object.defineProperty(inner, "scrollWidth", {
      get: () => parseFloat(inner.style.fontSize || "20") * 6,
    });
    Object.defineProperty(inner, "scrollHeight", {
      get: () => parseFloat(inner.style.fontSize || "20") * 3,
    });

    const size = shrinkToFit(container, inner);
    expect(size).toBeLessThanOrEqual(17);
    expect(size).toBeGreaterThanOrEqual(6);
    if (previousWindow) {
      (globalThis as any).window = previousWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  it("scales down to fit inside slot", () => {
    const container = { style: {} } as HTMLElement;
    const inner = { style: {} } as HTMLElement;
    Object.defineProperty(container, "clientWidth", { value: 100 });
    Object.defineProperty(container, "clientHeight", { value: 50 });
    Object.defineProperty(inner, "scrollWidth", { value: 200 });
    Object.defineProperty(inner, "scrollHeight", { value: 100 });

    const scale = scaleDownToFit(container, inner);
    expect(scale).toBeCloseTo(0.5, 2);
    expect(inner.style.transform).toContain("scale(0.5");
  });

  it("applies slot patches inside the preview document", () => {
    const inner = { innerHTML: "<span>Old</span>" } as HTMLElement;
    const slot = {
      querySelector: (selector: string) => (selector.includes("data-flux-slot-inner") ? inner : null),
    } as unknown as Element;
    const root = {
      querySelector: (selector: string) => (selector.includes('data-flux-id="slot-1"') ? slot : null),
    };

    const missing = applySlotPatches(root, { "slot-1": "<span>Updated</span>" });
    expect(inner.innerHTML).toBe("<span>Updated</span>");
    expect(missing).toEqual([]);

    const missingAgain = applySlotPatches(root, { "slot-1": "<span>Next</span>" });
    expect(inner.innerHTML).toBe("<span>Next</span>");
    expect(missingAgain).toEqual([]);
  });
});
