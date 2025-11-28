import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createRuntime, parseDocument } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const heroPath = path.join(__dirname, "..", "..", "..", "examples", "hero-test-doc.flux");
const heroSource = readFileSync(heroPath, "utf8");
const simpleSource = `
document {
  meta {
    title = "Materials runtime smoke";
    version = "0.1.0";
  }

  state {
    param tempo : float [40, 200] @ 120;
  }

  grid main {
    topology = grid;
    size { rows = 1; cols = 2; }

    cell a { tags = [ seed ]; content = "seed"; dynamic = 0.5; }
    cell b { tags = [ pulse ]; content = "pulse"; dynamic = 0.1; }
  }

  runtime { docstepAdvance = [ timer(1 s) ]; }
}
`;

describe("materials parsing and runtime", () => {
  it("parses materials from the hero example", () => {
    const doc = parseDocument(heroSource);

    expect(doc.materials).toBeDefined();
    expect(doc.materials?.materials.length).toBeGreaterThanOrEqual(2);

    const first = doc.materials?.materials[0];
    expect(first?.name).toBe("pulseSeed");
    expect(first?.tags).toContain("pulse");
    expect(first?.label).toBe("pulse");
    expect(first?.color).toBe("#00CDFE");
    expect(first?.score?.text).toContain("mf");
  });

  it("steps the runtime and emits events", () => {
    const doc = parseDocument(simpleSource);
    const runtime = createRuntime(doc, { clock: "manual" });

    const snapshot0 = runtime.snapshot();
    expect(snapshot0.docstep).toBe(0);
    expect(snapshot0.params.tempo).toBe(120);

    const main = snapshot0.grids[0];
    expect(main.rows).toBe(1);
    expect(main.cols).toBe(2);

    const snapshot1 = runtime.step();
    expect(snapshot1.docstep).toBe(1);
    expect(runtime.docstep).toBe(1);
  });

  it("invokes onEvent callbacks for each emitted event", async () => {
    const doc = parseDocument(simpleSource);
    const received: number[] = [];

    const runtime = createRuntime(doc, {
      clock: "timer",
      docstepIntervalMs: 1,
      onDocstep: (snap) => received.push(snap.docstep),
    });

    runtime.start();
    await new Promise((resolve) => setTimeout(resolve, 5));
    runtime.stop();
    expect(received.length).toBeGreaterThan(0);
  });
});
