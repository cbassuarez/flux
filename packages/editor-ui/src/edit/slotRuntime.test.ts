import { describe, expect, it } from "vitest";
import {
  formatRefreshPolicy,
  formatTransitionSpec,
  parseRefreshPolicyString,
  parseTransitionSpec,
  simulateSlotChanges,
  type SlotGeneratorSpec,
} from "./slotRuntime";

describe("slot runtime policy parsing", () => {
  it("parses refresh policies", () => {
    const every = parseRefreshPolicyString("every(1.2s, 0.4s)");
    expect(every).toEqual({ kind: "every", amount: 1.2, unit: "s", phase: 0.4, phaseUnit: "s" });

    const chance = parseRefreshPolicyString("chance(0.25, docstep)");
    expect(chance).toEqual({ kind: "chance", p: 0.25, every: { kind: "docstep" } });
  });

  it("formats refresh policies", () => {
    const formatted = formatRefreshPolicy({ kind: "chance", p: 0.5, every: { kind: "every", amount: 2, unit: "s" } } as any);
    expect(formatted).toBe("chance(0.5, 2s)");
  });

  it("parses transition policies", () => {
    const fade = parseTransitionSpec("fade(220ms, inOut)");
    expect(fade).toEqual({ kind: "fade", durationMs: 220, ease: "inOut" });

    const wipe = parseTransitionSpec("wipe(left, 180ms, out)");
    expect(wipe).toEqual({ kind: "wipe", direction: "left", durationMs: 180, ease: "out" });
  });

  it("formats transition policies", () => {
    const formatted = formatTransitionSpec({ kind: "flash", durationMs: 120 });
    expect(formatted).toBe("flash(120ms)");
  });
});

describe("slot runtime simulation", () => {
  it("is deterministic for the same seed/runtime", () => {
    const spec: SlotGeneratorSpec = { kind: "choose", values: ["Alpha", "Beta", "Gamma"] };
    const runtime = { seed: 7, timeSec: 0, docstep: 0 };
    const refresh = { kind: "every", amount: 1, unit: "s" } as any;

    const first = simulateSlotChanges(spec, refresh, runtime, "slot1", [], 6);
    const second = simulateSlotChanges(spec, refresh, runtime, "slot1", [], 6);
    expect(second).toEqual(first);
  });
});
