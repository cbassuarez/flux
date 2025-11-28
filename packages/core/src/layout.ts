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

export function computeGridLayout(doc: FluxDocument, snapshot: RuntimeSnapshot): GridLayoutModel {
  const grids: GridView[] = [];

  for (const gridDef of doc.grids ?? []) {
    if (gridDef.topology !== "grid") continue;

    const snapshotGrid = snapshot.grids.find((g) => g.name === gridDef.name);
    if (!snapshotGrid) continue;

    const cellSnapshots = snapshotGrid.cells ?? [];
    const explicitRows = gridDef.size?.rows;
    const explicitCols = gridDef.size?.cols;
    const count = cellSnapshots.length;

    let rows = explicitRows ?? snapshotGrid.rows ?? 0;
    let cols = explicitCols ?? snapshotGrid.cols ?? 0;

    if (!rows || !cols) {
      rows = 1;
      cols = count || 1;
    }

    const cells: GridCellView[] = [];
    for (let idx = 0; idx < cellSnapshots.length; idx++) {
      const cell = cellSnapshots[idx];
      const row = Math.floor(idx / cols);
      const col = idx % cols;

      cells.push({
        id: cell.id,
        row,
        col,
        tags: cell.tags ?? [],
        content: cell.content,
        mediaId: cell.mediaId,
        dynamic: cell.dynamic,
        density: cell.density,
        salience: cell.salience,
      });
    }

    grids.push({ name: gridDef.name, rows, cols, cells });
  }

  return { docstep: snapshot.docstep, grids };
}
