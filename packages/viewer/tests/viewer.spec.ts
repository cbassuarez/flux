import { describe, expect, it } from "vitest";
import { parseDocument, createDocumentRuntimeIR } from "@flux-lang/core";
import { advanceViewerRuntime } from "../src/index";

describe("viewer server", () => {
  it("advances time and docstep on the wallclock tick", () => {
    const source = `
      document {
        meta { version = "0.2.0"; }
        body {
          page p1 {
            text t1 { refresh = every(1s); content = @"t=" + time; }
          }
        }
      }
    `;

    const doc = parseDocument(source);
    const runtime = createDocumentRuntimeIR(doc, { seed: 1 });
    const initial = runtime.render();

    const tick1 = advanceViewerRuntime(runtime, {}, true, 0.5);
    const tick2 = advanceViewerRuntime(runtime, {}, true, 0.5);

    expect(tick1.ir.docstep).toBe(initial.docstep + 1);
    expect(tick2.ir.docstep).toBe(initial.docstep + 2);
    expect(tick2.ir.time).toBeGreaterThan(initial.time);
    expect(tick2.ir.time).toBeCloseTo(1, 4);
  });
});
