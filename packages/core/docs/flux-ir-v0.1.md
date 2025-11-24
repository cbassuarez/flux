# Flux v0.1 Intermediate Representation (IR)

This document describes the **canonical JSON representation** of a Flux v0.1 document.

You obtain this IR by:

1. Parsing a source string with `parseDocument(source: string): FluxDocument`.
2. Serializing the result with `JSON.stringify` (which drops `undefined` fields).
3. Optionally `JSON.parse`-ing that back to a plain JSON object.

```ts
import { parseDocument } from "@flux-lang/core";

const doc = parseDocument(source);
const ir = JSON.parse(JSON.stringify(doc)); // canonical JSON IR
````

The tests in `packages/core/tests/parser.spec.ts` under:

* **"canonical IR for docstep + neighbors + runtime"**
* **"canonical IR for an event rule with else branch"**

act as executable examples of this IR and SHOULD be kept in sync with this document.

---

## Top-level shape

Flux v0.1 documents have this logical shape (see `src/ast.ts`):

```ts
interface FluxDocument {
  meta: FluxMeta;
  state: FluxState;
  pageConfig?: PageConfig;
  grids: FluxGrid[];
  rules: FluxRule[];
  runtime?: FluxRuntimeConfig;
}
```

When serialized to JSON:

* `pageConfig` and `runtime` MAY be omitted if they are not present.
* The minimal valid document has `meta`, `state`, and no grids/rules/runtime.

---

## Meta and State

### Meta

```ts
interface FluxMeta {
  version: string;      // required; "0.1.0" for this spec
  [key: string]: string;
}
```

* `version` identifies the Flux grammar version.
* Additional string fields (e.g. `title`, `author`) are allowed.

### State

```ts
interface FluxState {
  params: FluxParam[];
}

type FluxType = "int" | "float" | "bool" | "string" | "enum";

interface FluxParam {
  name: string;
  type: FluxType;
  min?: number | string; // numbers or "inf"
  max?: number | string; // numbers or "inf"
  initial: number | boolean | string;
}
```

* Ranges `[min, max]` in the source become `min`/`max` literals.
* `"inf"` is represented as the string `"inf"` in JSON.

---

## Page configuration

```ts
interface PageConfig {
  size: PageSize;
}

interface PageSize {
  width: number;
  height: number;
  units: string; // e.g. "mm"
}
```

---

## Grids and cells

```ts
interface FluxGrid {
  name: string;
  topology: string;         // e.g. "grid"
  page?: number;
  size?: {
    rows?: number;
    cols?: number;
  };
  cells: FluxCell[];
}

interface FluxCell {
  id: string;
  tags: string[];
  content?: string;
  dynamic?: number;
}
```

* `topology` is currently a free string (e.g. `"grid"`).
* `tags` are bare identifiers in the source (e.g. `[ noise, tone ]`) → JSON strings.

---

## Expressions

Expressions are a discriminated union on `kind`:

```ts
type FluxExpr =
  | LiteralExpr
  | IdentifierExpr
  | BinaryExpr
  | UnaryExpr
  | MemberExpr
  | CallExpr
  | NeighborsCallExpr;

interface LiteralExpr {
  kind: "Literal";
  value: number | string | boolean;
}

interface IdentifierExpr {
  kind: "Identifier";
  name: string;
}

type BinaryOp =
  | "and"
  | "or"
  | "=="
  | "!="
  | "==="
  | "!=="
  | "<"
  | "<="
  | ">"
  | ">="
  | "+"
  | "-"
  | "*"
  | "/";

interface BinaryExpr {
  kind: "BinaryExpression";
  op: BinaryOp;
  left: FluxExpr;
  right: FluxExpr;
}

type UnaryOp = "not" | "-";

interface UnaryExpr {
  kind: "UnaryExpression";
  op: UnaryOp;
  argument: FluxExpr;
}

interface MemberExpr {
  kind: "MemberExpression";
  object: FluxExpr;
  property: string;
}

interface CallExpr {
  kind: "CallExpression";
  callee: FluxExpr;
  args: FluxExpr[];
}
```

Notes:

* Logical operators are **normalized** to `"and"` / `"or"` in the IR, even when `&&` / `||` are used in the source.
* Unary logical negation is normalized to `"not"`, even when `!` is used.

### Neighbors calls

`neighbors.*` calls have a dedicated node:

```ts
interface NeighborsCallExpr {
  kind: "NeighborsCallExpression";
  namespace: "neighbors";
  method: string;    // e.g. "all", "orth"
  args: FluxExpr[];
}
```

Example (see the “docstep + neighbors + runtime” test):

```flux
when { cell.content == "" && neighbors.all().dynamic > 0.5 }
```

Becomes (simplified):

```json
{
  "kind": "BinaryExpression",
  "op": "and",
  "left": {
    "kind": "BinaryExpression",
    "op": "==",
    "left": {
      "kind": "MemberExpression",
      "object": { "kind": "Identifier", "name": "cell" },
      "property": "content"
    },
    "right": { "kind": "Literal", "value": "" }
  },
  "right": {
    "kind": "BinaryExpression",
    "op": ">",
    "left": {
      "kind": "MemberExpression",
      "object": {
        "kind": "NeighborsCallExpression",
        "namespace": "neighbors",
        "method": "all",
        "args": []
      },
      "property": "dynamic"
    },
    "right": { "kind": "Literal", "value": 0.5 }
  }
}
```

---

## Statements

Statements are also a discriminated union:

```ts
type FluxStmt =
  | AssignmentStmt
  | LetStmt
  | AdvanceDocstepStmt
  | ExpressionStmt;

interface AssignmentStmt {
  kind: "AssignmentStatement";
  target: FluxExpr;   // Identifier or MemberExpression
  value: FluxExpr;
}

interface LetStmt {
  kind: "LetStatement";
  name: string;
  value: FluxExpr;
}

interface AdvanceDocstepStmt {
  kind: "AdvanceDocstepStatement";
}

interface ExpressionStmt {
  kind: "ExpressionStatement";
  expression: FluxExpr;
}
```

The “canonical event rule with else branch” test shows typical mixtures of `LetStatement` and `AssignmentStatement` in both `thenBranch` and `elseBranch`.

---

## Rules

```ts
type RuleMode = "docstep" | "event" | "timer";

interface RuleScope {
  grid: string;
}

interface FluxRule {
  name: string;
  mode: RuleMode;
  scope?: RuleScope;
  onEventType?: string; // for mode = "event"
  condition: FluxExpr;
  thenBranch: FluxStmt[];
  elseBranch?: FluxStmt[];
}
```

Notes:

* `on="..."` in the source becomes `onEventType: string` in the IR, but **only** for `mode = "event"`.
* Event rules without `on="..."` are rejected at parse time.
* `else { ... }` and else-when chains become a single `elseBranch` array.

---

## Runtime configuration

```ts
type EventsApplyPolicy =
  | "immediate"
  | "deferred"
  | "cellImmediateParamsDeferred";

type TimerUnit = "s" | "ms" | "beats";

interface DocstepAdvanceTimer {
  kind: "timer";
  amount: number;
  unit: TimerUnit;
}

type DocstepAdvanceSpec = DocstepAdvanceTimer;

interface FluxRuntimeConfig {
  eventsApply?: EventsApplyPolicy;
  docstepAdvance?: DocstepAdvanceSpec[];
}
```

* `eventsApply` **must** be a string literal in the source:

  * `"immediate"`, `"deferred"`, or `"cellImmediateParamsDeferred"`.
* `docstepAdvance` currently supports only `timer(...)` specs.

Example (see canonical neighbors + runtime test):

```flux
runtime {
  eventsApply    = "deferred";
  docstepAdvance = [ timer(8 s) ];
}
```

IR:

```json
{
  "eventsApply": "deferred",
  "docstepAdvance": [
    { "kind": "timer", "amount": 8, "unit": "s" }
  ]
}
```

---

## Versioning and compatibility

* This document describes **Flux v0.1** as indicated by `meta.version = "0.1.0"`.
* Any breaking changes to:

  * node `kind` strings,
  * field names,
  * or the shape of `FluxDocument`

MUST:

1. Bump the Flux version in `meta.version`.
2. Update this document.
3. Update and/or add new canonical IR tests in `tests/parser.spec.ts`.

Treat `src/ast.ts`, `src/parser.ts`, and the canonical IR tests as the **public contract** for Flux v0.1.

