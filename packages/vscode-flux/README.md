# Flux VS Code Extension

This extension adds first-class editor support for the **Flux** score language — a grid-based notation and rule language for spatial music and graphic scores.

## Features

- Syntax highlighting for `.flux` files:
    - Core keywords (`document`, `state`, `grid`, `cell`, `rule`, `when`, `then`, `runtime`, etc.).
    - Logical operators, event types, and the `neighbors.*` namespace.
- On-the-fly diagnostics powered by `@flux-lang/core`:
    - Parse errors surfaced as editor diagnostics.
    - Basic static checks (unknown `grid = ...`, invalid timers, unsupported `neighbors.*` methods).
- Plays nicely with the `flux` CLI:
    - `flux parse` → canonical IR JSON.
    - `flux check` → parse + static checks, same engine as the extension.

## Flux IR

Flux has a well-defined JSON IR (intermediate representation) that mirrors the TypeScript `FluxDocument` AST.

- IR docs: `packages/core/docs/flux-v0_1.md` (or wherever you’ve put the spec).
- Programmatically: `parseDocument(source)` from `@flux-lang/core` + `JSON.stringify`.

## Repository

This extension lives in the `flux` monorepo:

- GitHub: https://github.com/cbassuarez/flux
- Core library: `packages/core`
- CLI: `packages/cli`
- VS Code extension: `packages/vscode-flux`
