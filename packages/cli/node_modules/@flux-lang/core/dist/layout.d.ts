import type { FluxDocument } from "./ast.js";
import type { RuntimeSnapshot } from "./runtime.js";
export interface GridCellView {
    id: string;
    row: number;
    col: number;
    tags: string[];
    content?: string;
    mediaId?: string;
    dynamic?: number;
    density?: number;
    salience?: number;
}
export interface GridView {
    name: string;
    rows: number;
    cols: number;
    cells: GridCellView[];
}
/**
 * Layout model for grid-like viewers. Designed for both CLI and web.
 */
export interface GridLayoutModel {
    docstep: number;
    grids: GridView[];
}
export declare function computeGridLayout(doc: FluxDocument, snapshot: RuntimeSnapshot): GridLayoutModel;
//# sourceMappingURL=layout.d.ts.map