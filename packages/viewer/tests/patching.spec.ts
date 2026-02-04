// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { RenderDocumentIR, RenderNodeIR } from "@flux-lang/core";
import { collectSlotHashes, diffSlotIds, shrinkToFit, scaleDownToFit } from "../src/patching";

function makeSlot(content: string): RenderNodeIR {
  return {
    nodeId: "root/page:p1:0/slot:s1:0",
    id: "s1",
    kind: "slot",
    props: {},
    refresh: { kind: "onDocstep" },
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
        refresh: { kind: "onDocstep" },
        children: [],
      },
    ],
  };
}

function makeDoc(slot: RenderNodeIR): RenderDocumentIR {
  return {
    meta: { version: "0.2.0" },
    seed: 0,
    time: 0,
    docstep: 0,
    assets: [],
    body: [
      {
        nodeId: "root/page:p1:0",
        id: "p1",
        kind: "page",
        props: {},
        refresh: { kind: "onLoad" },
        children: [slot],
      },
    ],
  };
}

describe("viewer patching", () => {
  it("diffs by nodeId and only returns changed slots", () => {
    const first = makeDoc(makeSlot("hello"));
    const second = makeDoc(makeSlot("world"));
    const prev = collectSlotHashes(first);
    const next = collectSlotHashes(second);
    expect(diffSlotIds(prev, next)).toEqual(["root/page:p1:0/slot:s1:0"]);
  });

  it("shrinks text to fit inside slot", () => {
    const container = document.createElement("div");
    const inner = document.createElement("div");
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
    expect(size).toBeLessThanOrEqual(16.5);
    expect(size).toBeGreaterThanOrEqual(6);
  });

  it("scales down to fit inside slot", () => {
    const container = document.createElement("div");
    const inner = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 100 });
    Object.defineProperty(container, "clientHeight", { value: 50 });
    Object.defineProperty(inner, "scrollWidth", { value: 200 });
    Object.defineProperty(inner, "scrollHeight", { value: 100 });

    const scale = scaleDownToFit(container, inner);
    expect(scale).toBeCloseTo(0.5, 2);
    expect(inner.style.transform).toContain("scale(0.5");
  });
});
