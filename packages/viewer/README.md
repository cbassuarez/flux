# @flux-lang/viewer

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/viewer" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/npm.viewer.dark.svg">
      <img alt="@flux-lang/viewer version" src="../../badges/generated/npm.viewer.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/viewer" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.viewer.stable.dark.svg">
      <img alt="@flux-lang/viewer stable channel" src="../../badges/generated/channel.viewer.stable.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/viewer" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.viewer.canary.dark.svg">
      <img alt="@flux-lang/viewer canary channel" src="../../badges/generated/channel.viewer.canary.light.svg">
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
