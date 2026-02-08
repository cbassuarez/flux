# @flux-lang/cli

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
