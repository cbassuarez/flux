import { useEffect, useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import type { DocumentNode, NodePropValue } from "@flux-lang/core";
import type { DocIndexEntry, EditorTransform } from "../docService";
import type { SlotGeneratorSpec } from "../slotRuntime";
import { extractPlainText, getLiteralString } from "../docModel";
import RichTextEditor from "../RichTextEditor";
import { formatNodeLabel } from "./formatNodeLabel";

type InspectorPaneProps = {
  selectedEntry: DocIndexEntry | null;
  onApplyTransform: (transform: EditorTransform) => void;
  transformError: string | null;
};

type CaptionTarget = { kind: "prop" | "text"; id: string; value: string };

type SlotProgram = {
  spec: SlotGeneratorSpec | null;
  raw: unknown;
  source: { kind: "prop" | "text"; key?: string; textId?: string };
};

type EditableValue = string | number | boolean;

function readLiteralValue(value: NodePropValue | unknown): EditableValue | null {
  if (value && typeof value === "object" && (value as any).kind === "LiteralValue") {
    const literal = (value as any).value;
    if (typeof literal === "string" || typeof literal === "number" || typeof literal === "boolean") return literal;
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function wrapLiteralValue(value: EditableValue): NodePropValue {
  return { kind: "LiteralValue", value } as NodePropValue;
}

function resolveCaptionTarget(node: DocumentNode): CaptionTarget | null {
  const propCaption = getLiteralString(node.props?.caption);
  if (propCaption !== null) return { kind: "prop", id: node.id, value: propCaption ?? "" };
  const captionNode = findCaptionTextNode(node);
  if (captionNode) {
    return {
      kind: "text",
      id: captionNode.id,
      value: getLiteralString(captionNode.props?.content) ?? extractPlainText(captionNode),
    };
  }
  return null;
}

function findCaptionTextNode(node: DocumentNode): DocumentNode | null {
  let fallback: DocumentNode | null = null;
  const visit = (current: DocumentNode): DocumentNode | null => {
    if (current.kind === "text") {
      const role = getLiteralString(current.props?.role) ?? "";
      const style = getLiteralString(current.props?.style) ?? "";
      if (/caption/i.test(role) || /caption/i.test(style)) return current;
      if (!fallback) fallback = current;
    }
    for (const child of current.children ?? []) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(node) ?? fallback;
}

function readSlotProgram(node: DocumentNode): SlotProgram {
  const props = node.props ?? {};
  const textChild = node.children?.find((child) => child.kind === "text");
  const propEntry = findSlotGeneratorProp(props);
  if (propEntry) {
    const expr = unwrapExpression(propEntry.value);
    const spec = parseGeneratorSpec(expr);
    return {
      spec,
      raw: propEntry.value,
      source: { kind: "prop", key: propEntry.key },
    };
  }
  if (textChild) {
    const value = getLiteralString(textChild.props?.content) ?? "";
    return {
      spec: { kind: "literal", value },
      raw: textChild.props?.content ?? null,
      source: { kind: "text", textId: textChild.id },
    };
  }
  const literalContent = getLiteralString(props.content as any);
  if (literalContent !== null) {
    return {
      spec: { kind: "literal", value: literalContent ?? "" },
      raw: props.content ?? null,
      source: { kind: "prop", key: "content" },
    };
  }
  return { spec: null, raw: null, source: { kind: "prop" } };
}

function findSlotGeneratorProp(props: Record<string, unknown>): { key: string; value: unknown } | null {
  const preferred = ["generator", "source", "program", "content", "value"];
  for (const key of preferred) {
    if (!(key in props)) continue;
    const value = (props as Record<string, unknown>)[key];
    if (key === "content" && isLiteralProp(value)) continue;
    if (value !== undefined) return { key, value };
  }
  for (const [key, value] of Object.entries(props)) {
    if (value && typeof value === "object" && !(value as any).kind) {
      return { key, value };
    }
    if (!isLiteralProp(value)) return { key, value };
  }
  return null;
}

function unwrapExpression(value: any): any {
  if (!value || typeof value !== "object") return value;
  if (value.kind === "LiteralValue") return { kind: "Literal", value: value.value };
  if (value.kind === "ExpressionValue" || value.kind === "ExprValue") {
    return value.expr ?? value.expression ?? value.value ?? value;
  }
  return value;
}

function parseGeneratorSpec(expr: any): SlotGeneratorSpec | null {
  if (!expr) return null;
  if (expr.kind === "choose" && Array.isArray(expr.values)) {
    return { kind: "choose", values: expr.values.map((value: any) => String(value)) };
  }
  if (expr.kind === "cycle" && Array.isArray(expr.values)) {
    return { kind: "cycle", values: expr.values.map((value: any) => String(value)) };
  }
  if (expr.kind === "literal" && "value" in expr) {
    return { kind: "literal", value: String(expr.value ?? "") };
  }
  if (expr.kind === "Literal") {
    return { kind: "literal", value: String(expr.value ?? "") };
  }
  if (expr.kind === "CallExpression") {
    const callee = getCalleeName(expr.callee);
    const args = Array.isArray(expr.args) ? expr.args : [];
    if (!callee) return { kind: "unknown", summary: "call" };
    if (callee === "choose" || callee === "cycle") {
      const values = extractStringList(args);
      return { kind: callee, values };
    }
    return { kind: "unknown", summary: callee };
  }
  if (expr.kind === "Identifier") {
    return { kind: "unknown", summary: expr.name ?? "identifier" };
  }
  return { kind: "unknown", summary: "expression" };
}

function getCalleeName(expr: any): string | null {
  if (!expr || typeof expr !== "object") return null;
  if (expr.kind === "Identifier") return expr.name;
  if (expr.kind === "MemberExpression") {
    const objectName = getCalleeName(expr.object);
    const property = expr.property;
    if (!objectName) return property ?? null;
    return `${objectName}.${property ?? ""}`.replace(/\.$/, "");
  }
  return null;
}

function extractStringList(args: any[]): string[] {
  const values: string[] = [];
  for (const arg of args) {
    const text = readStringLiteral(arg);
    if (text !== null) values.push(text);
  }
  return values;
}

function readStringLiteral(expr: any): string | null {
  if (!expr) return null;
  if (expr.kind === "Literal" && typeof expr.value === "string") return expr.value;
  if (expr.kind === "Literal" && typeof expr.value === "number") return String(expr.value);
  if (expr.kind === "Literal" && typeof expr.value === "boolean") return expr.value ? "true" : "false";
  return null;
}

function buildGeneratorExpr(spec: SlotGeneratorSpec): any | null {
  if (spec.kind === "literal") {
    return { kind: "Literal", value: spec.value };
  }
  if (spec.kind === "choose" || spec.kind === "cycle") {
    return {
      kind: "CallExpression",
      callee: { kind: "Identifier", name: spec.kind },
      args: spec.values.map((value) => ({ kind: "Literal", value })),
    };
  }
  return null;
}

function wrapExpressionValue(expr: any): Record<string, unknown> {
  return { kind: "ExpressionValue", expr };
}

function isLiteralProp(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as any).kind === "LiteralValue");
}

export default function InspectorPane({ selectedEntry, onApplyTransform, transformError }: InspectorPaneProps) {
  const node = selectedEntry?.node ?? null;
  const captionTarget = useMemo(() => (node ? resolveCaptionTarget(node) : null), [node]);
  const [captionDraft, setCaptionDraft] = useState(captionTarget?.value ?? "");
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [propDrafts, setPropDrafts] = useState<Record<string, EditableValue>>({});
  const [textDraft, setTextDraft] = useState(() => (node ? getLiteralString(node.props?.content) ?? "" : ""));
  const [richTextKey, setRichTextKey] = useState(0);

  const propFields = useMemo(() => {
    if (!node) return [];
    return Object.entries(node.props ?? {}).filter(([key, value]) => {
      if (key === "caption") return false;
      const literal = readLiteralValue(value);
      return literal !== null;
    });
  }, [node]);

  const slotProgram = useMemo(() => (node ? readSlotProgram(node) : null), [node]);
  const baseSpec = slotProgram?.spec ?? null;
  const baseSpecKey = useMemo(() => JSON.stringify(baseSpec ?? null), [baseSpec]);
  const showVariants = baseSpec?.kind === "choose" || baseSpec?.kind === "cycle" || baseSpec?.kind === "literal";
  const [variants, setVariants] = useState<string[]>(() => {
    if (baseSpec?.kind === "choose" || baseSpec?.kind === "cycle") return [...baseSpec.values];
    if (baseSpec?.kind === "literal") return [baseSpec.value];
    return [];
  });

  useEffect(() => {
    setCaptionDraft(captionTarget?.value ?? "");
  }, [captionTarget?.id, captionTarget?.value]);

  useEffect(() => {
    if (!node) return;
    const next: Record<string, EditableValue> = {};
    for (const [key, value] of propFields) {
      const literal = readLiteralValue(value);
      if (literal !== null) next[key] = literal;
    }
    setPropDrafts(next);
    setTextDraft(getLiteralString(node.props?.content) ?? "");
    setRichTextKey((prev) => prev + 1);
    setJsonDraft(JSON.stringify(node.props ?? {}, null, 2));
    setJsonError(null);
  }, [node?.id, propFields]);

  useEffect(() => {
    if (baseSpec?.kind === "choose" || baseSpec?.kind === "cycle") {
      setVariants([...baseSpec.values]);
    } else if (baseSpec?.kind === "literal") {
      setVariants([baseSpec.value]);
    } else {
      setVariants([]);
    }
  }, [baseSpec?.kind, baseSpecKey]);

  if (!node) {
    return (
      <aside className="inspector-pane">
        <div className="inspector-empty">Select a node to inspect properties.</div>
      </aside>
    );
  }

  const handleCaptionCommit = () => {
    if (!captionTarget) return;
    if (captionTarget.kind === "prop") {
      onApplyTransform({
        type: "setNodeProps",
        id: captionTarget.id,
        props: { caption: wrapLiteralValue(captionDraft) },
      });
      return;
    }
    onApplyTransform({ type: "setTextNodeContent", id: captionTarget.id, text: captionDraft });
  };

  const handlePropCommit = (key: string, value: EditableValue) => {
    onApplyTransform({ type: "setNodeProps", id: node.id, props: { [key]: wrapLiteralValue(value) } });
  };

  const handleSlotGeneratorCommit = (next: SlotGeneratorSpec) => {
    const expr = buildGeneratorExpr(next);
    const generator = expr ? wrapExpressionValue(expr) : (next as unknown as Record<string, unknown>);
    onApplyTransform({ type: "setSlotGenerator", id: node.id, generator });
  };

  const handleVariantChange = (index: number, value: string) => {
    const next = variants.map((item, idx) => (idx === index ? value : item));
    setVariants(next);
  };

  const handleVariantCommit = (nextValues: string[]) => {
    if (baseSpec?.kind === "choose" || baseSpec?.kind === "cycle") {
      handleSlotGeneratorCommit({ ...baseSpec, values: nextValues });
    } else if (baseSpec?.kind === "literal") {
      if (nextValues.length === 1) {
        handleSlotGeneratorCommit({ ...baseSpec, value: nextValues[0] ?? "" });
      } else {
        handleSlotGeneratorCommit({ kind: "choose", values: nextValues });
      }
    }
  };

  const handleAddVariant = () => {
    const next = [...variants, ""];
    setVariants(next);
    handleVariantCommit(next);
  };

  const handleRemoveVariant = (index: number) => {
    const next = variants.filter((_, idx) => idx !== index);
    setVariants(next);
    handleVariantCommit(next);
  };

  const handleTextCommit = () => {
    if (node.kind !== "text") return;
    onApplyTransform({ type: "setTextNodeContent", id: node.id, text: textDraft });
  };

  const handleRichTextCommit = (json: JSONContent) => {
    if (node.kind !== "text") return;
    onApplyTransform({ type: "setTextNodeContent", id: node.id, richText: json });
  };

  const handleJsonApply = () => {
    try {
      const parsed = JSON.parse(jsonDraft);
      if (!parsed || typeof parsed !== "object") {
        setJsonError("JSON must be an object.");
        return;
      }
      setJsonError(null);
      onApplyTransform({ type: "setNodeProps", id: node.id, props: parsed as Record<string, unknown> });
    } catch (error) {
      setJsonError((error as Error).message);
    }
  };

  const title = formatNodeLabel(node);
  const meta = `kind: ${node.kind} · id: ${node.id}`;
  const path = selectedEntry?.path?.length ? selectedEntry.path.join(" / ") : "root";

  return (
    <aside className="inspector-pane">
      <div className="inspector-content">
        <div className="inspector-header">
          <div className="inspector-title">{title}</div>
          <div className="inspector-meta">
            <div>{meta}</div>
            <div>path: {path}</div>
          </div>
        </div>
        {transformError ? <div className="inspector-alert">{transformError}</div> : null}

        {captionTarget ? (
          <div className="inspector-section">
            <div className="section-title">Caption</div>
            <label className="field">
              <span>Text</span>
              <input
                className="input"
                data-testid="inspector-field:caption"
                value={captionDraft}
                onChange={(event) => setCaptionDraft(event.target.value)}
                onBlur={handleCaptionCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCaptionCommit();
                  }
                }}
              />
            </label>
          </div>
        ) : null}

        {node.kind === "text" ? (
          <div className="inspector-section">
            <div className="section-title">Text content</div>
            {node.children?.length ? (
              <RichTextEditor
                node={node}
                hydrationKey={`${node.id}-${richTextKey}`}
                allowHydrate
                onInlineSlotSelect={() => {}}
                onUpdate={handleRichTextCommit}
                onReady={() => {}}
                initialText={textDraft}
              />
            ) : (
              <label className="field">
                <span>Text</span>
                <textarea
                  className="input"
                  rows={4}
                  value={textDraft}
                  onChange={(event) => setTextDraft(event.target.value)}
                  onBlur={handleTextCommit}
                />
              </label>
            )}
          </div>
        ) : null}

        {node.kind === "slot" || node.kind === "inline_slot" ? (
          <div className="inspector-section slot-program-section">
            <div className="section-title">Slot variants</div>
            {showVariants ? (
              <div className="variant-list">
                {variants.map((value, index) => (
                  <div key={index} className="variant-row">
                    <input
                      className="input"
                      data-testid={`inspector-field:slot-variant-${index}`}
                      value={value}
                      onChange={(event) => handleVariantChange(index, event.target.value)}
                      onBlur={() => handleVariantCommit(variants)}
                    />
                    <div className="variant-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleRemoveVariant(index)}
                        disabled={variants.length <= 1 && baseSpec?.kind === "literal"}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  data-testid="inspector-action:add-variant"
                  onClick={handleAddVariant}
                >
                  Add variant
                </button>
              </div>
            ) : (
              <div className="section-hint">No editable variants for this slot generator.</div>
            )}
          </div>
        ) : null}

        {propFields.length ? (
          <div className="inspector-section">
            <div className="section-title">Properties</div>
            {propFields.map(([key, value]) => {
              const literal = readLiteralValue(value);
              if (literal === null) return null;
              const draftValue = propDrafts[key] ?? literal;
              if (typeof literal === "boolean") {
                return (
                  <label key={key} className="field field-inline">
                    <span>{key}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(draftValue)}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setPropDrafts((prev) => ({ ...prev, [key]: next }));
                        handlePropCommit(key, next);
                      }}
                    />
                  </label>
                );
              }
              return (
                <label key={key} className="field">
                  <span>{key}</span>
                  <input
                    className="input"
                    type={typeof literal === "number" ? "number" : "text"}
                    value={String(draftValue)}
                    onChange={(event) =>
                      setPropDrafts((prev) => ({
                        ...prev,
                        [key]: typeof literal === "number" ? Number(event.target.value) : event.target.value,
                      }))
                    }
                    onBlur={() => {
                      const nextValue = propDrafts[key] ?? literal;
                      handlePropCommit(key, nextValue);
                    }}
                  />
                </label>
              );
            })}
          </div>
        ) : null}

        <div className="inspector-section">
          <div className="section-title">JSON fallback</div>
          <textarea
            className="input"
            rows={6}
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
          />
          <div className="inspector-actions">
            <button type="button" className="btn btn-ghost btn-xs" onClick={handleJsonApply}>
              Apply JSON
            </button>
          </div>
          {jsonError ? <div className="inspector-alert">{jsonError}</div> : null}
        </div>
      </div>
    </aside>
  );
}
