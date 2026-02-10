const META_SLOT_NAMES_KEY = "editor.slotNames";
const META_SLOT_VARIANT_LABELS_KEY = "editor.slotVariantLabels";
const INDENT = "  ";

export type EditorSlotMeta = {
  slotNames: Map<string, string>;
  slotVariantLabels: Map<string, string[]>;
};

export function readEditorSlotMeta(meta: Record<string, unknown> | null | undefined, slotIds?: Set<string>): EditorSlotMeta {
  const slotNames = new Map<string, string>();
  const slotVariantLabels = new Map<string, string[]>();
  if (!meta || typeof meta !== "object") return { slotNames, slotVariantLabels };
  const record = meta as Record<string, unknown>;

  const namesRaw = record[META_SLOT_NAMES_KEY];
  if (Array.isArray(namesRaw)) {
    for (const entry of namesRaw) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const id = String(entry[0] ?? "");
      const name = entry[1];
      if (!id || typeof name !== "string") continue;
      if (slotIds && !slotIds.has(id)) continue;
      slotNames.set(id, name);
    }
  }

  const labelsRaw = record[META_SLOT_VARIANT_LABELS_KEY];
  if (Array.isArray(labelsRaw)) {
    for (const entry of labelsRaw) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const id = String(entry[0] ?? "");
      const labels = entry[1];
      if (!id || !Array.isArray(labels)) continue;
      if (slotIds && !slotIds.has(id)) continue;
      slotVariantLabels.set(
        id,
        labels.map((label) => String(label ?? "")),
      );
    }
  }

  return { slotNames, slotVariantLabels };
}

export function applyEditorMetaToSource({
  source,
  slotNames,
  slotVariantLabels,
  slotIds,
}: {
  source: string;
  slotNames: Map<string, string>;
  slotVariantLabels: Map<string, string[]>;
  slotIds: Set<string>;
}): string {
  const slotNameEntries = Array.from(slotNames.entries())
    .filter(([id, name]) => slotIds.has(id) && name.trim() !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, name]) => [id, name]);

  const slotVariantEntries = Array.from(slotVariantLabels.entries())
    .filter(([id, labels]) => {
      if (!slotIds.has(id)) return false;
      return labels.some((label) => String(label ?? "").trim() !== "");
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, labels]) => [id, labels.map((label) => String(label ?? ""))]);

  const metaEntries: Record<string, string | null> = {
    [META_SLOT_NAMES_KEY]: slotNameEntries.length ? formatFluxLiteral(slotNameEntries) : null,
    [META_SLOT_VARIANT_LABELS_KEY]: slotVariantEntries.length ? formatFluxLiteral(slotVariantEntries) : null,
  };

  const metaRange = findBlockRange(source, "meta");
  if (!metaRange) {
    const hasEntries = Object.values(metaEntries).some(Boolean);
    if (!hasEntries) return source;
    return insertMetaBlock(source, metaEntries);
  }

  const blockContent = source.slice(metaRange.start, metaRange.end);
  const innerIndent = metaRange.indent + INDENT;
  const updated = updateMetaBlockContent(blockContent, innerIndent, metaEntries);
  return source.slice(0, metaRange.start) + updated + source.slice(metaRange.end);
}

function insertMetaBlock(source: string, metaEntries: Record<string, string | null>): string {
  const docRange = findBlockRange(source, "document");
  if (!docRange) return source;
  const keys = Object.keys(metaEntries).filter((key) => metaEntries[key]);
  if (!keys.length) return source;
  const indent = docRange.indent + INDENT;
  const innerIndent = indent + INDENT;
  const lines = keys.map((key) => `${innerIndent}${key} = ${metaEntries[key]};`);
  const block = `\n${indent}meta {\n${lines.join("\n")}\n${indent}}\n`;
  return source.slice(0, docRange.start) + block + source.slice(docRange.start);
}

function updateMetaBlockContent(
  blockContent: string,
  innerIndent: string,
  metaEntries: Record<string, string | null>,
): string {
  const keys = Object.keys(metaEntries);
  let lines = blockContent.split("\n");
  lines = lines.filter((line) => !keys.some((key) => line.trimStart().startsWith(`${key} =`)));

  const newLines = keys
    .filter((key) => metaEntries[key])
    .map((key) => `${innerIndent}${key} = ${metaEntries[key]};`);

  if (newLines.length) {
    if (lines.length && lines[lines.length - 1].trim() !== "") {
      lines.push("");
    }
    lines.push(...newLines);
  }

  if (lines.length && lines[0].trim() !== "") {
    lines.unshift("");
  }

  return lines.join("\n");
}

function formatFluxLiteral(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => formatFluxLiteral(item)).join(", ");
    return `[ ${items} ]`;
  }
  if (typeof value === "string") {
    return `"${escapeStringLiteral(value)}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value == null) {
    return "null";
  }
  return `"${escapeStringLiteral(String(value))}"`;
}

function escapeStringLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
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
      if (ch === inString) inString = null;
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
    if (ch === '"' || ch === "'") {
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
