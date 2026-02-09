# @flux-lang/cli-core

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/cli-core" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/npm.cli-core.dark.svg">
      <img alt="@flux-lang/cli-core version" src="../../badges/generated/npm.cli-core.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/cli-core" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.cli-core.stable.dark.svg">
      <img alt="@flux-lang/cli-core stable channel" src="../../badges/generated/channel.cli-core.stable.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/cli-core" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.cli-core.canary.dark.svg">
      <img alt="@flux-lang/cli-core canary channel" src="../../badges/generated/channel.cli-core.canary.light.svg">
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
