# Flux Semantics (v0.2.0)

This document defines Flux v0.2 document rendering semantics and preserves the v0.1 rule/runtime kernel semantics for compatibility.

## 0. Document rendering (v0.2)

Flux v0.2 introduces a **document body tree** and **assets**. Rendering produces a canonical **Render IR** that is deterministic for a given document, seed, time, and docstep.

### 0.1 Render inputs

Rendering is parameterized by:

- `seed`: deterministic RNG seed (integer).
- `time`: seconds since load (floating-point).
- `docstep`: document step index (integer).

### 0.2 Refresh policies

Each node has an optional `refresh` policy:

- `onLoad` (default): evaluate once at load.
- `onDocstep`: refresh when docstep changes.
- `every(30s)`: refresh on a time interval.
- `never`: evaluate once and never refresh.

If a node omits `refresh`, it **inherits** the nearest ancestor refresh policy. If no ancestor defines one, the default is `onLoad`.

`every(...)` is defined for time units (`ms`, `s`, `m`, `h`). Other units are implementation-defined.

For each node, the runtime computes a **refresh key**:

- `onLoad` / `never`: key = `0`
- `onDocstep`: key = current `docstep`
- `every(T)`: key = `floor(time / T)`

When the key changes, the node re-evaluates its dynamic properties. Otherwise, its last resolved values are retained.

### 0.3 Evaluation window (time/docstep freezing)

Dynamic expressions are evaluated in a **refresh window**:

- `onLoad` / `never`: `time = 0`, `docstep = 0`
- `onDocstep`: `time = current time`, `docstep = current docstep`
- `every(T)`: `time = floor(time / T) * T`, `docstep = current docstep`

When a node does **not** refresh, its last evaluation window is reused (time/docstep are effectively frozen), ensuring that unrelated changes do not leak into unchanged subtrees.

### 0.4 Deterministic randomness

All randomness is deterministic and scoped:

- `choose(list)` selects an element using a RNG derived from `(seed, node id/path, prop name, refresh key)`.
- `assets.pick(...)` uses the same deterministic RNG unless an explicit seed is provided.
- `stableHash(...)` returns a deterministic integer hash for use in expressions.

### 0.5 Render IR

Rendering produces a `RenderDocument` JSON object:

- `meta`, `seed`, `time`, `docstep`
- `assets`: resolved assets with stable IDs and paths
- `body`: resolved node tree (all dynamic props resolved to literals)

Ordering is stable: node order follows source order; assets are sorted by stable ID.

---

## 1. State model (legacy v0.1)

A Flux document is parsed into a `FluxDocument`:

- `meta`: metadata, including `version` (language version).
- `state`: global parameters (`params`).
- `pageConfig`: page size (does not affect semantics).
- `grids`: topological collections of `cells`.
- `rules`: ordered list of rules.
- `runtime`: configuration for event application and docstep advancement.

At runtime, the **score state** consists of:

- Current parameter map `params: name -> value`.
- Current grids and their cells `grids: name -> cells`.
- Pending parameter updates from events (when deferred).
- Pending docstep requests (from timers, transport, or rules).

## 2. Parameter semantics

Each parameter is declared as:

- `name`: identifier.
- `type`: `int | float | bool | string | enum`.
- `[min, max]`: inclusive bounds (optional; `inf` as open upper bound).
- `initial`: initial value.

### 2.1 Type checking

At load/compile time:

- Parameter declarations are type-checked for consistency (range bounds and initial value must match the declared type).
- Assignments to `params` within rules are checked, where possible, for type compatibility; static mismatches are hard errors.

At runtime:

- Assignments from `Expr` are evaluated; the result is checked against the parameter type. If incompatible, a runtime warning is emitted and the assignment is ignored.

### 2.2 Clamping

After each docstep evaluation (see §3), parameters are checked against their ranges:

- If a parameter value exceeds `max`, it is set to `max`.
- If a parameter value is below `min`, it is set to `min`.

For every clamping, the implementation MUST emit a warning specifying:

- parameter name,
- original value,
- clamped value,
- docstep index or event context.

When a range is omitted, no clamping occurs for that parameter.

## 3. Docstep evaluation

Docsteps represent discrete updates of the score state. A docstep runs the `docstep`-mode rules over all cells and parameters.

Let `S_n` be the state at docstep `n`. One docstep computes `S_{n+1}`.

### 3.1 Algorithm

1. **Snapshot**:  
   Create a snapshot of the current state:
   - `params_n`: copy of `params`,
   - `cells_n`: copy of all grids and their cells.

2. **Initialize update sets**:  
   For each cell and each param, maintain a list of **proposed updates** and the rules that produced them.

3. **Evaluate docstep rules**:  
   For each grid `G` and each cell `c` in `G`:
   - Construct a rule environment `Env`:
     - `cell`: snapshot of `c` from `cells_n`,
     - `neighbors`: a view providing neighborhood queries appropriate to the grid’s topology,
     - `params`: `params_n`,
     - no `event` binding.
   - For each rule `R` in `rules`, in document order:
     - If `R.mode != "docstep"`, skip.
     - If `R.scope.grid` is defined and not equal to `G.name`, skip.
     - Evaluate `R.condition` in `Env`. If it is `true`, execute `R.thenBranch`; otherwise, if present, execute `R.elseBranch`.
     - Each assignment to `cell` or `params` produces a proposed update (see §4).
   - Multiple rules may propose updates for the same field.

4. **Merge updates (last-write-wins)**:  
   For each cell/param field:
   - If no updates are proposed, the value remains as in `S_n`.
   - If one update is proposed, apply it.
   - If multiple updates are proposed:
     - Apply only the **last update**, according to rule order.
     - Emit a warning indicating:
       - the field name,
       - all rules that wrote to it in this docstep,
       - which rule “won”.

5. **Apply updates to compute provisional `S_{n+1}`**:  
   Apply merged updates to a working copy of `params` and `cells`.

6. **Clamp parameters**:  
   Apply clamping as described in §2.2.

7. **Commit state**:  
   The result is `S_{n+1}`:
   - `params := params_{n+1}`,
   - `grids := grids_{n+1}`.

A viewer may use `params.docstep` to track the docstep count, but the language does not require a reserved parameter; it is declared like any other.

## 4. Assignments and conflicts

Assignments to `cell` and `params` occur only inside rules via the rule calculus.

### 4.1 Assignment targets

An assignment statement:

```flux
LValue = Expr;
````

may target:

* `cell` fields (e.g. `cell.content`, `cell.tags`, `cell.dynamic`, `cell.numericFields.foo`),
* `params` fields (e.g. `params.tempo`),
* local identifiers (e.g. `let x = ...;` then `x = ...;`).

Assignments to local identifiers affect only the rule’s environment and do not persist.

Assignments to `cell` and `params` are recorded as **proposed updates** during rule evaluation and resolved as described in §3.4.

### 4.2 Write conflicts

If multiple rules write to the same field in one evaluation cycle (docstep or event evaluation batch):

* The last assignment (by rule order and execution path) determines the resulting value.
* An implementation MUST emit a warning:

  * including the field name,
  * the list of rule names that wrote to it,
  * the name of the winning rule.

This policy applies both to docstep and event rules.

## 5. Events

Events allow external input (performers, audience, sensors, transport) to influence the score.

### 5.1 Event structure

A `FluxEvent` has:

* `type: string` – canonical (`"transport"`, `"input"`, `"sensor"`) or user-defined.
* `source?: string` – origin of the event (role, device, etc.).
* `location?: any` – grid/cell reference or spatial coordinates (implementation-defined).
* `payload?: any` – structured data.
* `timestamp: number` – performance-time.

Event delivery and transport are out of scope for this document; they are configured in `runtime`.

### 5.2 Event rules

Rules with `mode = "event"` are evaluated when events arrive:

1. When an event `E` arrives:

   * Construct `Env` for rule evaluation, including:

     * `event`: `E`,
     * `params`: current parameters,
     * optional `cell` binding depending on the rule’s logic (e.g. `grid.main.nearestTo(event.location)`).

2. For each rule `R` in document order:

   * If `R.mode != "event"`, skip.
   * If `R.onEventType` is defined and not equal to `E.type`, skip.
   * Evaluate `R.condition` in `Env`. If `true`, execute `R.thenBranch`; otherwise, if present, execute `R.elseBranch`.
   * Record proposed updates to `cell` and `params` as in §3.3.

3. Merge updates according to the **event application policy** (§5.3).

### 5.3 Event application policy

Runtime configuration:

```flux
runtime {
  eventsApply = immediate | deferred;
}
```

* `eventsApply = immediate`:

  * All updates (cell and params) from event rules are applied immediately to the current state, with last-write-wins and conflict warnings.
* `eventsApply = deferred`:

  * All updates are queued and applied at the next docstep.

If `eventsApply` is omitted, the **hybrid policy** is used:

* **Cell updates** are applied immediately.
* **Parameter updates** are queued and applied at the next docstep.

Queued updates are merged using the same last-write-wins policy with warnings.

### 5.4 Integration with docsteps

Event-driven parameter updates that are deferred are merged into the docstep update process before clamping (i.e. they join the set of proposed updates in §3.3). Event-driven cell updates applied immediately modify the current state and are visible in subsequent docsteps as part of `S_n`.

## 6. Docstep advancement

Docstep advancement is configured via `runtime.docstepAdvance` and can also be triggered by rules.

### 6.1 Runtime-driven advancement

The `docstepAdvance` field is a list of specifications:

```flux
runtime {
  docstepAdvance = [
    timer(8s),
    onTransport("nextSection")
  ];
}
```

Implementations interpret these as:

* `timer(8s)`: schedule a docstep approximately every 8 seconds of performance time.
* `onTransport("nextSection")`: schedule a docstep when a transport event with matching payload arrives.
* `onRuleRequest("name")`: schedule a docstep when rules request it by name (implementation-defined extension).

Multiple mechanisms can coexist; any of them MAY request a docstep. When multiple requests occur before the next evaluation, they are coalesced into a single docstep.

### 6.2 Rule-driven advancement: `advanceDocstep()`

The special statement:

```flux
advanceDocstep();
```

may appear only in `event` or `timer` rules. Semantics:

* When executed during rule evaluation, it **requests** a docstep after the current batch of event/timer rule evaluations completes.
* If a docstep is already scheduled (e.g. by timer or another rule), additional requests are coalesced; only one docstep runs.

`advanceDocstep()` does not itself perform a docstep; it only ensures that one will occur as soon as possible according to the runtime’s scheduling.

## 7. Errors and warnings

Flux distinguishes between **hard errors** (load/compile-time) and **warnings** (runtime or non-fatal issues).

### 7.1 Hard errors (must abort)

The following conditions MUST be treated as hard errors that prevent a document from loading or running:

* Syntax errors: violations of the grammar defined in `spec/grammar.md`.
* Unknown identifiers in structural positions:

  * undefined parameters referenced in `params.*` assignments,
  * undefined grid names in `grid` references,
  * undefined cell IDs referenced by rules, when statically resolvable.
* Type mismatches that can be determined statically:

  * assigning a string literal to an `int` param,
  * using non-boolean expressions in positions requiring boolean (e.g. `when` condition), when types are known.
* Invalid payload declarations:

  * unknown payload kinds used where a built-in is required (`phrase`, `audio_clip`, `image`, `video`).

On a hard error, the implementation MUST report the error with location information and refuse to run the document.

### 7.2 Warnings (non-fatal)

The following conditions MUST generate warnings but do not prevent execution:

* Multiple assignments to the same `cell` or `params` field in one evaluation cycle (docstep or event). The warning must list:

  * field name,
  * contributing rule names,
  * winning rule.
* Parameter clamping:

  * value written outside the `[min, max]` range is clamped; warn with original and clamped values.
* Runtime type issues:

  * evaluation of `Expr` yields a value incompatible with the target type, when types are not statically known. The assignment is ignored, and a warning is emitted.
* Events with unexpected shapes:

  * missing optional fields (e.g. no `location` or `payload`), when rules can still run; rules should handle `null`/`undefined` gracefully.
  * extra fields in `payload` or `location` that are ignored by rules.

Implementations SHOULD provide a way to surface warnings to users (e.g. logs, debug overlays) but MUST NOT silently suppress them.

## 8. Topologies and neighborhoods

Neighborhood functions are topology-dependent:

* `grid`:

  * Neighborhood typically includes up, down, left, right, and optionally diagonals (implementation MAY provide different neighborhood functions).
* `linear`:

  * Neighborhood includes previous and next cells in the linear order.
* `graph`:

  * Neighborhood includes cells directly connected by edges (edge representation is an extension beyond v0.1).
* `spatial`:

  * Neighborhood defined by a distance threshold (implementation-defined).

Rules access neighborhood information via library functions (e.g. `neighbors.withTag("noise")`), which are part of the standard library, not the core grammar.

Precise neighborhood APIs are deferred to separate documentation; v0.1 only requires that `neighbors` is a well-defined view consistent within a document.

---

Flux v0.1 semantics intentionally focus on:

* deterministic, ordered rule evaluation,
* explicit conflict and clamping behavior,
* a simple yet expressive event model,
* and a crisp distinction between fatal errors and non-fatal warnings.

Later versions may extend this with richer topologies, layered palimpsests, role systems, and additional runtime behaviors.
