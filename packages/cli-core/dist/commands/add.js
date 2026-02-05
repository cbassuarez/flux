import path from "node:path";
import { errorResult, okResult } from "../types.js";
import { readFileText, writeFileText } from "../fs.js";
import { parseFlux } from "./common.js";
import { checkCommand } from "./check.js";
const INDENT = "  ";
export async function addCommand(options) {
    if (!options.file) {
        return errorResult("flux add: No input file specified.", "NO_INPUT");
    }
    let source;
    try {
        source = await readFileText(options.file);
    }
    catch (error) {
        return errorResult(`flux add: failed to read ${options.file}: ${error.message}`, "READ_ERROR", error);
    }
    let doc;
    try {
        doc = parseFlux(source, options.file);
    }
    catch (error) {
        return errorResult(`flux add: parse failed: ${error.message}`, "PARSE_ERROR", error);
    }
    const allIds = collectIds(doc.body?.nodes ?? []);
    const makeId = (prefix) => nextId(prefix, allIds);
    let nextSource = source;
    try {
        switch (options.kind) {
            case "title":
                nextSource = applyTitleUpdate(source, options.text ?? "Untitled Document");
                break;
            case "page":
                nextSource = insertIntoBody(source, buildPageSnippet(makeId("page"), options.heading));
                break;
            case "section":
                nextSource = insertIntoLastPage(source, doc, buildSectionSnippet(makeId("section"), options));
                break;
            case "figure":
                nextSource = insertIntoLastPage(source, doc, buildFigureSnippet(makeId("figure"), options));
                break;
            case "callout":
                nextSource = insertIntoLastPage(source, doc, buildCalloutSnippet(makeId("callout"), options));
                break;
            case "table":
                nextSource = insertIntoLastPage(source, doc, buildTableSnippet(makeId("table")));
                break;
            case "slot":
                nextSource = insertIntoLastPage(source, doc, buildSlotSnippet(makeId("slot")));
                break;
            case "inline-slot":
                nextSource = insertIntoLastPage(source, doc, buildInlineSlotSnippet(makeId("inlineSlot")));
                break;
            case "bibliography-stub":
                nextSource = insertIntoBody(source, buildBibliographySnippet(makeId("bibliography")));
                break;
            default:
                return errorResult(`flux add: unsupported kind '${options.kind}'`, "UNSUPPORTED_KIND");
        }
    }
    catch (error) {
        return errorResult(`flux add: ${String(error?.message ?? error)}`, "ADD_FAILED", error);
    }
    nextSource = formatFluxSource(nextSource);
    await writeFileText(path.resolve(options.file), nextSource);
    if (!options.noCheck) {
        const check = await checkCommand({ files: [options.file] });
        const failures = check.data?.results?.filter((r) => !r.ok) ?? [];
        if (failures.length > 0) {
            return errorResult("flux add: check failed after edit", "CHECK_FAILED", failures);
        }
    }
    return okResult({ file: options.file, kind: options.kind });
}
function collectIds(nodes) {
    const ids = new Set();
    const visit = (node) => {
        ids.add(node.id);
        node.children?.forEach(visit);
    };
    nodes.forEach(visit);
    return ids;
}
function nextId(prefix, ids) {
    let n = 1;
    let candidate = `${prefix}${n}`;
    while (ids.has(candidate)) {
        n += 1;
        candidate = `${prefix}${n}`;
    }
    ids.add(candidate);
    return candidate;
}
function findBlockRange(source, blockName) {
    const regex = new RegExp(`(^|\\n)([\\t ]*)${blockName}\\s*\\{`, "m");
    const match = regex.exec(source);
    if (!match || match.index == null)
        return null;
    const indent = match[2] ?? "";
    const startIndex = match.index + match[0].length;
    const braceIndex = source.indexOf("{", match.index + match[0].length - 1);
    if (braceIndex === -1)
        return null;
    const endIndex = findMatchingBrace(source, braceIndex);
    if (endIndex === -1)
        return null;
    return { start: braceIndex + 1, end: endIndex, indent };
}
function findMatchingBrace(source, openIndex) {
    let depth = 0;
    let inString = null;
    let inLineComment = false;
    let inBlockComment = false;
    for (let i = openIndex; i < source.length; i += 1) {
        const ch = source[i];
        const next = source[i + 1];
        if (inLineComment) {
            if (ch === "\n")
                inLineComment = false;
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
        if (ch === "{")
            depth += 1;
        if (ch === "}") {
            depth -= 1;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
function insertIntoBody(source, snippet) {
    const block = findBlockRange(source, "body");
    if (!block) {
        throw new Error("No body block found");
    }
    const childIndent = block.indent + INDENT;
    return insertSnippet(source, block.end, childIndent, snippet);
}
function insertIntoLastPage(source, doc, snippet) {
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
function lineColumnToIndex(source, line, column) {
    const lines = source.split("\n");
    const clampedLine = Math.max(1, Math.min(line, lines.length));
    let index = 0;
    for (let i = 0; i < clampedLine - 1; i += 1) {
        index += lines[i].length + 1;
    }
    const colIndex = Math.max(1, column) - 1;
    return index + colIndex;
}
function getLineIndent(source, line) {
    const lines = source.split("\n");
    const text = lines[line - 1] ?? "";
    const match = /^([\t ]*)/.exec(text);
    return match ? match[1] : "";
}
function insertSnippet(source, index, indent, snippet) {
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
function escapeString(value) {
    return value.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}
function applyTitleUpdate(source, title) {
    const metaBlock = findBlockRange(source, "meta");
    if (!metaBlock)
        return source;
    const indent = metaBlock.indent + INDENT;
    const blockContent = source.slice(metaBlock.start, metaBlock.end);
    const titleRegex = /title\s*=\s*"[^"]*"\s*;/;
    let nextBlock = blockContent;
    if (titleRegex.test(blockContent)) {
        nextBlock = blockContent.replace(titleRegex, `title = "${escapeString(title)}";`);
    }
    else {
        nextBlock = `\n${indent}title = "${escapeString(title)}";` + blockContent;
    }
    let updated = source.slice(0, metaBlock.start) + nextBlock + source.slice(metaBlock.end);
    updated = updated.replace(/(text\s+\w+\s*\{[^}]*role\s*=\s*"title";[^}]*content\s*=\s*")([^"]*)("[^}]*\})/m, (_match, start, _content, end) => `${start}${escapeString(title)}${end}`);
    return updated;
}
function buildPageSnippet(id, heading) {
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
function buildSectionSnippet(id, options) {
    const heading = options.heading ?? "Section Heading";
    const lines = [`section ${id} {`];
    if (!options.noHeading) {
        lines.push(`${INDENT}text ${id}Heading { style = "H2"; content = "${escapeString(heading)}"; }`);
    }
    lines.push(`${INDENT}text ${id}Body { content = "Start writing here."; }`);
    lines.push(`}`);
    return lines.join("\n");
}
function buildFigureSnippet(id, options) {
    const label = options.label ?? `${id}`;
    return [
        `figure ${id} {`,
        `${INDENT}label = "${escapeString(label)}";`,
        `${INDENT}slot ${id}Slot {`,
        `${INDENT}${INDENT}reserve = fixed(240, 160, px);`,
        `${INDENT}${INDENT}fit = scaleDown;`,
        `${INDENT}${INDENT}text ${id}Placeholder { content = "Figure placeholder"; }`,
        `${INDENT}}`,
        `${INDENT}text ${id}Caption { role = "caption"; content = "Figure caption."; }`,
        `}`,
    ].join("\n");
}
function buildCalloutSnippet(id, options) {
    const tone = options.label ?? "info";
    const content = options.text ?? "Callout text.";
    return [
        `callout ${id} {`,
        `${INDENT}tone = "${escapeString(tone)}";`,
        `${INDENT}text ${id}Body { content = "${escapeString(content)}"; }`,
        `}`,
    ].join("\n");
}
function buildTableSnippet(id) {
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
function buildSlotSnippet(id) {
    return [
        `slot ${id} {`,
        `${INDENT}reserve = fixed(200, 80, px);`,
        `${INDENT}fit = shrink;`,
        `${INDENT}refresh = onDocstep;`,
        `${INDENT}text ${id}Text { content = @docstep; }`,
        `}`,
    ].join("\n");
}
function buildInlineSlotSnippet(id) {
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
function buildBibliographySnippet(id) {
    return [
        `section ${id} {`,
        `${INDENT}text ${id}Heading { style = "H2"; content = "References"; }`,
        `${INDENT}// TODO: add bibliography entries or wire to a citation system.`,
        `}`,
    ].join("\n");
}
function formatFluxSource(source) {
    const trimmed = source.replace(/[\t ]+\n/g, "\n");
    return trimmed.endsWith("\n") ? trimmed : trimmed + "\n";
}
//# sourceMappingURL=add.js.map