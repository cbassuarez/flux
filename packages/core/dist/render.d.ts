import type { AssetBank, FluxDocument, FluxMeta, RefreshPolicy } from "./ast.js";
export type RenderValue = string | number | boolean | null | RenderValue[] | {
    [key: string]: RenderValue;
} | RenderAssetRef;
export interface RenderAssetRef {
    kind: "asset";
    id: string;
    path: string;
    name: string;
    assetKind: string;
}
export interface RenderAsset {
    id: string;
    name: string;
    kind: string;
    path: string;
    tags: string[];
    weight: number;
    meta?: Record<string, RenderValue>;
    source?: {
        type: "asset" | "bank" | "material";
        name: string;
    };
}
export interface RenderGridCell {
    id: string;
    row: number;
    col: number;
    tags: string[];
    content: string | null;
    mediaId: string | null;
    dynamic: number | null;
    density: number | null;
    salience: number | null;
}
export interface RenderGridData {
    name: string;
    rows: number;
    cols: number;
    cells: RenderGridCell[];
}
export interface RenderNode {
    id: string;
    kind: string;
    props: Record<string, RenderValue>;
    children: RenderNode[];
    grid?: RenderGridData;
    style?: RenderNodeStyle;
}
export interface RenderDocument {
    meta: FluxMeta;
    seed: number;
    time: number;
    docstep: number;
    pageConfig?: FluxDocument["pageConfig"];
    assets: RenderAsset[];
    body: RenderNode[];
}
export type SlotFitPolicy = "clip" | "ellipsis" | "shrink" | "scaleDown";
export type SlotReserve = {
    kind: "fixed";
    width: number;
    height: number;
    units: string;
} | {
    kind: "fixedWidth";
    width: number;
    units: string;
};
export interface RenderNodeIR {
    nodeId: string;
    id: string;
    kind: string;
    props: Record<string, RenderValue>;
    children: RenderNodeIR[];
    refresh: RefreshPolicy;
    slot?: {
        reserve?: SlotReserve;
        fit?: SlotFitPolicy;
    };
    grid?: RenderGridData;
    style?: RenderNodeStyle;
    counters?: RenderNodeCounters;
}
export interface RenderNodeCounters {
    section?: string;
    figure?: number;
    table?: number;
    footnote?: number;
    label?: string;
    ref?: string;
}
export interface RenderStyleDefinition {
    name: string;
    className: string;
    props: Record<string, RenderValue>;
}
export interface RenderNodeStyle {
    name?: string;
    role?: string;
    className?: string;
    inline?: Record<string, RenderValue>;
}
export interface RenderDocumentIR {
    meta: FluxMeta;
    seed: number;
    time: number;
    docstep: number;
    pageConfig?: FluxDocument["pageConfig"];
    assets: RenderAsset[];
    body: RenderNodeIR[];
    theme?: string;
    styles?: RenderStyleDefinition[];
}
export interface RenderOptions {
    seed?: number;
    time?: number;
    docstep?: number;
    assetCwd?: string;
    assetResolver?: AssetResolver;
}
export interface DocumentRuntime {
    readonly doc: FluxDocument;
    readonly seed: number;
    readonly time: number;
    readonly docstep: number;
    render(): RenderDocument;
    tick(seconds: number): RenderDocument;
    step(n?: number): RenderDocument;
}
export interface DocumentRuntimeIR {
    readonly doc: FluxDocument;
    readonly seed: number;
    readonly time: number;
    readonly docstep: number;
    render(): RenderDocumentIR;
    tick(seconds: number): RenderDocumentIR;
    step(n?: number): RenderDocumentIR;
}
export type AssetResolver = (bank: AssetBank, options: {
    cwd?: string;
}) => string[];
export declare function createDocumentRuntime(doc: FluxDocument, options?: RenderOptions): DocumentRuntime;
export declare function renderDocument(doc: FluxDocument, options?: RenderOptions): RenderDocument;
export declare function createDocumentRuntimeIR(doc: FluxDocument, options?: RenderOptions): DocumentRuntimeIR;
export declare function renderDocumentIR(doc: FluxDocument, options?: RenderOptions): RenderDocumentIR;
//# sourceMappingURL=render.d.ts.map