# @flux-lang/core

Core library for the **Flux** score language: AST types, parser, canonical IR, and the v0.1 runtime kernel.

Flux is a small, declarative language for **procedurally evolving music scores and parts**. The `@flux-lang/core` package is the reference implementation of:

- The **Flux v0.1 grammar**.
- The **FluxDocument IR** (canonical JSON representation).
- A minimal **runtime kernel** with `docstep` rules and `neighbors.*` semantics.

---

## Installation

```bash
npm install @flux-lang/core
# or
pnpm add @flux-lang/core
# or
yarn add @flux-lang/core
````

---

## Basic usage

### Parse source → IR

```ts
import { parseDocument } from "@flux-lang/core";

const source = `
document {
  meta {
    version = "0.1.0";
    title   = "Example";
  }

  state {
    param tempo : float [40, 72] @ 60;
  }
}
`;

const doc = parseDocument(source);
// doc is a FluxDocument (Flux v0.1 IR)
```

### Runtime kernel: docstep + neighbors

```ts
import {
  parseDocument,
  initRuntimeState,
  runDocstepOnce,
} from "@flux-lang/core";

const doc = parseDocument(source);

// Build initial RuntimeState from the document
const state0 = initRuntimeState(doc);

// Advance one docstep (applies all mode=docstep rules)
const state1 = runDocstepOnce(doc, state0);
```

---

## Static checks

`@flux-lang/core` also exposes a small static checker used by the CLI and VS Code extension:

```ts
import { parseDocument, checkDocument } from "@flux-lang/core";

const doc = parseDocument(source);
const errors = checkDocument("example.flux", doc);

if (errors.length > 0) {
  for (const line of errors) {
    console.error(line);
  }
}
```

Typical diagnostics include:

* Unknown grid references in `rule ... (grid = main)`.
* Unsupported `neighbors.*` methods.
* Obvious runtime timer issues (e.g. non-positive `timer(...)` amounts).

---

## Flux IR contract

The canonical IR is the `FluxDocument` type exported from `@flux-lang/core`. It is:

* Produced by `parseDocument(source)`.
* Safe to serialize as JSON and pass across process boundaries.
* Used by the CLI (`flux parse`) and editor tooling.

See the Flux IR spec in the main repo for the full shape and semantics:

* GitHub: `https://github.com/cbassuarez/flux` (IR docs live under `packages/core/docs/`)

---

## Related tooling

* **CLI:** `@flux-lang/cli` — `flux parse` / `flux check` built on top of this package.
* **VS Code:** `@flux-lang/vscode-flux` — syntax highlighting + diagnostics using `@flux-lang/core`.

---

## License

MIT – see the LICENSE file in the repo root.