import type { FluxDocument } from "../ast.js";
import type { FluxEvent, RuntimeState } from "./model.js";
/**
 * Build an initial RuntimeState from a parsed FluxDocument.
 * - Params are initialized from `state.params.initial`.
 * - Grids are materialized into rectangular cell matrices (row-major 1D array).
 */
export declare function initRuntimeState(doc: FluxDocument): RuntimeState;
/**
 * Run a single docstep:
 * - Flushes any param/cell writes deferred from prior event handling.
 * - Evaluates all mode=docstep rules in document order (multi-branch).
 * - Applies their effects in a second "commit" phase (last-writer wins).
 */
export declare function runDocstepOnce(doc: FluxDocument, prev: RuntimeState): RuntimeState;
/**
 * Apply an event to the runtime: run all `mode=event` rules whose `onEventType`
 * matches the event, then apply their effects according to the document's
 * `runtime.eventsApply` policy:
 *   - "immediate":                    cell + param writes applied now.
 *   - "deferred":                     cell + param writes deferred to next docstep.
 *   - "cellImmediateParamsDeferred":  cells now, params next docstep (default).
 *
 * If a matching rule calls `advanceDocstep()`, a docstep is run after the
 * event's immediate writes are applied (which also flushes the deferred ones).
 */
export declare function handleEvent(doc: FluxDocument, state: RuntimeState, event: FluxEvent): RuntimeState;
//# sourceMappingURL=kernel.d.ts.map