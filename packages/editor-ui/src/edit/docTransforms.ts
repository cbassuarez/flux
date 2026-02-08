import type { DocumentNode, FluxDocument, NodePropValue, RefreshPolicy } from "@flux-lang/core";
import { findNodeById, getLiteralString } from "./docModel";

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

export function insertPage(
  doc: FluxDocument,
  { afterPageId }: { afterPageId?: string } = {},
): { doc: FluxDocument; newPageId: string; newSectionId: string } {
  const ids = collectIds(doc);
  const makeId = (prefix: string) => nextId(prefix, ids);

  const pageId = makeId("page");
  const sectionId = makeId("section");
  const section: DocumentNode = { id: sectionId, kind: "section", props: {}, children: [] };
  const page: DocumentNode = { id: pageId, kind: "page", props: {}, children: [section] };

  const next: FluxDocument = {
    ...doc,
    body: {
      nodes: [...(doc.body?.nodes ?? [])],
    },
  };
  const pages = next.body?.nodes ?? [];
  const insertAfterIndex =
    afterPageId && pages.length ? pages.findIndex((node) => node.id === afterPageId && node.kind === "page") : -1;
  const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : pages.length;
  pages.splice(insertIndex, 0, page);

  return { doc: next, newPageId: pageId, newSectionId: sectionId };
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

export function moveNode(
  doc: FluxDocument,
  {
    nodeId,
    fromContainerId,
    toContainerId,
    toIndex,
  }: { nodeId: string; fromContainerId: string; toContainerId: string; toIndex: number },
): FluxDocument {
  const target = resolveContainerId(toContainerId);
  const source = resolveContainerId(fromContainerId);
  if (!target || !source) return doc;
  const node = findNodeById(doc.body?.nodes ?? [], nodeId);
  if (!node || node.kind === "page" || node.kind === "section") return doc;

  const resolved = resolvePageSection(doc, target);
  if (!resolved) return doc;
  const resolvedSource = resolvePageSection(resolved.doc, source);
  if (!resolvedSource) return resolved.doc;
  const nextDoc = resolved.doc;

  if (resolvedSource.id === resolved.id) {
    const next: FluxDocument = {
      ...nextDoc,
      body: {
        nodes: nextDoc.body?.nodes
          ? nextDoc.body.nodes.map((entry) => reorderWithin(entry, nodeId, resolved.id, toIndex))
          : [],
      },
    };
    return next;
  }

  const removal = removeFromContainer(nextDoc.body?.nodes ?? [], resolvedSource.id, nodeId);
  if (!removal.removed) return nextDoc;
  const insertion = insertIntoContainer(removal.nodes, resolved.id, removal.removed, toIndex);
  return { ...nextDoc, body: { nodes: insertion } };
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

type ContainerRef = { kind: "page" | "section"; id: string };
type ResolvedContainer = { doc: FluxDocument; id: string };

function resolveContainerId(raw: string): ContainerRef | null {
  if (raw.startsWith("page:")) return { kind: "page", id: raw.slice("page:".length) };
  if (raw.startsWith("section:")) return { kind: "section", id: raw.slice("section:".length) };
  return raw ? { kind: "section", id: raw } : null;
}

function resolvePageSection(doc: FluxDocument, container: ContainerRef): ResolvedContainer | null {
  if (container.kind === "section") return { doc, id: container.id };
  const page = findNodeById(doc.body?.nodes ?? [], container.id);
  if (!page || page.kind !== "page") return null;
  const section = page.children?.find((child) => child.kind === "section");
  if (section) return { doc, id: section.id };
  const ids = collectIds(doc);
  const newSectionId = nextId("section", ids);
  const nextSection: DocumentNode = { id: newSectionId, kind: "section", props: {}, children: [] };
  const nextPage: DocumentNode = { ...page, children: [...(page.children ?? []), nextSection] };
  const next: FluxDocument = {
    ...doc,
    body: {
      nodes: doc.body?.nodes ? replaceNode(doc.body.nodes, nextPage) : [],
    },
  };
  return { doc: next, id: newSectionId };
}

function replaceNode(nodes: DocumentNode[], replacement: DocumentNode): DocumentNode[] {
  return nodes.map((node) => {
    if (node.id === replacement.id) return replacement;
    if (!node.children?.length) return node;
    return { ...node, children: replaceNode(node.children, replacement) };
  });
}

function removeFromContainer(
  nodes: DocumentNode[],
  containerId: string,
  nodeId: string,
): { nodes: DocumentNode[]; removed: DocumentNode | null } {
  let removed: DocumentNode | null = null;
  const nextNodes = nodes.map((node) => {
    if (node.id === containerId) {
      const children = [...(node.children ?? [])];
      const index = children.findIndex((child) => child.id === nodeId);
      if (index >= 0) {
        removed = children[index];
        children.splice(index, 1);
        return { ...node, children };
      }
      return node;
    }
    if (!node.children?.length) return node;
    const result = removeFromContainer(node.children, containerId, nodeId);
    if (result.removed) {
      removed = result.removed;
      return { ...node, children: result.nodes };
    }
    return node;
  });
  return { nodes: nextNodes, removed };
}

function insertIntoContainer(
  nodes: DocumentNode[],
  containerId: string,
  node: DocumentNode,
  index: number,
): DocumentNode[] {
  return nodes.map((entry) => {
    if (entry.id === containerId) {
      const children = [...(entry.children ?? [])];
      const clamped = Math.max(0, Math.min(index, children.length));
      children.splice(clamped, 0, node);
      return { ...entry, children };
    }
    if (!entry.children?.length) return entry;
    return { ...entry, children: insertIntoContainer(entry.children, containerId, node, index) };
  });
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
