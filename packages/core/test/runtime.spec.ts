import { describe, expect, it } from "vitest";
import { createRuntime, getDocstepIntervalHint, parseDocument } from "../src/index";

const LANDING_EXAMPLE_SOURCE = `
document {
  meta {
    title   = "Landing Example";
    version = "0.1.0";
  }

  state {
    param tempo : float [40, 72] @ 60;
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

  runtime {
    eventsApply    = "deferred";
    docstepAdvance = [ timer(8 s) ];
  }

  rule growNoise(mode = docstep, grid = main) {
    when cell.content == "" and neighbors.all().dynamic > 0.5
    then {
      cell.content = "noise";
      cell.dynamic = 0.6;
    }
  }
}
`;

describe("Flux runtime", () => {
  it("creates a runtime and initial snapshot from the landing example", () => {
    const doc = parseDocument(LANDING_EXAMPLE_SOURCE);
    const runtime = createRuntime(doc, { seed: 1234 });

    const snapshot = runtime.getSnapshot();

    expect(snapshot.docstep).toBe(0);
    expect(snapshot.grids).toHaveLength(1);

    const main = snapshot.grids[0];
    expect(main.name).toBe("main");
    expect(main.rows).toBe(1);
    expect(main.cols).toBe(3);

    const c1 = main.cells.find((cell) => cell.id === "c1");
    expect(c1).toBeDefined();
    expect(c1?.content).toBe("");
    expect(c1?.dynamic).toBeCloseTo(0.6);
  });

  it("applies growNoise rule based on neighbors", () => {
    const doc = parseDocument(LANDING_EXAMPLE_SOURCE);
    const runtime = createRuntime(doc, { seed: 1234 });

    const snap0 = runtime.getSnapshot();
    const snap1 = runtime.stepDocstep();

    expect(snap1.docstep).toBe(1);

    const main0 = snap0.grids[0];
    const main1 = snap1.grids[0];

    const changedCells = main1.cells.filter((cell1, idx) => {
      const cell0 = main0.cells[idx];
      return cell0.content !== cell1.content || cell0.dynamic !== cell1.dynamic;
    });

    expect(changedCells.length).toBeGreaterThan(0);
  });

  it("is deterministic with the same seed", () => {
    const doc1 = parseDocument(LANDING_EXAMPLE_SOURCE);
    const doc2 = parseDocument(LANDING_EXAMPLE_SOURCE);

    const r1 = createRuntime(doc1, { seed: 42 });
    const r2 = createRuntime(doc2, { seed: 42 });

    for (let i = 0; i < 5; i++) {
      r1.stepDocstep();
      r2.stepDocstep();
    }

    expect(r1.getSnapshot()).toEqual(r2.getSnapshot());
  });

  it("extracts the docstep interval hint", () => {
    const doc = parseDocument(LANDING_EXAMPLE_SOURCE);
    const hint = getDocstepIntervalHint(doc);
    expect(hint).not.toBeNull();
    expect(hint?.millis).toBe(8000);
  });
});
