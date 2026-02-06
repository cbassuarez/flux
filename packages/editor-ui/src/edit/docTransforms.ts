import type { DocumentNode, FluxDocument, NodePropValue, RefreshPolicy } from "@flux-lang/core";
import { getLiteralString } from "./docModel";

export type InlineSlotUpdate = {
  text?: string;
  reserve?: string;
  fit?: string;
  refresh?: RefreshPolicy;
  transition?: { kind: string; [key: string]: unknown };
};

export type SlotUpdate = InlineSlotUpdate;

export type ImageFrame = {
  fit: "contain" | "cover";
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function collectIds(doc: FluxDocument | null): Set<string> {
  const ids = new Set<string>();
  const visit = (node: DocumentNode) => {
    ids.add(node.id);
    node.children?.forEach(visit);
  };
  doc?.body?.nodes?.forEach(visit);
  return ids;
}

export function insertTextSection(doc: FluxDocument): { doc: FluxDocument; newIds: string[] } {
  const ids = collectIds(doc);
  const nextIds: string[] = [];
  const makeId = (prefix: string) => {
    let n = 1;
    let candidate = `${prefix}${n}`;
    while (ids.has(candidate)) {
      n += 1;
      candidate = `${prefix}${n}`;
    }
    ids.add(candidate);
    nextIds.push(candidate);
    return candidate;
  };

  const headingId = makeId("text");
  const bodyId = makeId("text");
  const sectionId = makeId("section");

  const heading: DocumentNode = {
    id: headingId,
    kind: "text",
    props: {
      style: { kind: "LiteralValue", value: "H2" },
      content: { kind: "LiteralValue", value: "Section Heading" },
    },
    children: [],
  };

  const body: DocumentNode = {
    id: bodyId,
    kind: "text",
    props: { content: { kind: "LiteralValue", value: "Start writing here." } },
    children: [],
  };

  const section: DocumentNode = {
    id: sectionId,
    kind: "section",
    props: {},
    children: [heading, body],
  };

  const next: FluxDocument = {
    ...doc,
    body: {
      nodes: [...(doc.body?.nodes ?? [])],
    },
  };

  const pages = next.body?.nodes ?? [];
  let pageIndex = pages.length - 1;
  let page = pages[pageIndex];
  if (!page || page.kind !== "page") {
    const pageId = makeId("page");
    page = { id: pageId, kind: "page", props: {}, children: [] };
    pages.push(page);
    pageIndex = pages.length - 1;
  }

  const nextPage: DocumentNode = {
    ...page,
    children: [...(page.children ?? []), section],
  };
  pages[pageIndex] = nextPage;

  return { doc: next, newIds: nextIds };
}

export function updateInlineSlot(doc: FluxDocument, slotId: string, update: InlineSlotUpdate): FluxDocument {
  const ids = collectIds(doc);
  const next: FluxDocument = {
    ...doc,
    body: {
      nodes: doc.body?.nodes ? doc.body.nodes.map((node) => updateNode(node, slotId, update, ids)) : [],
    },
  };
  return next;
}

export function updateSlot(doc: FluxDocument, slotId: string, update: SlotUpdate): FluxDocument {
  const ids = collectIds(doc);
  const next: FluxDocument = {
    ...doc,
    body: {
      nodes: doc.body?.nodes ? doc.body.nodes.map((node) => updateNode(node, slotId, update, ids)) : [],
    },
  };
  return next;
}

export function setImageFrame(doc: FluxDocument, nodeId: string, frame: ImageFrame): FluxDocument {
  const next: FluxDocument = {
    ...doc,
    body: {
      nodes: doc.body?.nodes
        ? doc.body.nodes.map((node) => updateNodeFrame(node, nodeId, frame))
        : [],
    },
  };
  return next;
}

export function resetImageFrame(doc: FluxDocument, nodeId: string): FluxDocument {
  const next: FluxDocument = {
    ...doc,
    body: {
      nodes: doc.body?.nodes
        ? doc.body.nodes.map((node) => updateNodeFrame(node, nodeId, null))
        : [],
    },
  };
  return next;
}

export function moveNode(doc: FluxDocument, nodeId: string, parentId: string, index: number): FluxDocument {
  const next: FluxDocument = {
    ...doc,
    body: {
      nodes: doc.body?.nodes
        ? doc.body.nodes.map((node) => reorderWithin(node, nodeId, parentId, index))
        : [],
    },
  };
  return next;
}

function updateNode(
  node: DocumentNode,
  slotId: string,
  update: InlineSlotUpdate,
  ids: Set<string>,
): DocumentNode {
  if (node.id === slotId && (node.kind === "inline_slot" || node.kind === "slot")) {
    const props: Record<string, NodePropValue> = { ...(node.props ?? {}) };
    if (update.reserve !== undefined) props.reserve = { kind: "LiteralValue", value: update.reserve };
    if (update.fit !== undefined) props.fit = { kind: "LiteralValue", value: update.fit };

    let children = node.children ?? [];
    if (update.text !== undefined) {
      const sanitized = sanitizeSlotText(update.text);
      const textChild = children.find((child) => child.kind === "text");
      const textId = textChild?.id ?? nextId("slotText", ids);
      children = [
        {
          id: textId,
          kind: "text",
          props: { content: { kind: "LiteralValue", value: sanitized } },
          children: [],
        },
      ];
    }

    return {
      ...node,
      props,
      refresh: update.refresh ?? node.refresh,
      transition: update.transition ?? (node as any).transition,
      children,
    };
  }

  if (!node.children?.length) return node;
  const nextChildren = node.children.map((child) => updateNode(child, slotId, update, ids));
  return { ...node, children: nextChildren };
}

function updateNodeFrame(node: DocumentNode, nodeId: string, frame: ImageFrame | null): DocumentNode {
  if (node.id === nodeId) {
    const props: Record<string, NodePropValue> = { ...(node.props ?? {}) };
    if (frame) {
      props.frame = { kind: "LiteralValue", value: frame };
    } else if ("frame" in props) {
      delete props.frame;
    }
    return { ...node, props };
  }
  if (!node.children?.length) return node;
  return { ...node, children: node.children.map((child) => updateNodeFrame(child, nodeId, frame)) };
}

function reorderWithin(node: DocumentNode, nodeId: string, parentId: string, index: number): DocumentNode {
  if (node.id === parentId) {
    const children = [...(node.children ?? [])];
    const from = children.findIndex((child) => child.id === nodeId);
    if (from < 0) return node;
    const [moving] = children.splice(from, 1);
    const clamped = Math.max(0, Math.min(index, children.length));
    children.splice(clamped, 0, moving);
    return { ...node, children };
  }
  if (!node.children?.length) return node;
  return { ...node, children: node.children.map((child) => reorderWithin(child, nodeId, parentId, index)) };
}

function sanitizeSlotText(value: string): string {
  return value.replace(/[\\r\\n]+/g, " ");
}

function nextId(prefix: string, ids: Set<string>): string {
  let n = 1;
  let candidate = `${prefix}${n}`;
  while (ids.has(candidate)) {
    n += 1;
    candidate = `${prefix}${n}`;
  }
  ids.add(candidate);
  return candidate;
}
