# Contributing to Flux

Flux is built as a monorepo. Contributions that keep determinism and IR stability intact are preferred.

## Ways to contribute
- **Code**: core runtime, renderers, viewer/editor, CLI, or VS Code extension.
- **Docs**: specs, package manuals, examples, and onboarding.
- **Examples**: real `.flux` documents that exercise new features.
- **Triage**: reproduce issues, add minimal repros, or improve labels.

## Prerequisites
- Node.js (see the `engines` fields in package.json files where applicable).
- pnpm (the repo uses `pnpm-lock.yaml`).

## Dev setup
```bash
pnpm install
```

## Build / test
Build everything (root script delegates to workspaces):

```bash
pnpm run build
```

Run workspace tests:

```bash
pnpm run test
```

Target a single workspace when iterating:

```bash
pnpm --filter @flux-lang/core run build
pnpm --filter @flux-lang/core run test
```

## Repo structure (quick map)
- `packages/` — packages for core, CLI, viewer, renderers, editor UI, and VS Code extension.
- `examples/` — real `.flux` documents used for demos and manual validation.
- `spec/` — language overview, grammar, semantics.
- `scripts/` — build helpers (e.g., editor dist sync).

## Making changes
- Keep PRs small and scoped; attach reproduction steps or fixtures.
- Preserve determinism and IR shape unless you are explicitly versioning a breaking change.
- Update docs and examples alongside behavioral changes.
- Prefer adding tests in the package you touched.

## Viewer / editor workflows
After building the CLI, you can run the viewer/editor against a document:

```bash
node packages/cli/dist/bin/flux.js view examples/viewer-demo.flux
node packages/cli/dist/bin/flux.js edit examples/viewer-demo.flux
```

To develop the editor UI directly:

```bash
pnpm --filter @flux-lang/editor-ui run dev
```

## Decisions and discussion
- File issues for bugs and feature proposals.
- If discussions are enabled later, link proposals there from issues.

## Good first issue
If no `good first issue` label exists yet, open an issue and tag it explicitly so it can be triaged.
