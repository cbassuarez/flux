// tests/render.events.spec.ts
//
// End-to-end: an input event mutates a param via an event rule, and the change
// surfaces in the rendered body tree through the document runtime. This is the
// bridge that makes documents interactive, not just deterministically evolving.

import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import { createDocumentRuntime, renderDocument } from "../src/render";

const findNodeById = (nodes: any[], id: string): any | undefined => {
  for (const node of nodes ?? []) {
    if (node?.id === id) return node;
    const child = findNodeById(node?.children ?? [], id);
    if (child) return child;
  }
  return undefined;
};

// Interaction model: an event mutates state and advances the docstep, so
// docstep-refreshing nodes re-evaluate. The node opts into reactivity via
// `refresh = docstep`.
const interactiveDoc = `
  document {
    meta { version = "0.2.0"; }
    state { param score : int [0, 999] @ 0; }
    body {
      page p1 {
        text scoreLabel { refresh = docstep; content = @score; }
      }
    }
    rule bump(mode = event, on = "click") {
      when true then { score = score + 10; advanceDocstep(); }
    }
    runtime { eventsApply = "immediate"; }
  }
`;

describe("document runtime: events flow into the rendered body", () => {
  it("reflects an event-driven param change in the rendered node", () => {
    const doc = parseDocument(interactiveDoc);
    const runtime = createDocumentRuntime(doc);

    const before = runtime.render();
    expect(findNodeById(before.body, "scoreLabel")?.props?.content).toBe(0);

    const after = runtime.applyEvent({ type: "click" });
    expect(findNodeById(after.body, "scoreLabel")?.props?.content).toBe(10);

    runtime.applyEvent({ type: "click" });
    const third = runtime.render();
    expect(findNodeById(third.body, "scoreLabel")?.props?.content).toBe(20);
  });

  it("ignores events with no matching rule", () => {
    const doc = parseDocument(interactiveDoc);
    const runtime = createDocumentRuntime(doc);

    const after = runtime.applyEvent({ type: "hover" });
    expect(findNodeById(after.body, "scoreLabel")?.props?.content).toBe(0);
  });

  it("does not perturb the deterministic static render path", () => {
    // A fresh runtime that never receives events must match a plain render.
    const doc = parseDocument(interactiveDoc);
    const plain = renderDocument(doc, { docstep: 0 });
    const viaRuntime = createDocumentRuntime(doc).render();
    expect(viaRuntime).toEqual(plain);
  });
});
