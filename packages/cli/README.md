# @flux-lang/cli

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/cli" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/npm.cli.dark.svg">
      <img alt="@flux-lang/cli version" src="../../badges/generated/npm.cli.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/cli" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../badges/generated/channel.cli.stable.dark.svg">
      <img alt="@flux-lang/cli stable channel" src="../../badges/generated/channel.cli.stable.light.svg">
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
   CLI tooling for the Flux score language. It ships the `flux` binary.

2) **When you use it**
   Use it to parse/check/render documents, preview them locally, or export snapshots.

3) **Install**

```bash
pnpm add -g @flux-lang/cli
```

4) **Basic usage**

```bash
flux render --format ir examples/viewer-demo.flux --pretty
```

5) **Reference**
- **Binary**: `flux`
- **Commands**: `parse`, `check`, `render`, `fmt`, `tick`, `step`, `view`, `edit`, `pdf`, `config`, `new`, `add`
- **Help**: `flux --help` and `flux <command> --help`
- **Source**: `src/bin/flux.ts`

6) **How it relates to IR/runtime**
The CLI parses documents into AST IR, renders canonical Render IR, and drives runtime stepping (docstep/time/seed) for deterministic outputs.

7) **Gotchas & troubleshooting**
- The CLI launches the Ink UI automatically in TTYs; use `--no-ui` for pure stdout mode.

8) **Versioning / compatibility notes**
- The CLI reports versions with `flux --version` (CLI, viewer, editor build ID).

9) **Links**
- Root Flux manual: [`../../README.md`](../../README.md)
- Examples: [`../../examples/`](../../examples/)
- CLI source: [`src/`](src/)
