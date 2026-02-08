# @flux-lang/brand

1) **What this package is**
   Shared Flux brand identity helpers and renderers for CLI and web surfaces.

2) **When you use it**
   Use it when you need consistent Flux version branding, taglines, or UI assets in CLI or web tooling.

3) **Install**

```bash
pnpm add @flux-lang/brand
```

4) **Basic usage**

```ts
import { coerceVersionInfo, formatFluxVersion, FLUX_TAGLINE } from "@flux-lang/brand";

const info = coerceVersionInfo({ version: "v0.1.4", channel: "canary" });
console.log(formatFluxVersion(info.version));
console.log(FLUX_TAGLINE);
```

5) **Reference**
- **Entry points**:
  - `@flux-lang/brand` (shared helpers) → `src/index.ts`
  - `@flux-lang/brand/cli` (CLI-specific helpers) → `src/cli.ts`
  - `@flux-lang/brand/web` (web/React helpers) → `src/web.tsx`

6) **How it relates to IR/runtime**
This package does not touch IR or runtime behavior. It provides shared branding and version presentation only.

7) **Gotchas & troubleshooting**
- The web entry point has React peer dependencies. Install `react`/`react-dom` if you use `@flux-lang/brand/web`.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Source: [`src/`](src/)
