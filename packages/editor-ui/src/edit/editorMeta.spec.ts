import { describe, expect, it } from "vitest";
import { parseDocument } from "@flux-lang/core";
import { applyEditorMetaToSource, readEditorSlotMeta } from "./editorMeta";

function collectSlotIds(doc: ReturnType<typeof parseDocument>): Set<string> {
  const ids = new Set<string>();
  const visit = (node: any) => {
    if (!node) return;
    if (node.kind === "slot" || node.kind === "inline_slot") ids.add(node.id);
    (node.children ?? []).forEach(visit);
  };
  (doc.body?.nodes ?? []).forEach(visit);
  return ids;
}

describe("editor slot metadata persistence", () => {
  it("round-trips slot names and variant labels via meta.editor", () => {
    const source = `
      document {
        meta { version = "0.3.0"; }
        body {
          page p1 {
            slot slot1 { }
          }
        }
      }
    `;
    const parsed = parseDocument(source, { sourcePath: "doc.flux", resolveIncludes: false });
    const slotIds = collectSlotIds(parsed);

    const slotNames = new Map([["slot1", "Hero Slot"]]);
    const slotVariantLabels = new Map([["slot1", ["Label A", "Label B"]]]);

    const updated = applyEditorMetaToSource({
      source,
      slotNames,
      slotVariantLabels,
      slotIds,
    });

    const reparsed = parseDocument(updated, { sourcePath: "doc.flux", resolveIncludes: false });
    const meta = readEditorSlotMeta(reparsed.meta as Record<string, unknown>, slotIds);
    expect(meta.slotNames.get("slot1")).toBe("Hero Slot");
    expect(meta.slotVariantLabels.get("slot1")).toEqual(["Label A", "Label B"]);
  });
});
