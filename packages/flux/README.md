# @flux-lang/flux

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
