import type { JSONContent } from "@tiptap/core";
import type { DocumentNode, NodePropValue, RefreshPolicy } from "@flux-lang/core";
import { getLiteralString } from "./docModel";

export type InlineSlotAttrs = {
  id?: string;
  text?: string;
  reserve?: string;
  fit?: string;
  refresh?: string;
  transition?: string;
  textId?: string;
};

const MARK_PRIORITY: Record<string, number> = {
  link: 0,
  bold: 1,
  italic: 2,
  code: 3,
};

export function fluxTextToTiptap(node: DocumentNode): JSONContent {
  const content: JSONContent[] = [];
  appendInline(node, [], content);
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: content.length ? content : [{ type: "text", text: "" }],
      },
    ],
  };
}

export function tiptapToFluxText(
  original: DocumentNode,
  json: JSONContent,
  existingIds: Set<string>,
): DocumentNode {
  const paragraph = json.content?.find((node) => node.type === "paragraph");
  const inlineContent = paragraph?.content ?? [];
  const children: DocumentNode[] = [];
  const plainText = inlineContent.every(
    (node) => node.type === "text" && (!node.marks || node.marks.length === 0),
  );

  if (plainText) {
    const text = inlineContent.map((node: any) => node.text ?? "").join("");
    const nextProps: Record<string, NodePropValue> = { ...(original.props ?? {}) };
    nextProps.content = { kind: "LiteralValue", value: text };
    return {
      ...original,
      props: nextProps,
      children: [],
    };
  }

  for (const node of inlineContent) {
    if (node.type === "text") {
      const text = node.text ?? "";
      if (text.length === 0) continue;
      children.push(wrapTextWithMarks(text, node.marks ?? [], existingIds));
      continue;
    }
    if (node.type === "inlineSlot") {
      const attrs = (node.attrs ?? {}) as InlineSlotAttrs;
      children.push(buildInlineSlot(attrs, existingIds));
      continue;
    }
  }

  const nextProps: Record<string, NodePropValue> = { ...(original.props ?? {}) };
  const shouldInline = children.length > 0;
  if (shouldInline && "content" in nextProps) {
    delete (nextProps as Record<string, unknown>).content;
  }

  return {
    ...original,
    props: nextProps,
    children: shouldInline ? children : [],
  };
}

function appendInline(node: DocumentNode, marks: any[], out: JSONContent[]) {
  const nextMarks = [...marks];
  const mark = markFromNode(node);
  if (mark) nextMarks.push(mark);

  if (node.kind === "inline_slot") {
    const textNode = node.children?.find((child) => child.kind === "text");
    const text = textNode ? getLiteralString(textNode.props?.content) ?? "" : "";
    out.push({
      type: "inlineSlot",
      attrs: {
        id: node.id,
        text,
        reserve: getLiteralString(node.props?.reserve) ?? undefined,
        fit: getLiteralString(node.props?.fit) ?? undefined,
        refresh: node.refresh ? refreshToAttr(node.refresh) : undefined,
        transition: (node as any).transition ? transitionToAttr((node as any).transition) : undefined,
        textId: textNode?.id,
      } as InlineSlotAttrs,
    });
    return;
  }

  const content = getLiteralString(node.props?.content);
  if (content) {
    out.push({
      type: "text",
      text: content,
      marks: nextMarks.length ? nextMarks : undefined,
    });
  }

  for (const child of node.children ?? []) {
    appendInline(child, nextMarks, out);
  }
}

function markFromNode(node: DocumentNode): { type: string; attrs?: Record<string, any> } | null {
  if (node.kind === "em") return { type: "italic" };
  if (node.kind === "strong") return { type: "bold" };
  if (node.kind === "code") return { type: "code" };
  if (node.kind === "link") {
    const href = getLiteralString(node.props?.href) ?? getLiteralString(node.props?.url) ?? getLiteralString(node.props?.to);
    return { type: "link", attrs: { href: href ?? "" } };
  }
  return null;
}

function wrapTextWithMarks(text: string, marks: any[], existingIds: Set<string>): DocumentNode {
  const textNode = makeTextNode(text, existingIds);
  if (!marks.length) return textNode;

  const ordered = [...marks].sort(
    (a, b) => (MARK_PRIORITY[a.type] ?? 99) - (MARK_PRIORITY[b.type] ?? 99),
  );

  let current = textNode;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    current = wrapMark(current, ordered[i], existingIds);
  }
  return current;
}

function wrapMark(child: DocumentNode, mark: any, existingIds: Set<string>): DocumentNode {
  const kind = mark.type === "bold" ? "strong" : mark.type === "italic" ? "em" : mark.type === "code" ? "code" : "link";
  const props: Record<string, NodePropValue> = {};
  if (kind === "link" && mark.attrs?.href) {
    props.href = { kind: "LiteralValue", value: String(mark.attrs.href) };
  }
  return {
    id: nextId(kind, existingIds),
    kind,
    props,
    children: [child],
  };
}

function buildInlineSlot(attrs: InlineSlotAttrs, existingIds: Set<string>): DocumentNode {
  const slotId = attrs.id ?? nextId("inlineSlot", existingIds);
  const textId = attrs.textId ?? nextId("slotText", existingIds);
  const props: Record<string, NodePropValue> = {};
  if (attrs.reserve) props.reserve = { kind: "LiteralValue", value: attrs.reserve };
  if (attrs.fit) props.fit = { kind: "LiteralValue", value: attrs.fit };

  return {
    id: slotId,
    kind: "inline_slot",
    props,
    refresh: parseRefreshAttr(attrs.refresh),
    transition: parseTransitionAttr(attrs.transition),
    children: [
      {
        id: textId,
        kind: "text",
        props: { content: { kind: "LiteralValue", value: attrs.text ?? "" } },
        children: [],
      },
    ],
  };
}

function makeTextNode(text: string, existingIds: Set<string>): DocumentNode {
  return {
    id: nextId("text", existingIds),
    kind: "text",
    props: { content: { kind: "LiteralValue", value: text } },
    children: [],
  };
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

function refreshToAttr(policy: RefreshPolicy): string {
  const kind = (policy as any).kind;
  if (kind === "docstep" || kind === "onDocstep") return "docstep";
  if (kind === "never" || kind === "onLoad") return "never";
  if (kind === "every") {
    const duration = `${(policy as any).amount}${(policy as any).unit ?? "s"}`;
    const phase = (policy as any).phase;
    if (phase !== undefined) {
      const phaseUnit = (policy as any).phaseUnit ?? (policy as any).unit ?? "s";
      return `every(${duration}, ${phase}${phaseUnit})`;
    }
    return `every(${duration})`;
  }
  if (kind === "at") {
    const time = `${(policy as any).time}${(policy as any).unit ?? "s"}`;
    return `at(${time})`;
  }
  if (kind === "atEach") {
    const times = Array.isArray((policy as any).times) ? (policy as any).times : [];
    const unit = (policy as any).unit ?? "s";
    return `atEach(${times.map((t: any) => `${t}${unit}`).join(", ")})`;
  }
  if (kind === "poisson") return `poisson(${(policy as any).ratePerSec ?? 0})`;
  if (kind === "chance") {
    const p = (policy as any).p ?? 0;
    const every = (policy as any).every;
    if (!every || every.kind === "docstep") return `chance(${p}, docstep)`;
    if (every.kind === "every") {
      return `chance(${p}, ${every.amount}${every.unit ?? "s"})`;
    }
    return `chance(${p}, docstep)`;
  }
  return "docstep";
}

function parseRefreshAttr(value?: string): RefreshPolicy | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === "docstep" || trimmed === "onDocstep") return { kind: "docstep" } as any;
  if (trimmed === "never" || trimmed === "onLoad") return { kind: "never" } as any;

  const everyMatch = trimmed.match(/^every\(([^,\)]+)(?:,\s*([^\)]+))?\)$/i);
  if (everyMatch) {
    const duration = parseDuration(everyMatch[1]);
    if (!duration) return undefined;
    const phase = everyMatch[2] ? parseDuration(everyMatch[2]) : null;
    return {
      kind: "every",
      amount: duration.amount,
      unit: duration.unit,
      phase: phase?.amount,
      phaseUnit: phase?.unit,
    } as any;
  }

  const atMatch = trimmed.match(/^at\(([^\)]+)\)$/i);
  if (atMatch) {
    const time = parseDuration(atMatch[1]);
    if (!time) return undefined;
    return { kind: "at", time: time.amount, unit: time.unit } as any;
  }

  const atEachMatch = trimmed.match(/^atEach\((.+)\)$/i);
  if (atEachMatch) {
    const raw = atEachMatch[1].replace(/[\[\]]/g, "");
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
    const parsed = parts.map((part) => parseDuration(part)).filter(Boolean) as Array<{
      amount: number;
      unit: string;
    }>;
    if (!parsed.length) return undefined;
    const firstUnit = parsed[0].unit;
    const mixed = parsed.some((item) => item.unit !== firstUnit);
    if (!mixed) {
      return { kind: "atEach", times: parsed.map((item) => item.amount), unit: firstUnit } as any;
    }
    return {
      kind: "atEach",
      times: parsed.map((item) => toSeconds(item.amount, item.unit)),
      unit: "s",
    } as any;
  }

  const poissonMatch = trimmed.match(/^poisson\(([^\)]+)\)$/i);
  if (poissonMatch) {
    const rate = Number(poissonMatch[1]);
    if (!Number.isFinite(rate)) return undefined;
    return { kind: "poisson", ratePerSec: rate } as any;
  }

  const chanceMatch = trimmed.match(/^chance\(([^,\)]+)(?:,\s*([^\)]+))?\)$/i);
  if (chanceMatch) {
    const p = Number(chanceMatch[1]);
    if (!Number.isFinite(p)) return undefined;
    const everyRaw = chanceMatch[2]?.trim();
    if (!everyRaw || everyRaw === "docstep") {
      return { kind: "chance", p, every: { kind: "docstep" } } as any;
    }
    const duration = parseDuration(everyRaw);
    if (!duration) return undefined;
    return { kind: "chance", p, every: { kind: "every", amount: duration.amount, unit: duration.unit } } as any;
  }

  return undefined;
}

function transitionToAttr(spec: any): string | undefined {
  if (!spec || typeof spec !== "object") return undefined;
  if (spec.kind === "none") return "none";
  if (spec.kind === "appear") return "appear()";
  if (spec.kind === "fade") return `fade(${spec.durationMs}ms, ${spec.ease ?? "linear"})`;
  if (spec.kind === "wipe")
    return `wipe(${spec.direction ?? "right"}, ${spec.durationMs}ms, ${spec.ease ?? "linear"})`;
  if (spec.kind === "flash") return `flash(${spec.durationMs}ms)`;
  return undefined;
}

function parseTransitionAttr(value?: string): any | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === "none") return { kind: "none" };
  if (trimmed.startsWith("appear")) return { kind: "appear" };
  const fadeMatch = trimmed.match(/^fade\((\d+)ms(?:,\s*([a-zA-Z]+))?\)$/i);
  if (fadeMatch) {
    return { kind: "fade", durationMs: Number(fadeMatch[1]), ease: fadeMatch[2] ?? "linear" };
  }
  const wipeMatch = trimmed.match(/^wipe\((left|right|up|down),\s*(\d+)ms(?:,\s*([a-zA-Z]+))?\)$/i);
  if (wipeMatch) {
    return {
      kind: "wipe",
      direction: wipeMatch[1],
      durationMs: Number(wipeMatch[2]),
      ease: wipeMatch[3] ?? "linear",
    };
  }
  const flashMatch = trimmed.match(/^flash\((\d+)ms\)$/i);
  if (flashMatch) {
    return { kind: "flash", durationMs: Number(flashMatch[1]) };
  }
  return undefined;
}

function parseDuration(value: string): { amount: number; unit: string } | null {
  const match = value.trim().match(/^(-?\\d*\\.?\\d+)\\s*(ms|s|m)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return { amount, unit: match[2].toLowerCase() };
}

function toSeconds(amount: number, unit: string): number {
  if (!Number.isFinite(amount)) return 0;
  const normalized = unit.toLowerCase();
  if (normalized === "ms") return amount / 1000;
  if (normalized === "m") return amount * 60;
  return amount;
}
