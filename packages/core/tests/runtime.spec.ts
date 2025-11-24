// tests/runtime.spec.ts

import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import { initRuntimeState, runDocstepOnce, handleEvent } from "../src/runtime/kernel";
import type { FluxEvent } from "../src/runtime/model";

describe("Flux runtime v0.1", () => {
    const src = `
      document {
        meta {
          title   = "Runtime Smoke Test";
          version = "0.1.0";
        }

        state {
          param tempo   : float [40, 72] @ 60;
          param density : float [0.0, 1.0] @ 0.25;
        }

        grid main {
          topology = grid;
          size { rows = 1; cols = 2; }

          cell c1 {
            tags    = [ noise ];
            content = "start";
            dynamic = 0.3;
          }

          cell c2 {
            tags    = [ tone ];
            content = "sustain";
          }
        }

        runtime {
          eventsApply    = "immediate";
          docstepAdvance = [ timer(8 s) ];
        }
      }
    `;

    const doc = parseDocument(src);
    const initialState = initRuntimeState(doc);

    it("initializes RuntimeState from a FluxDocument", () => {
        expect(initialState.doc).toBe(doc);
        expect(initialState.docstepIndex).toBe(0);

        // params
        expect(initialState.params.tempo).toBe(60);
        expect(initialState.params.density).toBe(0.25);

        // grids
        const main = initialState.grids.main;
        expect(main).toBeDefined();
        expect(main.rows).toBe(1);
        expect(main.cols).toBe(2);
        expect(main.cells.length).toBe(2);
        expect(main.cells[0].id).toBe("c1");
        expect(main.cells[0].content).toBe("start");
        expect(main.cells[0].dynamic).toBe(0.3);
        expect(main.cells[1].id).toBe("c2");
        expect(main.cells[1].content).toBe("sustain");

        // runtimeConfig mirrors doc.runtime
        expect(initialState.runtimeConfig).toEqual(doc.runtime);
    });

    it("runDocstepOnce is pure and bumps docstepIndex", () => {
        const next = runDocstepOnce(doc, initialState);

        expect(next).not.toBe(initialState);
        expect(next.docstepIndex).toBe(initialState.docstepIndex + 1);

        // state shape is preserved for now
        expect(next.params).toEqual(initialState.params);
        expect(next.grids).toEqual(initialState.grids);
        expect(next.runtimeConfig).toEqual(initialState.runtimeConfig);
    });

    it("handleEvent is a no-op placeholder in v0.1", () => {
        const event: FluxEvent = {
            type: "click",
            gridName: "main",
            cellId: "c1",
            payload: { note: "test" },
        };

        const next = handleEvent(doc, initialState, event);

        // For now, handleEvent does not change the state.
        expect(next).toEqual(initialState);
    });
});

