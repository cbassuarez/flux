import type { SlotGeneratorSpec } from "./slotRuntime";

export function normalizeVariantLiteralValue(value: string | null): string | null {
  if (value === "null") return null;
  return value;
}

export function isChooseCycleSpec(
  spec: SlotGeneratorSpec | null | undefined,
): spec is Extract<SlotGeneratorSpec, { kind: "choose" | "cycle" }> {
  return spec?.kind === "choose" || spec?.kind === "cycle";
}

export function hasEmptyValue(spec: SlotGeneratorSpec | null | undefined): boolean {
  if (!isChooseCycleSpec(spec)) return false;
  return spec.values.some((value) => value === "");
}

export function buildGeneratorExpr(spec: SlotGeneratorSpec): any | null {
  if (spec.kind === "literal") {
    return { kind: "Literal", value: normalizeVariantLiteralValue(spec.value) };
  }
  if (spec.kind === "choose" || spec.kind === "cycle") {
    return {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: spec.kind },
      args: spec.values.map((value) => ({ kind: "Literal", value: normalizeVariantLiteralValue(value) })),
    };
  }
  if (spec.kind === "assetsPick") {
    return {
      kind: "CallExpression",
      callee: {
        kind: "MemberExpression",
        object: { kind: "Identifier", name: "assets" },
        property: "pick",
      },
      args: spec.tags.map((tag) => ({ kind: "Literal", value: tag })),
    };
  }
  if (spec.kind === "poisson") {
    return {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: "poisson" },
      args: [{ kind: "Literal", value: spec.ratePerSec }],
    };
  }
  if (spec.kind === "at") {
    return {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: "at" },
      args: [
        ...spec.times.map((time) => ({ kind: "Literal", value: time })),
        ...spec.values.map((value) => ({ kind: "Literal", value: normalizeVariantLiteralValue(value) })),
      ],
    };
  }
  if (spec.kind === "every") {
    return {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: "every" },
      args: [
        { kind: "Literal", value: spec.amount },
        ...(spec.values ?? []).map((value) => ({ kind: "Literal", value: normalizeVariantLiteralValue(value) })),
      ],
    };
  }
  return null;
}

export function wrapExpressionValue(expr: any): Record<string, unknown> {
  return { kind: "ExpressionValue", expr };
}
