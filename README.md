# Flux

<!-- FLUX:BADGES:BEGIN -->
<p>
  <a href="https://www.npmjs.com/package/@flux-lang/flux" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/flux-npm.dark.svg">
      <img alt="@flux-lang/flux npm version" src="./badges/generated/flux-npm.light.svg">
    </picture>
  </a>
  <a href="https://github.com/cbassuarez/flux/actions/workflows/ci.yml" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/ci.dark.svg">
      <img alt="CI status" src="./badges/generated/ci.light.svg">
    </picture>
  </a>
  <a href="./LICENSE">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/license.dark.svg">
      <img alt="License" src="./badges/generated/license.light.svg">
    </picture>
  </a>
  <a href="https://flux-lang.org/docs" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/docs.dark.svg">
      <img alt="Docs" src="./badges/generated/docs.light.svg">
    </picture>
  </a>
  <a href="https://github.com/cbassuarez/flux/discussions" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/discord.dark.svg">
      <img alt="Community" src="./badges/generated/discord.light.svg">
    </picture>
  </a>
  <a href="https://github.com/cbassuarez/flux/security/policy" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/security.dark.svg">
      <img alt="Security policy" src="./badges/generated/security.light.svg">
    </picture>
  </a>
  <a href="https://github.com/cbassuarez/flux/commits/main" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/maintained.dark.svg">
      <img alt="Maintained status" src="./badges/generated/maintained.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/flux" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/channel.flux.stable.dark.svg">
      <img alt="Release channel stable" src="./badges/generated/channel.flux.stable.light.svg">
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/@flux-lang/flux" target="_blank" rel="noreferrer">
<picture>
      <source media="(prefers-color-scheme: dark)" srcset="./badges/generated/channel.flux.canary.dark.svg">
      <img alt="Release channel canary" src="./badges/generated/channel.flux.canary.light.svg">
    </picture>
  </a>
</p>
<!-- FLUX:BADGES:END -->

## Flux in one sentence
Flux is a domain-specific language for evolving documents: a `.flux` file is parsed into a document AST, rendered deterministically across docsteps/time/seed, and projected into viewer/export outputs.

## What you do with Flux
- **Parse** Flux sources to AST IR JSON with `flux parse`.
- **Check** documents for static issues with `flux check`.
- **Render** canonical Render IR JSON with `flux render --format ir`.
- **Preview/Edit** documents in a local web viewer/editor with `flux view` or `flux edit`.
- **Export** a deterministic PDF snapshot with `flux pdf`.

## Quickstart
This path runs the CLI from the monorepo and produces a real Render IR JSON output.

```bash
pnpm install
pnpm --filter @flux-lang/cli run build

mkdir -p out
node packages/cli/dist/bin/flux.js render --format ir examples/viewer-demo.flux --pretty > out/viewer-demo.ir.json
node packages/cli/dist/bin/flux.js view examples/viewer-demo.flux
```

- The Render IR JSON lands in `out/viewer-demo.ir.json` (written by shell redirection).
- `flux view` starts a local viewer server for the document.

If you want a brand-new document instead of the demo, use `flux new` (see templates in `packages/cli-core/templates`).

## Mental model: one substrate → many projections
Flux treats the `.flux` document as the single substrate, then deterministically projects it into different outputs.

```
.flux source
  │  parseDocument()
  ▼
FluxDocument (AST IR)
  │  renderDocumentIR(seed, time, docstep)
  ▼
RenderDocumentIR
  │  renderHtml() / typesetter.pdf() / viewer
  ▼
HTML + CSS, PDF, or live viewer output
```

- `parseDocument` produces the AST IR (`FluxDocument`).
- `renderDocumentIR` produces the canonical Render IR with stable node IDs and slot metadata.
- Determinism: for the same document, seed, time, and docstep, the Render IR must match byte-for-byte.

## Concepts & glossary
- **Document**: a `.flux` file parsed into a `FluxDocument` AST with meta, state, assets, body, and optional legacy runtime blocks.
- **IR (AST IR)**: the parse output (`FluxDocument`) used by tooling and validation.
- **IR (Render IR)**: the resolved render output (`RenderDocument`) used by renderers and exporters.
- **Render Document IR**: a stable-node-ID variant (`RenderDocumentIR`) with slot geometry and refresh metadata for patching/viewers.
- **Slot**: a layout-locked node that carries `reserve` geometry and `fit` policy, enabling stable layout with live content.
- **Generator**: a slot-driven content selector (e.g., `choose`, `cycle`, `assets.pick`, `poisson`) parsed from slot expressions and surfaced in the viewer/editor tooling.
- **Runtime**: the evaluation engine that advances docsteps/time and renders updated IR snapshots.
- **docstep**: the discrete document-step index used by the runtime for deterministic evolution and rule evaluation.
- **seed**: deterministic RNG seed stored on the Render IR for reproducible variations.
- **time / timeRate**: render time in seconds and a viewer-side multiplier for ticking forward in previews.
- **Patch / streaming**: the viewer can emit slot patch payloads over `/api/patches` and `/api/stream` for live updates.
- **Viewer / Renderer outputs**: the viewer serves HTML/CSS and export endpoints, while renderers like `@flux-lang/render-html` and typesetters like `@flux-lang/typesetter` project the IR into HTML/PDF.

## Using Flux
### Authoring
- Syntax is defined in the grammar and semantics specs; start there for the exact language surface and runtime rules.
- `flux new` scaffolds documents from built-in templates (`demo`, `article`, `spec`, `zine`, `paper`, `blank`).

### Rendering / Exporting
- Render canonical Render IR JSON: `flux render --format ir <file>`.
- Export a deterministic PDF snapshot: `flux pdf <file> --out <file.pdf>`.

### Deterministic variation
- Use `--seed`, `--time`, and `--docstep` to generate reproducible variants of the same document state.
- Determinism is enforced in the Render IR contract (same inputs → identical IR).

### Automation / CI
- `flux parse --ndjson` and `flux check --json` emit machine-readable output for pipelines (no UI).

## Repo map
- `packages/` — Flux packages (core, CLI, viewer, renderers, editor, VS Code extension).
- `examples/` — real `.flux` documents used for demos and manual validation.
- `spec/` — language overview, grammar, and semantics.
- `scripts/` — repo build helpers (e.g., editor dist sync).

## Packages index
| Package | Purpose | Docs |
| --- | --- | --- |
| `@flux-lang/brand` | Shared brand identity helpers for CLI and web tooling. | [`packages/brand/README.md`](packages/brand/README.md) |
| `@flux-lang/cli` | Flux CLI binary (`flux`). | [`packages/cli/README.md`](packages/cli/README.md) |
| `@flux-lang/cli-core` | Command implementations backing the CLI. | [`packages/cli-core/README.md`](packages/cli-core/README.md) |
| `@flux-lang/cli-ui` | Ink-based terminal UI for the CLI. | [`packages/cli-ui/README.md`](packages/cli-ui/README.md) |
| `@flux-lang/core` | Flux parser, AST/IR, and runtime kernel. | [`packages/core/README.md`](packages/core/README.md) |
| `@flux-lang/editor-ui` | Web editor UI served by the viewer server. | [`packages/editor-ui/README.md`](packages/editor-ui/README.md) |
| `@flux-lang/flux` | Global launcher that keeps the CLI cached and updated. | [`packages/flux/README.md`](packages/flux/README.md) |
| `@flux-lang/render-html` | HTML/CSS renderer for RenderDocumentIR. | [`packages/render-html/README.md`](packages/render-html/README.md) |
| `@flux-lang/typesetter` | PDF typesetting backends for HTML output. | [`packages/typesetter/README.md`](packages/typesetter/README.md) |
| `@flux-lang/viewer` | Local web viewer + editor server. | [`packages/viewer/README.md`](packages/viewer/README.md) |
| `@flux-lang/vscode-flux` | VS Code syntax + diagnostics for Flux. | [`packages/vscode-flux/README.md`](packages/vscode-flux/README.md) |

## Support / community / discussions
- **Issues**: https://github.com/cbassuarez/flux/issues
- **Discussions**: TBD / Not yet implemented
- **Discord / community**: TBD / Not yet implemented
- **Security policy**: see [SECURITY.md](SECURITY.md)

## Contributing, Code of Conduct, Security
- Contributing guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](SECURITY.md)

## License
MIT — see [LICENSE](LICENSE).
