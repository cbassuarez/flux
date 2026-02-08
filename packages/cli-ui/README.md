# @flux-lang/cli-ui

1) **What this package is**
   Ink-based terminal UI for the Flux CLI.

2) **When you use it**
   Use it when you want an interactive TTY UI on top of the CLI command set.

3) **Install**

```bash
pnpm add @flux-lang/cli-ui
```

4) **Basic usage**

```ts
import { runCliUi } from "@flux-lang/cli-ui";
import { coerceVersionInfo } from "@flux-lang/brand";

await runCliUi({ cwd: process.cwd(), versionInfo: coerceVersionInfo({ version: "0.1.13" }) });
```

5) **Reference**
- **Public entry point**: `@flux-lang/cli-ui` → `src/index.tsx`
- **UI launcher**: `runCliUi` (calls Ink `render()` with the app shell)
- **State exports**: `dashboard-machine`

6) **How it relates to IR/runtime**
The UI delegates all parsing/rendering/runtime work to `@flux-lang/cli-core` and surfaces status for docstep/time/seed.

7) **Gotchas & troubleshooting**
- The UI is intended for TTY environments; for non-interactive usage, use the plain CLI with `--no-ui`.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Source: [`src/`](src/)
