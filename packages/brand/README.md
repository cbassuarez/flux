# @flux-lang/brand

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/brand" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/npm.brand.dark.svg">
      <img alt="@flux-lang/brand version" src="../../badges/generated/npm.brand.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/brand" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.brand.stable.dark.svg">
      <img alt="@flux-lang/brand stable channel" src="../../badges/generated/channel.brand.stable.light.svg">
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
