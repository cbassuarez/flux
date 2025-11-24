// packages/core/src/index.ts
// Public surface for @flux-lang/core

// AST / IR types
export * from "./ast.js";

// Parser
export { parseDocument } from "./parser.js";

// Runtime types (runtime's FluxEvent stays internal for now)
export type {
    RuntimeState,
    GridRuntimeState,
    RuntimeCellState,
    NeighborRef,
    NeighborsNamespace,
} from "./runtime/model.js";

// Runtime kernel entry points
export { initRuntimeState, runDocstepOnce, handleEvent } from "./runtime/kernel.js";

// Static checks
export { checkDocument } from "./checks.js";
