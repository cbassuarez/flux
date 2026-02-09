# @flux-lang/render-html

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/render-html" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/npm.render-html.dark.svg">
      <img alt="@flux-lang/render-html version" src="../../badges/generated/npm.render-html.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/render-html" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.render-html.stable.dark.svg">
      <img alt="@flux-lang/render-html stable channel" src="../../badges/generated/channel.render-html.stable.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/render-html" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.render-html.canary.dark.svg">
      <img alt="@flux-lang/render-html canary channel" src="../../badges/generated/channel.render-html.canary.light.svg">
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
   HTML/CSS renderer for Flux RenderDocumentIR.

2) **When you use it**
   Use it when you need to turn Render IR into HTML/CSS for the viewer or export pipelines.

3) **Install**

```bash
pnpm add @flux-lang/render-html
```

4) **Basic usage**

```ts
import { parseDocument, renderDocumentIR } from "@flux-lang/core";
import { renderHtml } from "@flux-lang/render-html";

const src = `
  document {
    meta { version = "0.2.0"; }
    body { page p1 { text t1 { content = "Hello"; } } }
  }
`;

const doc = parseDocument(src);
const ir = renderDocumentIR(doc);
const { html, css } = renderHtml(ir);
```

5) **Reference**
- **Entry point**: `renderHtml`, `renderSlotMap` (see `src/index.ts`)

6) **How it relates to IR/runtime**
It consumes `RenderDocumentIR` and does not advance runtime state itself.

7) **Gotchas & troubleshooting**
- Use `renderDocumentIR` (not `renderDocument`) to get stable node IDs required for slot patching.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Source: [`src/`](src/)
