# Flux Language Overview (v0.1.0)

Flux is a domain-specific language for **live, evolving scores**.

A Flux document describes a score as a **stateful system** rather than a fixed artifact. The score’s visible notation, instructions, and media references emerge from an internal state that updates over **document steps (docsteps)** and **events** (performer input, sensors, transport, etc.). Performers read the current “frame” of the score while their actions can, in turn, modify that score.

Flux v0.1.0 is intentionally small and opinionated: a compact semantic kernel with a neutral, text-based DSL and a clear runtime model. It is designed to be embedded in tools and viewers, exported to other notations (e.g. LaTeX/PDF), and analyzed as a language in its own right.

## Core concepts

### Document

A Flux document is a single `.flux` file parsed into a `FluxDocument` AST. It contains:

- **Meta**: human-readable metadata and the **language version** (semver).
- **State**: a set of typed parameters (`param`) that describe global score state (tempo, density, docstep, etc.).
- **Page configuration**: page size and units.
- **Grids**: collections of **cells** arranged in a chosen topology (grid, linear, graph, spatial).
- **Rules**: local transformation rules that update cells and global params over time.
- **Runtime config**: how docsteps advance and how events are applied.

### State and parameters

The `state` block declares **global parameters** with:

- name (camelCase, case-sensitive),
- type (`int`, `float`, `bool`, `string`, `enum`),
- optional `[min, max]` range,
- initial value.

Parameters live in a single global map (`params`) accessible from rules. When rules attempt to write values outside the declared range, they are clamped to the boundary and a warning is emitted.

A special parameter `docstep` is typically used to track document time, but it is not reserved by the language; it is declared like any other param.

### Grids and cells

A **grid** is a collection of **cells** with a specified topology:

- `grid`: rectangular row/column neighborhood.
- `linear`: ordered list with left/right neighbors.
- `graph`: adjacency defined by explicit edges (extended later).
- `spatial`: neighbors defined by spatial distance (extended later).

Each cell has:

- `id`: unique identifier within its grid.
- `tags`: arbitrary labels (e.g. `noise`, `strings`, `text`).
- `content`: optional text or markup for display.
- `mediaId`: optional reference to an external media asset.
- `payload`: structured data describing symbolic music, audio clips, images, videos, etc.
- **Standard numeric fields**: `dynamic`, `density`, `salience`.
- **Arbitrary numeric fields**: `numericFields.<name>` for user-defined scalars.

Flux treats notation and layout as **surface concerns**. The language focuses on semantic cell behavior; a viewer or backend decides how to engrave or render `content` and media.

### Rules and the rule calculus

Flux rules describe **local transformations** over cells and parameters. They are:

- **Modeled as small programs** using a minimal expression and statement language.
- **Executed in a well-defined environment** containing `cell`, `neighbors`, `params`, and optionally `event`.

Rule modes:

- `docstep`: run once per document step, over every cell in scope.
- `event`: run when a matching event arrives.
- `timer`: run at fixed time intervals (from runtime configuration).

Rules are **ordered** as they appear in the document. When multiple rules assign to the same field in one evaluation cycle, **last assignment wins**, and a warning is emitted naming all contributing rules.

The rule calculus supports:

- literals, identifiers, property access,
- basic arithmetic, comparison, boolean operators,
- function calls (from a fixed standard library),
- assignments, let-bindings, `advanceDocstep()` as a special statement.

There is no looping or recursion; all rules are single-pass local transforms.

### Docsteps and evaluation

Flux uses **document steps (docsteps)** as the primary time axis for structural changes.

At each docstep, the runtime:

1. Takes a snapshot of current parameters and cell states.
2. For each grid and cell, evaluates all `docstep` rules in order, collecting proposed updates.
3. Merges updates with last-write-wins and conflict warnings.
4. Clamps parameter values to their declared ranges, emitting warnings when clamped.
5. Commits the new state as the next docstep.

Docsteps may be advanced by:

- timers (e.g. every 8 seconds),
- transport events (e.g. “nextSection”),
- explicit `advanceDocstep()` calls in rules (event/timer modes only).

### Events and user input

Flux models performer and environmental input as **events**:

```ts
type CanonicalEventType = "transport" | "input" | "sensor";
````

Each event has:

* `type`: canonical or user-defined string,
* `source`: role, device, or origin identifier,
* `location`: cell or spatial reference,
* `payload`: structured data,
* `timestamp`: performance time.

`event`-mode rules run whenever an event of a matching type arrives. By default:

* **Cell updates** from event rules are applied **immediately**.
* **Parameter updates** from event rules are **deferred** to the next docstep.

This hybrid policy can be overridden via `runtime.eventsApply`.

Events allow the score to respond to performers, audience, or sensors, making the document a **second-order cybernetic object**: it both shapes and is shaped by the performance.

### Runtime configuration

The `runtime` block configures:

* `eventsApply`:

  * `"immediate"`: all updates applied immediately.
  * `"deferred"`: all updates applied at next docstep.
  * default: hybrid (immediate cell, deferred params).
* `docstepAdvance`:

  * timer-based (e.g. `timer(8s)`),
  * transport triggers (e.g. `onTransport("nextSection")`),
  * rule-driven triggers (e.g. `onRuleRequest("advance")`).

Runtime configuration does not change the semantics of rules, only how often and when evaluation cycles occur.

## Design stance

Flux v0.1 is built around a **small, analyzable core**:

* **Neutral DSL**: no dependency on LaTeX or other host languages.
* **Explicit AST**: suitable for static analysis, tooling, and backends.
* **Local rules, global semantics**: simple rule calculus, clearly defined evaluation order and conflict handling.
* **Media-agnostic payloads**: support for symbolic music, audio, images, and video via structured payloads and media IDs.

The surface (engravings, viewers, editors) is intentionally left open.

### Versioning and stability

Flux uses semantic versioning, stored in `meta.version`. All `0.x` releases are considered **unstable**:

* Breaking changes may occur between minor versions.
* Implementations should warn when they encounter older versions and may choose not to support them fully.

The v0.1.0 spec focuses on:

* document structure,
* docstep and event semantics,
* rule calculus,
* payload and event schemas,
* error handling.

More advanced features (layered palimpsests, role systems, deep notation backends) are deferred to later versions.
