import fs from "node:fs";
import path from "node:path";
import { computeGridLayout } from "./layout.js";
import { createRuntime } from "./runtime.js";
export function createDocumentRuntime(doc, options = {}) {
    const seed = options.seed ?? 0;
    let time = options.time ?? 0;
    let docstep = options.docstep ?? 0;
    const body = ensureBody(doc);
    const assets = buildAssetCatalog(doc, options);
    const baseParams = buildParams(doc.state.params);
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
        };
        const renderedBody = body.nodes.map((node, index) => renderNode(node, ctx, nodeCache, "root", undefined, index));
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
    const body = ensureBody(doc);
    const toIr = (rendered) => buildRenderDocumentIR(rendered, body);
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
function buildRenderDocumentIR(rendered, body) {
    return {
        ...rendered,
        body: buildRenderNodesIR(body.nodes, rendered.body, "root", undefined),
    };
}
function buildRenderNodesIR(astNodes, renderedNodes, parentPath, parentPolicy) {
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
        const children = buildRenderNodesIR(astNode.children ?? [], renderedNode.children ?? [], nodePath, effectivePolicy);
        const slot = buildSlotInfo(astNode.kind, renderedNode.props);
        result.push({
            ...renderedNode,
            nodeId: nodePath,
            refresh: effectivePolicy,
            slot,
            children,
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
function renderNode(node, ctx, cache, parentPath, parentPolicy, index) {
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
        });
        cache.set(nodePath, { refreshKey, time: evalTime, docstep: evalDocstep, props });
    }
    else {
        props = cached.props;
    }
    const children = node.children.map((child, childIndex) => renderNode(child, ctx, cache, nodePath, effectivePolicy, childIndex));
    const rendered = {
        id: node.id,
        kind: node.kind,
        props,
        children,
    };
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
        };
        const exprValue = evalExpr(value.expr, evalCtx);
        resolved[key] = toRenderValue(exprValue);
    }
    return resolved;
}
function computeEvalWindow(policy, time, docstep) {
    switch (policy.kind) {
        case "onLoad":
        case "never":
            return { time: 0, docstep: 0 };
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
    if (expr.callee.kind === "Identifier") {
        const name = expr.callee.name;
        if (name === "choose") {
            return evalChoose(expr.args, ctx);
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
        expr.callee.property === "pick") {
        return evalAssetsPick(expr.args, ctx);
    }
    throw new Error("Unsupported function call in document expressions");
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
function evalAssetsPick(args, ctx) {
    const { positional, named } = evalCallArgs(args, ctx);
    const rawTags = named.tags ?? positional[0];
    const rawStrategy = named.strategy ?? positional[1];
    const rawSeed = named.seed ?? positional[2];
    const tags = Array.isArray(rawTags)
        ? rawTags.map((tag) => String(tag))
        : rawTags
            ? [String(rawTags)]
            : [];
    const strategy = typeof rawStrategy === "string" ? rawStrategy : undefined;
    if (strategy && strategy !== "weighted" && strategy !== "uniform") {
        throw new Error(`Unknown asset pick strategy '${strategy}'`);
    }
    const candidates = ctx.assets.filter((asset) => tags.length === 0 ? true : tags.every((tag) => asset.tags.includes(tag)));
    if (candidates.length === 0)
        return null;
    const resolvedStrategy = strategy ??
        (candidates.every((asset) => asset.strategy === candidates[0].strategy)
            ? candidates[0].strategy
            : undefined) ??
        "uniform";
    const pickRng = rawSeed != null
        ? mulberry32(stableHash(ctx.propSeed, rawSeed, "assets.pick"))
        : ctx.rng;
    if (resolvedStrategy === "weighted") {
        const total = candidates.reduce((sum, asset) => sum + (Number.isFinite(asset.weight) ? asset.weight : 1), 0);
        if (total <= 0) {
            const idx = Math.floor(pickRng() * candidates.length);
            return candidates[idx];
        }
        let roll = pickRng() * total;
        for (const asset of candidates) {
            const weight = Number.isFinite(asset.weight) ? asset.weight : 1;
            roll -= weight;
            if (roll <= 0)
                return asset;
        }
        return candidates[candidates.length - 1];
    }
    const idx = Math.floor(pickRng() * candidates.length);
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