import { describe, expect, it } from "vitest";
import { buildGeneratorExpr, wrapExpressionValue } from "./generatorUtils";
import type { SlotGeneratorSpec } from "./slotRuntime";

describe("slot generator expression", () => {
  it("preserves choose call expression when editing variants", () => {
    const spec: SlotGeneratorSpec = { kind: "choose", values: [null, "nul"] };
    const expr = buildGeneratorExpr(spec);
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
