import type { DocumentNode, FluxDocument } from "./ast.js";

export type SlotFitPolicy = "clip" | "ellipsis" | "shrink" | "scaleDown";

export type AddTransformKind =
  | "title"
  | "page"
  | "section"
  | "paragraph"
  | "figure"
  | "callout"
  | "table"
  | "slot"
  | "inline-slot"
  | "bibliography-stub";

export interface AddTransformOptions {
  kind: AddTransformKind;
  text?: string;
  heading?: string;
  label?: string;
  noHeading?: boolean;
  bankName?: string;
  tags?: string[];
  caption?: string;
  reserve?: string | { width: number; height?: number; units?: string };
  fit?: SlotFitPolicy | string;
}

const INDENT = "  ";
const DEFAULT_RESERVE = "fixed(240, 160, px)";
const DEFAULT_FIT: SlotFitPolicy = "scaleDown";

export function applyAddTransform(source: string, doc: FluxDocument, options: AddTransformOptions): string {
  const allIds = collectIds(doc.body?.nodes ?? []);
  const makeId = (prefix: string): string => nextId(prefix, allIds);

  switch (options.kind) {
    case "title":
      return applyTitleUpdate(source, options.text ?? "Untitled Document");
    case "page":
      return insertIntoBody(source, buildPageSnippet(makeId("page"), options.heading));
    case "section":
      return insertIntoLastPage(source, doc, buildSectionSnippet(makeId("section"), options));
    case "paragraph":
      return insertIntoLastSection(source, doc, buildParagraphSnippet(makeId("paragraph"), options));
    case "figure":
      return insertIntoLastPage(source, doc, buildFigureSnippet(makeId("figure"), doc, options));
    case "callout":
      return insertIntoLastPage(source, doc, buildCalloutSnippet(makeId("callout"), options));
    case "table":
      return insertIntoLastPage(source, doc, buildTableSnippet(makeId("table")));
    case "slot":
      return insertIntoLastPage(source, doc, buildSlotSnippet(makeId("slot")));
    case "inline-slot":
      return insertIntoLastPage(source, doc, buildInlineSlotSnippet(makeId("inlineSlot")));
    case "bibliography-stub":
      return insertIntoBody(source, buildBibliographySnippet(makeId("bibliography")));
    default:
      throw new Error(`Unsupported add transform '${options.kind}'`);
  }
}

export function formatFluxSource(source: string): string {
  const trimmed = source.replace(/[\t ]+\n/g, "\n");
  return trimmed.endsWith("\n") ? trimmed : trimmed + "\n";
}

function collectIds(nodes: DocumentNode[]): Set<string> {
  const ids = new Set<string>();
  const visit = (node: DocumentNode) => {
    ids.add(node.id);
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return ids;
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

function findBlockRange(source: string, blockName: string): { start: number; end: number; indent: string } | null {
  const regex = new RegExp(`(^|\\n)([\\t ]*)${blockName}\\s*\\{`, "m");
  const match = regex.exec(source);
  if (!match || match.index == null) return null;
  const indent = match[2] ?? "";
  const braceIndex = source.indexOf("{", match.index + match[0].length - 1);
  if (braceIndex === -1) return null;
  const endIndex = findMatchingBrace(source, braceIndex);
  if (endIndex === -1) return null;
  return { start: braceIndex + 1, end: endIndex, indent };
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      if (ch === "\\" && next) {
        i += 1;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "\"" || ch === "'") {
      inString = ch;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function insertIntoBody(source: string, snippet: string): string {
  const block = findBlockRange(source, "body");
  if (!block) {
    throw new Error("No body block found");
  }
  const childIndent = block.indent + INDENT;
  return insertSnippet(source, block.end, childIndent, snippet);
}

function insertIntoLastPage(source: string, doc: FluxDocument, snippet: string): string {
  const pages = doc.body?.nodes?.filter((node) => node.kind === "page") ?? [];
  if (!pages.length) {
    return insertIntoBody(source, snippet);
  }
  const last = pages[pages.length - 1];
  const loc = last.loc;
  if (!loc?.endLine || !loc?.endColumn) {
    return insertIntoBody(source, snippet);
  }
  const index = lineColumnToIndex(source, loc.endLine, loc.endColumn);
  const indent = getLineIndent(source, loc.endLine);
  const childIndent = indent + INDENT;
  return insertSnippet(source, index, childIndent, snippet);
}

function insertIntoLastSection(source: string, doc: FluxDocument, snippet: string): string {
  const sections: DocumentNode[] = [];
  const visit = (node: DocumentNode) => {
    if (node.kind === "section") sections.push(node);
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  for (const node of doc.body?.nodes ?? []) {
    visit(node);
  }
  if (!sections.length) {
    return insertIntoLastPage(source, doc, snippet);
  }
  const last = sections[sections.length - 1];
  const loc = last.loc;
  if (!loc?.endLine || !loc?.endColumn) {
    return insertIntoLastPage(source, doc, snippet);
  }
  const index = lineColumnToIndex(source, loc.endLine, loc.endColumn);
  const indent = getLineIndent(source, loc.endLine);
  const childIndent = indent + INDENT;
  return insertSnippet(source, index, childIndent, snippet);
}

function lineColumnToIndex(source: string, line: number, column: number): number {
  const lines = source.split("\n");
  const clampedLine = Math.max(1, Math.min(line, lines.length));
  let index = 0;
  for (let i = 0; i < clampedLine - 1; i += 1) {
    index += lines[i].length + 1;
  }
  const colIndex = Math.max(1, column) - 1;
  return index + colIndex;
}

function getLineIndent(source: string, line: number): string {
  const lines = source.split("\n");
  const text = lines[line - 1] ?? "";
  const match = /^([\t ]*)/.exec(text);
  return match ? match[1] : "";
}

function insertSnippet(source: string, index: number, indent: string, snippet: string): string {
  const prefix = source.slice(0, index);
  const suffix = source.slice(index);
  const needsLeadingNewline = !prefix.endsWith("\n");
  const indented = snippet
    .split("\n")
    .map((line) => (line.length ? indent + line : ""))
    .join("\n");
  const insertion = `${needsLeadingNewline ? "\n" : ""}${indented}\n${indent.slice(0, Math.max(0, indent.length - INDENT.length))}`;
  return prefix + insertion + suffix;
}

function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}

function applyTitleUpdate(source: string, title: string): string {
  const metaBlock = findBlockRange(source, "meta");
  if (!metaBlock) return source;
  const indent = metaBlock.indent + INDENT;
  const blockContent = source.slice(metaBlock.start, metaBlock.end);
  const titleRegex = /title\s*=\s*"[^"]*"\s*;/;
  let nextBlock = blockContent;
  if (titleRegex.test(blockContent)) {
    nextBlock = blockContent.replace(titleRegex, `title = "${escapeString(title)}";`);
  } else {
    nextBlock = `\n${indent}title = "${escapeString(title)}";` + blockContent;
  }
  let updated = source.slice(0, metaBlock.start) + nextBlock + source.slice(metaBlock.end);
  updated = updated.replace(
    /(text\s+\w+\s*\{[^}]*role\s*=\s*"title";[^}]*content\s*=\s*")([^"]*)("[^}]*\})/m,
    (_match, start, _content, end) => `${start}${escapeString(title)}${end}`,
  );
  return updated;
}

function buildPageSnippet(id: string, heading?: string): string {
  const title = heading ?? "New Page";
  return [
    `page ${id} {`,
    `${INDENT}section ${id}Section {`,
    `${INDENT}${INDENT}text ${id}Heading { style = "H1"; content = "${escapeString(title)}"; }`,
    `${INDENT}${INDENT}text ${id}Body { content = "Start writing here."; }`,
    `${INDENT}}`,
    `}`,
  ].join("\n");
}

function buildSectionSnippet(id: string, options: AddTransformOptions): string {
  const heading = options.heading ?? "Section Heading";
  const lines = [`section ${id} {`];
  if (!options.noHeading) {
    lines.push(`${INDENT}text ${id}Heading { style = "H2"; content = "${escapeString(heading)}"; }`);
  }
  lines.push(`${INDENT}text ${id}Body { content = "Start writing here."; }`);
  lines.push(`}`);
  return lines.join("\n");
}

function buildParagraphSnippet(id: string, options: AddTransformOptions): string {
  const content = options.text ?? "New paragraph.";
  return [`text ${id} { content = "${escapeString(content)}"; }`].join("\n");
}

function buildFigureSnippet(id: string, doc: FluxDocument, options: AddTransformOptions): string {
  const label = options.label ?? `${id}`;
  const caption = options.caption ?? "Figure caption.";
  const { assetExpr, reserveExpr, fitExpr } = resolveFigureOptions(doc, options);

  if (!assetExpr) {
    return [
      `figure ${id} {`,
      `${INDENT}label = "${escapeString(label)}";`,
      `${INDENT}slot ${id}Slot {`,
      `${INDENT}${INDENT}reserve = ${reserveExpr};`,
      `${INDENT}${INDENT}fit = ${fitExpr};`,
      `${INDENT}${INDENT}text ${id}Placeholder { content = "Figure placeholder"; }`,
      `${INDENT}}`,
      `${INDENT}text ${id}Caption { role = "caption"; content = "${escapeString(caption)}"; }`,
      `}`,
    ].join("\n");
  }

  return [
    `figure ${id} {`,
    `${INDENT}label = "${escapeString(label)}";`,
    `${INDENT}slot ${id}Slot {`,
    `${INDENT}${INDENT}reserve = ${reserveExpr};`,
    `${INDENT}${INDENT}fit = ${fitExpr};`,
    `${INDENT}${INDENT}image ${id}Image { asset = ${assetExpr}; }`,
    `${INDENT}}`,
    `${INDENT}text ${id}Caption { role = "caption"; content = "${escapeString(caption)}"; }`,
    `}`,
  ].join("\n");
}

function resolveFigureOptions(
  doc: FluxDocument,
  options: AddTransformOptions,
): { assetExpr: string | null; reserveExpr: string; fitExpr: string } {
  let bankTags: string[] = [];
  if (options.bankName) {
    const bank = doc.assets?.banks?.find((entry) => entry.name === options.bankName);
    if (!bank) {
      throw new Error(`Unknown asset bank '${options.bankName}'`);
    }
    bankTags = [...(bank.tags ?? []), `bank:${bank.name}`];
  }

  const userTags = Array.isArray(options.tags) ? options.tags.map((tag) => String(tag)) : [];
  const tags = dedupeTags([...bankTags, ...userTags]);
  const assetExpr = tags.length
    ? `@assets.pick(tags=[${tags.map((tag) => `"${escapeString(tag)}"`).join(", ")}])`
    : null;

  return {
    assetExpr,
    reserveExpr: normalizeReserve(options.reserve),
    fitExpr: normalizeFit(options.fit),
  };
}

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const clean = tag.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function normalizeReserve(reserve: AddTransformOptions["reserve"]): string {
  if (!reserve) return DEFAULT_RESERVE;
  if (typeof reserve === "string") {
    const trimmed = reserve.trim();
    if (/^(fixed|fixedWidth)\(/.test(trimmed)) {
      return trimmed;
    }
    return DEFAULT_RESERVE;
  }
  const width = typeof reserve.width === "number" && Number.isFinite(reserve.width) ? reserve.width : null;
  const height = typeof reserve.height === "number" && Number.isFinite(reserve.height) ? reserve.height : null;
  const units = reserve.units ?? "px";
  if (!width) return DEFAULT_RESERVE;
  if (!height) return `fixedWidth(${width}, ${units})`;
  return `fixed(${width}, ${height}, ${units})`;
}

function normalizeFit(fit: AddTransformOptions["fit"]): string {
  const raw = typeof fit === "string" ? fit : fit ?? DEFAULT_FIT;
  if (raw === "clip" || raw === "ellipsis" || raw === "shrink" || raw === "scaleDown") {
    return raw;
  }
  return DEFAULT_FIT;
}

function buildCalloutSnippet(id: string, options: AddTransformOptions): string {
  const tone = options.label ?? "info";
  const content = options.text ?? "Callout text.";
  return [
    `callout ${id} {`,
    `${INDENT}tone = "${escapeString(tone)}";`,
    `${INDENT}text ${id}Body { content = "${escapeString(content)}"; }`,
    `}`,
  ].join("\n");
}

function buildTableSnippet(id: string): string {
  return [
    `table ${id} {`,
    `${INDENT}rows = [`,
    `${INDENT}${INDENT}["Column", "Value"],`,
    `${INDENT}${INDENT}["Row 1", "Edit me"],`,
    `${INDENT}];`,
    `${INDENT}header = true;`,
    `}`,
  ].join("\n");
}

function buildSlotSnippet(id: string): string {
  return [
    `slot ${id} {`,
    `${INDENT}reserve = fixed(200, 80, px);`,
    `${INDENT}fit = shrink;`,
    `${INDENT}refresh = onDocstep;`,
    `${INDENT}text ${id}Text { content = @docstep; }`,
    `}`,
  ].join("\n");
}

function buildInlineSlotSnippet(id: string): string {
  return [
    `text ${id}Line {`,
    `${INDENT}content = "Inline slot demo: ";`,
    `${INDENT}inline_slot ${id} {`,
    `${INDENT}${INDENT}reserve = fixedWidth(8, ch);`,
    `${INDENT}${INDENT}fit = ellipsis;`,
    `${INDENT}${INDENT}refresh = onDocstep;`,
    `${INDENT}${INDENT}text ${id}Value { content = @docstep; }`,
    `${INDENT}}`,
    `}`,
  ].join("\n");
}

function buildBibliographySnippet(id: string): string {
  return [
    `section ${id} {`,
    `${INDENT}text ${id}Heading { style = "H2"; content = "References"; }`,
    `${INDENT}// TODO: add bibliography entries or wire to a citation system.`,
    `}`,
  ].join("\n");
}
