# @flux-lang/editor-ui

1) **What this package is**
   Flux web editor UI served by the viewer server.

2) **When you use it**
   Use it when you want an in-browser editor for `.flux` documents (served via `flux edit`).

3) **Install**

```bash
# workspace-only package
pnpm install
```

4) **Basic usage**

```ts
// Playwright test snippet: the editor is served from the viewer at /edit.
await page.goto(`/edit?file=${encodeURIComponent(docPath)}`);
await page.waitForSelector(".editor-root");
```

5) **Reference**
- **Dev server**: `pnpm --filter @flux-lang/editor-ui run dev`
- **Build**: `pnpm --filter @flux-lang/editor-ui run build`
- **Source**: `src/`

6) **How it relates to IR/runtime**
The editor consumes viewer APIs that expose the Render IR and patch streams; it does not evaluate the runtime directly.

7) **Gotchas & troubleshooting**
- The editor UI is bundled and served by `@flux-lang/viewer`; ensure the viewer has prepared `editor-dist` before running `flux edit`.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Viewer package: [`../viewer/README.md`](../viewer/README.md)
- Source: [`src/`](src/)
