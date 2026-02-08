import { describe, expect, it } from "vitest";
import { collectIds, insertPage, insertTextSection, moveNode, updateInlineSlot } from "./docTransforms";
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

    const updated = moveNode(doc, {
      nodeId: "b",
      fromContainerId: "section:section1",
      toContainerId: "section:section1",
      toIndex: 0,
    });
    const section = findNodeById(updated.body?.nodes ?? [], "section1");
    const order = section?.children?.map((child: any) => child.id);
    expect(order).toEqual(["b", "a", "c"]);

    const ids = collectIds(updated);
    for (const id of ["a", "b", "c", "section1", "page1"]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("inserts a page after the selected page with a default section", () => {
    const doc = {
      meta: { version: "0.1.0" },
      state: { params: [] },
      grids: [],
      rules: [],
      body: {
        nodes: [
          { id: "page1", kind: "page", props: {}, children: [] },
          { id: "page2", kind: "page", props: {}, children: [] },
        ],
      },
    } as any;

    const result = insertPage(doc, { afterPageId: "page1" });
    const pages = result.doc.body?.nodes ?? [];
    expect(pages.map((node: any) => node.id)).toEqual(["page1", result.newPageId, "page2"]);
    const inserted = pages[1];
    expect(inserted.kind).toBe("page");
    expect(inserted.children?.[0]?.kind).toBe("section");
    expect(inserted.children?.[0]?.children ?? []).toEqual([]);
  });

  it("appends a page when no selection is provided", () => {
    const doc = {
      meta: { version: "0.1.0" },
      state: { params: [] },
      grids: [],
      rules: [],
      body: {
        nodes: [{ id: "page1", kind: "page", props: {}, children: [] }],
      },
    } as any;

    const result = insertPage(doc);
    const pages = result.doc.body?.nodes ?? [];
    expect(pages.map((node: any) => node.id)).toEqual(["page1", result.newPageId]);
  });

  it("moves nodes across containers", () => {
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
                  { id: "a", kind: "text", props: {}, children: [] },
                  { id: "b", kind: "text", props: {}, children: [] },
                ],
              },
              {
                id: "section2",
                kind: "section",
                props: {},
                children: [{ id: "c", kind: "text", props: {}, children: [] }],
              },
            ],
          },
        ],
      },
    } as any;

    const updated = moveNode(doc, {
      nodeId: "b",
      fromContainerId: "section:section1",
      toContainerId: "section:section2",
      toIndex: 1,
    });
    const section1 = findNodeById(updated.body?.nodes ?? [], "section1");
    const section2 = findNodeById(updated.body?.nodes ?? [], "section2");
    expect(section1?.children?.map((child: any) => child.id)).toEqual(["a"]);
    expect(section2?.children?.map((child: any) => child.id)).toEqual(["c", "b"]);
  });

  it("appends nodes when dropping on a container", () => {
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
                children: [{ id: "a", kind: "text", props: {}, children: [] }],
              },
              {
                id: "section2",
                kind: "section",
                props: {},
                children: [{ id: "b", kind: "text", props: {}, children: [] }],
              },
            ],
          },
        ],
      },
    } as any;

    const updated = moveNode(doc, {
      nodeId: "a",
      fromContainerId: "section:section1",
      toContainerId: "section:section2",
      toIndex: 1,
    });
    const section2 = findNodeById(updated.body?.nodes ?? [], "section2");
    expect(section2?.children?.map((child: any) => child.id)).toEqual(["b", "a"]);
  });

  it("rejects moving container nodes", () => {
    const doc = {
      meta: { version: "0.1.0" },
      state: { params: [] },
      grids: [],
      rules: [],
      body: {
        nodes: [{ id: "page1", kind: "page", props: {}, children: [] }],
      },
    } as any;

    const updated = moveNode(doc, {
      nodeId: "page1",
      fromContainerId: "section:section1",
      toContainerId: "section:section2",
      toIndex: 0,
    });
    expect(updated).toEqual(doc);
  });
});
