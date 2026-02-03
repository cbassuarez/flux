# Flux v0.2 Render IR

This document describes the **canonical JSON Render IR** for Flux v0.2.

There are two related JSON shapes:

1. **AST IR** (`FluxDocument`) produced by `parseDocument(source)`.
2. **Render IR** (`RenderDocument`) produced by `renderDocument(doc, options)`.

The Render IR is the canonical, fully-resolved output used by viewers and exporters.

---

## Render IR shape

```ts
interface RenderDocument {
  meta: FluxMeta;
  seed: number;
  time: number;
  docstep: number;
  pageConfig?: PageConfig;
  assets: RenderAsset[];
  body: RenderNode[];
}
```

### Assets

```ts
interface RenderAsset {
  id: string;         // stable deterministic ID
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
```

Assets are sorted by `id` for deterministic diffs.

### Nodes

```ts
type RenderValue =
  | string
  | number
  | boolean
  | null
  | RenderValue[]
  | { [key: string]: RenderValue }
  | RenderAssetRef;

interface RenderAssetRef {
  kind: "asset";
  id: string;
  path: string;
  name: string;
  assetKind: string;
}

interface RenderNode {
  id: string;
  kind: string;
  props: Record<string, RenderValue>;
  children: RenderNode[];
  grid?: RenderGridData;
}
```

All dynamic properties are resolved to concrete `RenderValue`s.

### Grid data (legacy v0.1)

When a `grid` node references a legacy grid, the renderer attaches grid data:

```ts
interface RenderGridData {
  name: string;
  rows: number;
  cols: number;
  cells: RenderGridCell[];
}

interface RenderGridCell {
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
```

---

## Determinism

For a given document, seed, time, and docstep, the Render IR must be identical
byte-for-byte:

```ts
const doc = parseDocument(source);
const irA = renderDocument(doc, { seed: 42, time: 10, docstep: 2 });
const irB = renderDocument(doc, { seed: 42, time: 10, docstep: 2 });

JSON.stringify(irA) === JSON.stringify(irB); // true
```

---

## Notes

- `renderDocument` resolves refresh policies and dynamic expressions.
- Asset references inside node props are represented as `RenderAssetRef`.
- The AST (`FluxDocument`) remains the canonical parse output for tooling and validation.
