import type { AssetBank, FluxDocument, FluxMeta } from "./ast.js";
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
export type AssetResolver = (bank: AssetBank, options: {
    cwd?: string;
}) => string[];
export declare function createDocumentRuntime(doc: FluxDocument, options?: RenderOptions): DocumentRuntime;
export declare function renderDocument(doc: FluxDocument, options?: RenderOptions): RenderDocument;
//# sourceMappingURL=render.d.ts.map