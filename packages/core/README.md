# @flux-lang/core

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/core" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/npm.core.dark.svg">
      <img alt="@flux-lang/core version" src="../../badges/generated/npm.core.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/core" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.core.stable.dark.svg">
      <img alt="@flux-lang/core stable channel" src="../../badges/generated/channel.core.stable.light.svg">
    </picture>
  </a>
  <a href="../../LICENSE">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/license.dark.svg">
      <img alt="License" src="../../badges/generated/license.light.svg">
    </picture>
  </a>
  <a href="https://github.com/cbassuarez/flux/commits/main" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/maintained.dark.svg">
      <img alt="Maintained status" src="../../badges/generated/maintained.light.svg">
    </picture>
  </a>
</p>
<!-- FLUX:BADGES:END -->

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
