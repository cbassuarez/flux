import type { JSONContent } from "@tiptap/core";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createDocService } from "./docService";
import { fetchEditSource, fetchEditState, postTransform } from "./api";

vi.mock("./api", () => ({
  fetchEditState: vi.fn(),
  fetchEditSource: vi.fn(),
  postTransform: vi.fn(),
  RequestTimeoutError: class RequestTimeoutError extends Error {},
}));

vi.mock("./richText", () => ({
  tiptapToFluxText: vi.fn((node: any) => ({
    ...node,
    props: {
      ...(node?.props ?? {}),
      content: { kind: "LiteralValue", value: "rich" },
    },
    children: [],
  })),
}));

const baseDoc = {
  kind: "document",
  body: {
    nodes: [
      {
        id: "t1",
        kind: "text",
        props: { content: { kind: "LiteralValue", value: "hello" } },
        children: [],
      },
      {
        id: "s1",
        kind: "slot",
        props: {},
        children: [],
      },
    ],
  },
};

const baseSource = "doc { }";

const fetchEditStateMock = fetchEditState as unknown as Mock;
const fetchEditSourceMock = fetchEditSource as unknown as Mock;
const postTransformMock = postTransform as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  fetchEditStateMock.mockResolvedValue({ doc: baseDoc, revision: 1, source: baseSource });
  fetchEditSourceMock.mockResolvedValue({ source: baseSource, revision: 1 });
  postTransformMock.mockResolvedValue({ ok: true, source: baseSource, doc: baseDoc, revision: 2 });
});

describe("docService transform requests", () => {
  it("keeps setTextNodeContent for plain rich text and omits richText", async () => {
    const service = createDocService();
    await service.loadDoc();
    const richText: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    };

    await service.applyTransform({ type: "setTextNodeContent", id: "t1", richText });

    expect(postTransformMock.mock.calls[0][0]?.op).toBe("setTextNodeContent");
    const args = postTransformMock.mock.calls[0][0]?.args as Record<string, unknown>;
    expect("richText" in args).toBe(false);
  });

  it("uses replaceNode as the primary request for formatted rich text", async () => {
    const service = createDocService();
    await service.loadDoc();
    const richText: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi", marks: [{ type: "bold" }] }] }],
    };

    await service.applyTransform({ type: "setTextNodeContent", id: "t1", richText });

    expect(postTransformMock.mock.calls[0][0]?.op).toBe("replaceNode");
  });

  it("keeps setTextNodeContent as primary for plain text", async () => {
    const service = createDocService();
    await service.loadDoc();

    await service.applyTransform({ type: "setTextNodeContent", id: "t1", text: "hello" });

    expect(postTransformMock.mock.calls[0][0]?.op).toBe("setTextNodeContent");
  });

  it("uses replaceNode as the primary request for slot props", async () => {
    const service = createDocService();
    await service.loadDoc();

    await service.applyTransform({ type: "setSlotProps", id: "s1", reserve: "fixedWidth(9, ch)" });

    expect(postTransformMock.mock.calls[0][0]?.op).toBe("replaceNode");
  });

  it("uses replaceNode as the primary request for slot generators", async () => {
    const service = createDocService();
    await service.loadDoc();

    await service.applyTransform({
      type: "setSlotGenerator",
      id: "s1",
      generator: { kind: "LiteralValue", value: "x" },
    });

    expect(postTransformMock.mock.calls[0][0]?.op).toBe("replaceNode");
  });

  it("retries with fallback on header no-op responses", async () => {
    const service = createDocService();
    await service.loadDoc();
    const richText: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi", marks: [{ type: "bold" }] }] }],
    };

    postTransformMock
      .mockResolvedValueOnce({
        ok: true,
        source: baseSource,
        doc: baseDoc,
        revision: 2,
        _fluxBefore: "a",
        _fluxAfter: "a",
      })
      .mockResolvedValueOnce({
        ok: true,
        source: baseSource,
        doc: baseDoc,
        revision: 3,
        _fluxBefore: "a",
        _fluxAfter: "b",
      });

    await service.applyTransform({ type: "setTextNodeContent", id: "t1", richText });

    expect(postTransformMock).toHaveBeenCalledTimes(2);
    expect(postTransformMock.mock.calls[1][0]?.op).toBe("setTextNodeContent");
  });

  it("retries setNodeProps with replaceNode fallback after no-op", async () => {
    const service = createDocService();
    await service.loadDoc();

    postTransformMock
      .mockResolvedValueOnce({
        ok: true,
        source: baseSource,
        doc: baseDoc,
        revision: 2,
        _fluxBefore: "a",
        _fluxAfter: "a",
      })
      .mockResolvedValueOnce({
        ok: true,
        source: baseSource,
        doc: baseDoc,
        revision: 3,
        _fluxBefore: "a",
        _fluxAfter: "b",
      });

    await service.applyTransform({
      type: "setNodeProps",
      id: "s1",
      props: { variant: { kind: "LiteralValue", value: "x" } },
    });

    expect(postTransformMock).toHaveBeenCalledTimes(2);
    expect(postTransformMock.mock.calls[1][0]?.op).toBe("replaceNode");
  });

  it("preserves null literals in slot generator retries", async () => {
    const service = createDocService();
    await service.loadDoc();

    postTransformMock
      .mockResolvedValueOnce({
        ok: true,
        source: baseSource,
        doc: baseDoc,
        revision: 2,
        _fluxBefore: "a",
        _fluxAfter: "a",
      })
      .mockResolvedValueOnce({
        ok: true,
        source: baseSource,
        doc: baseDoc,
        revision: 3,
        _fluxBefore: "a",
        _fluxAfter: "b",
      });

    const generator = {
      kind: "ExpressionValue",
      expr: {
        kind: "CallExpression",
        callee: { kind: "Identifier", name: "choose" },
        args: [
          { kind: "Literal", value: null },
          { kind: "Literal", value: "" },
        ],
      },
    };

    await service.applyTransform({
      type: "setSlotGenerator",
      id: "s1",
      generator,
    });

    expect(postTransformMock).toHaveBeenCalledTimes(2);
    const retryRequest = postTransformMock.mock.calls[1][0] as any;
    const retryArgs = retryRequest?.args ?? {};
    const retryGenerator =
      retryArgs.generator ?? retryArgs.node?.props?.generator ?? retryArgs.node?.generator ?? retryArgs.node?.props?.source;
    const expr = retryGenerator?.expr ?? retryGenerator?.expression ?? retryGenerator?.value ?? retryGenerator;
    expect(expr.kind).toBe("CallExpression");
    expect(expr.callee?.name).toBe("choose");
    expect(expr.args?.[0]).toMatchObject({ kind: "Literal", value: null });
    expect(expr.args?.[1]).toMatchObject({ kind: "Literal", value: "" });
  });

  it("adopts newRevision as doc.revision after hydration", async () => {
    const service = createDocService();
    await service.loadDoc();
    postTransformMock.mockResolvedValueOnce({ ok: true, source: baseSource, doc: baseDoc, newRevision: 13 });

    await service.applyTransform({ type: "setTextNodeContent", id: "t1", text: "hello" });

    expect(service.getState().doc?.revision).toBe(13);
  });
});
