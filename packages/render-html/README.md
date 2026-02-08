# @flux-lang/render-html

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
