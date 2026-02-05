import { describe, it, expect } from "vitest";
import { renderHtml } from "../src/index.js";
import type { RenderDocumentIR, RenderNodeIR } from "@flux-lang/core";

function makeInlineSlotDoc(): RenderDocumentIR {
  const inlineSlot: RenderNodeIR = {
    nodeId: "slot1",
    id: "slot1",
    kind: "inline_slot",
    props: {},
    children: [
      {
        nodeId: "section1",
        id: "section1",
        kind: "section",
        props: {},
        children: [
          {
            nodeId: "text1",
            id: "text1",
            kind: "text",
            props: { content: "Inline" },
            children: [],
            refresh: { kind: "never" },
          },
        ],
        refresh: { kind: "never" },
      },
    ],
    refresh: { kind: "never" },
    slot: {
      reserve: { kind: "fixedWidth", width: 8, units: "ch" },
      fit: "ellipsis",
    },
  };

  return {
    meta: { version: "0.3.0" },
    seed: 0,
    time: 0,
    docstep: 0,
    assets: [],
    body: [inlineSlot],
  };
}

describe("inline slot rendering", () => {
  it("renders inline_slot with span wrappers only", () => {
    const doc = makeInlineSlotDoc();
    const { html } = renderHtml(doc);
    expect(html).toContain("data-flux-slot-inner");
    expect(html).toContain("<span");
    expect(html).not.toContain("<div class=\"flux-inline-slot\"");
    expect(html).not.toContain("<section class=\"flux-section\"");
  });
});
