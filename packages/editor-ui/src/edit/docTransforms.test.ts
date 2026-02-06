import { describe, expect, it } from "vitest";
import { collectIds, insertTextSection, moveNode, updateInlineSlot } from "./docTransforms";
import { findNodeById } from "./docModel";

function stripLoc(node: any): any {
  if (!node) return node;
  const { loc, ...rest } = node;
  return {
    ...rest,
    children: Array.isArray(node.children) ? node.children.map(stripLoc) : [],
  };
}

describe("doc transforms", () => {
  it("inserts a text section without touching existing ids", () => {
    const doc = {
      meta: { version: "0.1.0" },
      state: { params: [] },
      grids: [],
      rules: [],
      body: {
        nodes: [
          {
            id: "page1",
            kind: "page",
            props: {},
            children: [
              {
                id: "section1",
                kind: "section",
                props: {},
                children: [
                  {
                    id: "t1",
                    kind: "text",
                    props: { content: { kind: "LiteralValue", value: "Hello" } },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    } as any;
    const before = collectIds(doc);
    const result = insertTextSection(doc);
    const after = collectIds(result.doc);

    for (const id of before) {
      expect(after.has(id)).toBe(true);
    }
    for (const id of result.newIds) {
      expect(before.has(id)).toBe(false);
    }
  });

  it("updates inline slot content without changing unrelated nodes", () => {
    const doc = {
      meta: { version: "0.1.0" },
      state: { params: [] },
      grids: [],
      rules: [],
      body: {
        nodes: [
          {
            id: "page1",
            kind: "page",
            props: {},
            children: [
              {
                id: "t1",
                kind: "text",
                props: { content: { kind: "LiteralValue", value: "Hello " } },
                children: [
                  {
                    id: "slot1",
                    kind: "inline_slot",
                    props: {
                      reserve: { kind: "LiteralValue", value: "fixedWidth(8, ch)" },
                      fit: { kind: "LiteralValue", value: "ellipsis" },
                    },
                    children: [
                      {
                        id: "slotText",
                        kind: "text",
                        props: { content: { kind: "LiteralValue", value: "world" } },
                        children: [],
                      },
                    ],
                  },
                ],
              },
              {
                id: "t2",
                kind: "text",
                props: { content: { kind: "LiteralValue", value: "Unaffected" } },
                children: [],
              },
            ],
          },
        ],
      },
    } as any;
    const updated = updateInlineSlot(doc, "slot1", { text: "updated", transition: { kind: "fade", durationMs: 220 } });

    const originalOther = stripLoc(findNodeById(doc.body?.nodes ?? [], "t2"));
    const updatedOther = stripLoc(findNodeById(updated.body?.nodes ?? [], "t2"));
    expect(updatedOther).toEqual(originalOther);

    const slot = findNodeById(updated.body?.nodes ?? [], "slot1");
    const slotText = slot?.children?.find((child) => child.kind === "text");
    expect((slotText?.props?.content as any)?.value).toBe("updated");
    expect((slot as any)?.transition).toEqual({ kind: "fade", durationMs: 220 });
  });

  it("reorders nodes within a parent without changing ids", () => {
    const doc = {
      meta: { version: "0.1.0" },
      state: { params: [] },
      grids: [],
      rules: [],
      body: {
        nodes: [
          {
            id: "page1",
            kind: "page",
            props: {},
            children: [
              {
                id: "section1",
                kind: "section",
                props: {},
                children: [
                  { id: "a", kind: "text", props: { content: { kind: "LiteralValue", value: "A" } }, children: [] },
                  { id: "b", kind: "figure", props: {}, children: [] },
                  { id: "c", kind: "text", props: { content: { kind: "LiteralValue", value: "C" } }, children: [] },
                ],
              },
            ],
          },
        ],
      },
    } as any;

    const updated = moveNode(doc, "b", "section1", 0);
    const section = findNodeById(updated.body?.nodes ?? [], "section1");
    const order = section?.children?.map((child: any) => child.id);
    expect(order).toEqual(["b", "a", "c"]);

    const ids = collectIds(updated);
    for (const id of ["a", "b", "c", "section1", "page1"]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
