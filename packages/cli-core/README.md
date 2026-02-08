# @flux-lang/cli-core

1) **What this package is**
   Core command implementations for the Flux CLI (parse/check/render/view/new/add and config helpers).

2) **When you use it**
   Use it when embedding Flux CLI behavior inside other tools or UIs (e.g., the Ink UI).

3) **Install**

```bash
pnpm add @flux-lang/cli-core
```

4) **Basic usage**

```ts
import { newCommand } from "@flux-lang/cli-core";

const result = await newCommand({
  cwd: process.cwd(),
  template: "demo",
  out: "./demo-doc",
  page: "A4",
  theme: "both",
  fonts: "bookish",
  fontFallback: "system",
  assets: true,
  chapters: 2,
  live: true,
});
```

5) **Reference**
- **Command exports** (see `src/index.ts`):
  - `parseCommand`, `checkCommand`, `renderCommand`, `formatCommand`
  - `tickCommand`, `stepCommand`, `viewCommand`, `pdfCommand`
  - `newCommand`, `addCommand`, `configCommand`
  - viewer helpers (`viewer/manager`)

6) **How it relates to IR/runtime**
This package wraps `@flux-lang/core` parsing/rendering and coordinates viewer/runtime stepping for CLI workflows.

7) **Gotchas & troubleshooting**
- Commands return `{ ok, data, error }` shapes; always check `ok` before using `data`.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Source: [`src/`](src/)
