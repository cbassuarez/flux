# @flux-lang/core

1) **What this package is**
   Core AST, parser, Render IR, and runtime kernel for the Flux score language.

2) **When you use it**
   Use it when you need to parse `.flux` sources, render deterministic IR, or execute the runtime kernel.

3) **Install**

```bash
pnpm add @flux-lang/core
```

4) **Basic usage**

```ts
import { parseDocument, renderDocument } from "@flux-lang/core";

const source = `
  document {
    meta { version = "0.2.0"; }
    body { page p1 { text t1 { content = "Hello"; } } }
  }
`;

const doc = parseDocument(source);
const ir = renderDocument(doc, { seed: 42, docstep: 0, time: 0 });
```

5) **Reference**
- **Parse**: `parseDocument`
- **Render**: `renderDocument`, `renderDocumentIR`, `createDocumentRuntime`, `createDocumentRuntimeIR`
- **Runtime kernel**: `initRuntimeState`, `runDocstepOnce`, `handleEvent`
- **Static checks**: `checkDocument`
- **Layout**: `computeGridLayout`

6) **How it relates to IR/runtime**
This package defines the AST IR (`FluxDocument`) and the Render IR (`RenderDocument`/`RenderDocumentIR`), and implements the runtime stepping semantics that drive docsteps and time.

7) **Gotchas & troubleshooting**
- `renderDocumentIR` returns stable node IDs for patching and viewer workflows; use it when you need deterministic diffing.

8) **Versioning / compatibility notes**
- Flux uses semantic versioning in `meta.version`, and `0.x` releases are considered unstable.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Render IR spec: [`docs/flux-ir-v0.2.md`](docs/flux-ir-v0.2.md)
- Source: [`src/`](src/)
