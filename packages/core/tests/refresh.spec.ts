import { describe, it, expect } from "vitest";
import { parseDocument } from "../src/parser";
import { didFire, renderDocumentIR } from "../src/render";
import type { RefreshPolicy } from "../src/ast";

describe("refresh triggers", () => {
  it("is deterministic for the same seed/time/docstep", () => {
    const policy: RefreshPolicy = { kind: "poisson", ratePerSec: 0.15 };
    const ctx = { seed: 7, slotId: "slot-1", timeSec: 2.0, docstep: 5 };
    const first = didFire(policy, ctx);
    const second = didFire(policy, ctx);
    expect(second).toEqual(first);
  });

  it("keeps chance decisions stable within the same time bucket", () => {
    const policy: RefreshPolicy = {
      kind: "chance",
      p: 0.25,
      every: { kind: "time", intervalSec: 0.25 },
    };
    const firedA = didFire(policy, { seed: 1, slotId: "slot-a", timeSec: 1.01, docstep: 0 }).fired;
    const firedB = didFire(policy, { seed: 1, slotId: "slot-a", timeSec: 1.2, docstep: 0 }).fired;
    expect(firedB).toBe(firedA);
  });

  it("keeps poisson decisions stable within the same time bucket", () => {
    const policy: RefreshPolicy = { kind: "poisson", ratePerSec: 0.2 };
    const firedA = didFire(policy, { seed: 3, slotId: "slot-b", timeSec: 0.51, docstep: 0 }).fired;
    const firedB = didFire(policy, { seed: 3, slotId: "slot-b", timeSec: 0.6, docstep: 0 }).fired;
    expect(firedB).toBe(firedA);
  });
});

describe("slot presentation metadata", () => {
  it("normalizes transitions and exposes value hashes", () => {
    const src = `
      document {
        meta { version = "0.3.0"; }
        body {
          page p1 {
            slot s1 {
              refresh = every("1s");
              transition = fade(duration=220ms, ease="inOut");
              text t1 { content = "hello"; }
            }
          }
        }
      }
    `;
    const doc = parseDocument(src);
    const rendered = renderDocumentIR(doc, { seed: 1, time: 0, docstep: 0 });
    const slotId = Object.keys(rendered.slotMeta ?? {})[0];
    const meta = slotId ? rendered.slotMeta?.[slotId] : null;
    expect(meta?.valueHash).toBeTruthy();
    expect(meta?.transition).toMatchObject({ type: "fade", durationMs: 220, ease: "inOut" });
  });
});
