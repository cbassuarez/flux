[![CI](https://img.shields.io/github/actions/workflow/status/cbassuarez/flux/ci.yml?branch=main&label=CI&logo=github)](https://github.com/cbassuarez/flux/actions/workflows/ci.yml)
[![Flux IR v0.1](https://img.shields.io/badge/Flux%20IR-v0.1-00CDFE)](./packages/core/docs/flux-v0_1.md)
[![License: MIT](https://img.shields.io/github/license/cbassuarez/flux)](./LICENSE)
[![Node >= 20](https://img.shields.io/badge/node-%3E%3D%2020-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript ^5.6](https://img.shields.io/badge/TypeScript-%5E5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

# Flux

Flux is a small domain-specific language for **grid-based musical scores and live systems**. It lets you describe pages of cells (grids), global parameters, and rule-based behaviors (docsteps, neighbors, events) in a compact, textual form.

The project is aimed at **composers and sound artists** who want programmable scores and tools, as well as developers who want a structured IR for building editors, renderers, or custom runtimes on top of Flux.

At its core, Flux is both:

- A **language + runtime** for rule-based scores on 2D grids.
- A **well-defined IR** (`FluxDocument`) you can parse, inspect, transform, and execute from your own tools.

---

## Monorepo layout

This repository is organized as a small monorepo:

```text
packages/
  core          – @flux-lang/core     (AST, parser, IR, runtime kernel)
  cli           – @flux-lang/cli      (flux parse, flux check)
  vscode-flux   – Flux VS Code extension (syntax + diagnostics)
````

### `@flux-lang/core` – parser, IR, runtime

The `core` package exports:

* **AST + IR types** – centered on `FluxDocument`.
* `parseDocument(source: string): FluxDocument` – parses v0.1 source.
* A **v0.1 runtime kernel**:

    * `initRuntimeState(doc: FluxDocument): RuntimeState`
    * `runDocstepOnce(doc: FluxDocument, state: RuntimeState): RuntimeState`
    * `handleEvent(doc: FluxDocument, state: RuntimeState, event: FluxEvent): RuntimeState` (stubbed in v0.1)

### `@flux-lang/cli` – Flux CLI

The `cli` package provides the `flux` binary:

* `flux parse` – parse `.flux` files and print their IR as JSON.
* `flux check` – parse + basic static checks (grid references, neighbors usage, runtime shape).

### `@flux-lang/vscode-flux` – VS Code language support

The `vscode-flux` package is a VS Code extension that adds:

* Syntax highlighting for `.flux` files.
* On-the-fly diagnostics powered by `@flux-lang/core` (parse + static checks).
* A command: **“Flux: Show IR JSON for Current File”** (pretty-prints the `FluxDocument` IR in a JSON editor).

---

## The Flux v0.1 IR contract

Flux v0.1 is defined around a single top-level IR type:

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

You obtain the **canonical JSON IR** in three steps:

1. Parse a source string with `parseDocument(source: string): FluxDocument`.
2. Serialize with `JSON.stringify` (which drops `undefined` fields).
3. Optionally `JSON.parse` back to a plain JSON object.

```ts
import { parseDocument } from "@flux-lang/core";

const doc = parseDocument(source);
const ir = JSON.parse(JSON.stringify(doc)); // canonical JSON IR
```

The full v0.1 IR is documented in:

* `packages/core/docs/flux-v0_1.md`

That document, together with:

* `packages/core/src/ast.ts`
* `packages/core/src/parser.ts`
* the **canonical IR tests** in `packages/core/tests/parser.spec.ts`

constitute the **public IR contract** for Flux v0.1.

### Key concepts (v0.1)

A few core concepts you’ll see in the IR and runtime:

* **Grids & cells**
  `grids` is an array of named grids (`FluxGrid`), each with:

    * `topology` (currently `"grid"`),
    * `size` (`rows`, `cols`),
    * and a flat array of `cells`.
      Each `FluxCell` has:
    * an `id` (e.g. `"c1"`),
    * `tags` (`["noise", "tone", ...]`),
    * optional `content` (string),
    * optional `dynamic` (number).

* **Global state / params**
  `state.params` defines typed parameters (`int`, `float`, `bool`, `string`, `enum`) with optional ranges and an `initial` value.

* **Rules & docsteps**
  `rules` are `FluxRule` objects with:

    * a `mode` (`"docstep" | "event" | "timer"`),
    * optional `scope.grid` (grid-scoped vs doc-scoped),
    * a `condition` expression,
    * `thenBranch` / optional `elseBranch` of statements (`Assignment`, `Let`, etc.).

  In v0.1, the runtime kernel executes **docstep rules** over rectangular grids.

* **Neighbors API**
  The language has a dedicated **neighbors namespace**:

    * `neighbors.all()` → all 8 surrounding cells (Moore neighborhood).
    * `neighbors.orth()` → 4 orthogonal neighbors (von Neumann).

  These appear as:

  ```ts
  interface NeighborsCallExpression {
    kind: "NeighborsCallExpression";
    namespace: "neighbors";
    method: string;    // e.g. "all", "orth"
    args: FluxExpr[];
  }
  ```

  and can be chained via `MemberExpression`, e.g. `neighbors.all().dynamic`.

* **Runtime config**
  `runtime` contains:

    * `eventsApply` – `"immediate" | "deferred" | "cellImmediateParamsDeferred"`.
    * `docstepAdvance` – a list of `timer(...)` specs (amount + unit).

Events and timers are **parsed and represented in the IR** in v0.1, but only **docstep rules** are executed by the runtime kernel.

For the full details of all node shapes, fields, and versioning rules, see:

* `packages/core/docs/flux-v0_1.md`

---

## Quickstart

### 1. Core: parse & run a docstep

Install `@flux-lang/core`:

```bash
npm install @flux-lang/core
# or
pnpm add @flux-lang/core
```

Basic usage:

```ts
import {
  parseDocument,
  initRuntimeState,
  runDocstepOnce,
} from "@flux-lang/core";

const source = `
document {
  meta { version = "0.1.0"; title = "Example"; }

  state {
    param tempo : float [40, 72] @ 60;
  }

  grid main {
    topology = grid;
    size { rows = 1; cols = 3; }

    cell c1 { tags = [ noise ]; content = ""; dynamic = 0.6; }
    cell c2 { tags = [ noise ]; content = ""; dynamic = 0.6; }
    cell c3 { tags = [ noise ]; content = ""; dynamic = 0.4; }
  }

  rule growNoise(mode = docstep, grid = main) {
    when cell.content == "" and neighbors.all().dynamic > 0.5
    then {
      cell.content = "noise";
    }
  }
}
`;

const doc = parseDocument(source);

// Build initial runtime state from the IR
const state0 = initRuntimeState(doc);

// Execute one docstep over all docstep rules
const state1 = runDocstepOnce(doc, state0);

// Inspect updated cells, params, etc.
console.log(state1.grids.main.cells);
```

In v0.1, the runtime kernel:

* Executes all **mode = docstep** rules in document order.
* Supports:

    * doc-scoped and grid-scoped rules,
    * `cell.*` assignments in grid-scoped rules,
    * `neighbors.all()` / `neighbors.orth()` with `.dynamic` aggregation (average).

### 2. CLI: `flux parse` and `flux check`

The CLI is distributed as `@flux-lang/cli`, exposing a `flux` binary.

You can use it via `npx`:

```bash
# Parse one file and pretty-print the IR
npx @flux-lang/cli parse example.flux

# Parse multiple files and emit NDJSON
npx @flux-lang/cli parse --ndjson src/**/*.flux

# Run basic static checks
npx @flux-lang/cli check example.flux
```

Or install it globally:

```bash
npm install -g @flux-lang/cli

flux parse example.flux
flux check example.flux
```

Current v0.1 CLI behavior:

* **`flux parse`**

    * Parses all files; if any parse fails, prints a diagnostic and exits with code `1`.
    * For a single file:

        * Pretty-prints the `FluxDocument` JSON (2-space indent) by default.
    * For multiple files or `--ndjson`:

        * Emits one JSON object per line:
          `{"file": "...", "doc": { ...FluxDocument... } }`.

* **`flux check`**

    * Parses each file and runs basic static checks:

        * `grid = name` references point to existing grids.
        * `neighbors.*` methods are recognized (`all` / `orth` in v0.1).
        * `runtime.docstepAdvance` timers have positive amounts.
        * `initRuntimeState` is run as a sanity check (must not throw).
    * Exits with:

        * `0` if all files pass checks,
        * `1` if any file fails checks.
    * Human-readable output:

        * Diagnostics on stderr (`path:line:col: message`).
        * Summary line on stdout, e.g.
          `✗ 1 of 3 files failed checks`.

NDJSON diagnostics via `--json` are planned and may appear in future versions.

### 3. VS Code: Flux language support
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/cbassuarez.flux-language-support)](https://marketplace.visualstudio.com/items?itemName=cbassuarez.flux-language-support)
[![VS Code Installs](https://img.shields.io/visual-studio-marketplace/i/cbassuarez.flux-language-support)](https://marketplace.visualstudio.com/items?itemName=cbassuarez.flux-language-support)

The **Flux VS Code extension** lives in:

* `packages/vscode-flux`

Features (v0.1):

* Syntax highlighting for `.flux` files:

    * `document`, `state`, `grid`, `cell`, `rule`, `runtime`, etc.
    * Basic expression-level highlighting (numbers, strings, operators).
    * Special scoping for `neighbors.*` and event-type strings (e.g. `on = "click"`).
* On-the-fly diagnostics powered by `@flux-lang/core`:

    * Parse errors (with approximate ranges).
    * Static check errors from `checkDocument` (e.g. unknown `grid = ...`).
* Command: **“Flux: Show IR JSON for Current File”**

    * Parses the active `.flux` document with `parseDocument`.
    * Opens a read-only JSON editor showing the `FluxDocument` IR.

#### Installing the extension (from source)

Until it’s published on the VS Code Marketplace, you can use it locally:

```bash
cd packages/vscode-flux
npm install
npm run build

# Then open this folder in VS Code:
code .
```

From VS Code:

1. Press **F5** to launch an **Extension Development Host**.
2. In the new window, create or open an `example.flux` file.
3. You should see:

    * Flux syntax highlighting.
    * Diagnostics for bad `grid` references, invalid runtime timers, etc.
    * The **“Flux: Show IR JSON for Current File”** command in the Command Palette.

Once the extension is published, the README will be updated to point to the Marketplace entry (publisher: `cbassuarez`).

---

## Development

Clone and bootstrap:

```bash
git clone https://github.com/cbassuarez/flux.git
cd flux

npm install
npm run build
npm test
```

This will:

* Build all workspaces:

    * `@flux-lang/core`
    * `@flux-lang/cli`
    * `@flux-lang/vscode-flux`
* Run tests for:

    * `core` (parser + runtime).
    * `cli` (CLI smoke tests).
    * `vscode-flux` currently has a placeholder `test` script.

### Working on individual packages
[![npm version](https://img.shields.io/npm/v/%40flux-lang%2Fcore)](https://www.npmjs.com/package/@flux-lang/core)
[![npm version](https://img.shields.io/npm/v/%40flux-lang%2Fcli)](https://www.npmjs.com/package/@flux-lang/cli)

You can also work inside each package:

```bash
# Core: AST, parser, runtime
cd packages/core
npm test     # runs Vitest test suite
npm run build

# CLI: flux parse / flux check
cd ../cli
npm test     # CLI smoke tests via execa
npm run build

# VS Code extension: language support
cd ../vscode-flux
npm run typecheck
npm run build
```

Each package has its own `package.json` and build pipeline, but they’re all wired through the top-level `npm run build` / `npm test` via workspaces.

---

## Motivation

Flux exists to answer a specific need:

* Many **scores, interfaces, and installations** are naturally **grid-shaped** (pages of cells, pads, lights, UI tiles).
* We often want to **describe behavior** over those grids (how cells react, evolve, or respond to input) without hardwiring everything into a monolithic app.
* Tools that *understand* these structures need a **shared representation**: something that’s easy to parse, inspect, and execute.

Flux is:

* A textual language that **feels like a score** (document, pages, grids, cells, rules).
* A **machine-readable IR** that toolmakers can depend on.
* A small runtime kernel you can embed to **execute docsteps and neighbors-based rules** without reinventing the semantics each time.

The v0.1 kit (core + CLI + VS Code extension) is meant to be a **minimal but real stack** you can:

* Experiment with as a composer / artist.
* Integrate into custom tools as a developer (e.g. renderers, visualizers, or live systems).

---

## Status & roadmap (v0.1)

**Grammar / parser**

* The v0.1 grammar is **stable enough for experimentation**, but may still change.
* Any significant IR changes will:

    * Be reflected in `meta.version` (e.g. `"0.1.0" → "0.2.0"`).
    * Update `packages/core/docs/flux-v0_1.md`.
    * Be accompanied by new or updated canonical IR tests.

**IR**

* `FluxDocument` is the **canonical IR** for Flux v0.1.
* It is versioned via `meta.version`.
* It’s designed to be **embedded** in other tools:

    * Parse once with `parseDocument`.
    * Store / transmit the JSON IR.
    * Reconstruct and execute as needed.

**Runtime kernel**

* v0.1 runtime kernel supports:

    * `mode = docstep` rules (doc-scoped and grid-scoped).
    * Rectangular grids with `neighbors.all()` and `neighbors.orth()`:

        * `.dynamic` aggregation currently computes averages over neighbor cells.
    * `cell.*` field assignments in grid-scoped docstep rules.
* Events and timers:

    * Parsed and represented in `FluxDocument.runtime` and `FluxRule` (e.g. `mode = event`, `on = "click"`).
    * **Not yet executed** by the kernel; `handleEvent` is a documented no-op for now.

Future work (beyond v0.1):

* Fully executing **event rules** and **timer-based docstepAdvance**.
* More expressive **neighbors** operations and aggregators.
* Richer static analysis in `flux check` and the VS Code extension.
* Additional editor integrations (beyond VS Code).

---

## License

Flux is released under the **MIT License**. See `LICENSE` for details.