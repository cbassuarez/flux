// tests/runtime.events.spec.ts
//
// Coverage for the rule calculus the parser accepts and the kernel now executes:
// `let` bindings, multi-branch rules, `advanceDocstep()`, and event-mode rules
// under each `runtime.eventsApply` policy.

import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import { initRuntimeState, runDocstepOnce, handleEvent } from "../src/runtime/kernel";
import type { FluxEvent } from "../src/runtime/model";

function setup(src: string) {
  const doc = parseDocument(src);
  return { doc, state: initRuntimeState(doc) };
}

describe("kernel: docstep rule calculus", () => {
  it("provides a deterministic math stdlib to rule expressions", () => {
    const { doc, state } = setup(`
      document {
        state {
          param level : float [0, 100] @ 80;
          param decayed : float [0, 100] @ 0;
          param bounded : float [0, 100] @ 0;
        }
        rule maths(mode = docstep) {
          when true then {
            decayed = max(0, level - 95);
            bounded = clamp(level * 2, 0, 100);
          }
        }
      }
    `);

    const next = runDocstepOnce(doc, state);
    expect(next.params.decayed).toBe(0); // max(0, 80-95) = 0
    expect(next.params.bounded).toBe(100); // clamp(160, 0, 100) = 100
  });

  it("evaluates `let` bindings within a docstep rule", () => {
    const { doc, state } = setup(`
      document {
        state {
          param level : float [0, 100] @ 10;
        }
        rule ramp(mode = docstep) {
          when level < 100
          then {
            let bump = level * 2;
            level = bump + 5;
          }
        }
      }
    `);

    const next = runDocstepOnce(doc, state);
    expect(next.params.level).toBe(25); // 10*2 + 5
  });

  it("runs the first matching branch (else-when semantics) and the else branch", () => {
    const src = (initial: number) => `
      document {
        state {
          param x     : int [0, 10] @ ${initial};
          param label : string @ "none";
        }
        rule classify(mode = docstep) {
          when x > 5 then { label = "high"; }
          else when x > 2 then { label = "mid"; }
          else { label = "low"; }
        }
      }
    `;

    const labelAfterStep = (initial: number): unknown => {
      const { doc, state } = setup(src(initial));
      return runDocstepOnce(doc, state).params.label;
    };

    expect(labelAfterStep(8)).toBe("high");
    expect(labelAfterStep(3)).toBe("mid");
    expect(labelAfterStep(1)).toBe("low");
  });
});

describe("kernel: event handling", () => {
  const docSrc = (policy: string) => `
    document {
      state {
        param score   : int [0, 100] @ 0;
        param lastHit : string @ "none";
      }
      grid board {
        topology = grid;
        size { rows = 1; cols = 1; }
        cell c1 { tags = [ a ]; content = "idle"; dynamic = 0; }
      }
      rule onClick(mode = event, on = "click", grid = board) {
        when true
        then {
          cell.content = "hit";
          score = score + 10;
        }
      }
      runtime {
        eventsApply = "${policy}";
      }
    }
  `;

  const clickEvent: FluxEvent = { type: "click" };

  it("immediate policy applies both cell and param writes now", () => {
    const { doc, state } = setup(docSrc("immediate"));
    const next = handleEvent(doc, state, clickEvent);

    expect(next.grids.board.cells[0].content).toBe("hit");
    expect(next.params.score).toBe(10);
    expect(next.docstepIndex).toBe(0); // no advance
  });

  it("default (cellImmediateParamsDeferred) applies cells now, defers params", () => {
    const { doc, state } = setup(docSrc("cellImmediateParamsDeferred"));
    const next = handleEvent(doc, state, clickEvent);

    // Cell applied immediately...
    expect(next.grids.board.cells[0].content).toBe("hit");
    // ...but the param write is queued, not yet visible.
    expect(next.params.score).toBe(0);

    // It lands on the next docstep.
    const stepped = runDocstepOnce(doc, next);
    expect(stepped.params.score).toBe(10);
  });

  it("deferred policy queues both cell and param writes until the next docstep", () => {
    const { doc, state } = setup(docSrc("deferred"));
    const next = handleEvent(doc, state, clickEvent);

    expect(next.grids.board.cells[0].content).toBe("idle");
    expect(next.params.score).toBe(0);

    const stepped = runDocstepOnce(doc, next);
    expect(stepped.grids.board.cells[0].content).toBe("hit");
    expect(stepped.params.score).toBe(10);
  });

  it("exposes the triggering event to event-mode rules", () => {
    const { doc, state } = setup(`
      document {
        state { param last : int [0, 999] @ 0; }
        rule capture(mode = event, on = "input") {
          when true then { last = event.payload.value; }
        }
        runtime { eventsApply = "immediate"; }
      }
    `);

    const next = handleEvent(doc, state, { type: "input", payload: { value: 42 } } as FluxEvent);
    expect(next.params.last).toBe(42);
  });

  it("advanceDocstep() in an event rule runs a docstep after the event", () => {
    const { doc, state } = setup(`
      document {
        state { param ticks : int [0, 999] @ 0; }
        rule tick(mode = docstep) {
          when true then { ticks = ticks + 1; }
        }
        rule go(mode = event, on = "transport") {
          when true then { advanceDocstep(); }
        }
        runtime { eventsApply = "immediate"; }
      }
    `);

    expect(state.docstepIndex).toBe(0);
    const next = handleEvent(doc, state, { type: "transport" } as FluxEvent);

    expect(next.docstepIndex).toBe(1);
    expect(next.params.ticks).toBe(1);
  });
});
