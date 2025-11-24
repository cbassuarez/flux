// tests/runtime.kernel.spec.ts (only the assertions block needs tweaking)
import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import { initRuntimeState, runDocstepOnce } from "../src/runtime/kernel";

describe("Flux runtime v0.1 kernel", () => {
    it("applies a grid-scoped docstep rule with neighbors.all().dynamic", () => {
        const src = `
      document {
        state {
          param docstep : int [0, inf] @ 0;
        }

        grid main {
          topology = grid;
          size { rows = 1; cols = 3; }

          cell c1 {
            tags    = [ noise ];
            content = "";
            dynamic = 0.6;
          }

          cell c2 {
            tags    = [ noise ];
            content = "";
            dynamic = 0.6;
          }

          cell c3 {
            tags    = [ noise ];
            content = "";
            dynamic = 0.4;
          }
        }

        rule growNoise(mode = docstep, grid = main) {
          when cell.content == "" and neighbors.all().dynamic > 0.5
          then {
            cell.content = "noise";
          }
        }
      }
    `;

        const doc = parseDocument(src);
        const state0 = initRuntimeState(doc);

        expect(state0.docstepIndex).toBe(0);

        const grid0 = state0.grids.main;
        expect(grid0.cells[0].content).toBe("");
        expect(grid0.cells[1].content).toBe("");
        expect(grid0.cells[2].content).toBe("");

        const state1 = runDocstepOnce(doc, state0);

        // Docstep advances
        expect(state1.docstepIndex).toBe(1);

        const grid = state1.grids["main"];

        // neighbors.all().dynamic is averaged:
        // - For c1: neighbors = [c2] => 0.6 > 0.5 => "noise"
        // - For c2: neighbors = [c1, c3] => (0.6 + 0.4)/2 = 0.5 => not > 0.5 => ""
        // - For c3: neighbors = [c2] => 0.6 > 0.5 => "noise"
        expect(grid.cells[0].content).toBe("noise");
        expect(grid.cells[1].content).toBe("");
        expect(grid.cells[2].content).toBe("noise");

        // Params unchanged
        expect(state1.params.docstep).toBe(0);
    });

    // second test can stay as-is unless it also used 2D cells
});
