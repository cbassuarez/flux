import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import type { FluxDocument } from "../src/ast";

describe("Flux parser v0.1", () => {
  it("parses a minimal document", () => {
    const src = `
      document {
        meta {
          title   = "Minimal Flux";
          author  = "Test";
          version = "0.1.0";
        }

        state {
          param docstep : int [0, inf] @ 0;
        }
      }
    `;

    const doc: FluxDocument = parseDocument(src);

    expect(doc.meta.title).toBe("Minimal Flux");
    expect(doc.meta.version).toBe("0.1.0");
    expect(doc.state.params.length).toBe(1);
    expect(doc.state.params[0].name).toBe("docstep");
    expect(doc.grids.length).toBe(0);
    expect(doc.rules.length).toBe(0);
  });

  it("parses a document with one param and one grid", () => {
    const src = `
      document {
        meta {
          title   = "Grid Doc";
          version = "0.1.0";
        }

        state {
          param tempo : float [40, 72] @ 60;
        }

        pageConfig {
          size {
            width  = 210;
            height = 297;
            units  = "mm";
          }
        }

        grid main {
          topology = grid;
          page     = 1;
          size {
            rows = 2;
            cols = 3;
          }

          cell c11 {
            tags    = [ noise, perc ];
            content = "irregular scratches, low";
            dynamic = 0.3;
          }

          cell c12 {
            tags    = [ tone, strings ];
            content = "sustained harmonic, 7-limit";
          }
        }
      }
    `;

    const doc: FluxDocument = parseDocument(src);

    expect(doc.state.params.length).toBe(1);
    expect(doc.state.params[0].name).toBe("tempo");

    expect(doc.pageConfig?.size.width).toBe(210);
    expect(doc.pageConfig?.size.units).toBe("mm");

    expect(doc.grids.length).toBe(1);
    const grid = doc.grids[0];
    expect(grid.name).toBe("main");
    expect(grid.topology).toBe("grid");
    expect(grid.size?.rows).toBe(2);
    expect(grid.cells.length).toBe(2);
    expect(grid.cells[0].id).toBe("c11");
  });

  it("parses a document with docstep and event rules", () => {
    const src = `
      document {
        meta {
          title   = "Rules Doc";
          version = "0.1.0";
        }

        state {
          param tempo   : float [40, 72] @ 60;
          param density : float [0.0, 1.0] @ 0.25;
          param docstep : int [0, inf] @ 0;
        }

        grid main {
          topology = grid;
          size { rows = 1; cols = 2; }

          cell c1 {
            tags    = [ noise ];
            content = "start";
          }

          cell c2 {
            tags    = [ tone ];
            content = "sustain";
          }
        }

        rule growNoise(mode = docstep, grid = main) {
          when cell.content == "" and neighbors.withTag("noise").count >= 2
          then {
            cell.content = "noise";
            cell.tags    = cell.tags + { noise };
          }
        }

        rule echoInput(mode = event, grid = main, on = "input") {
          when event.type == "input"
          then {
            let target = grid.main.nearestTo(event.location);
            target.content = event.payload.text;
          }
        }

        runtime {
          eventsApply = "deferred";
          docstepAdvance = [ timer(8s) ];
        }
      }
    `;

    const doc: FluxDocument = parseDocument(src);

    expect(doc.rules.length).toBe(2);

    const growNoise = doc.rules[0];
    expect(growNoise.name).toBe("growNoise");
    expect(growNoise.mode).toBe("docstep");
    expect(growNoise.scope?.grid).toBe("main");

    const echoInput = doc.rules[1];
    expect(echoInput.name).toBe("echoInput");
    expect(echoInput.mode).toBe("event");
    expect(echoInput.onEventType).toBe("input");

    expect(doc.runtime?.eventsApply).toBe("deferred");
    expect(doc.runtime?.docstepAdvance?.length).toBe(1);
    expect(doc.runtime?.docstepAdvance?.[0].kind).toBe("timer");
  });
});
