import type { DocumentNode, FluxDocument, NodePropValue } from "@flux-lang/core";

export type OutlineNode = {
  id: string;
  kind: string;
  label: string;
  children: OutlineNode[];
};

export function findNodeById(nodes: DocumentNode[], id: string): DocumentNode | null {
  for (const node of nodes ?? []) {
    if (node.id === id) return node;
    const child = findNodeById(node.children ?? [], id);
    if (child) return child;
  }
  return null;
}

export function getLiteralString(value: NodePropValue | undefined): string | null {
  if (!value || value.kind !== "LiteralValue") return null;
  return typeof value.value === "string" ? value.value : null;
}

export function getLiteralValue(value: NodePropValue | undefined): unknown | null {
  if (!value || value.kind !== "LiteralValue") return null;
  return value.value;
}

export function extractPlainText(node: DocumentNode): string {
  const pieces: string[] = [];
  const content = getLiteralString(node.props?.content);
  if (content) pieces.push(content);
  for (const child of node.children ?? []) {
    pieces.push(extractPlainText(child));
  }
  return pieces.join("");
}

export function buildOutlineFromDoc(doc: FluxDocument | null): OutlineNode[] {
  if (!doc?.body?.nodes) return [];
  const outline: OutlineNode[] = [];
  const inlineKinds = new Set([
    "em",
    "strong",
    "code",
    "smallcaps",
    "sub",
    "sup",
    "mark",
    "link",
    "quote",
    "inline_slot",
  ]);
  const flattenKinds = new Set(["row", "column"]);

  const visit = (node: DocumentNode, parentInline: boolean): OutlineNode[] => {
    const isInline = parentInline || inlineKinds.has(node.kind);
    const childInline = isInline || node.kind === "text";
    const children = (node.children ?? []).flatMap((child) => visit(child, childInline));
    if (isInline) return [];
    if (flattenKinds.has(node.kind)) return children;
    const label = deriveLabel(node);
    return [
      {
      id: node.id,
      kind: node.kind,
      label,
      children,
      },
    ];
  };

  for (const node of doc.body.nodes) {
    outline.push(...visit(node, false));
  }
  return outline;
}

function deriveLabel(node: DocumentNode): string {
  if (node.kind === "page") {
    const title = getLiteralString(node.props?.title) ?? getLiteralString(node.props?.name);
    return title ?? `Page ${node.id}`;
  }
  if (node.kind === "section") {
    const heading = node.children?.find((child) => child.kind === "text" && isHeading(child));
    if (heading) {
      const text = extractPlainText(heading).trim();
      if (text) return text;
    }
    return `Section ${node.id}`;
  }
  if (node.kind === "figure") {
    const label = getLiteralString(node.props?.label);
    if (label) return label;
  }
  if (node.kind === "text") {
    const text = extractPlainText(node).trim();
    if (text) return text.length > 42 ? `${text.slice(0, 42)}…` : text;
  }
  return `${node.kind} ${node.id}`;
}

function isHeading(node: DocumentNode): boolean {
  const style = getLiteralString(node.props?.style);
  const role = getLiteralString(node.props?.role);
  if (style && /^H\d/.test(style)) return true;
  if (role && ["title", "subtitle", "heading"].includes(role)) return true;
  return false;
}
