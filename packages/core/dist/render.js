import fs from "node:fs";
import path from "node:path";
import { computeGridLayout } from "./layout.js";
import { createRuntime } from "./runtime.js";
export function createDocumentRuntime(doc, options = {}) {
    const seed = options.seed ?? 0;
    let time = options.time ?? 0;
    let docstep = options.docstep ?? 0;
    const baseBody = ensureBody(doc);
    const assets = buildAssetCatalog(doc, options);
    const baseParams = buildParams(doc.state.params);
    const styleRegistry = buildStyleRegistry(doc);
    const body = applyVisibility(baseBody, {
        params: baseParams,
        meta: doc.meta,
        tokens: styleRegistry.tokens,
        seed,
    });
    const counterRegistry = buildCounterRegistry(body);
    const nodeCache = new Map();
    let legacySnapshot = null;
    let legacySnapshotDocstep = null;
    const getLegacySnapshot = () => {
        if (!doc.grids?.length)
            return null;
        if (legacySnapshot && legacySnapshotDocstep === docstep) {
            return legacySnapshot;
        }
        const runtime = createRuntime(doc, { clock: "manual" });
        let snap = runtime.snapshot();
        if (docstep > 0) {
            try {
                for (let i = 0; i < docstep; i += 1) {
                    snap = runtime.step();
                }
            }
            catch {
                snap = runtime.snapshot();
            }
        }
        legacySnapshot = snap;
        legacySnapshotDocstep = docstep;
        return legacySnapshot;
    };
    const render = () => {
        const snap = getLegacySnapshot();
        const params = snap?.params ?? baseParams;
        const ctx = {
            doc,
            params,
            time,
            docstep,
            seed,
            assets,
            legacySnapshot: snap,
            styleRegistry,
            counterRegistry,
        };
        const renderedBody = body.nodes.map((node, index) => renderNode(node, ctx, nodeCache, "root", undefined, index, false));
        return {
            meta: doc.meta,
            seed,
            time,
            docstep,
            pageConfig: doc.pageConfig,
            assets: assetsToRender(assets),
            body: renderedBody,
        };
    };
    const tick = (seconds) => {
        const delta = Number(seconds);
        if (!Number.isFinite(delta)) {
            throw new Error("tick(seconds) requires a finite number");
        }
        time += delta;
        return render();
    };
    const step = (n = 1) => {
        const amount = Number(n);
        if (!Number.isFinite(amount)) {
            throw new Error("step(n) requires a finite number");
        }
        docstep += amount;
        return render();
    };
    return {
        get doc() {
            return doc;
        },
        get seed() {
            return seed;
        },
        get time() {
            return time;
        },
        get docstep() {
            return docstep;
        },
        render,
        tick,
        step,
    };
}
export function renderDocument(doc, options = {}) {
    const runtime = createDocumentRuntime(doc, options);
    return runtime.render();
}
export function createDocumentRuntimeIR(doc, options = {}) {
    const runtime = createDocumentRuntime(doc, options);
    const baseBody = ensureBody(doc);
    const styleRegistry = buildStyleRegistry(doc);
    const baseParams = buildParams(doc.state.params);
    const body = applyVisibility(baseBody, {
        params: baseParams,
        meta: doc.meta,
        tokens: styleRegistry.tokens,
        seed: options.seed ?? 0,
    });
    const counterRegistry = buildCounterRegistry(body);
    const toIr = (rendered) => buildRenderDocumentIR(rendered, body, styleRegistry, counterRegistry);
    return {
        get doc() {
            return runtime.doc;
        },
        get seed() {
            return runtime.seed;
        },
        get time() {
            return runtime.time;
        },
        get docstep() {
            return runtime.docstep;
        },
        render: () => toIr(runtime.render()),
        tick: (seconds) => toIr(runtime.tick(seconds)),
        step: (n) => toIr(runtime.step(n)),
    };
}
export function renderDocumentIR(doc, options = {}) {
    const runtime = createDocumentRuntimeIR(doc, options);
    return runtime.render();
}
function ensureBody(doc) {
    if (doc.body?.nodes?.length) {
        return doc.body;
    }
    if (!doc.grids?.length) {
        return { nodes: [] };
    }
    const pages = new Map();
    for (const grid of doc.grids) {
        const pageNumber = grid.page ?? 1;
        const node = {
            id: grid.name,
            kind: "grid",
            props: {
                ref: { kind: "LiteralValue", value: grid.name },
            },
            children: [],
        };
        const list = pages.get(pageNumber) ?? [];
        list.push(node);
        pages.set(pageNumber, list);
    }
    const nodes = [];
    const sortedPages = Array.from(pages.keys()).sort((a, b) => a - b);
    for (const pageNumber of sortedPages) {
        const pageNodes = pages.get(pageNumber) ?? [];
        nodes.push({
            id: `page${pageNumber}`,
            kind: "page",
            props: {},
            children: pageNodes,
            refresh: { kind: "onDocstep" },
        });
    }
    return { nodes };
}
function buildRenderDocumentIR(rendered, body, styleRegistry, counterRegistry) {
    return {
        ...rendered,
        body: buildRenderNodesIR(body.nodes, rendered.body, "root", undefined, counterRegistry),
        theme: styleRegistry.theme,
        styles: styleRegistry.renderStyles,
    };
}
function buildRenderNodesIR(astNodes, renderedNodes, parentPath, parentPolicy, counterRegistry) {
    const count = Math.max(astNodes.length, renderedNodes.length);
    const result = [];
    for (let index = 0; index < count; index += 1) {
        const rendered = renderedNodes[index];
        const fallbackAst = rendered
            ? { id: rendered.id, kind: rendered.kind, props: {}, children: [] }
            : { id: `node${index}`, kind: "node", props: {}, children: [] };
        const astNode = astNodes[index] ?? fallbackAst;
        const renderedNode = rendered ?? {
            id: astNode.id,
            kind: astNode.kind,
            props: {},
            children: [],
        };
        const nodePath = `${parentPath}/${astNode.kind}:${astNode.id}:${index}`;
        const effectivePolicy = astNode.refresh ?? parentPolicy ?? { kind: "onLoad" };
        const children = buildRenderNodesIR(astNode.children ?? [], renderedNode.children ?? [], nodePath, effectivePolicy, counterRegistry);
        const slot = buildSlotInfo(astNode.kind, renderedNode.props);
        result.push({
            ...renderedNode,
            nodeId: nodePath,
            refresh: effectivePolicy,
            slot,
            children,
            style: renderedNode.style,
            counters: counterRegistry.countersByNodePath.get(nodePath),
        });
    }
    return result;
}
function buildSlotInfo(kind, props) {
    if (kind !== "slot" && kind !== "inline_slot")
        return undefined;
    const reserve = parseSlotReserve(props.reserve);
    const fit = parseSlotFit(props.fit);
    if (!reserve && !fit)
        return undefined;
    return { reserve, fit };
}
function parseSlotFit(value) {
    if (typeof value !== "string")
        return undefined;
    switch (value) {
        case "clip":
        case "ellipsis":
        case "shrink":
        case "scaleDown":
            return value;
        default:
            return undefined;
    }
}
function parseSlotReserve(value) {
    if (value == null)
        return undefined;
    if (typeof value === "object") {
        if (Array.isArray(value))
            return parseSlotReserveArray(value);
        const maybeAsset = value;
        if (maybeAsset.kind === "asset")
            return undefined;
        return parseSlotReserveObject(value);
    }
    if (typeof value === "string") {
        const fixedMatch = value.match(/^fixed\(\s*([0-9.+-]+)\s*,\s*([0-9.+-]+)\s*,\s*([^)]+)\s*\)$/i);
        if (fixedMatch) {
            const width = Number(fixedMatch[1]);
            const height = Number(fixedMatch[2]);
            const units = fixedMatch[3].trim();
            if (Number.isFinite(width) && Number.isFinite(height) && units) {
                return { kind: "fixed", width, height, units };
            }
        }
        const fixedWidthMatch = value.match(/^fixedWidth\(\s*([0-9.+-]+)\s*,\s*([^)]+)\s*\)$/i);
        if (fixedWidthMatch) {
            const width = Number(fixedWidthMatch[1]);
            const units = fixedWidthMatch[2].trim();
            if (Number.isFinite(width) && units) {
                return { kind: "fixedWidth", width, units };
            }
        }
    }
    return undefined;
}
function parseSlotReserveObject(value) {
    const kind = typeof value.kind === "string" ? value.kind : null;
    if (kind === "fixed") {
        const width = toFiniteNumber(value.width);
        const height = toFiniteNumber(value.height);
        const units = typeof value.units === "string" ? value.units : null;
        if (width !== null && height !== null && units) {
            return { kind: "fixed", width, height, units };
        }
    }
    if (kind === "fixedWidth") {
        const width = toFiniteNumber(value.width);
        const units = typeof value.units === "string" ? value.units : null;
        if (width !== null && units) {
            return { kind: "fixedWidth", width, units };
        }
    }
    return undefined;
}
function parseSlotReserveArray(value) {
    if (value.length >= 3) {
        const width = toFiniteNumber(value[0]);
        const height = toFiniteNumber(value[1]);
        const units = typeof value[2] === "string" ? value[2] : null;
        if (width !== null && height !== null && units) {
            return { kind: "fixed", width, height, units };
        }
    }
    if (value.length >= 2) {
        const width = toFiniteNumber(value[0]);
        const units = typeof value[1] === "string" ? value[1] : null;
        if (width !== null && units) {
            return { kind: "fixedWidth", width, units };
        }
    }
    return undefined;
}
function toFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return null;
}
function buildParams(params) {
    const values = {};
    for (const param of params ?? []) {
        values[param.name] = param.initial;
    }
    return values;
}
function renderNode(node, ctx, cache, parentPath, parentPolicy, index, insideSlot) {
    const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
    const effectivePolicy = node.refresh ?? parentPolicy ?? { kind: "onLoad" };
    const refreshKey = computeRefreshKey(effectivePolicy, ctx.time, ctx.docstep);
    const cached = cache.get(nodePath);
    let props;
    let evalTime = cached?.time ?? 0;
    let evalDocstep = cached?.docstep ?? 0;
    if (!cached || cached.refreshKey !== refreshKey) {
        const ctxWindow = computeEvalWindow(effectivePolicy, ctx.time, ctx.docstep);
        evalTime = ctxWindow.time;
        evalDocstep = ctxWindow.docstep;
        props = resolveProps(node.props, {
            params: ctx.params,
            time: evalTime,
            docstep: evalDocstep,
            seed: ctx.seed,
            assets: ctx.assets,
            refreshKey,
            nodePath,
            nodeId: node.id,
            nodeKind: node.kind,
            meta: ctx.doc.meta,
            tokens: ctx.styleRegistry.tokens,
            refs: ctx.counterRegistry.refs,
        });
        cache.set(nodePath, { refreshKey, time: evalTime, docstep: evalDocstep, props });
    }
    else {
        props = cached.props;
    }
    const nextInsideSlot = insideSlot || node.kind === "slot" || node.kind === "inline_slot";
    const children = node.children.map((child, childIndex) => renderNode(child, ctx, cache, nodePath, effectivePolicy, childIndex, nextInsideSlot));
    const style = resolveNodeStyle(node, props, ctx, {
        time: evalTime,
        docstep: evalDocstep,
        refreshKey,
        nodePath,
        nodeId: node.id,
        nodeKind: node.kind,
    }, insideSlot);
    const rendered = {
        id: node.id,
        kind: node.kind,
        props,
        children,
    };
    if (style) {
        rendered.style = style;
    }
    if (node.kind === "grid") {
        const gridData = resolveGridData(node, props, ctx);
        if (gridData) {
            rendered.grid = gridData;
        }
    }
    return rendered;
}
function resolveProps(props, ctx) {
    const resolved = {};
    for (const key of Object.keys(props)) {
        const value = props[key];
        if (value.kind === "LiteralValue") {
            resolved[key] = toRenderValue(value.value);
            continue;
        }
        const propSeed = stableHash(ctx.seed, ctx.nodePath, key, ctx.refreshKey);
        const rng = mulberry32(propSeed);
        const evalCtx = {
            params: ctx.params,
            time: ctx.time,
            docstep: ctx.docstep,
            rng,
            propSeed,
            assets: ctx.assets,
            meta: ctx.meta,
            tokens: ctx.tokens,
            refs: ctx.refs,
        };
        try {
            const exprValue = evalExpr(value.expr, evalCtx);
            resolved[key] = toRenderValue(exprValue);
        }
        catch (error) {
            const detail = error?.message ?? String(error);
            const contextParts = [
                ctx.nodeId ? `node '${ctx.nodeId}'` : "",
                ctx.nodeKind ? `kind '${ctx.nodeKind}'` : "",
                `prop '${key}'`,
            ].filter(Boolean);
            const context = contextParts.length ? ` (${contextParts.join(", ")})` : "";
            throw new Error(`${detail}${context}`);
        }
    }
    return resolved;
}
const DEFAULT_TOKENS = {
    "font.serif": '"Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif',
    "font.sans": '"Inter", "Helvetica Neue", Arial, sans-serif',
    "font.mono": '"Source Code Pro", "Courier New", monospace',
    "space.xs": 2,
    "space.s": 4,
    "space.m": 8,
    "space.l": 12,
    "space.xl": 18,
    "color.text": "#1d1b17",
    "color.muted": "#6b645a",
    "color.link": "#2b4c7e",
    "color.rule": "#d1c8bb",
    "color.calloutBg": "#f6f1e8",
    "color.calloutBorder": "#d9d0c4",
    "rule.thin": 1,
};
function buildStyleRegistry(doc) {
    const theme = resolveThemeName(doc);
    const themeBlock = doc.themes?.find((t) => t.name === theme);
    const tokenFlat = {
        ...DEFAULT_TOKENS,
        ...(doc.tokens?.tokens ?? {}),
        ...(themeBlock?.tokens?.tokens ?? {}),
    };
    const tokens = buildTokenTree(tokenFlat);
    const baseStyles = buildDefaultStyles(tokenFlat);
    const docStyles = doc.styles?.styles ?? [];
    const themeStyles = themeBlock?.styles?.styles ?? [];
    const mergedStyles = mergeStyleInputs(baseStyles, docStyles, themeStyles);
    const styles = resolveStyleSpecs(mergedStyles, tokens);
    const renderStyles = Array.from(styles.values()).map((style) => ({
        name: style.name,
        className: style.className,
        props: style.staticProps,
    }));
    return {
        theme,
        tokens,
        tokenFlat,
        styles,
        renderStyles,
    };
}
function resolveThemeName(doc) {
    const target = typeof doc.meta?.target === "string" ? doc.meta.target : null;
    if (target)
        return target;
    return "screen";
}
function applyVisibility(body, ctx) {
    return { nodes: filterVisibleNodes(body.nodes, ctx, "root") };
}
function filterVisibleNodes(nodes, ctx, parentPath) {
    const result = [];
    for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
        const visible = evaluateVisibleIf(node, ctx, nodePath);
        if (!visible)
            continue;
        const children = node.children?.length
            ? filterVisibleNodes(node.children, ctx, nodePath)
            : [];
        result.push({ ...node, children });
    }
    return result;
}
function evaluateVisibleIf(node, ctx, nodePath) {
    const visibleProp = node.props?.visibleIf;
    if (!visibleProp)
        return true;
    if (visibleProp.kind === "LiteralValue") {
        return Boolean(visibleProp.value);
    }
    const propSeed = stableHash(ctx.seed, nodePath, "visibleIf");
    const rng = mulberry32(propSeed);
    const evalCtx = {
        params: ctx.params,
        time: 0,
        docstep: 0,
        rng,
        propSeed,
        assets: [],
        meta: ctx.meta,
        tokens: ctx.tokens,
        refs: new Map(),
    };
    const value = evalExpr(visibleProp.expr, evalCtx);
    return Boolean(value);
}
function buildCounterRegistry(body) {
    const refs = new Map();
    const countersByNodePath = new Map();
    let figureCount = 0;
    let tableCount = 0;
    let footnoteCount = 0;
    const sectionCounters = [];
    const visit = (node, parentPath, index) => {
        const nodePath = `${parentPath}/${node.kind}:${node.id}:${index}`;
        const counters = {};
        const headingLevel = getHeadingLevel(node);
        if (headingLevel != null) {
            while (sectionCounters.length < headingLevel)
                sectionCounters.push(0);
            sectionCounters.length = headingLevel;
            sectionCounters[headingLevel - 1] += 1;
            const sectionNumber = sectionCounters.join(".");
            counters.section = sectionNumber;
        }
        if (node.kind === "figure") {
            figureCount += 1;
            counters.figure = figureCount;
        }
        if (node.kind === "table") {
            tableCount += 1;
            counters.table = tableCount;
        }
        if (node.kind === "footnote") {
            footnoteCount += 1;
            counters.footnote = footnoteCount;
        }
        const label = getLiteralString(node.props?.label);
        if (label) {
            counters.label = label;
            const refText = formatRefText(node, counters);
            counters.ref = refText;
            refs.set(label, refText);
        }
        if (Object.keys(counters).length) {
            countersByNodePath.set(nodePath, counters);
        }
        node.children?.forEach((child, childIndex) => visit(child, nodePath, childIndex));
    };
    body.nodes.forEach((node, index) => visit(node, "root", index));
    return { refs, countersByNodePath };
}
function getHeadingLevel(node) {
    if (node.kind !== "text")
        return null;
    const explicit = getLiteralNumber(node.props?.level);
    if (explicit != null && explicit >= 1)
        return explicit;
    const style = getLiteralString(node.props?.style);
    if (style === "H1")
        return 1;
    if (style === "H2")
        return 2;
    const variant = getLiteralString(node.props?.variant);
    if (variant === "heading")
        return 1;
    return null;
}
function getLiteralString(value) {
    if (!value || value.kind !== "LiteralValue")
        return null;
    return typeof value.value === "string" ? value.value : null;
}
function getLiteralNumber(value) {
    if (!value || value.kind !== "LiteralValue")
        return null;
    return typeof value.value === "number" && Number.isFinite(value.value) ? value.value : null;
}
function formatRefText(node, counters) {
    if (counters.section)
        return `§${counters.section}`;
    if (counters.figure != null)
        return `Figure ${counters.figure}`;
    if (counters.table != null)
        return `Table ${counters.table}`;
    if (counters.footnote != null)
        return `Footnote ${counters.footnote}`;
    return counters.label ?? "";
}
function buildTokenTree(tokens) {
    const root = {};
    for (const [key, value] of Object.entries(tokens)) {
        const parts = key.split(".");
        let cursor = root;
        for (let i = 0; i < parts.length; i += 1) {
            const part = parts[i];
            if (i === parts.length - 1) {
                cursor[part] = value;
            }
            else {
                if (!cursor[part] || typeof cursor[part] !== "object") {
                    cursor[part] = {};
                }
                cursor = cursor[part];
            }
        }
    }
    return root;
}
function buildDefaultStyles(tokens) {
    const t = (key) => tokens[key] ?? DEFAULT_TOKENS[key] ?? "";
    const lit = (value) => ({
        kind: "LiteralValue",
        value,
    });
    return [
        {
            name: "Body",
            props: {
                "font.family": lit(t("font.serif")),
                "font.size": lit(10.8),
                "line.height": lit(1.45),
                color: lit(t("color.text")),
                "space.after": lit(t("space.m")),
            },
        },
        {
            name: "H1",
            extends: "Body",
            props: {
                "font.size": lit(16.5),
                "font.weight": lit(600),
                "space.before": lit(t("space.l")),
                "space.after": lit(t("space.s")),
            },
        },
        {
            name: "H2",
            extends: "Body",
            props: {
                "font.size": lit(13),
                "font.weight": lit(600),
                "space.before": lit(t("space.m")),
                "space.after": lit(t("space.s")),
            },
        },
        {
            name: "Title",
            extends: "H1",
            props: {
                "font.size": lit(26),
                "letter.spacing": lit("0.02em"),
                "space.after": lit(t("space.s")),
            },
        },
        {
            name: "Subtitle",
            extends: "Body",
            props: {
                "font.size": lit(12.5),
                color: lit(t("color.muted")),
                "space.after": lit(t("space.m")),
            },
        },
        {
            name: "Byline",
            extends: "Body",
            props: {
                "font.size": lit(9.5),
                "letter.spacing": lit("0.08em"),
                "text.transform": lit("uppercase"),
                color: lit(t("color.muted")),
            },
        },
        {
            name: "Abstract",
            extends: "Body",
            props: {
                color: lit(t("color.muted")),
            },
        },
        {
            name: "Keywords",
            extends: "Body",
            props: {
                "font.size": lit(9),
                "letter.spacing": lit("0.06em"),
                "text.transform": lit("uppercase"),
                color: lit(t("color.muted")),
            },
        },
        {
            name: "Caption",
            extends: "Body",
            props: {
                "font.size": lit(9.5),
                color: lit(t("color.muted")),
                "space.before": lit(t("space.s")),
                "space.after": lit(t("space.xs")),
            },
        },
        {
            name: "Credit",
            extends: "Body",
            props: {
                "font.size": lit(8.5),
                color: lit(t("color.muted")),
            },
        },
        {
            name: "Code",
            extends: "Body",
            props: {
                "font.family": lit(t("font.mono")),
                "font.size": lit(9.5),
                background: lit("#f4f0e9"),
                padding: lit(t("space.s")),
                "border.radius": lit(4),
            },
        },
        {
            name: "Quote",
            extends: "Body",
            props: {
                "font.style": lit("italic"),
                color: lit(t("color.muted")),
                "space.before": lit(t("space.s")),
                "space.after": lit(t("space.s")),
            },
        },
        {
            name: "Callout",
            extends: "Body",
            props: {
                background: lit(t("color.calloutBg")),
                border: lit(`1pt solid ${t("color.calloutBorder")}`),
                padding: lit(t("space.m")),
                "border.radius": lit(6),
                "space.before": lit(t("space.m")),
                "space.after": lit(t("space.m")),
            },
        },
        // Legacy variant aliases
        {
            name: "Label",
            extends: "Body",
            props: {
                "font.size": lit(8.5),
                "text.transform": lit("uppercase"),
                "letter.spacing": lit("0.14em"),
                color: lit(t("color.muted")),
            },
        },
        {
            name: "Edition",
            extends: "Body",
            props: {
                "font.size": lit(9.5),
                "letter.spacing": lit("0.08em"),
                "text.transform": lit("uppercase"),
                color: lit(t("color.muted")),
            },
        },
        {
            name: "Note",
            extends: "Body",
            props: {
                "font.size": lit(8.5),
                color: lit(t("color.muted")),
            },
        },
        {
            name: "Sample",
            extends: "Body",
            props: {
                "font.size": lit(10),
                "letter.spacing": lit("0.08em"),
            },
        },
        {
            name: "List",
            extends: "Body",
            props: {
                "space.after": lit(t("space.s")),
            },
        },
        {
            name: "End",
            extends: "Body",
            props: {
                "font.size": lit(10),
                "text.align": lit("right"),
                "space.before": lit(t("space.m")),
            },
        },
    ];
}
function mergeStyleInputs(...styleLists) {
    const map = new Map();
    for (const list of styleLists) {
        for (const style of list) {
            const existing = map.get(style.name);
            if (!existing) {
                map.set(style.name, { ...style, props: { ...style.props } });
                continue;
            }
            map.set(style.name, {
                name: style.name,
                extends: style.extends ?? existing.extends,
                props: { ...existing.props, ...style.props },
            });
        }
    }
    return map;
}
function resolveTokenExpr(expr, tokens) {
    if (!exprUsesOnlyTokens(expr))
        return null;
    const propSeed = stableHash("style.tokens");
    const rng = mulberry32(propSeed);
    const evalCtx = {
        params: {},
        time: 0,
        docstep: 0,
        rng,
        propSeed,
        assets: [],
        meta: { version: "0.0.0" },
        tokens,
        refs: new Map(),
    };
    const value = evalExpr(expr, evalCtx);
    return toRenderValue(value);
}
function exprUsesOnlyTokens(expr) {
    let ok = true;
    const visit = (node) => {
        if (!ok)
            return;
        switch (node.kind) {
            case "Literal":
                return;
            case "Identifier":
                if (node.name !== "tokens")
                    ok = false;
                return;
            case "ListExpression":
                node.items.forEach(visit);
                return;
            case "UnaryExpression":
                visit(node.argument);
                return;
            case "BinaryExpression":
                visit(node.left);
                visit(node.right);
                return;
            case "MemberExpression":
                visit(node.object);
                return;
            case "CallExpression":
            case "NeighborsCallExpression":
            default:
                ok = false;
                return;
        }
    };
    visit(expr);
    return ok;
}
function resolveStyleSpecs(styleMap, tokens) {
    const resolved = new Map();
    const visiting = new Set();
    const resolve = (name) => {
        const cached = resolved.get(name);
        if (cached)
            return cached;
        if (visiting.has(name)) {
            throw new Error(`Style inheritance cycle detected at '${name}'`);
        }
        visiting.add(name);
        const input = styleMap.get(name);
        const baseName = input?.extends;
        const baseProps = baseName ? resolve(baseName).props : {};
        const mergedProps = { ...baseProps, ...(input?.props ?? {}) };
        const dynamicProps = {};
        const staticProps = {};
        let axesSafe = false;
        for (const [key, value] of Object.entries(mergedProps)) {
            if (key === "font.axes.safe") {
                if (value.kind === "LiteralValue" && value.value === true) {
                    axesSafe = true;
                }
                continue;
            }
            if (value.kind === "LiteralValue") {
                staticProps[key] = toRenderValue(value.value);
            }
            else {
                const tokenStatic = resolveTokenExpr(value.expr, tokens);
                if (tokenStatic !== null) {
                    staticProps[key] = tokenStatic;
                }
                else {
                    dynamicProps[key] = value.expr;
                }
            }
        }
        const spec = {
            name,
            className: makeStyleClassName(name),
            props: mergedProps,
            staticProps,
            dynamicProps,
            axesSafe,
        };
        visiting.delete(name);
        resolved.set(name, spec);
        return spec;
    };
    for (const name of styleMap.keys()) {
        resolve(name);
    }
    return resolved;
}
function makeStyleClassName(name) {
    return `flux-style-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
const ROLE_STYLE_MAP = {
    title: "Title",
    subtitle: "Subtitle",
    caption: "Caption",
    credit: "Credit",
    abstract: "Abstract",
    keywords: "Keywords",
    byline: "Byline",
};
const VARIANT_STYLE_MAP = {
    title: "Title",
    subtitle: "Subtitle",
    heading: "H2",
    caption: "Caption",
    credit: "Credit",
    label: "Label",
    edition: "Edition",
    note: "Note",
    sample: "Sample",
    list: "List",
    end: "End",
};
const KIND_STYLE_MAP = {
    text: "Body",
    blockquote: "Quote",
    codeblock: "Code",
    callout: "Callout",
};
function resolveNodeStyle(node, resolvedProps, ctx, evalMeta, insideSlot) {
    const roleRaw = resolveRenderString(resolvedProps.role);
    const styleRaw = resolveRenderString(resolvedProps.style);
    const variantRaw = resolveRenderString(resolvedProps.variant);
    let name;
    let role;
    if (styleRaw) {
        name = styleRaw;
    }
    else if (roleRaw) {
        role = roleRaw;
        name = ROLE_STYLE_MAP[roleRaw] ?? roleRaw;
    }
    else if (variantRaw) {
        name = VARIANT_STYLE_MAP[variantRaw] ?? variantRaw;
    }
    else if (KIND_STYLE_MAP[node.kind]) {
        name = KIND_STYLE_MAP[node.kind];
    }
    if (!name)
        return undefined;
    const spec = ctx.styleRegistry.styles.get(name);
    const className = spec?.className ?? makeStyleClassName(name);
    const inline = {};
    if (spec) {
        for (const [key, expr] of Object.entries(spec.dynamicProps)) {
            if (isLayoutSensitiveStyleKey(key)) {
                const axesAllowed = key.startsWith("font.axes.") &&
                    ctx.styleRegistry.theme === "screen" &&
                    spec.axesSafe;
                if (!insideSlot && !axesAllowed) {
                    throw new Error(`Dynamic style '${spec.name}.${key}' must be inside a slot or marked axes-safe for screen`);
                }
            }
            const propSeed = stableHash(ctx.seed, evalMeta.nodePath, "style", spec.name, key, evalMeta.refreshKey);
            const rng = mulberry32(propSeed);
            const evalCtx = {
                params: ctx.params,
                time: evalMeta.time,
                docstep: evalMeta.docstep,
                rng,
                propSeed,
                assets: ctx.assets,
                meta: ctx.doc.meta,
                tokens: ctx.styleRegistry.tokens,
                refs: ctx.counterRegistry.refs,
            };
            const value = evalExpr(expr, evalCtx);
            inline[key] = toRenderValue(value);
        }
    }
    const style = { name, role, className };
    if (Object.keys(inline).length > 0) {
        style.inline = inline;
    }
    return style;
}
function resolveRenderString(value) {
    if (value == null)
        return "";
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    if (Array.isArray(value))
        return value.map((item) => resolveRenderString(item)).join(" ");
    if (typeof value === "object") {
        if (value.kind === "asset") {
            return value.name ?? "";
        }
    }
    return "";
}
function isLayoutSensitiveStyleKey(key) {
    if (key.startsWith("font.axes."))
        return true;
    switch (key) {
        case "font.family":
        case "font.size":
        case "font.weight":
        case "font.style":
        case "line.height":
        case "letter.spacing":
        case "space.before":
        case "space.after":
        case "space.indent":
            return true;
        default:
            return false;
    }
}
function computeEvalWindow(policy, time, docstep) {
    switch (policy.kind) {
        case "onLoad":
        case "never":
            return { time, docstep };
        case "onDocstep":
            return { time, docstep };
        case "every": {
            const seconds = durationToSeconds(policy.amount, policy.unit);
            if (seconds == null || seconds <= 0) {
                throw new Error(`Unsupported refresh duration unit '${policy.unit}'`);
            }
            const bucket = Math.floor(time / seconds);
            return { time: bucket * seconds, docstep };
        }
        default: {
            const _exhaustive = policy;
            return _exhaustive;
        }
    }
}
function computeRefreshKey(policy, time, docstep) {
    switch (policy.kind) {
        case "onLoad":
        case "never":
            return 0;
        case "onDocstep":
            return docstep;
        case "every": {
            const seconds = durationToSeconds(policy.amount, policy.unit);
            if (seconds == null || seconds <= 0) {
                throw new Error(`Unsupported refresh duration unit '${policy.unit}'`);
            }
            return Math.floor(time / seconds);
        }
        default: {
            const _exhaustive = policy;
            return _exhaustive;
        }
    }
}
function resolveGridData(node, props, ctx) {
    const snapshot = ctx.legacySnapshot;
    if (!snapshot)
        return null;
    const refValue = props.ref ?? props.name ?? props.grid ?? node.id;
    const ref = typeof refValue === "string" ? refValue : node.id;
    const layout = computeGridLayout(ctx.doc, snapshot);
    const view = layout.grids.find((grid) => grid.name === ref);
    if (!view)
        return null;
    return {
        name: view.name,
        rows: view.rows,
        cols: view.cols,
        cells: view.cells.map((cell) => ({
            id: cell.id,
            row: cell.row,
            col: cell.col,
            tags: [...cell.tags],
            content: cell.content ?? null,
            mediaId: cell.mediaId ?? null,
            dynamic: cell.dynamic ?? null,
            density: cell.density ?? null,
            salience: cell.salience ?? null,
        })),
    };
}
function assetsToRender(assets) {
    return assets
        .map((asset) => ({
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        path: asset.path,
        tags: [...asset.tags],
        weight: asset.weight,
        meta: asset.meta ? normalizeMeta(asset.meta) : undefined,
        source: asset.source,
    }))
        .sort((a, b) => a.id.localeCompare(b.id));
}
function normalizeMeta(meta) {
    const keys = Object.keys(meta).sort();
    const normalized = {};
    for (const key of keys) {
        normalized[key] = meta[key];
    }
    return normalized;
}
function toRenderValue(value) {
    if (value == null)
        return null;
    if (Array.isArray(value)) {
        return value.map((item) => toRenderValue(item));
    }
    if (typeof value === "object") {
        if (isResolvedAsset(value)) {
            return {
                kind: "asset",
                id: value.id,
                path: value.path,
                name: value.name,
                assetKind: value.kind,
            };
        }
        const entries = Object.entries(value);
        const normalized = {};
        for (const [key, item] of entries) {
            normalized[key] = toRenderValue(item);
        }
        return normalized;
    }
    return value;
}
function evalExpr(expr, ctx) {
    switch (expr.kind) {
        case "Literal":
            return expr.value;
        case "ListExpression":
            return expr.items.map((item) => evalExpr(item, ctx));
        case "Identifier":
            return evalIdentifier(expr.name, ctx);
        case "UnaryExpression":
            return evalUnary(expr.op, expr.argument, ctx);
        case "BinaryExpression":
            return evalBinary(expr.op, expr.left, expr.right, ctx);
        case "MemberExpression":
            return evalMember(expr.object, expr.property, ctx);
        case "CallExpression":
            return evalCall(expr, ctx);
        case "NeighborsCallExpression":
            throw new Error("neighbors.*() is not supported in document expressions");
        default: {
            throw new Error(`Unsupported expression kind '${expr?.kind ?? "unknown"}'`);
        }
    }
}
function evalIdentifier(name, ctx) {
    if (name === "params")
        return ctx.params;
    if (name === "time" || name === "timeSeconds")
        return ctx.time;
    if (name === "docstep")
        return ctx.docstep;
    if (name === "meta")
        return ctx.meta;
    if (name === "tokens")
        return ctx.tokens;
    return ctx.params[name];
}
function evalUnary(op, argument, ctx) {
    const value = evalExpr(argument, ctx);
    switch (op) {
        case "not":
            return !value;
        case "-":
            return -value;
        default:
            throw new Error(`Unsupported unary operator '${op}'`);
    }
}
function evalBinary(op, left, right, ctx) {
    switch (op) {
        case "and": {
            const l = evalExpr(left, ctx);
            return Boolean(l) && Boolean(evalExpr(right, ctx));
        }
        case "or": {
            const l = evalExpr(left, ctx);
            return Boolean(l) || Boolean(evalExpr(right, ctx));
        }
        default: {
            const l = evalExpr(left, ctx);
            const r = evalExpr(right, ctx);
            switch (op) {
                case "==":
                    return l === r;
                case "!=":
                    return l !== r;
                case "===":
                    return l === r;
                case "!==":
                    return l !== r;
                case "<":
                    return l < r;
                case "<=":
                    return l <= r;
                case ">":
                    return l > r;
                case ">=":
                    return l >= r;
                case "+":
                    return l + r;
                case "-":
                    return l - r;
                case "*":
                    return l * r;
                case "/":
                    return l / r;
                default:
                    throw new Error(`Unsupported binary operator '${op}'`);
            }
        }
    }
}
function evalMember(objectExpr, property, ctx) {
    const obj = evalExpr(objectExpr, ctx);
    if (obj == null) {
        throw new Error(`Cannot read property '${property}' of null/undefined`);
    }
    return obj[property];
}
function evalCall(expr, ctx) {
    // Supported document-expression builtins:
    // choose, chooseStep, now/timeSeconds, stableHash, assets.pick
    if (expr.callee.kind === "Identifier") {
        const name = expr.callee.name;
        if (name === "choose") {
            return evalChoose(expr.args, ctx);
        }
        if (name === "chooseStep") {
            return evalChooseStep(expr.args, ctx);
        }
        if (name === "cycle") {
            return evalCycle(expr.args, ctx);
        }
        if (name === "hashpick") {
            return evalHashpick(expr.args, ctx);
        }
        if (name === "phase") {
            return evalPhase(expr.args, ctx);
        }
        if (name === "lerp") {
            return evalLerp(expr.args, ctx);
        }
        if (name === "shuffle") {
            return evalShuffle(expr.args, ctx);
        }
        if (name === "sample") {
            return evalSample(expr.args, ctx);
        }
        if (name === "ref") {
            return evalRef(expr.args, ctx);
        }
        if (name === "now" || name === "timeSeconds") {
            return ctx.time;
        }
        if (name === "stableHash") {
            const values = evalCallArgs(expr.args, ctx);
            return stableHash(...values.positional, values.named);
        }
    }
    if (expr.callee.kind === "MemberExpression" &&
        expr.callee.object.kind === "Identifier" &&
        expr.callee.object.name === "assets" &&
        (expr.callee.property === "pick" || expr.callee.property === "shuffle")) {
        if (expr.callee.property === "shuffle") {
            return evalAssetsShuffle(expr.args, ctx);
        }
        return evalAssetsPick(expr.args, ctx);
    }
    const calleeName = describeCallee(expr.callee) ?? "unknown";
    const location = formatExprLocation(expr);
    throw new Error(`Unsupported function call '${calleeName}' in document expressions${location}`);
}
function evalCallArgs(args, ctx) {
    const positional = [];
    const named = {};
    for (const arg of args ?? []) {
        if (arg.kind === "NamedArg") {
            named[arg.name] = evalExpr(arg.value, ctx);
        }
        else {
            positional.push(evalExpr(arg, ctx));
        }
    }
    return { positional, named };
}
function evalChoose(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const list = (named.list ?? positional[0]);
    if (!Array.isArray(list)) {
        throw new Error("choose(list) expects a list");
    }
    if (list.length === 0)
        return null;
    const idx = Math.floor(ctx.rng() * list.length);
    return list[idx];
}
function evalChooseStep(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const list = (named.list ?? positional[0]);
    if (!Array.isArray(list)) {
        throw new Error("chooseStep(list) expects a list");
    }
    if (list.length === 0) {
        throw new Error("chooseStep(list) expects a non-empty list");
    }
    const offsetRaw = named.offset ?? 0;
    const offset = typeof offsetRaw === "number" && Number.isFinite(offsetRaw) ? offsetRaw : 0;
    const idx = Math.abs(Math.floor(ctx.docstep + offset)) % list.length;
    return list[idx];
}
function evalCycle(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const list = (named.list ?? positional[0]);
    if (!Array.isArray(list)) {
        throw new Error("cycle(list, index) expects a list");
    }
    if (list.length === 0)
        return null;
    const rawIndex = named.index ?? positional[1] ?? ctx.docstep;
    const indexValue = typeof rawIndex === "number" && Number.isFinite(rawIndex) ? rawIndex : 0;
    const idx = ((Math.floor(indexValue) % list.length) + list.length) % list.length;
    return list[idx];
}
function evalHashpick(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const list = (named.list ?? positional[0]);
    if (!Array.isArray(list)) {
        throw new Error("hashpick(list, key) expects a list");
    }
    if (list.length === 0)
        return null;
    const keyRaw = named.key ?? positional[1];
    if (keyRaw == null) {
        throw new Error("hashpick(list, key) expects a key");
    }
    const hash = stableHash(String(keyRaw));
    const idx = hash % list.length;
    return list[idx];
}
function evalPhase(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const raw = named.value ?? positional[0] ?? ctx.docstep;
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    const floor = Math.floor(value);
    return value - floor;
}
function evalLerp(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const a = named.a ?? positional[0];
    const b = named.b ?? positional[1];
    const t = named.t ?? positional[2];
    if (![a, b, t].every((v) => typeof v === "number" && Number.isFinite(v))) {
        throw new Error("lerp(a, b, t) expects numeric arguments");
    }
    return a + (b - a) * t;
}
function evalShuffle(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const list = (named.list ?? positional[0]);
    if (!Array.isArray(list)) {
        throw new Error("shuffle(list) expects a list");
    }
    return shuffleList(list, ctx.rng);
}
function evalSample(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const list = (named.list ?? positional[0]);
    if (!Array.isArray(list)) {
        throw new Error("sample(list, n) expects a list");
    }
    const nRaw = named.n ?? positional[1] ?? 1;
    const n = typeof nRaw === "number" && Number.isFinite(nRaw) ? Math.floor(nRaw) : 1;
    if (n <= 0)
        return [];
    const shuffled = shuffleList(list, ctx.rng);
    return shuffled.slice(0, Math.min(n, shuffled.length));
}
function evalRef(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const label = named.label ?? positional[0];
    if (typeof label !== "string") {
        throw new Error("ref(label) expects a string label");
    }
    const resolved = ctx.refs.get(label);
    if (!resolved) {
        throw new Error(`ref('${label}') target not found`);
    }
    return resolved;
}
function shuffleList(list, rng) {
    const items = [...list];
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}
function describeCallee(callee) {
    if (!callee)
        return null;
    if (callee.kind === "Identifier")
        return String(callee.name);
    if (callee.kind === "MemberExpression") {
        const object = callee.object;
        const objectName = object?.kind === "Identifier" ? object.name : null;
        const property = typeof callee.property === "string" ? callee.property : null;
        if (objectName && property) {
            return `${objectName}.${property}`;
        }
    }
    return null;
}
function formatExprLocation(expr) {
    const loc = expr?.location ?? expr?.loc ?? null;
    const line = typeof loc?.line === "number" ? loc.line : typeof expr?.line === "number" ? expr.line : null;
    const column = typeof loc?.column === "number"
        ? loc.column
        : typeof expr?.column === "number"
            ? expr.column
            : null;
    if (line != null && column != null) {
        return ` at ${line}:${column}`;
    }
    return "";
}
function evalAssetsPick(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const rawTags = named.tags ?? positional[0];
    const rawExclude = named.excludeTags;
    const rawStrategy = named.strategy ?? positional[1];
    const rawSeed = named.seed ?? positional[2];
    const rawNoRepeat = named.noRepeatSteps ?? named.noRepeat ?? positional[3];
    const tags = Array.isArray(rawTags)
        ? rawTags.map((tag) => String(tag))
        : rawTags
            ? [String(rawTags)]
            : [];
    const excludeTags = Array.isArray(rawExclude)
        ? rawExclude.map((tag) => String(tag))
        : rawExclude
            ? [String(rawExclude)]
            : [];
    const strategy = typeof rawStrategy === "string" ? rawStrategy : undefined;
    if (strategy && strategy !== "weighted" && strategy !== "uniform") {
        throw new Error(`Unknown asset pick strategy '${strategy}'`);
    }
    const candidates = filterAssets(ctx.assets, tags, excludeTags);
    if (candidates.length === 0)
        return null;
    const resolvedStrategy = strategy ??
        (candidates.every((asset) => asset.strategy === candidates[0].strategy)
            ? candidates[0].strategy
            : undefined) ??
        "uniform";
    const noRepeatSteps = typeof rawNoRepeat === "number" && Number.isFinite(rawNoRepeat) ? Math.max(0, Math.floor(rawNoRepeat)) : 0;
    const baseRng = rawSeed != null
        ? mulberry32(stableHash(ctx.propSeed, rawSeed, "assets.pick"))
        : ctx.rng;
    if (noRepeatSteps > 0) {
        const history = new Set();
        for (let i = 1; i <= noRepeatSteps; i += 1) {
            const prev = pickAssetAtStep(candidates, resolvedStrategy, ctx, ctx.docstep - i, 0);
            if (prev)
                history.add(prev.id);
        }
        for (let salt = 0; salt < candidates.length; salt += 1) {
            const candidate = pickAssetAtStep(candidates, resolvedStrategy, ctx, ctx.docstep, salt);
            if (candidate && !history.has(candidate.id))
                return candidate;
        }
        return pickAssetAtStep(candidates, resolvedStrategy, ctx, ctx.docstep, 0);
    }
    return pickAssetByStrategy(candidates, resolvedStrategy, baseRng);
}
function evalAssetsShuffle(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const rawTags = named.tags ?? positional[0];
    const rawExclude = named.excludeTags;
    const rawSeed = named.seed ?? positional[1];
    const tags = Array.isArray(rawTags)
        ? rawTags.map((tag) => String(tag))
        : rawTags
            ? [String(rawTags)]
            : [];
    const excludeTags = Array.isArray(rawExclude)
        ? rawExclude.map((tag) => String(tag))
        : rawExclude
            ? [String(rawExclude)]
            : [];
    const candidates = filterAssets(ctx.assets, tags, excludeTags);
    if (candidates.length === 0)
        return [];
    const rng = rawSeed != null
        ? mulberry32(stableHash(ctx.propSeed, rawSeed, "assets.shuffle"))
        : mulberry32(stableHash(ctx.propSeed, "assets.shuffle"));
    return shuffleList(candidates, rng);
}
function filterAssets(assets, tags, excludeTags) {
    return assets.filter((asset) => {
        if (tags.length && !tags.every((tag) => asset.tags.includes(tag)))
            return false;
        if (excludeTags.length && excludeTags.some((tag) => asset.tags.includes(tag)))
            return false;
        return true;
    });
}
function pickAssetAtStep(candidates, strategy, ctx, step, salt) {
    if (candidates.length === 0)
        return null;
    const rng = mulberry32(stableHash(ctx.propSeed, step, salt, "assets.pick.step"));
    return pickAssetByStrategy(candidates, strategy, rng);
}
function pickAssetByStrategy(candidates, strategy, rng) {
    if (strategy === "weighted") {
        const total = candidates.reduce((sum, asset) => sum + (Number.isFinite(asset.weight) ? asset.weight : 1), 0);
        if (total <= 0) {
            const idx = Math.floor(rng() * candidates.length);
            return candidates[idx];
        }
        let roll = rng() * total;
        for (const asset of candidates) {
            const weight = Number.isFinite(asset.weight) ? asset.weight : 1;
            roll -= weight;
            if (roll <= 0)
                return asset;
        }
        return candidates[candidates.length - 1];
    }
    const idx = Math.floor(rng() * candidates.length);
    return candidates[idx];
}
function buildAssetCatalog(doc, options) {
    const assets = [];
    const blocks = doc.assets;
    const resolver = options.assetResolver ?? defaultAssetResolver;
    if (blocks) {
        for (const asset of blocks.assets ?? []) {
            assets.push(materializeAssetDefinition(asset));
        }
        for (const bank of blocks.banks ?? []) {
            const entries = resolver(bank, { cwd: options.assetCwd });
            const root = normalizePath(bank.root);
            for (const rel of entries) {
                const relPath = normalizePath(rel);
                const fullPath = root ? `${root}/${relPath}` : relPath;
                assets.push(materializeBankAsset(bank, relPath, fullPath));
            }
        }
    }
    if (doc.materials) {
        assets.push(...materializeMaterials(doc.materials));
    }
    return assets;
}
function materializeAssetDefinition(asset) {
    const pathValue = normalizePath(asset.path);
    return {
        __asset: true,
        id: makeAssetId("asset", asset.name, asset.kind, pathValue),
        name: asset.name,
        kind: asset.kind,
        path: pathValue,
        tags: [...(asset.tags ?? [])],
        weight: typeof asset.weight === "number" && Number.isFinite(asset.weight)
            ? asset.weight
            : 1,
        meta: asset.meta ? normalizeMeta(toRenderValue(asset.meta)) : undefined,
        source: { type: "asset", name: asset.name },
    };
}
function materializeBankAsset(bank, relPath, fullPath) {
    return {
        __asset: true,
        id: makeAssetId("bank", bank.name, bank.kind, relPath),
        name: relPath,
        kind: bank.kind,
        path: fullPath,
        tags: [...(bank.tags ?? [])],
        weight: 1,
        source: { type: "bank", name: bank.name },
        strategy: bank.strategy,
    };
}
function materializeMaterials(block) {
    const assets = [];
    for (const material of block.materials ?? []) {
        const meta = {
            label: material.label ?? null,
            description: material.description ?? null,
            color: material.color ?? null,
        };
        if (material.score) {
            meta.score = toRenderValue(material.score);
        }
        if (material.midi) {
            meta.midi = toRenderValue(material.midi);
        }
        if (material.video) {
            meta.video = toRenderValue(material.video);
        }
        assets.push({
            __asset: true,
            id: makeAssetId("material", material.name, "material", material.name),
            name: material.name,
            kind: "material",
            path: "",
            tags: [...(material.tags ?? [])],
            weight: 1,
            meta,
            source: { type: "material", name: material.name },
        });
    }
    return assets;
}
function defaultAssetResolver(bank, options) {
    const cwd = options.cwd ?? process.cwd();
    const rootAbs = path.resolve(cwd, bank.root);
    if (!fs.existsSync(rootAbs)) {
        return [];
    }
    const files = walkFiles(rootAbs);
    const matcher = globToRegExp(normalizePath(bank.include));
    const matches = files
        .map((filePath) => normalizePath(path.relative(rootAbs, filePath)))
        .filter((rel) => matcher.test(rel))
        .sort((a, b) => a.localeCompare(b));
    return matches;
}
function walkFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkFiles(full));
        }
        else if (entry.isFile()) {
            results.push(full);
        }
    }
    return results;
}
function globToRegExp(pattern) {
    let regex = "^";
    let i = 0;
    while (i < pattern.length) {
        const ch = pattern[i];
        if (ch === "*") {
            if (pattern[i + 1] === "*") {
                regex += ".*";
                i += 2;
            }
            else {
                regex += "[^/]*";
                i += 1;
            }
            continue;
        }
        if (ch === "?") {
            regex += "[^/]";
            i += 1;
            continue;
        }
        if ("\\.^$+()[]{}|".includes(ch)) {
            regex += `\\${ch}`;
        }
        else {
            regex += ch;
        }
        i += 1;
    }
    regex += "$";
    return new RegExp(regex);
}
function normalizePath(value) {
    if (!value)
        return "";
    return value.split(path.sep).join("/").replace(/\/+/g, "/").replace(/^\.\//, "");
}
function durationToSeconds(amount, unit) {
    switch (unit) {
        case "ms":
        case "millisecond":
        case "milliseconds":
            return amount / 1000;
        case "s":
        case "sec":
        case "secs":
        case "second":
        case "seconds":
            return amount;
        case "m":
        case "min":
        case "mins":
        case "minute":
        case "minutes":
            return amount * 60;
        case "h":
        case "hr":
        case "hrs":
        case "hour":
        case "hours":
            return amount * 3600;
        default:
            return null;
    }
}
function isResolvedAsset(value) {
    return Boolean(value && typeof value === "object" && value.__asset);
}
function makeAssetId(prefix, name, kind, pathValue) {
    const hash = stableHash(prefix, name, kind, pathValue);
    return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}
function stableHash(...values) {
    const serialized = values.map((value) => stableSerialize(value)).join("|");
    let hash = 0x811c9dc5;
    for (let i = 0; i < serialized.length; i += 1) {
        hash ^= serialized.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}
function stableSerialize(value) {
    if (value == null)
        return "null";
    if (typeof value === "number")
        return `n:${String(value)}`;
    if (typeof value === "string")
        return `s:${value}`;
    if (typeof value === "boolean")
        return `b:${value}`;
    if (Array.isArray(value)) {
        return `a:[${value.map((item) => stableSerialize(item)).join(",")}]`;
    }
    if (typeof value === "object") {
        const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
        return `o:{${entries
            .map(([key, val]) => `${key}:${stableSerialize(val)}`)
            .join(",")}}`;
    }
    return `u:${String(value)}`;
}
function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = t;
        r = Math.imul(r ^ (r >>> 15), r | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
//# sourceMappingURL=render.js.map