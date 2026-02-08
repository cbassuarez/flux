# @flux-lang/viewer

1) **What this package is**
   Local web viewer and editor server for Flux documents.

2) **When you use it**
   Use it when you want to preview documents, stream slot patches, or serve the web editor.

3) **Install**

```bash
pnpm add @flux-lang/viewer
```

4) **Basic usage**

```ts
import { startViewerServer } from "@flux-lang/viewer";

const server = await startViewerServer({
  docPath: "./examples/viewer-demo.flux",
  docstepMs: 1000,
  seed: 1,
  advanceTime: true,
});

console.log(server.url);
await server.close();
```

5) **Reference**
- **Server helpers**: `startViewerServer`, `advanceViewerRuntime`, `noCacheHeaders`
- **Editor assets**: `resolveEditorDist`, `defaultEmbeddedDir`
- **Viewer endpoints** (subset):
  - `/api/render`, `/api/ir` — Render IR payloads
  - `/api/patches`, `/api/stream` — slot patch payloads (polling/SSE)
  - `/api/pdf` — PDF snapshot export
  - `/api/edit/*` — editor APIs (state, outline, transform)

6) **How it relates to IR/runtime**
The viewer parses and renders documents with `@flux-lang/core`, then uses `@flux-lang/render-html` and `@flux-lang/typesetter` to serve HTML/CSS and PDFs.

7) **Gotchas & troubleshooting**
- The viewer serves editor assets from `editor-dist`; run the editor build or `prepare-editor` before shipping.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Source: [`src/`](src/)
