// packages/core/src/index.ts
// Public surface for @flux-lang/core
// AST / IR types
export * from "./ast.js";
// Parser
export { parseDocument } from "./parser.js";
// Runtime kernel entry points
export { initRuntimeState, runDocstepOnce, handleEvent } from "./runtime/kernel.js";
export { createRuntime, getDocstepIntervalHint, } from "./runtime.js";
// Static checks
export { checkDocument } from "./checks.js";
//# sourceMappingURL=index.js.map