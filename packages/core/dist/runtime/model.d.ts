import type { FluxDocument, FluxRuntimeConfig } from "../ast";
/**
 * RuntimeCellState is the concrete, mutable-ish view of a Flux cell at runtime.
 *
 * It is derived from a FluxCell in the document but holds only the fields that
 * can change as the program executes.
 */
export interface RuntimeCellState {
    /**
     * Stable cell identifier, taken from FluxCell.id
     */
    id: string;
    /**
     * Tags associated with this cell. In v0.1, we treat this as a string set:
     * - assignments like `cell.tags = cell.tags + { noise }` are interpreted
     *   as adding a tag if it is not already present.
     */
    tags: string[];
    /**
     * Arbitrary textual content for the cell, defaulting to the empty string.
     */
    content: string;
    /**
     * A numeric "intensity" or "weight" for the cell, defaulting to 0.0.
     * This is what neighbors.*().dynamic aggregates over.
     */
    dynamic: number;
}
/**
 * GridRuntimeState describes the runtime view of a single grid.
 *
 * For topology = grid, we assume a row-major layout and currently require that
 * rows * cols == cells.length (enforced by initRuntimeState).
 */
export interface GridRuntimeState {
    /**
     * Name of the grid, matching FluxGrid.name.
     */
    name: string;
    /**
     * Declared grid dimensions. For topology = grid in v0.1 we expect both
     * rows and cols to be non-zero.
     */
    rows: number;
    cols: number;
    /**
     * Row-major list of cells. Cell (row, col) is at index row * cols + col.
     */
    cells: RuntimeCellState[];
}
/**
 * FluxEvent is the runtime representation of an event delivered to the Flux
 * runtime. It is intentionally generic and transport-agnostic.
 */
export interface FluxEvent {
    /**
     * Event type string, e.g. "click", "input", "hover", etc.
     * Event rules with `on = "..."` will typically match against this field.
     */
    type: string;
    /**
     * Optional grid name in which the event occurred.
     */
    gridName?: string;
    /**
     * Optional cell id if the event is associated with a specific cell.
     */
    cellId?: string;
    /**
     * Optional spatial/location metadata. For UI-like systems this might be
     * pixel coordinates; for purely discrete grids, row/col may be used.
     */
    location?: {
        x?: number;
        y?: number;
        row?: number;
        col?: number;
    };
    /**
     * Arbitrary event payload. E.g. for an "input" event this could include
     * `{ text: "..." }`, etc.
     */
    payload?: Record<string, unknown>;
}
/**
 * NeighborRef is the minimal information the neighbors namespace exposes about
 * a neighboring cell.
 */
export interface NeighborRef {
    row: number;
    col: number;
    cell: RuntimeCellState;
}
/**
 * NeighborsNamespace describes the runtime "neighbors" helper that rule
 * bodies see when they refer to neighbors.*().
 *
 * For v0.1 we only commit to neighbors.all(); other methods like orth() will
 * be added later.
 *
 * NOTE: This is an internal runtime concept, not yet wired into evaluation.
 */
export interface NeighborsNamespace {
    /**
     * All 8-connected neighbors (orthogonal + diagonal) for the current cell,
     * in unspecified order, with out-of-bounds cells omitted.
     */
    all(): NeighborRef[];
}
/**
 * RuntimeState is the top-level state that the Flux runtime operates on.
 *
 * It is intentionally separate from FluxDocument, which is immutable and
 * describes the program. RuntimeState is the evolving state of one execution
 * of that program.
 */
export interface RuntimeState {
    /**
     * The parsed Flux document that this runtime state is executing.
     * Immutable; callers should treat this as read-only.
     */
    doc: FluxDocument;
    /**
     * Internal docstep counter. This is separate from any user-defined param
     * named "docstep"; rules may freely read/write such a param without
     * affecting this counter.
     */
    docstepIndex: number;
    /**
     * Runtime parameter map.
     *
     * Keys are parameter names from doc.state.params; values are the current
     * runtime values. For v0.1 we allow number | boolean | string.
     */
    params: Record<string, number | boolean | string>;
    /**
     * Runtime view of all grids, keyed by grid name.
     */
    grids: Record<string, GridRuntimeState>;
    /**
     * Direct copy of the document's runtime configuration (if present).
     * This mirrors FluxDocument.runtime and is not interpreted here.
     */
    runtimeConfig?: FluxRuntimeConfig;
}
//# sourceMappingURL=model.d.ts.map