// packages/core/src/index.ts
// Public surface for @flux-lang/core

// AST / IR types
export * from "./ast.js";

// Parser
export { parseDocument, type ParseOptions } from "./parser.js";

// Render IR (v0.2)
export type {
  RenderDocument,
  RenderNode,
  RenderDocumentIR,
  RenderNodeIR,
  RenderValue,
  RenderAsset,
  RenderAssetRef,
  RenderGridData,
  RenderGridCell,
  SlotReserve,
  SlotFitPolicy,
  RenderStyleDefinition,
  RenderNodeStyle,
  RenderNodeCounters,
  RenderOptions,
  DocumentRuntime,
  DocumentRuntimeIR,
  AssetResolver,
} from "./render.js";
export { createDocumentRuntime, renderDocument, createDocumentRuntimeIR, renderDocumentIR } from "./render.js";

// Runtime types (runtime's FluxEvent stays internal for now)
export type { RuntimeState, GridRuntimeState, NeighborRef, NeighborsNamespace } from "./runtime/model.js";

// Runtime kernel entry points
export { initRuntimeState, runDocstepOnce, handleEvent } from "./runtime/kernel.js";

// Runtime types & API
export type {
  Runtime,
  RuntimeSnapshot,
  RuntimeEvent,
  RuntimeOptions,
} from "./runtime.js";

export { createRuntime, getDocstepIntervalHint } from "./runtime.js";
export type { DocstepIntervalHint } from "./runtime.js";

// Layout model
export type { GridLayoutModel, GridView, GridCellView } from "./layout.js";
export { computeGridLayout } from "./layout.js";

// Static checks
export { checkDocument } from "./checks.js";

// Guided transforms (edit helpers)
export type { AddTransformKind, AddTransformOptions } from "./transform.js";
export { applyAddTransform, formatFluxSource } from "./transform.js";
