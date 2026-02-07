import { describe, expect, it } from "vitest";
import { buildGeneratorExpr, promoteVariants, wrapExpressionValue } from "./generatorUtils";
import type { SlotGeneratorSpec } from "./slotRuntime";

describe("slot generator expression", () => {
  it("promotes literal to choose with non-empty placeholder", () => {
    const baseSpec: SlotGeneratorSpec = { kind: "literal", value: null };
    const promotion = promoteVariants(baseSpec, []);
    expect(promotion).not.toBeNull();
    expect(promotion?.nextSpec.kind).toBe("choose");
    expect(promotion?.nextSpec.values.length).toBe(2);
    expect(promotion?.nextSpec.values[0]).toBeNull();
    expect(typeof promotion?.nextSpec.values[1]).toBe("string");
    expect(promotion?.nextSpec.values[1]).not.toBe("");
    expect(promotion?.nextVariants).toEqual(promotion?.nextSpec.values);
  });

  it("appends placeholder when adding variant to choose", () => {
    const baseSpec: SlotGeneratorSpec = { kind: "choose", values: [null, "x"] };
    const promotion = promoteVariants(baseSpec, [null, "x"]);
    expect(promotion).not.toBeNull();
    expect(promotion?.nextSpec.kind).toBe("choose");
    expect(promotion?.nextSpec.values.length).toBe(3);
    expect(promotion?.nextSpec.values[2]).not.toBe("");
  });

  it("preserves choose call expression when editing variants", () => {
    const spec: SlotGeneratorSpec = { kind: "choose", values: [null, "x"] };
    const edited: SlotGeneratorSpec = { ...spec, values: [spec.values[0], "nul"] };
    const expr = buildGeneratorExpr(edited);
    expect(expr).not.toBeNull();

    const generator = wrapExpressionValue(expr);
    expect(generator.kind).toBe("ExpressionValue");
    expect(generator.expr.kind).toBe("CallExpression");
    expect(generator.expr.callee).toEqual({ kind: "Identifier", name: "choose" });
    expect(generator.expr.args).toEqual([
      { kind: "Literal", value: null },
      { kind: "Literal", value: "nul" },
    ]);
    expect(generator.expr).not.toEqual({ kind: "Literal", value: "nul" });
  });
});
