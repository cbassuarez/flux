# @flux-lang/cli

Command-line tools for the **Flux** score language.

This package provides the `flux` binary, built on top of `@flux-lang/core`, with:

- `flux parse` – parse Flux source files and print their IR as JSON.
- `flux check` – parse + run basic static checks (grids, neighbors, timers).

Flux is a small, declarative language for **procedurally evolving music scores and parts**. See the main repo for the full IR and language spec.

---

## Installation

Global install:

```bash
npm install -g @flux-lang/cli
````

Project-local (dev) install:

```bash
npm install --save-dev @flux-lang/cli
```

You can also use `npx` without installing globally.

---

## Commands

### `flux parse`

Parse one or more `.flux` files and print their IR as JSON.

```bash
flux parse example.flux
```

For a single file, the default output is pretty-printed JSON, e.g.:

```json
{
  "meta": {
    "version": "0.1.0",
    "title": "Example"
  },
  "state": {
    "params": []
  },
  "grids": [],
  "rules": []
}
```

Options:

* `--ndjson` – emit **one JSON object per line** `{ "file", "doc" }` (always used when parsing multiple files).
* `--pretty` – always pretty-print JSON (2-space indent).
* `--compact` – compact JSON with no extra whitespace.

You can also read from stdin using `-`:

```bash
cat example.flux | flux parse -
```

> Note: `-` (stdin) can only be used by itself (not mixed with other file paths).

---

### `flux check`

Parse `.flux` files and run basic static checks:

* Unknown `grid` references in rule scopes.
* Unsupported `neighbors.*` methods.
* Obvious runtime timer issues (`timer(...)` amount must be positive).
* A light `initRuntimeState` smoke-check to catch obviously invalid IR.

Basic usage:

```bash
flux check example.flux
```

If all files are OK:

```text
✓ 1 files OK
```

If some fail, diagnostics go to **stderr** and a summary to **stdout**:

```text
# stderr
example.flux:0:0: Check error: Rule 'oops' references unknown grid 'notAGrid'

# stdout
✗ 1 of 1 files failed checks
```

#### JSON / NDJSON output

You can get machine-readable diagnostics via:

```bash
flux check --json example.flux
```

This emits one JSON line per input file:

```json
{"file":"example.flux","ok":false,"errors":[{"message":"example.flux:0:0: Check error: Rule 'oops' references unknown grid 'notAGrid'"}]}
```

---

## Using with npm scripts / CI

Example `package.json` snippets:

```jsonc
{
  "scripts": {
    "flux:parse": "flux parse src/scores/*.flux",
    "flux:check": "flux check src/scores/*.flux"
  }
}
```

In CI, you can simply run:

```bash
npx flux check src/scores/*.flux
```

and treat a non-zero exit code as a failure.

---

## Relationship to `@flux-lang/core`

`@flux-lang/cli` is a thin wrapper around `@flux-lang/core`:

* `flux parse` calls `parseDocument` and prints the `FluxDocument` IR.
* `flux check` uses both the parser and `checkDocument` to validate documents.

If you want to embed Flux directly in a tool or runtime, prefer `@flux-lang/core`. If you want to wire Flux into scripts, CI, or quick local checks, use `@flux-lang/cli`.

---

## License

MIT – see the LICENSE file in the repo root.