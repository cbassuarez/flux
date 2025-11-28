import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createRuntime, parseDocument } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const heroPath = path.join(__dirname, "..", "..", "..", "examples", "hero-test-doc.flux");
const heroSource = readFileSync(heroPath, "utf8");

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
    const doc = parseDocument(heroSource);
    const runtime = createRuntime(doc, { clock: "manual" });

    const snapshot0 = runtime.getSnapshot();
    expect(snapshot0.docstep).toBe(0);
    expect(snapshot0.params.tempo).toBe(96);
    expect(snapshot0.params.spawnProb).toBeCloseTo(0.3);

    const main = snapshot0.grids[0];
    expect(main.rows).toBe(2);
    expect(main.cols).toBe(4);

    const { snapshot: snapshot1, events } = runtime.stepDocstep();
    expect(snapshot1.docstep).toBe(1);

    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("docstep");

    const cellEvents = events.filter((e) => e.kind === "cellChanged");
    expect(cellEvents.length).toBeGreaterThanOrEqual(1);

    const materialEvents = events.filter((e) => e.kind === "materialTrigger");
    expect(materialEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("invokes onEvent callbacks for each emitted event", () => {
    const doc = parseDocument(heroSource);
    const received: string[] = [];

    const runtime = createRuntime(doc, {
      clock: "manual",
      onEvent: (ev) => received.push(ev.kind),
    });

    runtime.stepDocstep();
    expect(received).toContain("docstep");
    expect(received.length).toBeGreaterThanOrEqual(2);
  });
});
