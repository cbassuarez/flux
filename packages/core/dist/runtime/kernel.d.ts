import type { FluxDocument } from "../ast";
import type { FluxEvent, RuntimeState } from "./model";
/**
 * Build an initial RuntimeState from a parsed FluxDocument.
 * - Params are initialized from `state.params.initial`.
 * - Grids are materialized into rectangular cell matrices (row-major 1D array).
 */
export declare function initRuntimeState(doc: FluxDocument): RuntimeState;
/**
 * Run a single docstep:
 * - Evaluates all mode=docstep rules in document order.
 * - Applies their effects in a second "commit" phase (last-writer wins).
 */
export declare function runDocstepOnce(doc: FluxDocument, prev: RuntimeState): RuntimeState;
/**
 * Event handling is reserved for a later kernel milestone.
 * For now it is a documented no-op.
 */
export declare function handleEvent(_doc: FluxDocument, state: RuntimeState, _event: FluxEvent): RuntimeState;
//# sourceMappingURL=kernel.d.ts.map