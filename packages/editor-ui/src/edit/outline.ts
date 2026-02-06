import type { EditState } from "./api";

export type OutlineNode = {
  id: string;
  kind: string;
  label: string;
  children: OutlineNode[];
  data?: unknown;
};

function normalizeId(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function normalizeLabel(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function normalizeKind(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function normalizeChildren(value: unknown, seen: WeakSet<object>): OutlineNode[] {
  return normalizeOutline(value, seen);
}

function normalizeNode(node: unknown, index: number, seen: WeakSet<object>): OutlineNode | null {
  if (!node || typeof node !== "object") return null;
  if (seen.has(node as object)) return null;
  seen.add(node as object);

  const record = node as Record<string, unknown>;
  const kind = normalizeKind(record.kind ?? record.type ?? record.nodeType ?? record.role ?? record.tag, "node");
  const id = normalizeId(record.id ?? record.uid ?? record.key ?? record.ref, `${kind}-${index + 1}`);
  const label = normalizeLabel(record.label ?? record.title ?? record.name ?? record.heading, `${kind} ${index + 1}`);
  const childrenSource =
    record.children ?? record.nodes ?? record.items ?? record.sections ?? record.figures ?? record.pages ?? record.blocks;

  return {
    id,
    kind,
    label,
    children: normalizeChildren(childrenSource, seen),
    data: record
  };
}

export function normalizeOutline(input: unknown, seen: WeakSet<object> = new WeakSet()): OutlineNode[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map((node, index) => normalizeNode(node, index, seen))
      .filter((node): node is OutlineNode => Boolean(node));
  }

  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (record.outline) return normalizeOutline(record.outline, seen);
    if (record.nodes) return normalizeOutline(record.nodes, seen);
    if (record.items) return normalizeOutline(record.items, seen);
    if (record.pages) return normalizeOutline(record.pages, seen);
    if (record.sections) return normalizeOutline(record.sections, seen);
    if (record.figures) return normalizeOutline(record.figures, seen);

    const single = normalizeNode(record, 0, seen);
    return single ? [single] : [];
  }

  return [];
}

export function buildFallbackOutline(state?: EditState | null): OutlineNode[] {
  if (!state) {
    return [
      {
        id: "document",
        kind: "document",
        label: "Document",
        children: []
      }
    ];
  }

  const title =
    (state.title as string | undefined) ??
    ((state as any).doc && typeof (state as any).doc === "object" ? (state as any).doc.title : undefined) ??
    ((state as any).doc && typeof (state as any).doc === "object" ? (state as any).doc.meta?.title : undefined) ??
    "Document";

  const id =
    (state.id as string | undefined) ??
    ((state as any).doc && typeof (state as any).doc === "object" ? (state as any).doc.id : undefined) ??
    "document";

  const pages = normalizeOutline(
    (state.pages as unknown) ??
      (((state as any).doc && typeof (state as any).doc === "object" ? (state as any).doc.pages : undefined) as unknown) ??
      (state.sections as unknown) ??
      (state.blocks as unknown)
  );

  return [
    {
      id,
      kind: "document",
      label: title,
      children: pages
    }
  ];
}
