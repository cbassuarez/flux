# @flux-lang/flux

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/flux" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/flux-npm.dark.svg">
      <img alt="@flux-lang/flux npm version" src="../../badges/generated/flux-npm.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/flux" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.flux.stable.dark.svg">
      <img alt="@flux-lang/flux stable channel" src="../../badges/generated/channel.flux.stable.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/flux" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.flux.canary.dark.svg">
      <img alt="@flux-lang/flux canary channel" src="../../badges/generated/channel.flux.canary.light.svg">
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
   Global Flux launcher that keeps `@flux-lang/cli` (and viewer) cached and up to date.

2) **When you use it**
   Use it when you want a global `flux` binary that can self-update and cache CLI versions.

3) **Install**

```bash
pnpm add -g @flux-lang/flux
```

4) **Basic usage**

```bash
flux self status
```

5) **Reference**
- **Binary**: `flux`
- **Self commands**: `flux self status | channel | update | pin | unpin | autoupdate | clear-cache`
- **Source**: `src/bin/flux.ts`

6) **How it relates to IR/runtime**
This package does not parse or render IR itself; it resolves and launches the actual CLI binary.

7) **Gotchas & troubleshooting**
- Offline use requires a cached CLI version; otherwise the launcher reports an error and suggests pinning.

8) **Versioning / compatibility notes**
TBD / Not yet implemented.

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Launcher source: [`src/`](src/)
